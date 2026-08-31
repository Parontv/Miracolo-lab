/* Miracolo Lab V21.1 — runtime version coordinator. */
(() => {
  'use strict';
  const FALLBACK = '—';
  const PANELS = ['radar','investimenti','bot','learning','blackswan','settings'];
  let VERSION = FALLBACK;

  function applyVersion(v) {
    if (!v || typeof v !== 'string' || v === '—') return;
    VERSION = v;
    document.documentElement.dataset.mlVersion = VERSION;
    document.querySelector('meta[name="version"]')?.setAttribute('content', VERSION);
    document.querySelector('title')?.replaceChildren(document.createTextNode(`Miracolo Lab — Investment Intelligence ${VERSION}`));
    document.querySelectorAll('.build-badge').forEach(el => { el.textContent = VERSION; });
    window.ML_BUILD_VERSION = VERSION;
    window.dispatchEvent(new CustomEvent('miracolo:version', { detail: { version: VERSION } }));
  }

  async function resolveVersion() {
    try {
      const r = await fetch('/api/version?probe=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('version endpoint ' + r.status);
      const d = await r.json();
      if (!d?.version) throw new Error('missing version');
      applyVersion(String(d.version));
    } catch (e) {
      document.querySelectorAll('.build-badge').forEach(el => { el.textContent = '—'; });
      console.warn('Miracolo Lab version probe unavailable:', e.message);
    }
  }

  function syncTabs(id) {
    document.querySelectorAll('.top-tab[data-panel]').forEach(btn => {
      const active = btn.dataset.panel === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.body.dataset.activePanel = id;
    if (VERSION !== FALLBACK) applyVersion(VERSION);
  }

  function install() {
    const previous = window.setPanel;
    if (previous && previous.__mlV21) { resolveVersion(); return; }
    window.setPanel = function(id) {
      const panel = PANELS.includes(id) ? id : 'radar';
      try { if (typeof previous === 'function') previous(panel); }
      catch (e) { console.warn('Miracolo Lab panel error:', e); }
      syncTabs(panel);
      window.dispatchEvent(new CustomEvent('miracolo:panel-change', { detail: { panel } }));
    };
    window.setPanel.__mlV21 = true;
    syncTabs(window.__mlPanel || 'radar');
    resolveVersion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
