document.addEventListener('DOMContentLoaded', function () {
  const siteInput = document.getElementById('site-input');
  const addBtn = document.getElementById('add-btn');
  const blockedList = document.getElementById('blocked-list');
  const sitesCount = document.getElementById('sites-count');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importExportArea = document.getElementById('import-export-area');
  const toggleBlockBtn = document.getElementById('toggle-block-btn');

  // Distraction-Free Toggle
  const dfToggle = document.getElementById('df-toggle');

  // Shorts checkboxes
  const shortsCheckboxes = {
    youtube: document.getElementById('shorts-youtube'),
    instagram: document.getElementById('shorts-instagram'),
    tiktok: document.getElementById('shorts-tiktok'),
    facebook: document.getElementById('shorts-facebook')
  };

  // Initial load
  loadAndRenderBlockedSites();
  loadShortsSettings();
  loadDfSettings();

  // Load Distraction-Free state
  async function loadDfSettings() {
    const { dfSettings = { enabled: false } } = await chrome.storage.sync.get(['dfSettings']);
    if (dfToggle) {
      dfToggle.checked = !!(dfSettings && dfSettings.enabled);
    }
  }

  // Handle Distraction-Free Toggle
  if (dfToggle) {
    dfToggle.addEventListener('change', async function () {
      const updatedDf = { enabled: dfToggle.checked };
      await chrome.storage.sync.set({ dfSettings: updatedDf });
      chrome.runtime.sendMessage({ action: 'updateRules' }).catch(() => {});
    });
  }

  // Load Shorts settings
  async function loadShortsSettings() {
    const { shortsSettings = { youtube: true, instagram: true, tiktok: true, facebook: true } } =
      await chrome.storage.sync.get(['shortsSettings']);

    for (const [platform, checkbox] of Object.entries(shortsCheckboxes)) {
      if (checkbox) {
        checkbox.checked = shortsSettings[platform] !== false;
      }
    }
  }

  // Handle Shorts checkbox changes
  for (const [platform, checkbox] of Object.entries(shortsCheckboxes)) {
    if (checkbox) {
      checkbox.addEventListener('change', async function () {
        const { shortsSettings = { youtube: true, instagram: true, tiktok: true, facebook: true } } =
          await chrome.storage.sync.get(['shortsSettings']);

        const updatedSettings = {
          youtube: shortsSettings.youtube !== false,
          instagram: shortsSettings.instagram !== false,
          tiktok: shortsSettings.tiktok !== false,
          facebook: shortsSettings.facebook !== false,
          [platform]: checkbox.checked
        };

        await chrome.storage.sync.set({ shortsSettings: updatedSettings });
        chrome.runtime.sendMessage({ action: 'updateRules' }).catch(() => {});
      });
    }
  }

  // Add site to user custom list
  addBtn.addEventListener('click', async function () {
    let site = siteInput.value.trim();
    if (!site) return;

    site = site.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

    const { blockedSites = [] } = await chrome.storage.sync.get(['blockedSites']);

    if (!blockedSites.some(s => s.toLowerCase() === site.toLowerCase())) {
      const updated = [...blockedSites, site];
      await saveAndRenderBlockedSites(updated);
      siteInput.value = '';
    } else {
      alert('This site is already in your blocked list!');
    }
  });

  // Allow pressing Enter in the input field to add a site
  siteInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addBtn.click();
  });

  // Remove site from user custom list
  blockedList.addEventListener('click', async function (e) {
    if (e.target.classList.contains('remove-btn')) {
      const siteToRemove = e.target.dataset.site;
      const { blockedSites = [] } = await chrome.storage.sync.get(['blockedSites']);
      const updatedSites = blockedSites.filter(site => site !== siteToRemove);
      await saveAndRenderBlockedSites(updatedSites);
    }
  });

  // Export custom list
  exportBtn.addEventListener('click', async function () {
    const { blockedSites = [] } = await chrome.storage.sync.get(['blockedSites']);
    importExportArea.value = JSON.stringify(blockedSites, null, 2);
  });

  // Import custom list
  importBtn.addEventListener('click', async function () {
    try {
      const sites = JSON.parse(importExportArea.value);
      if (Array.isArray(sites)) {
        await saveAndRenderBlockedSites(sites);
        importExportArea.value = 'List imported successfully!';
      } else {
        importExportArea.value = 'Error: must be a JSON array of strings';
      }
    } catch (e) {
      importExportArea.value = 'Error: invalid JSON format';
    }
  });

  // Toggle current site in user custom list
  toggleBlockBtn.addEventListener('click', async function () {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    let currentSite;
    try {
      currentSite = new URL(tab.url).hostname.replace(/^www\./, '');
    } catch {
      return;
    }

    const { blockedSites = [] } = await chrome.storage.sync.get(['blockedSites']);
    const isBlocked = blockedSites.some(s => s.toLowerCase() === currentSite.toLowerCase());

    let updatedSites;
    if (isBlocked) {
      updatedSites = blockedSites.filter(s => s.toLowerCase() !== currentSite.toLowerCase());
      await saveAndRenderBlockedSites(updatedSites);
      await chrome.tabs.reload(tab.id);
    } else {
      updatedSites = [...blockedSites, currentSite];
      await saveAndRenderBlockedSites(updatedSites);
    }
  });

  async function updateToggleButton() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    let currentSite;
    try {
      currentSite = new URL(tab.url).hostname.replace(/^www\./, '');
    } catch {
      return;
    }

    const { blockedSites = [] } = await chrome.storage.sync.get(['blockedSites']);
    const isBlocked = blockedSites.some(s => s.toLowerCase() === currentSite.toLowerCase());

    if (isBlocked) {
      toggleBlockBtn.textContent = 'Unblock current site';
      toggleBlockBtn.classList.add('unblock');
    } else {
      toggleBlockBtn.textContent = 'Block current site';
      toggleBlockBtn.classList.remove('unblock');
    }
  }

  async function loadAndRenderBlockedSites() {
    const { blockedSites = [] } = await chrome.storage.sync.get(['blockedSites']);
    renderBlockedList(blockedSites);
    await updateToggleButton();
  }

  async function saveAndRenderBlockedSites(sites) {
    await chrome.storage.sync.set({ blockedSites: sites });
    renderBlockedList(sites);
    await updateToggleButton();
    chrome.runtime.sendMessage({ action: 'updateRules' }).catch(() => {});
  }

  function renderBlockedList(sites) {
    blockedList.innerHTML = '';

    if (sitesCount) {
      sitesCount.textContent = sites.length;
    }

    if (sites.length === 0) {
      blockedList.innerHTML = '<li class="empty-message">No custom sites added</li>';
      return;
    }

    sites.forEach(site => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="site-name">${site}</span>
        <button class="remove-btn" data-site="${site}">Remove</button>
      `;
      blockedList.appendChild(li);
    });
  }
});
