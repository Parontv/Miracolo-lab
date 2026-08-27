/* Miracolo Lab v5 UX layer: automatic refresh + top navigation + tab isolation */
(() => {
  const FIVE_MIN = 5 * 60 * 1000;

  function applyLayout() {
    const scan = document.getElementById('scanBtn');
    if (scan) scan.remove();
    const auto = document.getElementById('autoToggle');
    if (auto) { auto.checked = true; auto.disabled = true; }
    const label = document.querySelector('.auto-label');
    if (label) {
      const text = label.querySelector('.auto-text');
      if (text) text.textContent = 'Auto 5 min';
    }
  }

  function isolateTab(panel) {
    const feed = document.getElementById('feedCol');
    const side = document.querySelector('.side-col');
    if (!feed || !side) return;
    const dashboard = panel === 'radar';
    feed.classList.toggle('ux-dashboard-feed', dashboard);
    feed.classList.toggle('ux-tab-hidden', !dashboard);
    side.classList.toggle('ux-panel-main', !dashboard);
  }

  function installPanelHook() {
    if (typeof window.setPanel !== 'function' || window.setPanel.__uxWrapped) return;
    const original = window.setPanel;
    function wrapped(panel) {
      original(panel);
      isolateTab(panel);
    }
    wrapped.__uxWrapped = true;
    window.setPanel = wrapped;
    isolateTab(window.S?.activePanel || 'radar');
  }

  function startAuto() {
    if (window.__miracoloAuto5) return;
    window.__miracoloAuto5 = true;
    applyLayout();
    installPanelHook();
    // Initial data load, then exactly every 5 minutes.
    if (typeof window.fetchCrypto === 'function') window.fetchCrypto();
    if (typeof window.fetchAllPrices === 'function') window.fetchAllPrices();
    if (typeof window.doScan === 'function') window.doScan();
    setInterval(() => {
      if (typeof window.fetchCrypto === 'function') window.fetchCrypto();
      if (typeof window.fetchAllPrices === 'function') window.fetchAllPrices();
      if (typeof window.doScan === 'function') window.doScan();
    }, FIVE_MIN);
  }

  const timer = setInterval(() => {
    applyLayout();
    installPanelHook();
    if (typeof window.doScan === 'function') {
      clearInterval(timer);
      startAuto();
    }
  }, 50);
})();
