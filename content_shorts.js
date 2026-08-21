(function () {
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  let currentPlatform = null;

  if (hostname.includes('youtube.com')) {
    currentPlatform = 'youtube';
  } else if (hostname.includes('instagram.com')) {
    currentPlatform = 'instagram';
  } else if (hostname.includes('tiktok.com')) {
    currentPlatform = 'tiktok';
  } else if (hostname.includes('facebook.com')) {
    currentPlatform = 'facebook';
  } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    currentPlatform = 'x';
  } else if (hostname.includes('reddit.com')) {
    currentPlatform = 'reddit';
  } else if (hostname.includes('linkedin.com')) {
    currentPlatform = 'linkedin';
  }

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

  function siteMatches(host, target) {
    const h = host.toLowerCase().replace(/^www\./, '');
    const t = target.toLowerCase().replace(/^www\./, '');
    return h === t || h.endsWith('.' + t);
  }

  let isShortsEnabled = true;
  let isSiteBlocked = false;

  function isShortsUrl(urlStr) {
    try {
      const url = new URL(urlStr);
      const path = url.pathname;

      if (currentPlatform === 'youtube') {
        return path.startsWith('/shorts') || path.includes('/shorts/');
      }
      if (currentPlatform === 'instagram') {
        return path.startsWith('/reels') || path.startsWith('/reel');
      }
      if (currentPlatform === 'tiktok') {
        return true;
      }
      if (currentPlatform === 'facebook') {
        return path.startsWith('/reel') || path.startsWith('/reels');
      }
    } catch {
      return false;
    }
    return false;
  }

  function handleCheck() {
    const currentUrl = window.location.href;

    // Check full site block (custom or distraction-free mode)
    if (isSiteBlocked) {
      document.querySelectorAll('video, audio').forEach(v => {
        try { v.pause(); } catch (e) {}
      });
      const blockedUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(currentUrl);
      window.location.replace(blockedUrl);
      return;
    }

    // Check Shorts block
    if (isShortsEnabled && isShortsUrl(currentUrl)) {
      document.querySelectorAll('video, audio').forEach(v => {
        try { v.pause(); } catch (e) {}
      });
      const blockedUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(currentUrl);
      window.location.replace(blockedUrl);
    }
  }

  function cleanDomElements() {
    if (!isShortsEnabled) return;

    if (currentPlatform === 'youtube') {
      document.querySelectorAll('ytd-guide-entry-renderer a[href*="/shorts"], ytd-mini-guide-entry-renderer a[href*="/shorts"]').forEach(a => {
        const item = a.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
        if (item) item.style.setProperty('display', 'none', 'important');
      });

      document.querySelectorAll('ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-shorts, ytd-shorts-lockup-view-model, ytm-shorts-lockup-view-model, shorts-video-cell-view-model').forEach(el => {
        const section = el.closest('ytd-rich-section-renderer, ytd-item-section-renderer') || el;
        section.style.setProperty('display', 'none', 'important');
      });

      document.querySelectorAll('ytd-rich-item-renderer a[href*="/shorts/"], ytd-video-renderer a[href*="/shorts/"], ytd-grid-video-renderer a[href*="/shorts/"], ytd-compact-video-renderer a[href*="/shorts/"]').forEach(a => {
        const item = a.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer');
        if (item) item.style.setProperty('display', 'none', 'important');
      });
    } else if (currentPlatform === 'instagram') {
      document.querySelectorAll('a[href*="/reels/"], a[href*="/reels"]').forEach(a => {
        const item = a.closest('div[role="listitem"]') || a.parentElement || a;
        if (item) item.style.setProperty('display', 'none', 'important');
      });

      document.querySelectorAll('a[href*="/reel/"]').forEach(a => {
        const item = a.closest('article, div:has(> a[href*="/reel/"])') || a;
        if (item) item.style.setProperty('display', 'none', 'important');
      });
    }
  }

  function applySettings(storageData) {
    const blockedSites = storageData.blockedSites || [];
    const dfSettings = storageData.dfSettings || { enabled: false };
    const shortsSettings = storageData.shortsSettings || {};

    // Check if current site is blocked
    const inCustomList = blockedSites.some(site => siteMatches(hostname, site));
    const inDfList = dfSettings.enabled && DISTRACTION_FREE_SITES.some(site => siteMatches(hostname, site));

    isSiteBlocked = inCustomList || inDfList;
    isShortsEnabled = currentPlatform && shortsSettings[currentPlatform] !== false;

    if (currentPlatform) {
      const shortsClassName = `sb-block-shorts-${currentPlatform}`;
      if (isShortsEnabled) {
        document.documentElement.classList.add(shortsClassName);
      } else {
        document.documentElement.classList.remove(shortsClassName);
      }
    }

    handleCheck();
    cleanDomElements();
  }

  // Load initial settings
  chrome.storage.sync.get(['blockedSites', 'dfSettings', 'shortsSettings'], function (res) {
    applySettings(res || {});
  });

  // Listen for storage changes in real-time
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync') {
      chrome.storage.sync.get(['blockedSites', 'dfSettings', 'shortsSettings'], function (res) {
        applySettings(res || {});
      });
    }
  });

  // Listen for navigation events
  window.addEventListener('yt-navigate-finish', function () {
    handleCheck();
    cleanDomElements();
  });
  window.addEventListener('popstate', function () {
    handleCheck();
    cleanDomElements();
  });
  document.addEventListener('DOMContentLoaded', function () {
    handleCheck();
    cleanDomElements();
  });

  // Intercept history pushState/replaceState
  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    handleCheck();
    cleanDomElements();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    handleCheck();
    cleanDomElements();
  };

  // MutationObserver
  const observer = new MutationObserver(function () {
    handleCheck();
    cleanDomElements();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Periodic safety check
  let lastUrl = window.location.href;
  setInterval(function () {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      handleCheck();
      cleanDomElements();
    }
  }, 300);
})();
