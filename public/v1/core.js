/* Miracolo Lab V1 — UI core. One state, one event bus. */
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
})();
