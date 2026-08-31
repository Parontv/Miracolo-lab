/* Miracolo Lab V21.1 — single final UI coordinator.
   Keeps functional modules while removing competing tab/style controllers. */
(() => {
  'use strict';
  const VERSION = '21.1.0';
  const PANELS = ['radar','investimenti','bot','learning','blackswan','settings'];

  function syncTabs(id) {
    document.querySelectorAll('.top-tab[data-panel]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === id);
      btn.setAttribute('aria-selected', btn.dataset.panel === id ? 'true' : 'false');
    });
    document.body.dataset.activePanel = id;
    document.documentElement.dataset.mlVersion = VERSION;
    document.querySelectorAll('.build-badge').forEach(el => { el.textContent = VERSION; });
  }

  function install() {
    const previous = window.setPanel;
    if (previous && previous.__mlV21) return;
    window.setPanel = function(id) {
      const panel = PANELS.includes(id) ? id : 'radar';
      try {
        if (typeof previous === 'function') previous(panel);
      } catch (e) {
        console.warn('Miracolo Lab panel error:', e);
      }
      syncTabs(panel);
      window.dispatchEvent(new CustomEvent('miracolo:panel-change', { detail: { panel } }));
    };
    window.setPanel.__mlV21 = true;
    syncTabs(window.__mlPanel || 'radar');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
