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
      <td><a href="${escapeAttr(s.link)}" target="_blank" class="video-link" title="${escapeAttr(s.name)}">${escapeHtml(s.name)}</a></td>
      <td><span class="channel-name" title="${escapeAttr(s.channelName)}">${escapeHtml(s.channelName)}</span></td>
      <td><span class="source-badge ${s.source}">${s.source === 'youtube' ? 'YT' : 'IG'}</span></td>
      <td><span class="category-badge">${escapeHtml(s.category)}</span></td>
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
