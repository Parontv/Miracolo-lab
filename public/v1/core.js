/* Miracolo Lab V1 — UI core. One state, one event bus, one panel router bridge. */
(() => {
  'use strict';
  const state = { version: '1.0', scan: null, market: null, activePanel: 'radar', updatedAt: null };
  const listeners = new Map();
  const emit = (name, detail) => (listeners.get(name) || []).forEach(fn => { try { fn(detail); } catch (e) { console.warn('V1 UI listener', e); } });
  window.ML = window.ML || {};
  window.ML.state = state;
  window.ML.on = (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); return () => listeners.get(name)?.delete(fn); };
  window.ML.set = patch => { Object.assign(state, patch || {}); emit('state', state); };
  window.ML.emit = emit;
  window.ML.setPanel = id => { const panel = ['radar','investimenti','bot','learning','blackswan','settings'].includes(id) ? id : 'radar'; state.activePanel = panel; emit('panel', panel); };
  function syncVersion() {
    const meta = document.querySelector('meta[name="version"]');
    const version = meta?.getAttribute('content')?.trim() || '1.0';
    document.querySelectorAll('.build-badge').forEach(el => el.textContent = version);
    document.title = `Miracolo Lab — Investment Intelligence ${version}`;
    window.ML_BUILD_VERSION = version;
  }
  function syncTabs(id) {
    document.querySelectorAll('.top-tab[data-panel]').forEach(btn => {
      const active = btn.dataset.panel === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.body.dataset.activePanel = id;
    state.activePanel = id;
    syncVersion();
  }
  function install() {
    syncVersion();
    const previous = window.setPanel;
    if (previous && previous.__mlV1) return;
    window.setPanel = function(id) {
      const panel = ['radar','investimenti','bot','learning','blackswan','settings'].includes(id) ? id : 'radar';
      try { if (typeof previous === 'function') previous(panel); } catch (e) { console.warn('Miracolo Lab panel error:', e); }
      syncTabs(panel);
      emit('panel', panel);
      window.dispatchEvent(new CustomEvent('miracolo:panel-change', { detail: { panel } }));
    };
    window.setPanel.__mlV1 = true;
    syncTabs(state.activePanel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
