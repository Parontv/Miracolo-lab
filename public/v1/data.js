/* Miracolo Lab V1 — dashboard data adapter. One read path per dataset. */
(() => {
  'use strict';
  async function json(url) { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(url + ' HTTP ' + r.status); return r.json(); }
  async function loadScan() { return json('/api/full-scan'); }
  async function loadMarket() { try { return await json('/api/market-monitor'); } catch { return { indices: [] }; } }
  async function refresh() {
    try {
      const [scan, market] = await Promise.all([loadScan(), loadMarket()]);
      window.ML.set({ scan, market, updatedAt: new Date().toISOString() });
      window.ML.emit('data', { scan, market });
      return { scan, market };
    } catch (e) { window.ML.emit('error', e); throw e; }
  }
  window.ML.data = { refresh };
  window.ML.on('panel', panel => { if (panel === 'radar') window.ML.data.refresh().catch(() => {}); });
  document.addEventListener('DOMContentLoaded', () => { window.ML.data.refresh().catch(() => {}); setInterval(() => window.ML.data.refresh().catch(() => {}), 300000); });
})();
