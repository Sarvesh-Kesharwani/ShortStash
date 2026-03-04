(() => {
  let isEnabled = false;
  let currentOverlay = null;

  // Load initial state
  chrome.storage.local.get(['enabled'], (result) => {
    isEnabled = result.enabled || false;
    if (isEnabled) startObserving();
  });

  // Listen for toggle from popup
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_EXTENSION') {
      isEnabled = message.enabled;
      if (isEnabled) {
        startObserving();
        injectButtons();
      } else {
        cleanup();
      }
    }
  });

  // --- Platform Detection ---
  function getPlatform() {
    const host = window.location.hostname;
    if (host.includes('youtube.com')) return 'youtube';
    if (host.includes('instagram.com')) return 'instagram';
    return null;
  }

  // --- YouTube Shorts helpers ---
  function getYouTubeShortInfo() {
    const url = window.location.href;
    if (!url.includes('/shorts/')) return null;

    const link = url.split('?')[0];
    const nameEl = document.querySelector(
      'yt-shorts-video-title-view-model .yt-core-attributed-string'
    ) || document.querySelector('#title h2') || document.querySelector('h2.title');
    const channelEl = document.querySelector(
      'ytd-channel-name yt-formatted-string a'
    ) || document.querySelector('.ytd-channel-name a');

    return {
      source: 'youtube',
      link,
      name: nameEl ? nameEl.textContent.trim() : 'Untitled Short',
      channelName: channelEl ? channelEl.textContent.trim() : 'Unknown Channel'
    };
  }

  // --- Instagram Reels helpers ---
  function getInstagramReelInfo() {
    const url = window.location.href;
    if (!url.includes('/reel') && !url.includes('/reels')) return null;

    const link = url.split('?')[0];
    const userEl = document.querySelector(
      'header a.x1i10hfl[role="link"]'
    ) || document.querySelector('a[href*="/"] span');
    const captionEl = document.querySelector('h1') || document.querySelector('span[dir="auto"]');

    return {
      source: 'instagram',
      link,
      name: captionEl ? captionEl.textContent.trim().slice(0, 80) : 'Untitled Reel',
      channelName: userEl ? userEl.textContent.trim() : 'Unknown User'
    };
  }

  function getShortInfo() {
    const platform = getPlatform();
    if (platform === 'youtube') return getYouTubeShortInfo();
    if (platform === 'instagram') return getInstagramReelInfo();
    return null;
  }

  // --- Plus Button ---
  function injectButtons() {
    if (!isEnabled) return;
    // Remove existing buttons first
    document.querySelectorAll('.shortstash-save-btn').forEach(el => el.remove());

    const info = getShortInfo();
    if (!info) return;

    const btn = document.createElement('button');
    btn.className = 'shortstash-save-btn';
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    btn.title = 'Save with ShortStash';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showCategoryPicker(info);
    });

    document.body.appendChild(btn);
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
        input.addEventListener('keydown', (e) => {
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
      if (response && response.success) {
        showToast('Saved!');
      } else if (response && response.reason === 'duplicate') {
        showToast('Already saved!');
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

  function startObserving() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(injectButtons, 500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    injectButtons();
  }

  function cleanup() {
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
