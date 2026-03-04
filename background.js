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

  // --- Google Drive ---

  if (message.type === 'DRIVE_SIGN_IN') {
    (async () => {
      try {
        await getDriveToken(true);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.toString() });
      }
    })();
    return true;
  }

  if (message.type === 'DRIVE_STATUS') {
    chrome.storage.local.get(['driveToken'], (result) => {
      const t = result.driveToken;
      sendResponse({ signedIn: !!(t && t.access_token && t.expires_at > Date.now() + 60000) });
    });
    return true;
  }

  if (message.type === 'DRIVE_BACKUP') {
    (async () => {
      try {
        const token = await getDriveToken(true);
        const result = await chrome.storage.local.get(['savedShorts', 'categories']);
        const payload = {
          backedUpAt: new Date().toISOString(),
          version: '1.4.0',
          savedShorts: result.savedShorts || [],
          categories: result.categories || []
        };
        const existing = await findDriveBackupFile(token);
        const file = await uploadToDrive(token, payload, existing?.id);
        sendResponse({ success: true, fileId: file.id, backedUpAt: payload.backedUpAt });
      } catch (err) {
        sendResponse({ success: false, error: err.toString() });
      }
    })();
    return true;
  }

  if (message.type === 'DRIVE_RESTORE') {
    (async () => {
      try {
        const token = await getDriveToken(true);
        const file = await findDriveBackupFile(token);
        if (!file) {
          sendResponse({ success: false, error: 'No backup found on Google Drive.' });
          return;
        }
        const resp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Drive read failed (${resp.status})`);
        }
        const data = await resp.json();
        if (!Array.isArray(data.savedShorts) || !Array.isArray(data.categories)) {
          sendResponse({ success: false, error: 'Backup file is malformed.' });
          return;
        }
        await chrome.storage.local.set({ savedShorts: data.savedShorts, categories: data.categories });
        sendResponse({ success: true, savedShorts: data.savedShorts, categories: data.categories, backedUpAt: data.backedUpAt });
      } catch (err) {
        sendResponse({ success: false, error: err.toString() });
      }
    })();
    return true;
  }

  if (message.type === 'DRIVE_SIGN_OUT') {
    chrome.storage.local.get(['driveToken'], (result) => {
      const t = result.driveToken;
      const clear = () => chrome.storage.local.remove('driveToken', () => sendResponse({ success: true }));
      if (t && t.access_token) {
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${t.access_token}`).finally(clear);
      } else {
        clear();
      }
    });
    return true;
  }
});

// --- Drive Helpers ---

function getDriveToken(interactive) {
  return new Promise((resolve, reject) => {
    // Check cached token first
    chrome.storage.local.get(['driveToken'], (cached) => {
      const t = cached.driveToken;
      if (t && t.access_token && t.expires_at > Date.now() + 60000) {
        resolve(t.access_token);
        return;
      }
      if (!interactive) {
        reject(new Error('Not signed in'));
        return;
      }

      // Use web auth flow — works without Chrome browser sign-in
      const clientId = chrome.runtime.getManifest().oauth2?.client_id;
      if (!clientId || clientId.startsWith('YOUR_')) {
        reject(new Error('OAuth client_id not configured in manifest.json'));
        return;
      }
      const redirectUri = chrome.identity.getRedirectURL();
      const authUrl = 'https://accounts.google.com/o/oauth2/auth?' + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: 'https://www.googleapis.com/auth/drive.file',
        prompt: 'select_account'
      });

      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'Sign-in cancelled'));
          return;
        }
        try {
          const params = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
          const token = params.get('access_token');
          const expiresIn = parseInt(params.get('expires_in') || '3600');
          if (!token) throw new Error('No access token in response');
          chrome.storage.local.set({
            driveToken: { access_token: token, expires_at: Date.now() + expiresIn * 1000 }
          });
          resolve(token);
        } catch (e) {
          reject(e);
        }
      });
    });
  });
}

async function findDriveBackupFile(token) {
  const q = encodeURIComponent("name='shortstash_backup.json' and trashed=false");
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || `Drive search failed (${resp.status})`);
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

async function uploadToDrive(token, content, existingFileId) {
  const boundary = 'shortstash_mp_boundary';
  const body = JSON.stringify(content);
  const metadata = JSON.stringify({ name: 'shortstash_backup.json', mimeType: 'application/json' });
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const resp = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipart
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || `Drive upload failed (${resp.status})`);
  return data;
}
