(function () {
  'use strict';

  const {
    DISTRACTION_FREE_SITES = [],
    siteMatches,
    getPlatform,
    isShortsUrl,
    isUrlBypassed,
    getLocalStorage,
    getSessionStorage
  } = (typeof SiteBlockerUtils !== 'undefined' ? SiteBlockerUtils : {});

  const hostname = window.location.hostname.toLowerCase().replace(/^(www\.)+/i, '');
  const currentPlatform = getPlatform ? getPlatform(hostname) : null;

  let isShortsEnabled = false;
  let isSiteBlocked = false;
  let isSettingsLoaded = false;
  let isObserverActive = false;
  let lastUrl = window.location.href;

  function handleCheck() {
    if (!isSettingsLoaded) return;
    const currentUrl = window.location.href;

    if (isSiteBlocked) {
      document.querySelectorAll('video, audio').forEach(v => {
        try { v.pause(); } catch (e) {}
      });
      const blockedUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(currentUrl);
      window.location.replace(blockedUrl);
      return;
    }

    if (isShortsEnabled && isShortsUrl && isShortsUrl(currentUrl, currentPlatform)) {
      document.querySelectorAll('video, audio').forEach(v => {
        try { v.pause(); } catch (e) {}
      });
      const blockedUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(currentUrl);
      window.location.replace(blockedUrl);
    }
  }

  function cleanDomElements() {
    if (!isSettingsLoaded || !isShortsEnabled) return;
    if (currentPlatform !== 'youtube' && currentPlatform !== 'instagram') return;
    if (!document.documentElement && !document.body) return;

    if (currentPlatform === 'youtube') {
      document.querySelectorAll('ytd-guide-entry-renderer a[href*="/shorts"], ytd-mini-guide-entry-renderer a[href*="/shorts"]').forEach(a => {
        const item = a.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
        if (item) item.style.setProperty('display', 'none', 'important');
      });

      document.querySelectorAll('ytd-rich-shelf-renderer[is-shorts], ytd-rich-shelf-renderer:has(a[href*="/shorts"]), ytd-reel-shelf-renderer, ytd-shorts, ytd-shorts-lockup-view-model, ytm-shorts-lockup-view-model, shorts-video-cell-view-model').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
      });

      document.querySelectorAll('ytd-rich-item-renderer a[href*="/shorts/"], ytd-video-renderer a[href*="/shorts/"], ytd-grid-video-renderer a[href*="/shorts/"], ytd-compact-video-renderer a[href*="/shorts/"]').forEach(a => {
        const item = a.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer');
        if (item) item.style.setProperty('display', 'none', 'important');
      });
    } else if (currentPlatform === 'instagram') {
      document.querySelectorAll('a[href="/reels/"], a[href^="/reels?"]').forEach(a => {
        const navItem = a.closest('div[role="listitem"]') || a;
        if (navItem) navItem.style.setProperty('display', 'none', 'important');
      });
    }
  }

  let cleanDomTimer = null;
  function scheduleCleanDom(delay = 150) {
    if (!isShortsEnabled || (currentPlatform !== 'youtube' && currentPlatform !== 'instagram')) return;
    if (cleanDomTimer) {
      clearTimeout(cleanDomTimer);
    }
    cleanDomTimer = setTimeout(() => {
      cleanDomTimer = null;
      cleanDomElements();
    }, delay);
  }

  const observer = new MutationObserver(function () {
    scheduleCleanDom(150);
  });

  function updateObserverState() {
    const shouldObserve = isShortsEnabled && (currentPlatform === 'youtube' || currentPlatform === 'instagram');
    if (shouldObserve && !isObserverActive && document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      isObserverActive = true;
    } else if (!shouldObserve && isObserverActive) {
      observer.disconnect();
      isObserverActive = false;
    }
  }

  async function loadSettings() {
    const localStorage = getLocalStorage ? getLocalStorage() : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
    if (!localStorage) return;

    try {
      const localData = await new Promise(resolve => {
        try {
          const res = localStorage.get(['blockedSites', 'dfSettings', 'shortsSettings'], items => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              resolve({});
            } else {
              resolve(items || {});
            }
          });
          if (res && typeof res.then === 'function') {
            res.then(resolve).catch(() => resolve({}));
          }
        } catch (err) {
          resolve({});
        }
      });

      let sessionData = {};
      try {
        const sessionStorage = getSessionStorage ? getSessionStorage() : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session);
        if (sessionStorage && typeof sessionStorage.get === 'function') {
          sessionData = await new Promise(resolve => {
            try {
              const res = sessionStorage.get(['tempBypasses'], items => {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                  resolve({});
                } else {
                  resolve(items || {});
                }
              });
              if (res && typeof res.then === 'function') {
                res.then(resolve).catch(() => resolve({}));
              }
            } catch (err) {
              resolve({});
            }
          });
        }
      } catch (sessionErr) {
        sessionData = {};
      }

      applySettings({
        ...localData,
        tempBypasses: sessionData ? (sessionData.tempBypasses || {}) : {}
      });
    } catch (e) {
      console.error('Error loading settings in content script:', e);
    }
  }

  function applySettings(storageData) {
    isSettingsLoaded = true;
    const blockedSites = Array.isArray(storageData.blockedSites) ? storageData.blockedSites : [];
    const dfSettings = storageData.dfSettings || { enabled: false };
    const shortsSettings = storageData.shortsSettings || {};
    const tempBypasses = storageData.tempBypasses || {};

    const bypassed = isUrlBypassed ? isUrlBypassed(window.location.href, tempBypasses) : false;

    if (bypassed) {
      isSiteBlocked = false;
      isShortsEnabled = false;
      if (currentPlatform && document.documentElement) {
        document.documentElement.classList.remove(`sb-block-shorts-${currentPlatform}`);
      }
      updateObserverState();
      return;
    }

    const inCustomList = blockedSites.some(site => siteMatches && siteMatches(hostname, site));
    const inDfList = dfSettings.enabled && DISTRACTION_FREE_SITES && DISTRACTION_FREE_SITES.some(site => siteMatches && siteMatches(hostname, site));

    isSiteBlocked = inCustomList || inDfList;
    isShortsEnabled = !!(currentPlatform && shortsSettings[currentPlatform] === true);

    if (currentPlatform) {
      const shortsClassName = `sb-block-shorts-${currentPlatform}`;
      if (document.documentElement) {
        if (isShortsEnabled) {
          document.documentElement.classList.add(shortsClassName);
        } else {
          document.documentElement.classList.remove(shortsClassName);
        }
      } else {
        const rootObserver = new MutationObserver(() => {
          if (document.documentElement) {
            rootObserver.disconnect();
            if (isShortsEnabled) {
              document.documentElement.classList.add(shortsClassName);
            }
            updateObserverState();
          }
        });
        rootObserver.observe(document, { childList: true });
      }
    }

    updateObserverState();
    handleCheck();
    if (isShortsEnabled) {
      scheduleCleanDom(0);
    }
  }

  loadSettings();

  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'local' || namespace === 'session') {
      loadSettings();
    }
  });

  function onNavigation() {
    lastUrl = window.location.href;
    updateObserverState();
    handleCheck();
    scheduleCleanDom(0);
  }

  window.addEventListener('yt-navigate-finish', onNavigation);
  window.addEventListener('popstate', onNavigation);
  document.addEventListener('DOMContentLoaded', function () {
    if (currentPlatform && isShortsEnabled && document.documentElement) {
      document.documentElement.classList.add(`sb-block-shorts-${currentPlatform}`);
    }
    updateObserverState();
    onNavigation();
  });

  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    onNavigation();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    onNavigation();
  };

  setInterval(function () {
    if (window.location.href !== lastUrl) {
      onNavigation();
    }
  }, 1000);
})();
