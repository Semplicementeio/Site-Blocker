const REDIRECT_URL = chrome.runtime.getURL('blocked.html');

const DISTRACTION_FREE_SITES = [
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'reddit.com',
  'twitch.tv',
  'threads.net',
  'pinterest.com',
  'netflix.com',
  'linkedin.com',
  'snapchat.com',
  'discord.com',
  'tumblr.com',
  '9gag.com',
  'buzzfeed.com'
];

function siteMatches(hostname, targetSite) {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  const t = targetSite.toLowerCase().replace(/^www\./, '');
  return h === t || h.endsWith('.' + t);
}

async function redirectOpenBlockedTabs(blockedList, dfActive, shortsActive) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        continue;
      }

      let tabUrl;
      try {
        tabUrl = new URL(tab.url);
      } catch {
        continue;
      }

      const hostname = tabUrl.hostname;
      let shouldBlock = false;

      // Check custom blocked sites
      if (blockedList.some(site => siteMatches(hostname, site))) {
        shouldBlock = true;
      }

      // Check Distraction-Free mode sites
      if (dfActive && DISTRACTION_FREE_SITES.some(site => siteMatches(hostname, site))) {
        shouldBlock = true;
      }

      // Check Shorts URLs
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
  } catch (e) {
    console.error('Error redirecting open tabs:', e);
  }
}

async function initializeDefaults() {
  const data = await chrome.storage.sync.get(['blockedSites', 'shortsSettings', 'dfSettings']);
  const updates = {};

  if (!data.blockedSites) {
    updates.blockedSites = [];
  }
  if (!data.shortsSettings) {
    updates.shortsSettings = { youtube: true, instagram: true, tiktok: true, facebook: true };
  }
  if (!data.dfSettings) {
    updates.dfSettings = { enabled: false };
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.sync.set(updates);
  }
}

async function rebuildRules() {
  const {
    blockedSites = [],
    shortsSettings = { youtube: true, instagram: true, tiktok: true, facebook: true },
    dfSettings = { enabled: false }
  } = await chrome.storage.sync.get(['blockedSites', 'shortsSettings', 'dfSettings']);

  const currentShorts = {
    youtube: shortsSettings.youtube !== false,
    instagram: shortsSettings.instagram !== false,
    tiktok: shortsSettings.tiktok !== false,
    facebook: shortsSettings.facebook !== false
  };

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map(r => r.id);

  let ruleId = 1;
  const newRules = [];
  const addedSites = new Set();

  // 1. Custom user blocked sites
  blockedSites.forEach(site => {
    const cleanSite = site.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanSite) return;
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

  // 2. Distraction-Free Mode: automatically block major distraction sites when active
  if (dfSettings && dfSettings.enabled) {
    DISTRACTION_FREE_SITES.forEach(site => {
      if (!addedSites.has(site)) {
        addedSites.add(site);
        newRules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              url: REDIRECT_URL + '?url=' + encodeURIComponent('https://' + site)
            }
          },
          condition: {
            urlFilter: `||${site}`,
            resourceTypes: ['main_frame']
          }
        });
      }
    });
  }

  // 3. YouTube Shorts
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

  // 4. Instagram Reels
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

  // 5. TikTok
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

  // 6. Facebook Reels
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

  // Redirect currently open tabs that should be blocked
  await redirectOpenBlockedTabs(blockedSites, dfSettings && dfSettings.enabled, currentShorts);
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeDefaults();
  await rebuildRules();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeDefaults();
  await rebuildRules();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateRules') {
    rebuildRules().then(() => sendResponse({ status: 'complete' }));
    return true;
  }
});
