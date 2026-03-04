// Initialize default state on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['enabled', 'categories', 'savedShorts'], (result) => {
    const defaults = {};
    if (result.enabled === undefined) defaults.enabled = false;
    if (!result.categories) defaults.categories = ['Funny', 'Music', 'Tech', 'Cooking', 'Gaming', 'Fitness', 'DIY', 'Education'];
    if (!result.savedShorts) defaults.savedShorts = [];
    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults);
    }
  });
});

// Relay toggle messages from popup to all content script tabs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_EXTENSION') {
    chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://www.instagram.com/*'] }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  }

  if (message.type === 'SAVE_SHORT') {
    chrome.storage.local.get(['savedShorts'], (result) => {
      const shorts = result.savedShorts || [];
      const existing = shorts.find(s => s.link === message.data.link && s.category === message.data.category);
      if (existing) {
        // Same link + same category: update details (thumbnail, name, channel)
        existing.name = message.data.name || existing.name;
        existing.channelName = message.data.channelName || existing.channelName;
        existing.thumbnail = message.data.thumbnail || existing.thumbnail;
        existing.savedAt = new Date().toISOString();
        chrome.storage.local.set({ savedShorts: shorts }, () => {
          sendResponse({ success: true, updated: true });
        });
      } else {
        // Different category or new link: add as new entry
        shorts.push({ ...message.data, savedAt: new Date().toISOString() });
        chrome.storage.local.set({ savedShorts: shorts }, () => {
          sendResponse({ success: true });
        });
      }
    });
    return true; // keep channel open for async sendResponse
  }

  if (message.type === 'GET_CATEGORIES') {
    chrome.storage.local.get(['categories'], (result) => {
      sendResponse({ categories: result.categories || [] });
    });
    return true;
  }

  if (message.type === 'ADD_CATEGORY') {
    chrome.storage.local.get(['categories'], (result) => {
      const categories = result.categories || [];
      if (!categories.includes(message.category)) {
        categories.push(message.category);
        chrome.storage.local.set({ categories }, () => {
          sendResponse({ categories });
        });
      } else {
        sendResponse({ categories });
      }
    });
    return true;
  }

  if (message.type === 'REFRESH_THUMBNAILS') {
    (async () => {
      const result = await chrome.storage.local.get(['savedShorts']);
      const shorts = result.savedShorts || [];
      // Only refresh specified links (required)
      const links = message.links;
      if (!links || !Array.isArray(links) || links.length === 0) {
        sendResponse({ done: true, updated: 0, total: 0 });
        return;
      }
      const toRefresh = shorts.filter(s => links.includes(s.link));
      let updated = 0;

      for (const short of toRefresh) {
        try {
          const tab = await chrome.tabs.create({ url: short.link, active: false });

          await new Promise((resolve) => {
            function onUpdated(tabId, info) {
              if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(onUpdated);
                resolve();
              }
            }
            chrome.tabs.onUpdated.addListener(onUpdated);
          });

          await new Promise(r => setTimeout(r, 3000));

          try {
            const info = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SHORT_INFO' });
            if (info && info.thumbnail) {
              short.thumbnail = info.thumbnail;
              if (info.name && info.name !== 'Untitled Short' && info.name !== 'Untitled Reel') {
                short.name = info.name;
              }
              if (info.channelName && info.channelName !== 'Unknown Channel' && info.channelName !== 'Unknown User') {
                short.channelName = info.channelName;
              }
              updated++;
            }
          } catch (e) { /* content script not available */ }

          await chrome.tabs.remove(tab.id);
        } catch (e) { /* tab failed to open */ }
      }

      if (updated > 0) {
        await chrome.storage.local.set({ savedShorts: shorts });
      }
      sendResponse({ done: true, updated, total: toRefresh.length });
    })();
    return true;
  }

  if (message.type === 'EXPORT_DATA') {
    chrome.storage.local.get(['savedShorts', 'categories'], (result) => {
      sendResponse({
        savedShorts: result.savedShorts || [],
        categories: result.categories || []
      });
    });
    return true;
  }
});
