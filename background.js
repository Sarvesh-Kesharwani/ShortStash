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
