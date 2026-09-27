document.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url');

  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      const host = (typeof SiteBlockerUtils !== 'undefined' && SiteBlockerUtils.normalizeDomain)
        ? SiteBlockerUtils.normalizeDomain(parsed.hostname)
        : parsed.hostname.replace(/^(www\.)+/i, '');
      const subEl = document.getElementById('subheading-text');
      if (subEl) {
        subEl.textContent = `You chose to block ${host} to protect your time and focus. Take a deep breath.`;
      }
    } catch (e) {}
  }

  const closeBtn = document.getElementById('close-tab-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      if (chrome.tabs && chrome.tabs.getCurrent) {
        chrome.tabs.getCurrent(function (tab) {
          if (tab && tab.id) {
            chrome.tabs.remove(tab.id).catch(() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = 'about:blank';
              }
            });
            return;
          }
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = 'about:blank';
          }
        });
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'about:blank';
      }
    });
  }

  const proceedBtn = document.getElementById('proceed-btn');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', function () {
      if (targetUrl) {
        proceedBtn.disabled = true;
        proceedBtn.textContent = 'Loading...';
        chrome.runtime.sendMessage({ action: 'tempBypass', url: targetUrl, durationMinutes: 15 }, function () {
          window.location.replace(targetUrl);
        });
      }
    });
  }

  const breathText = document.getElementById('breath-text');
  const phases = [
    { text: 'Inhale', duration: 4000 },
    { text: 'Hold', duration: 4000 },
    { text: 'Exhale', duration: 4000 }
  ];

  let phaseIndex = 0;
  function updateBreathPhase() {
    if (breathText) {
      breathText.textContent = phases[phaseIndex].text;
      phaseIndex = (phaseIndex + 1) % phases.length;
    }
  }
  updateBreathPhase();
  setInterval(updateBreathPhase, 4000);

  let remainingSeconds = 10;
  const countdownEl = document.getElementById('countdown-text');
  if (proceedBtn) {
    proceedBtn.disabled = true;
    proceedBtn.textContent = `Continue anyway (${remainingSeconds}s)`;
  }

  const timer = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds > 0) {
      if (countdownEl) countdownEl.textContent = remainingSeconds + 's';
      if (proceedBtn) proceedBtn.textContent = `Continue anyway (${remainingSeconds}s)`;
    } else {
      if (countdownEl) countdownEl.textContent = 'Breathe';
      if (proceedBtn) {
        proceedBtn.disabled = false;
        proceedBtn.textContent = 'Continue anyway';
      }
      clearInterval(timer);
    }
  }, 1000);
});
