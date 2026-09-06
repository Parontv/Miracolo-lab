/* Miracolo Lab V1.0 — single source of truth for the displayed app version. */
(() => {
  'use strict';
  const FALLBACK = '1.0';
  const PANELS = ['radar','investimenti','bot','learning','blackswan','settings'];
  let VERSION = FALLBACK;

  function readVersion() {
    const meta = document.querySelector('meta[name="version"]');
    const value = meta?.getAttribute('content')?.trim();
    return value || FALLBACK;
  }

  function applyVersion(v) {
    VERSION = String(v || FALLBACK).trim() || FALLBACK;
    document.documentElement.dataset.mlVersion = VERSION;
    const meta = document.querySelector('meta[name="version"]');
    if (meta) meta.setAttribute('content', VERSION);
    document.title = `Miracolo Lab — Investment Intelligence ${VERSION}`;
    document.querySelectorAll('.build-badge').forEach(el => { el.textContent = VERSION; });
    window.ML_BUILD_VERSION = VERSION;
    window.dispatchEvent(new CustomEvent('miracolo:version', { detail: { version: VERSION } }));
  }

  function syncTabs(id) {
    document.querySelectorAll('.top-tab[data-panel]').forEach(btn => {
      const active = btn.dataset.panel === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.body.dataset.activePanel = id;
    applyVersion(VERSION);
  }

  function install() {
    applyVersion(readVersion());
    const previous = window.setPanel;
    if (previous && previous.__mlV1) {
      syncTabs(window.__mlPanel || 'radar');
      return;
    }
    window.setPanel = function(id) {
      const panel = PANELS.includes(id) ? id : 'radar';
      try { if (typeof previous === 'function') previous(panel); }
      catch (e) { console.warn('Miracolo Lab panel error:', e); }
      syncTabs(panel);
      window.dispatchEvent(new CustomEvent('miracolo:panel-change', { detail: { panel } }));
    };
    window.setPanel.__mlV1 = true;
    syncTabs(window.__mlPanel || 'radar');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();