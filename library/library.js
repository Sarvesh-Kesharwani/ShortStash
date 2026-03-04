let allShorts = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery = '';

const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const categoryTabs = document.getElementById('categoryTabs');
const statsRow = document.getElementById('statsRow');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const manageCatsBtn = document.getElementById('manageCatsBtn');

// Load data
chrome.storage.local.get(['savedShorts', 'categories'], (result) => {
  allShorts = result.savedShorts || [];
  allCategories = result.categories || [];
  render();
});

// Search
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  render();
});

// Export
exportBtn.addEventListener('click', () => {
  const data = {
    exportedAt: new Date().toISOString(),
    categories: allCategories,
    savedShorts: allShorts
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shortstash_library_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Manage Categories
manageCatsBtn.addEventListener('click', openCategoryManager);

function openCategoryManager() {
  // Remove existing modal if any
  const existing = document.querySelector('.cat-manager-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'cat-manager-overlay';

  const modal = document.createElement('div');
  modal.className = 'cat-manager-modal';

  modal.innerHTML = `
    <div class="cat-manager-header">
      <span class="cat-manager-title">Manage Categories</span>
      <button class="cat-manager-close">&times;</button>
    </div>
    <div class="cat-manager-list" id="catManagerList"></div>
    <div class="cat-manager-add-row">
      <input type="text" class="cat-manager-input" id="newCatInput" placeholder="New category name..." maxlength="30">
      <button class="cat-manager-add-btn" id="addCatBtn">Add</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  renderCategoryList();

  // Close handlers
  modal.querySelector('.cat-manager-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Add category
  const newCatInput = document.getElementById('newCatInput');
  const addCatBtn = document.getElementById('addCatBtn');

  function addNewCategory() {
    const name = newCatInput.value.trim();
    if (!name) return;
    if (allCategories.includes(name)) {
      newCatInput.value = '';
      return;
    }
    allCategories.push(name);
    saveCategories();
    newCatInput.value = '';
    renderCategoryList();
  }

  addCatBtn.addEventListener('click', addNewCategory);
  newCatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addNewCategory();
  });
}

function renderCategoryList() {
  const list = document.getElementById('catManagerList');
  if (!list) return;

  // Count usage per category
  const counts = {};
  for (const s of allShorts) {
    counts[s.category] = (counts[s.category] || 0) + 1;
  }

  if (allCategories.length === 0) {
    list.innerHTML = '<div class="cat-manager-empty">No categories yet.</div>';
    return;
  }

  list.innerHTML = allCategories.map((cat, i) => `
    <div class="cat-manager-item" data-index="${i}">
      <span class="cat-manager-name">${escapeHtml(cat)}</span>
      <span class="cat-manager-count">${counts[cat] || 0} videos</span>
      <div class="cat-manager-actions">
        <button class="cat-mgr-btn cat-rename-btn" data-cat="${escapeAttr(cat)}" title="Rename">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="cat-mgr-btn cat-delete-btn" data-cat="${escapeAttr(cat)}" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  // Rename handlers
  list.querySelectorAll('.cat-rename-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const oldName = btn.dataset.cat;
      const item = btn.closest('.cat-manager-item');
      const nameSpan = item.querySelector('.cat-manager-name');
      const input = document.createElement('input');
      input.className = 'cat-manager-rename-input';
      input.value = oldName;
      input.maxLength = 30;
      nameSpan.replaceWith(input);
      input.focus();
      input.select();

      function commitRename() {
        const newName = input.value.trim();
        if (newName && newName !== oldName && !allCategories.includes(newName)) {
          const idx = allCategories.indexOf(oldName);
          if (idx !== -1) allCategories[idx] = newName;
          // Update all shorts with old category
          allShorts.forEach(s => {
            if (s.category === oldName) s.category = newName;
          });
          chrome.storage.local.set({ savedShorts: allShorts });
          saveCategories();
          if (activeCategory === oldName) activeCategory = newName;
          render();
        }
        renderCategoryList();
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') renderCategoryList();
      });
      input.addEventListener('blur', commitRename);
    });
  });

  // Delete handlers
  list.querySelectorAll('.cat-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const count = counts[cat] || 0;
      const msg = count > 0
        ? `Delete "${cat}"? ${count} video(s) in this category will become uncategorized.`
        : `Delete "${cat}"?`;
      if (!confirm(msg)) return;
      allCategories = allCategories.filter(c => c !== cat);
      if (count > 0) {
        allShorts.forEach(s => {
          if (s.category === cat) s.category = 'Uncategorized';
        });
        chrome.storage.local.set({ savedShorts: allShorts });
      }
      saveCategories();
      if (activeCategory === cat) activeCategory = 'all';
      render();
      renderCategoryList();
    });
  });
}

function saveCategories() {
  chrome.storage.local.set({ categories: allCategories });
}

function render() {
  renderStats();
  renderTabs();
  renderTable();
}

function getFilteredShorts() {
  let filtered = allShorts;
  if (activeCategory !== 'all') {
    filtered = filtered.filter(s => s.category === activeCategory);
  }
  if (searchQuery) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(searchQuery) ||
      s.channelName.toLowerCase().includes(searchQuery) ||
      s.category.toLowerCase().includes(searchQuery)
    );
  }
  return filtered;
}

function renderStats() {
  const ytCount = allShorts.filter(s => s.source === 'youtube').length;
  const igCount = allShorts.filter(s => s.source === 'instagram').length;
  const catCount = [...new Set(allShorts.map(s => s.category))].length;

  statsRow.innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${allShorts.length}</span>
      <span class="stat-label">Total Saved</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${ytCount}</span>
      <span class="stat-label">YouTube</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${igCount}</span>
      <span class="stat-label">Instagram</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${catCount}</span>
      <span class="stat-label">Categories</span>
    </div>
  `;
}

function renderTabs() {
  // Count per category
  const counts = {};
  for (const s of allShorts) {
    counts[s.category] = (counts[s.category] || 0) + 1;
  }

  let html = `<button class="cat-tab ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">All<span class="tab-count">${allShorts.length}</span></button>`;

  // Show categories that have saved shorts, in order
  const usedCategories = allCategories.filter(c => counts[c]);
  for (const cat of usedCategories) {
    html += `<button class="cat-tab ${activeCategory === cat ? 'active' : ''}" data-cat="${escapeAttr(cat)}">${escapeHtml(cat)}<span class="tab-count">${counts[cat]}</span></button>`;
  }
  // Show Uncategorized tab if any exist
  if (counts['Uncategorized']) {
    html += `<button class="cat-tab ${activeCategory === 'Uncategorized' ? 'active' : ''}" data-cat="Uncategorized">Uncategorized<span class="tab-count">${counts['Uncategorized']}</span></button>`;
  }

  categoryTabs.innerHTML = html;

  // Attach click handlers
  categoryTabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      render();
    });
  });
}

function renderTable() {
  const filtered = getFilteredShorts();

  if (filtered.length === 0) {
    tableBody.innerHTML = '';
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');

  // Sort by savedAt descending
  const sorted = [...filtered].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  tableBody.innerHTML = sorted.map((s, i) => `
    <tr>
      <td><div class="thumb-cell">${getThumbnailHtml(s)}</div></td>
      <td><span class="source-badge ${s.source}">${s.source === 'youtube' ? 'YT' : 'IG'}</span></td>
      <td><button class="category-badge reassign-btn ${s.category === 'Uncategorized' ? 'uncategorized' : ''}" data-link="${escapeAttr(s.link)}">${escapeHtml(s.category)}</button></td>
      <td><a href="${escapeAttr(s.link)}" target="_blank" class="video-link" title="${escapeAttr(s.link)}">Open</a></td>
      <td><span class="date-text">${formatDate(s.savedAt)}</span></td>
      <td style="text-align:center"><button class="delete-btn" data-link="${escapeAttr(s.link)}" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button></td>
    </tr>
  `).join('');

  // Delete handlers
  tableBody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const link = btn.dataset.link;
      allShorts = allShorts.filter(s => s.link !== link);
      chrome.storage.local.set({ savedShorts: allShorts }, () => render());
    });
  });

  // Reassign category handlers
  tableBody.querySelectorAll('.reassign-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Remove any existing dropdown
      document.querySelectorAll('.reassign-dropdown').forEach(d => d.remove());

      const link = btn.dataset.link;
      const rect = btn.getBoundingClientRect();

      const dropdown = document.createElement('div');
      dropdown.className = 'reassign-dropdown';
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.left = `${rect.left}px`;

      for (const cat of allCategories) {
        const opt = document.createElement('button');
        opt.className = 'reassign-option';
        opt.textContent = cat;
        opt.addEventListener('click', () => {
          const short = allShorts.find(s => s.link === link);
          if (short) {
            short.category = cat;
            chrome.storage.local.set({ savedShorts: allShorts }, () => render());
          }
          dropdown.remove();
        });
        dropdown.appendChild(opt);
      }

      document.body.appendChild(dropdown);

      // Close on outside click
      function closeDropdown(ev) {
        if (!dropdown.contains(ev.target)) {
          dropdown.remove();
          document.removeEventListener('click', closeDropdown);
        }
      }
      setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    });
  });
}

function getThumbnailHtml(s) {
  // Use stored thumbnail (captured at save time)
  if (s.thumbnail) {
    return `<img src="${escapeAttr(s.thumbnail)}" alt="" class="thumb-img" loading="lazy">`;
  }
  // Fallback for YouTube: derive from video ID
  if (s.source === 'youtube') {
    const ytMatch = s.link && s.link.match(/\/shorts\/([^/?]+)/);
    if (ytMatch) {
      return `<img src="https://i.ytimg.com/vi/${escapeAttr(ytMatch[1])}/hqdefault.jpg" alt="" class="thumb-img" loading="lazy">`;
    }
  }
  // No thumbnail available — placeholder
  return `<div class="thumb-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="3"/><polygon points="10,8 16,12 10,16" fill="#555" stroke="none"/></svg></div>`;
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const day = d.getDate().toString().padStart(2, '0');
  const mon = d.toLocaleString('en', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${mon} ${year}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
