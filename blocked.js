document.addEventListener('DOMContentLoaded', function () {
  // Parse blocked URL
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url');

  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      const badgeEl = document.getElementById('site-badge');
      const domainEl = document.getElementById('blocked-domain');
      if (domainEl && badgeEl) {
        domainEl.textContent = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
        badgeEl.style.display = 'inline-flex';
      }
    } catch (e) {}
  }

  // Close or go back button
  const closeBtn = document.getElementById('close-tab-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    });
  }

  // Breathing text cycle (12s total: 4s inhale, 4s hold, 4s exhale)
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

  // 10s countdown
  let remainingSeconds = 10;
  const countdownEl = document.getElementById('countdown-text');
  const timer = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds > 0) {
      if (countdownEl) countdownEl.textContent = remainingSeconds + 's';
    } else {
      if (countdownEl) countdownEl.textContent = 'Breathe';
      clearInterval(timer);
    }
  }, 1000);
});
