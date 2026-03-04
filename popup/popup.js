const toggle = document.getElementById('toggleExtension');
const statusLabel = document.getElementById('statusLabel');

// Load saved state
chrome.storage.local.get(['enabled'], (result) => {
  const enabled = result.enabled || false;
  toggle.checked = enabled;
  updateLabel(enabled);
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled });
  updateLabel(enabled);

  // Notify all content scripts of the state change
  chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION', enabled });
});

function updateLabel(enabled) {
  statusLabel.textContent = enabled ? 'Enabled' : 'Disabled';
  statusLabel.classList.toggle('active', enabled);
}
