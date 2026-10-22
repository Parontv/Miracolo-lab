/* Miracolo Lab V1 — UI core. One state, one event bus, one canonical Bot workspace. */
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
  const valid = ['radar','investimenti','bot','strategy','blackswan','settings'];
  const syncVersion = () => {
    const meta = document.querySelector('meta[name="version"]');
    const version = meta?.getAttribute('content')?.trim() || '1.0';
    document.querySelectorAll('.build-badge').forEach(el => el.textContent = version);
    document.title = `Miracolo Lab — Investment Intelligence ${version}`;
    window.ML_BUILD_VERSION = version;
  };
  const syncTabs = id => {
    document.querySelectorAll('.top-tab[data-panel]').forEach(btn => {
      const active = btn.dataset.panel === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.body.dataset.activePanel = id;
    state.activePanel = id;
    syncVersion();
  };
  function mountCanonicalBot() {
    const target = document.getElementById('sidePanel');
    if (!target || typeof window.panelBotUnified !== 'function') return false;
    target.innerHTML = window.panelBotUnified();
    window.dispatchEvent(new CustomEvent('miracolo:botui', { detail: { mounted: true } }));
    return true;
  }
  function install() {
    syncVersion();
    const previous = window.setPanel;
    if (previous && previous.__mlV1Canonical) return;
    window.setPanel = function(id) {
      const panel = valid.includes(id) ? id : 'radar';
      /* Bot is a hard boundary: legacy renderers are never called for this tab. */
      if (panel === 'bot') {
        syncTabs(panel);
        window.__mlPanel = 'bot';
        if (!mountCanonicalBot()) setTimeout(mountCanonicalBot, 40);
        emit('panel', panel);
        window.dispatchEvent(new CustomEvent('miracolo:panelchange', { detail: { panel } }));
        return;
      }
      try { if (typeof previous === 'function') previous(panel); } catch (e) { console.warn('Miracolo Lab panel error:', e); }
      syncTabs(panel);
      window.__mlPanel = panel;
      emit('panel', panel);
      window.dispatchEvent(new CustomEvent('miracolo:panelchange', { detail: { panel } }));
    };
    window.setPanel.__mlV1Canonical = true;
    syncTabs(state.activePanel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
