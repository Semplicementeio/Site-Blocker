(function (root) {
  'use strict';

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

  function normalizeDomain(input) {
    if (typeof input !== 'string') return null;
    let str = input.trim().toLowerCase();
    if (!str) return null;

    if (/[\s'"<>\\^`{|}]/.test(str)) {
      return null;
    }

    let hostname = '';

    try {
      const urlToParse = (/^[a-z][a-z0-9+.-]*:\/\//i.test(str) || str.startsWith('//'))
        ? (str.startsWith('//') ? 'http:' + str : str)
        : 'http://' + str;

      const parsed = new URL(urlToParse);
      hostname = parsed.hostname;
    } catch {
      return null;
    }

    if (!hostname) return null;

    hostname = hostname.replace(/^(www\.)+/i, '').toLowerCase();
    hostname = hostname.replace(/\.+$/, '');

    if (!hostname) return null;
    if (hostname === 'localhost') return 'localhost';

    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(hostname)) {
      return hostname;
    }

    if (/^\[?[a-f0-9:]+\]?$/i.test(hostname) && hostname.includes(':')) {
      return hostname;
    }

    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/i;
    if (!domainRegex.test(hostname)) {
      return null;
    }

    return hostname;
  }

  function siteMatches(hostname, targetSite) {
    if (!hostname || !targetSite) return false;
    const h = normalizeDomain(hostname) || hostname.toLowerCase().replace(/^(www\.)+/i, '');
    const t = normalizeDomain(targetSite) || targetSite.toLowerCase().replace(/^(www\.)+/i, '');
    return h === t || h.endsWith('.' + t);
  }

  function getPlatform(hostname) {
    if (!hostname) return null;
    const h = hostname.toLowerCase();
    if (h.includes('youtube.com')) return 'youtube';
    if (h.includes('instagram.com')) return 'instagram';
    if (h.includes('tiktok.com')) return 'tiktok';
    if (h.includes('facebook.com')) return 'facebook';
    if (h.includes('twitter.com') || h.includes('x.com')) return 'x';
    if (h.includes('reddit.com')) return 'reddit';
    if (h.includes('linkedin.com')) return 'linkedin';
    return null;
  }

  function isShortsUrl(urlStr, platform) {
    try {
      const url = new URL(urlStr);
      const path = url.pathname;

      if (platform === 'youtube') {
        return path.startsWith('/shorts') || path.includes('/shorts/');
      }
      if (platform === 'instagram') {
        return path.startsWith('/reels') || path.startsWith('/reel');
      }
      if (platform === 'tiktok') {
        return true;
      }
      if (platform === 'facebook') {
        return path.startsWith('/reel') || path.startsWith('/reels');
      }
    } catch {
      return false;
    }
    return false;
  }

  function isUrlBypassed(tabUrl, validBypasses) {
    if (!validBypasses || Object.keys(validBypasses).length === 0) return false;

    let href = '';
    let hostname = '';
    let parsedTabUrl = null;

    if (tabUrl instanceof URL) {
      href = tabUrl.href;
      hostname = tabUrl.hostname;
      parsedTabUrl = tabUrl;
    } else if (typeof tabUrl === 'string') {
      href = tabUrl;
      try {
        parsedTabUrl = new URL(tabUrl);
        hostname = parsedTabUrl.hostname;
      } catch {
        hostname = tabUrl;
      }
    } else {
      return false;
    }

    const cleanHost = normalizeDomain(hostname) || hostname.toLowerCase().replace(/^(www\.)+/i, '');

    return Object.keys(validBypasses).some(key => {
      if (key.startsWith('http://') || key.startsWith('https://')) {
        try {
          const keyUrl = new URL(key);
          const keyHost = normalizeDomain(keyUrl.hostname) || keyUrl.hostname.toLowerCase().replace(/^(www\.)+/i, '');
          if (parsedTabUrl && (cleanHost === keyHost || cleanHost.endsWith('.' + keyHost))) {
            const keyPath = keyUrl.pathname.replace(/\/+$/, '');
            const currentPath = parsedTabUrl.pathname.replace(/\/+$/, '');
            if (keyPath === '' || currentPath === keyPath || currentPath.startsWith(keyPath + '/')) {
              return true;
            }
          }
        } catch {}
        return href === key || href.startsWith(key);
      }
      const d = normalizeDomain(key) || key.toLowerCase().replace(/^(www\.)+/i, '');
      return cleanHost === d || cleanHost.endsWith('.' + d);
    });
  }

  function getSessionStorage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        return chrome.storage.session;
      }
    } catch (e) {}
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  }

  function getLocalStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  }

  const SiteBlockerUtils = {
    DISTRACTION_FREE_SITES,
    normalizeDomain,
    siteMatches,
    getPlatform,
    isShortsUrl,
    isUrlBypassed,
    getSessionStorage,
    getLocalStorage
  };

  root.SiteBlockerUtils = SiteBlockerUtils;
})(typeof self !== 'undefined' ? self : this);
