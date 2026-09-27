document.addEventListener('DOMContentLoaded', function () {
  const { normalizeDomain, siteMatches, getLocalStorage, getSessionStorage } = SiteBlockerUtils;
  const localStorage = getLocalStorage();
  const sessionStorage = getSessionStorage();

  const siteInput = document.getElementById('site-input');
  const addBtn = document.getElementById('add-btn');
  const blockedList = document.getElementById('blocked-list');
  const sitesCount = document.getElementById('sites-count');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importExportArea = document.getElementById('import-export-area');
  const toggleBlockBtn = document.getElementById('toggle-block-btn');
  const dfToggle = document.getElementById('df-toggle');

  const shortsCheckboxes = {
    youtube: document.getElementById('shorts-youtube'),
    instagram: document.getElementById('shorts-instagram'),
    tiktok: document.getElementById('shorts-tiktok'),
    facebook: document.getElementById('shorts-facebook')
  };

  loadAndRenderBlockedSites();
  loadShortsSettings();
  loadDfSettings();

  async function loadDfSettings() {
    if (!localStorage) return;
    const { dfSettings = { enabled: false } } = await localStorage.get(['dfSettings']);
    if (dfToggle) {
      dfToggle.checked = !!(dfSettings && dfSettings.enabled);
    }
  }

  if (dfToggle && localStorage) {
    dfToggle.addEventListener('change', async function () {
      const updatedDf = { enabled: dfToggle.checked };
      await localStorage.set({ dfSettings: updatedDf });
    });
  }

  async function loadShortsSettings() {
    if (!localStorage) return;
    const { shortsSettings = { youtube: false, instagram: false, tiktok: false, facebook: false } } =
      await localStorage.get(['shortsSettings']);

    for (const [platform, checkbox] of Object.entries(shortsCheckboxes)) {
      if (checkbox) {
        checkbox.checked = shortsSettings[platform] === true;
      }
    }
  }

  for (const [platform, checkbox] of Object.entries(shortsCheckboxes)) {
    if (checkbox && localStorage) {
      checkbox.addEventListener('change', async function () {
        const { shortsSettings = { youtube: false, instagram: false, tiktok: false, facebook: false } } =
          await localStorage.get(['shortsSettings']);

        const updatedSettings = {
          ...shortsSettings,
          [platform]: checkbox.checked
        };

        await localStorage.set({ shortsSettings: updatedSettings });
        if (sessionStorage) {
          await sessionStorage.set({ tempBypasses: {} });
        }
      });
    }
  }

  addBtn.addEventListener('click', async function () {
    if (!localStorage) return;

    const rawInput = siteInput.value.trim();
    if (!rawInput) return;

    const normalizedSite = normalizeDomain(rawInput);
    if (!normalizedSite) {
      alert('Please enter a valid domain name (e.g. example.com or reddit.com)');
      return;
    }

    const { blockedSites = [] } = await localStorage.get(['blockedSites']);

    if (!blockedSites.some(s => s.toLowerCase() === normalizedSite.toLowerCase())) {
      const updated = [...blockedSites, normalizedSite];
      await saveAndRenderBlockedSites(updated);
      siteInput.value = '';
    } else {
      alert('This site is already in your blocked list!');
    }
  });

  siteInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addBtn.click();
  });

  blockedList.addEventListener('click', async function (e) {
    if (e.target.classList.contains('remove-btn') && localStorage) {
      const siteToRemove = e.target.dataset.site;
      const { blockedSites = [] } = await localStorage.get(['blockedSites']);
      const updatedSites = blockedSites.filter(site => site !== siteToRemove);
      await saveAndRenderBlockedSites(updatedSites);
    }
  });

  exportBtn.addEventListener('click', async function () {
    if (!localStorage) return;
    const { blockedSites = [] } = await localStorage.get(['blockedSites']);
    importExportArea.value = JSON.stringify(blockedSites, null, 2);
  });

  importBtn.addEventListener('click', async function () {
    if (!localStorage) return;

    try {
      const rawText = importExportArea.value.trim();
      if (!rawText) {
        importExportArea.value = 'Error: please paste JSON data to import';
        return;
      }

      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) {
        importExportArea.value = 'Error: input must be a JSON array of domain strings (e.g. ["example.com", "site.org"])';
        return;
      }

      const validatedSites = [];
      const seen = new Set();
      let skippedCount = 0;

      for (const item of parsed) {
        if (typeof item !== 'string') {
          skippedCount++;
          continue;
        }

        const cleanDomain = normalizeDomain(item);
        if (cleanDomain && !seen.has(cleanDomain)) {
          seen.add(cleanDomain);
          validatedSites.push(cleanDomain);
        } else {
          skippedCount++;
        }
      }

      if (validatedSites.length === 0) {
        importExportArea.value = 'Error: no valid domains found in the imported array';
        return;
      }

      await saveAndRenderBlockedSites(validatedSites);
      const msg = skippedCount > 0
        ? `Imported ${validatedSites.length} domains (${skippedCount} invalid/duplicate items skipped).`
        : `Successfully imported ${validatedSites.length} domains!`;
      importExportArea.value = msg;
    } catch (e) {
      importExportArea.value = 'Error: invalid JSON format';
    }
  });

  toggleBlockBtn.addEventListener('click', async function () {
    if (!localStorage) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    let currentSite;
    try {
      currentSite = normalizeDomain(new URL(tab.url).hostname);
    } catch {
      return;
    }

    if (!currentSite) return;

    const { blockedSites = [] } = await localStorage.get(['blockedSites']);
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
    if (!localStorage) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    let currentSite;
    try {
      currentSite = normalizeDomain(new URL(tab.url).hostname);
    } catch {
      toggleBlockBtn.disabled = true;
      return;
    }

    if (!currentSite) {
      toggleBlockBtn.disabled = true;
      return;
    }

    toggleBlockBtn.disabled = false;
    const { blockedSites = [] } = await localStorage.get(['blockedSites']);
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
    if (!localStorage) return;
    const { blockedSites = [] } = await localStorage.get(['blockedSites']);
    renderBlockedList(blockedSites);
    await updateToggleButton();
  }

  async function saveAndRenderBlockedSites(sites) {
    if (!localStorage) return;
    await localStorage.set({ blockedSites: sites });
    renderBlockedList(sites);
    await updateToggleButton();
  }

  function renderBlockedList(sites) {
    blockedList.innerHTML = '';

    if (sitesCount) {
      sitesCount.textContent = sites.length;
    }

    if (!Array.isArray(sites) || sites.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'empty-message';
      emptyLi.textContent = 'No custom sites added';
      blockedList.appendChild(emptyLi);
      return;
    }

    sites.forEach(site => {
      const li = document.createElement('li');

      const span = document.createElement('span');
      span.className = 'site-name';
      span.textContent = site;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.dataset.site = site;
      removeBtn.textContent = 'Remove';

      li.appendChild(span);
      li.appendChild(removeBtn);
      blockedList.appendChild(li);
    });
  }
});
