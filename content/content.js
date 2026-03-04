(() => {
  let isEnabled = false;
  let currentOverlay = null;

  // Load initial state
  chrome.storage.local.get(['enabled'], (result) => {
    isEnabled = result.enabled || false;
    if (isEnabled) startObserving();
  });

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_EXTENSION') {
      isEnabled = message.enabled;
      if (isEnabled) {
        startObserving();
        injectButtonsForCurrentPage();
      } else {
        cleanup();
      }
    }
    if (message.type === 'GET_SHORT_INFO') {
      const info = getShortInfo();
      sendResponse(info);
    }
  });

  // --- Platform Detection ---
  function getPlatform() {
    const host = window.location.hostname;
    if (host.includes('youtube.com')) return 'youtube';
    if (host.includes('instagram.com')) return 'instagram';
    return null;
  }

  // --- Find the active/visible reel renderer ---
  function getActiveShortRenderer() {
    const renderers = document.querySelectorAll('ytd-reel-video-renderer');
    for (const r of renderers) {
      const rect = r.getBoundingClientRect();
      // The visible one occupies most of the viewport
      if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
        return r;
      }
    }
    return renderers[0] || null;
  }

  // --- YouTube Shorts helpers ---
  function getYouTubeShortInfo() {
    const url = window.location.href;
    if (!url.includes('/shorts/')) return null;

    const link = url.split('?')[0];
    const renderer = getActiveShortRenderer();
    const scope = renderer || document;

    // Title: try multiple known selectors
    const nameEl =
      scope.querySelector('yt-formatted-string#video-title') ||
      scope.querySelector('.title.ytd-reel-player-header-renderer') ||
      scope.querySelector('yt-shorts-video-title-view-model .yt-core-attributed-string') ||
      scope.querySelector('#title h2') ||
      document.querySelector('yt-formatted-string#video-title');

    // Channel: try multiple known selectors
    const channelEl =
      scope.querySelector('yt-formatted-string.ytd-channel-name a') ||
      scope.querySelector('yt-formatted-string.ytd-channel-name') ||
      scope.querySelector('ytd-channel-name a') ||
      scope.querySelector('.ytd-channel-name a') ||
      document.querySelector('ytd-channel-name yt-formatted-string a');

    // Thumbnail: derive from video ID
    const videoId = link.match(/\/shorts\/([^/?]+)/)?.[1] || '';
    const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

    return {
      source: 'youtube',
      link,
      name: nameEl ? nameEl.textContent.trim() : 'Untitled Short',
      channelName: channelEl ? channelEl.textContent.trim() : 'Unknown Channel',
      thumbnail
    };
  }

  // --- YouTube regular video helpers ---
  function getYouTubeVideoInfo() {
    const url = window.location.href;
    if (!url.includes('/watch')) return null;

    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('v');
    if (!videoId) return null;

    const link = `https://www.youtube.com/watch?v=${videoId}`;

    const nameEl =
      document.querySelector('yt-formatted-string.ytd-watch-metadata') ||
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
      document.querySelector('#title h1 yt-formatted-string') ||
      document.querySelector('h1.title');

    const channelEl =
      document.querySelector('ytd-channel-name yt-formatted-string a') ||
      document.querySelector('ytd-channel-name a') ||
      document.querySelector('#channel-name a');

    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      source: 'youtube',
      link,
      name: nameEl ? nameEl.textContent.trim() : 'Untitled Video',
      channelName: channelEl ? channelEl.textContent.trim() : 'Unknown Channel',
      thumbnail
    };
  }

  // --- Instagram Reels helpers ---
  function getInstagramReelInfo() {
    const url = window.location.href;
    if (!url.includes('/reel') && !url.includes('/reels')) return null;

    const link = url.split('?')[0];

    // Channel: look for username links near the reel
    const userEl =
      document.querySelector('header a[role="link"] span') ||
      document.querySelector('a[role="link"] > span[dir="auto"]') ||
      document.querySelector('header a.x1i10hfl[role="link"]');

    // Caption/title
    const captionEl =
      document.querySelector('h1._ap3a') ||
      document.querySelector('h1') ||
      document.querySelector('span[dir="auto"]._ap3a');

    // Thumbnail: find the currently visible/playing video, not just any video on page
    const thumbnail = (() => {
      // Try to find the playing video first (most reliable for current reel)
      const allVideos = [...document.querySelectorAll('video')];
      const playingVideo = allVideos.find(v => !v.paused && v.currentTime > 0);
      // Fall back to the video closest to viewport center
      const visibleVideo = allVideos.find(v => {
        const rect = v.getBoundingClientRect();
        return rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2;
      });
      const bestVideo = playingVideo || visibleVideo || allVideos[0];
      if (bestVideo && bestVideo.poster) return bestVideo.poster;
      // Fall back to og:image (page-level, may be stale on SPA)
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage && ogImage.content) return ogImage.content;
      return '';
    })();

    return {
      source: 'instagram',
      link,
      name: captionEl ? captionEl.textContent.trim().slice(0, 80) : 'Untitled Reel',
      channelName: userEl ? userEl.textContent.trim() : 'Unknown User',
      thumbnail
    };
  }

  function getShortInfo() {
    const platform = getPlatform();
    if (platform === 'youtube') return getYouTubeShortInfo() || getYouTubeVideoInfo();
    if (platform === 'instagram') return getInstagramReelInfo();
    return null;
  }

  // --- Plus Button ---
  function injectButtons() {
    if (!isEnabled) return;
    document.querySelectorAll('.shortstash-save-btn').forEach(el => el.remove());
    const info = getShortInfo();
    if (!info) return;
    injectSaveButton(info);
  }

  // --- Category Picker Overlay ---
  function showCategoryPicker(shortInfo) {
    if (currentOverlay) currentOverlay.remove();

    chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }, (response) => {
      const categories = response.categories || [];

      const overlay = document.createElement('div');
      overlay.className = 'shortstash-overlay';
      currentOverlay = overlay;

      const panel = document.createElement('div');
      panel.className = 'shortstash-panel';

      // Header
      const header = document.createElement('div');
      header.className = 'shortstash-panel-header';
      header.innerHTML = `
        <span class="shortstash-panel-title">Save to ShortStash</span>
        <button class="shortstash-close-btn">&times;</button>
      `;
      panel.appendChild(header);

      // Short info preview
      const preview = document.createElement('div');
      preview.className = 'shortstash-preview';
      preview.innerHTML = `
        <div class="shortstash-preview-name">${escapeHtml(shortInfo.name)}</div>
        <div class="shortstash-preview-channel">${escapeHtml(shortInfo.channelName)} &middot; ${shortInfo.source === 'youtube' ? 'YouTube' : 'Instagram'}</div>
      `;
      panel.appendChild(preview);

      // Category label
      const label = document.createElement('div');
      label.className = 'shortstash-label';
      label.textContent = 'Choose a category:';
      panel.appendChild(label);

      // Category grid
      const grid = document.createElement('div');
      grid.className = 'shortstash-category-grid';

      for (const cat of categories) {
        const catBtn = document.createElement('button');
        catBtn.className = 'shortstash-cat-btn';
        catBtn.textContent = cat;
        catBtn.addEventListener('click', () => saveShort(shortInfo, cat, overlay));
        grid.appendChild(catBtn);
      }

      // Add new category button
      const addBtn = document.createElement('button');
      addBtn.className = 'shortstash-cat-btn shortstash-cat-add';
      addBtn.textContent = '+ New';
      addBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.className = 'shortstash-new-cat-input';
        input.placeholder = 'Category name...';
        input.maxLength = 30;
        addBtn.replaceWith(input);
        input.focus();

        // Stop propagation so YouTube/Instagram don't swallow key events
        input.addEventListener('keydown', (e) => e.stopPropagation());
        input.addEventListener('keyup', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && input.value.trim()) {
            const newCat = input.value.trim();
            chrome.runtime.sendMessage({ type: 'ADD_CATEGORY', category: newCat }, () => {
              saveShort(shortInfo, newCat, overlay);
            });
          }
          if (e.key === 'Escape') {
            input.replaceWith(addBtn);
          }
        });
        input.addEventListener('blur', () => {
          const val = input.value.trim();
          if (val) {
            chrome.runtime.sendMessage({ type: 'ADD_CATEGORY', category: val }, () => {
              saveShort(shortInfo, val, overlay);
            });
          } else {
            input.replaceWith(addBtn);
          }
        });
      });
      grid.appendChild(addBtn);

      panel.appendChild(grid);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      // Close handlers
      header.querySelector('.shortstash-close-btn').addEventListener('click', () => {
        overlay.remove();
        currentOverlay = null;
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          currentOverlay = null;
        }
      });
    });
  }

  function saveShort(info, category, overlay) {
    const data = { ...info, category };
    chrome.runtime.sendMessage({ type: 'SAVE_SHORT', data }, (response) => {
      if (response && response.success && response.updated) {
        showToast('Updated!');
      } else if (response && response.success) {
        showToast('Saved!');
      }
      overlay.remove();
      currentOverlay = null;
    });
  }

  // --- Toast ---
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'shortstash-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // --- Utility ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- MutationObserver for SPA navigation ---
  let observer = null;
  let lastUrl = window.location.href;
  let retryTimerId = null;

  // Route injection based on page type
  function injectButtonsForCurrentPage() {
    if (retryTimerId !== null) {
      clearTimeout(retryTimerId);
      retryTimerId = null;
    }
    if (!isEnabled) return;
    if (window.location.href.includes('/watch')) {
      scheduleWatchInject(0);
    } else {
      setTimeout(injectButtons, 500);
    }
  }

  // Retry injection on watch pages until button survives YouTube's DOM hydration
  function scheduleWatchInject(attempt) {
    const MAX_ATTEMPTS = 8;
    const INTERVAL = 700;

    document.querySelectorAll('.shortstash-save-btn').forEach(el => el.remove());
    const info = getYouTubeVideoInfo();
    if (!info) return; // navigated away

    injectSaveButton(info);

    if (attempt < MAX_ATTEMPTS) {
      retryTimerId = setTimeout(() => {
        retryTimerId = null;
        if (!isEnabled || !window.location.href.includes('/watch')) return;
        const buttonGone = !document.querySelector('.shortstash-save-btn');
        const freshInfo = getYouTubeVideoInfo();
        const titleStillLoading = !freshInfo || freshInfo.name === 'Untitled Video';
        // Keep retrying if button was removed OR title is still loading (first 4 attempts)
        if (buttonGone || (titleStillLoading && attempt < 4)) {
          scheduleWatchInject(attempt + 1);
        }
      }, INTERVAL);
    }
  }

  // Shared button factory
  function injectSaveButton(info) {
    const btn = document.createElement('button');
    btn.className = 'shortstash-save-btn';
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    btn.title = 'Save with ShortStash';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Get fresh info at click time so title/channel are up-to-date
      showCategoryPicker(getShortInfo() || info);
    });
    document.body.appendChild(btn);
  }

  function startObserving() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        injectButtonsForCurrentPage();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    injectButtonsForCurrentPage();
  }

  function cleanup() {
    if (retryTimerId !== null) {
      clearTimeout(retryTimerId);
      retryTimerId = null;
    }
    document.querySelectorAll('.shortstash-save-btn').forEach(el => el.remove());
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
})();
