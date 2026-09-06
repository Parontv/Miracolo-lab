/* Miracolo Lab V1 — data adapter. One read path per dashboard dataset. */
(() => {
  'use strict';
  async function json(url) {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
    return r.json();
  }

  function hasNews(scan) {
    return Array.isArray(scan?.items) && scan.items.length > 0;
  }

  async function loadScan() {
    // Dashboard reads the persisted central dataset first. This avoids making
    // every browser load trigger a fresh 24-feed network scan.
    try {
      const live = await json('/api/live');
      const snapshot = live?.news;
      if (hasNews(snapshot)) {
        return { ...snapshot, ok: true, recoveredFromSnapshot: true, snapshotTimestamp: live.timestamp || snapshot.timestamp };
      }
    } catch (e) { console.warn('News Core live snapshot failed:', e.message); }

    // Only fall back to a fresh scan when the persisted dataset is empty.
    try {
      const scan = await json('/api/full-scan');
      if (hasNews(scan)) return scan;
      return scan;
    } catch (e) {
      throw e;
    }
  }

  async function loadMarket() {
    try { return await json('/api/market-monitor'); }
    catch { return { indices: [] }; }
  }

  async function refresh() {
    try {
      const [scan, market] = await Promise.all([loadScan(), loadMarket()]);
      window.ML.set({ scan, market, updatedAt: new Date().toISOString() });
      window.ML.emit('data', { scan, market });
      return { scan, market };
    } catch (e) {
      window.ML.emit('error', e);
      throw e;
    }
  }

  window.ML.data = { refresh };
  window.ML.on('panel', panel => {
    if (panel === 'radar') window.ML.data.refresh().catch(e => console.warn('Miracolo Lab data refresh:', e.message));
  });
  document.addEventListener('DOMContentLoaded', () => {
    window.ML.data.refresh().catch(e => console.warn('Miracolo Lab data refresh:', e.message));
    setInterval(() => window.ML.data.refresh().catch(e => console.warn('Miracolo Lab data refresh:', e.message)), 300000);
  });
})();
