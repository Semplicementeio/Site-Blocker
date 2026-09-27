if (typeof SiteBlockerUtils === 'undefined' && typeof importScripts === 'function') {
  importScripts('utils.js');
}

const REDIRECT_URL = chrome.runtime.getURL('blocked.html');
const { DISTRACTION_FREE_SITES, normalizeDomain, siteMatches, isUrlBypassed, getSessionStorage, getLocalStorage } = SiteBlockerUtils;

async function getTempBypasses() {
  const sessionStorage = getSessionStorage();
  if (!sessionStorage) return {};

  const { tempBypasses = {} } = await sessionStorage.get(['tempBypasses']);
  const now = Date.now();
  const validBypasses = {};
  let cleaned = false;

  for (const [domain, expiresAt] of Object.entries(tempBypasses)) {
    if (typeof expiresAt === 'number' && expiresAt > now) {
      validBypasses[domain] = expiresAt;
    } else {
      cleaned = true;
    }
  }

  if (cleaned) {
    sessionStorage.set({ tempBypasses: validBypasses }).catch(() => {});
  }

  return validBypasses;
}

function redirectTabIfBlocked(tab, validBypasses, blockedSitesList = [], dfActive = false, shortsActive = null) {
  if (
    !tab ||
    !tab.id ||
    !tab.url ||
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('moz-extension://') ||
    tab.url.startsWith('about:')
  ) {
    return;
  }

  let tabUrl;
  try {
    tabUrl = new URL(tab.url);
  } catch {
    return;
  }

  if (isUrlBypassed(tabUrl, validBypasses)) {
    return;
  }

  const hostname = tabUrl.hostname;
  let shouldBlock = false;

  if (blockedSitesList.some(site => siteMatches(hostname, site))) {
    shouldBlock = true;
  }

  if (!shouldBlock && dfActive && DISTRACTION_FREE_SITES.some(site => siteMatches(hostname, site))) {
    shouldBlock = true;
  }

  if (!shouldBlock && shortsActive) {
    if (shortsActive.youtube && siteMatches(hostname, 'youtube.com') && tabUrl.pathname.startsWith('/shorts')) {
      shouldBlock = true;
    }
    if (shortsActive.instagram && siteMatches(hostname, 'instagram.com') && (tabUrl.pathname.startsWith('/reels') || tabUrl.pathname.startsWith('/reel'))) {
      shouldBlock = true;
    }
    if (shortsActive.tiktok && siteMatches(hostname, 'tiktok.com')) {
      shouldBlock = true;
    }
    if (shortsActive.facebook && siteMatches(hostname, 'facebook.com') && (tabUrl.pathname.startsWith('/reel') || tabUrl.pathname.startsWith('/reels'))) {
      shouldBlock = true;
    }
  }

  if (shouldBlock) {
    const dest = REDIRECT_URL + '?url=' + encodeURIComponent(tab.url);
    chrome.tabs.update(tab.id, { url: dest }).catch(() => {});
  }
}

async function checkAndRedirectAffectedTabs({ addedSites = [], dfActivated = false, newlyEnabledShorts = [] } = {}) {
  try {
    const validBypasses = await getTempBypasses();

    if (addedSites.length > 0) {
      for (const site of addedSites) {
        const patterns = [`*://*.${site}/*`, `*://${site}/*`];
        const tabs = await chrome.tabs.query({ url: patterns });
        for (const tab of tabs) {
          redirectTabIfBlocked(tab, validBypasses, [site]);
        }
      }
    }

    if (dfActivated) {
      const patterns = DISTRACTION_FREE_SITES.flatMap(s => [`*://*.${s}/*`, `*://${s}/*`]);
      const tabs = await chrome.tabs.query({ url: patterns });
      for (const tab of tabs) {
        redirectTabIfBlocked(tab, validBypasses, [], true);
      }
    }

    if (newlyEnabledShorts.length > 0) {
      for (const platform of newlyEnabledShorts) {
        let pattern = null;
        if (platform === 'youtube') pattern = '*://*.youtube.com/shorts*';
        else if (platform === 'instagram') pattern = '*://*.instagram.com/*';
        else if (platform === 'tiktok') pattern = '*://*.tiktok.com/*';
        else if (platform === 'facebook') pattern = '*://*.facebook.com/*';

        if (pattern) {
          const tabs = await chrome.tabs.query({ url: pattern });
          for (const tab of tabs) {
            redirectTabIfBlocked(tab, validBypasses, [], false, { [platform]: true });
          }
        }
      }
    }
  } catch (e) {
    console.error('Error redirecting affected tabs:', e);
  }
}

async function migrateFromSyncIfNeeded() {
  if (!chrome.storage.sync) return;

  try {
    const syncData = await chrome.storage.sync.get(['blockedSites', 'shortsSettings', 'dfSettings', 'tempBypasses']);
    if (!syncData || Object.keys(syncData).length === 0) return;

    const localStorage = getLocalStorage();
    const sessionStorage = getSessionStorage();

    const localUpdates = {};
    if (Array.isArray(syncData.blockedSites)) {
      localUpdates.blockedSites = syncData.blockedSites;
    }
    if (syncData.shortsSettings && typeof syncData.shortsSettings === 'object') {
      localUpdates.shortsSettings = syncData.shortsSettings;
    }
    if (syncData.dfSettings && typeof syncData.dfSettings === 'object') {
      localUpdates.dfSettings = syncData.dfSettings;
    }

    if (Object.keys(localUpdates).length > 0 && localStorage) {
      const existingLocal = await localStorage.get(Object.keys(localUpdates));
      const toSet = {};
      for (const [key, val] of Object.entries(localUpdates)) {
        if (existingLocal[key] === undefined) {
          toSet[key] = val;
        }
      }
      if (Object.keys(toSet).length > 0) {
        await localStorage.set(toSet);
      }
    }

    if (syncData.tempBypasses && sessionStorage && typeof syncData.tempBypasses === 'object') {
      const existingSession = await sessionStorage.get(['tempBypasses']);
      if (!existingSession.tempBypasses) {
        await sessionStorage.set({ tempBypasses: syncData.tempBypasses });
      }
    }

    await chrome.storage.sync.remove(['blockedSites', 'shortsSettings', 'dfSettings', 'tempBypasses']);
  } catch (err) {
    console.warn('Migration from storage.sync failed or skipped:', err);
  }
}

async function initializeDefaults() {
  await migrateFromSyncIfNeeded();

  const localStorage = getLocalStorage();
  const sessionStorage = getSessionStorage();

  if (!localStorage) return;

  const data = await localStorage.get(['blockedSites', 'shortsSettings', 'dfSettings']);
  const updates = {};

  if (!Array.isArray(data.blockedSites)) {
    updates.blockedSites = [];
  }
  if (!data.shortsSettings || typeof data.shortsSettings !== 'object') {
    updates.shortsSettings = { youtube: false, instagram: false, tiktok: false, facebook: false };
  }
  if (!data.dfSettings || typeof data.dfSettings !== 'object') {
    updates.dfSettings = { enabled: false };
  }

  if (Object.keys(updates).length > 0) {
    await localStorage.set(updates);
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session && chrome.storage.session.setAccessLevel) {
    try {
      await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    } catch (e) {}
  }

  if (sessionStorage) {
    const sessionData = await sessionStorage.get(['tempBypasses']);
    if (!sessionData.tempBypasses || typeof sessionData.tempBypasses !== 'object') {
      await sessionStorage.set({ tempBypasses: {} });
    }
  }
}

let rebuildPromise = null;
let pendingRebuild = false;
let rebuildDebounceTimer = null;

function debouncedRebuildRules(delayMs = 60) {
  return new Promise((resolve) => {
    if (rebuildDebounceTimer) {
      clearTimeout(rebuildDebounceTimer);
    }
    rebuildDebounceTimer = setTimeout(() => {
      rebuildDebounceTimer = null;
      serializedRebuildRules().then(resolve, resolve);
    }, delayMs);
  });
}

async function executeRebuildQueue() {
  do {
    pendingRebuild = false;
    try {
      await rebuildRules();
    } catch (err) {
      console.error('Error during rebuildRules:', err);
    }
  } while (pendingRebuild);
}

function serializedRebuildRules() {
  if (rebuildPromise) {
    pendingRebuild = true;
    return rebuildPromise;
  }

  rebuildPromise = executeRebuildQueue().finally(() => {
    rebuildPromise = null;
  });

  return rebuildPromise;
}

async function rebuildRules() {
  const localStorage = getLocalStorage();
  if (!localStorage) return;

  const {
    blockedSites = [],
    shortsSettings = { youtube: false, instagram: false, tiktok: false, facebook: false },
    dfSettings = { enabled: false }
  } = await localStorage.get(['blockedSites', 'shortsSettings', 'dfSettings']);

  const validBypasses = await getTempBypasses();

  const currentShorts = {
    youtube: shortsSettings.youtube === true,
    instagram: shortsSettings.instagram === true,
    tiktok: shortsSettings.tiktok === true,
    facebook: shortsSettings.facebook === true
  };

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map(r => r.id);

  let ruleId = 1;
  const newRules = [];

  Object.keys(validBypasses).forEach(bypassedKey => {
    if (bypassedKey.startsWith('http://') || bypassedKey.startsWith('https://')) {
      try {
        const u = new URL(bypassedKey);
        const host = normalizeDomain(u.hostname) || u.hostname.replace(/^(www\.)+/i, '');
        const cleanPath = u.pathname.replace(/\/+$/, '');
        newRules.push({
          id: ruleId++,
          priority: 100,
          action: {
            type: 'allow'
          },
          condition: {
            urlFilter: `||${host}${cleanPath}*`,
            resourceTypes: ['main_frame']
          }
        });
      } catch {
        newRules.push({
          id: ruleId++,
          priority: 100,
          action: {
            type: 'allow'
          },
          condition: {
            urlFilter: bypassedKey + '*',
            resourceTypes: ['main_frame']
          }
        });
      }
    } else {
      const cleanDomain = normalizeDomain(bypassedKey);
      if (!cleanDomain) return;
      newRules.push({
        id: ruleId++,
        priority: 100,
        action: {
          type: 'allow'
        },
        condition: {
          urlFilter: `||${cleanDomain}`,
          resourceTypes: ['main_frame']
        }
      });
    }
  });

  const addedSites = new Set();

  if (Array.isArray(blockedSites)) {
    blockedSites.forEach(site => {
      const cleanSite = normalizeDomain(site);
      if (!cleanSite || addedSites.has(cleanSite)) return;
      addedSites.add(cleanSite);
      newRules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            url: REDIRECT_URL + '?url=' + encodeURIComponent('https://' + cleanSite)
          }
        },
        condition: {
          urlFilter: `||${cleanSite}`,
          resourceTypes: ['main_frame']
        }
      });
    });
  }

  if (dfSettings && dfSettings.enabled) {
    DISTRACTION_FREE_SITES.forEach(site => {
      const cleanSite = normalizeDomain(site);
      if (!cleanSite || addedSites.has(cleanSite)) return;
      addedSites.add(cleanSite);
      newRules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            url: REDIRECT_URL + '?url=' + encodeURIComponent('https://' + cleanSite)
          }
        },
        condition: {
          urlFilter: `||${cleanSite}`,
          resourceTypes: ['main_frame']
        }
      });
    });
  }

  if (currentShorts.youtube && !addedSites.has('youtube.com')) {
    newRules.push({
      id: ruleId++,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: {
          url: REDIRECT_URL + '?url=' + encodeURIComponent('https://www.youtube.com/shorts')
        }
      },
      condition: {
        urlFilter: '||youtube.com/shorts*',
        resourceTypes: ['main_frame']
      }
    });
  }

  if (currentShorts.instagram && !addedSites.has('instagram.com')) {
    newRules.push({
      id: ruleId++,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: {
          url: REDIRECT_URL + '?url=' + encodeURIComponent('https://www.instagram.com/reels')
        }
      },
      condition: {
        urlFilter: '||instagram.com/reel*',
        resourceTypes: ['main_frame']
      }
    });
  }

  if (currentShorts.tiktok && !addedSites.has('tiktok.com')) {
    newRules.push({
      id: ruleId++,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: {
          url: REDIRECT_URL + '?url=' + encodeURIComponent('https://www.tiktok.com')
        }
      },
      condition: {
        urlFilter: '||tiktok.com',
        resourceTypes: ['main_frame']
      }
    });
  }

  if (currentShorts.facebook && !addedSites.has('facebook.com')) {
    newRules.push({
      id: ruleId++,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: {
          url: REDIRECT_URL + '?url=' + encodeURIComponent('https://www.facebook.com/reel')
        }
      },
      condition: {
        urlFilter: '||facebook.com/reel*',
        resourceTypes: ['main_frame']
      }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: newRules
  });
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session && chrome.storage.session.setAccessLevel) {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});
}

initializeDefaults().then(() => {
  serializedRebuildRules();
}).catch(err => {
  console.error('Failed top-level initialization:', err);
});

chrome.runtime.onInstalled.addListener(async () => {
  await initializeDefaults();
  await serializedRebuildRules();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeDefaults();
  await serializedRebuildRules();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    let needsRebuild = false;
    const addedSites = [];
    let dfActivated = false;
    const newlyEnabledShorts = [];

    if (changes.blockedSites) {
      needsRebuild = true;
      const oldList = (Array.isArray(changes.blockedSites.oldValue) ? changes.blockedSites.oldValue : []).map(normalizeDomain).filter(Boolean);
      const newList = (Array.isArray(changes.blockedSites.newValue) ? changes.blockedSites.newValue : []).map(normalizeDomain).filter(Boolean);
      const oldSet = new Set(oldList);
      for (const s of newList) {
        if (!oldSet.has(s)) {
          addedSites.push(s);
        }
      }
    }

    if (changes.dfSettings) {
      needsRebuild = true;
      const wasEnabled = changes.dfSettings.oldValue && changes.dfSettings.oldValue.enabled === true;
      const isEnabled = changes.dfSettings.newValue && changes.dfSettings.newValue.enabled === true;
      if (isEnabled && !wasEnabled) {
        dfActivated = true;
      }
    }

    if (changes.shortsSettings) {
      needsRebuild = true;
      const oldShorts = changes.shortsSettings.oldValue || {};
      const newShorts = changes.shortsSettings.newValue || {};
      for (const platform of ['youtube', 'instagram', 'tiktok', 'facebook']) {
        if (newShorts[platform] === true && oldShorts[platform] !== true) {
          newlyEnabledShorts.push(platform);
        }
      }
    }

    if (needsRebuild) {
      debouncedRebuildRules();
      if (addedSites.length > 0 || dfActivated || newlyEnabledShorts.length > 0) {
        checkAndRedirectAffectedTabs({ addedSites, dfActivated, newlyEnabledShorts });
      }
    }
  } else if (areaName === 'session') {
    if (changes.tempBypasses) {
      debouncedRebuildRules();
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateRules') {
    serializedRebuildRules().then(() => sendResponse({ status: 'complete' }));
    return true;
  }

  if (request.action === 'tempBypass') {
    (async () => {
      if (request.url) {
        try {
          const parsed = new URL(request.url);
          const isShortUrl = parsed.pathname.startsWith('/shorts') || parsed.pathname.startsWith('/reel');
          const key = isShortUrl ? parsed.href : (normalizeDomain(parsed.hostname) || parsed.hostname.replace(/^(www\.)+/i, ''));

          const sessionStorage = getSessionStorage();
          if (sessionStorage) {
            const { tempBypasses = {} } = await sessionStorage.get(['tempBypasses']);
            const duration = (request.durationMinutes || 15) * 60 * 1000;
            tempBypasses[key] = Date.now() + duration;
            await sessionStorage.set({ tempBypasses });
            await serializedRebuildRules();
          }
        } catch (e) {
          console.error('Error setting tempBypass:', e);
        }
      }
      sendResponse({ status: 'complete' });
    })();
    return true;
  }
});
