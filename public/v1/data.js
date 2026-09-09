/* Miracolo Lab V1 — data adapter. One read path per dashboard dataset. */
(() => {
  'use strict';
  const GROUPS=['news','finance','crypto','macro','rates','central','commodities','fx','volatility','geopolitics','social','company'];
  const MAX_PER_CATEGORY=300;
  async function json(url) {
    const r=await fetch(url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
    return r.json();
  }

  function hasNews(scan) {
    return Array.isArray(scan?.items) && scan.items.length > 0;
  }

  // News Core is the source of truth, but older/persisted snapshots can contain
  // incomplete category maps. Rebuild only the missing/empty categories from
  // the canonical item list so a partial snapshot can never turn a menu to zero.
  function categoryOf(x){
    const raw=`${x?.cat||x?.type||''} ${x?.source||''} ${x?.title||''} ${x?.description||''}`.toLowerCase();
    const t=String(x?.cat||x?.type||'').toLowerCase();
    if(t==='crypto'||/crypto|bitcoin|ethereum|solana|xrp|coindesk/.test(raw))return'crypto';
    if(t==='macro'||/inflation|cpi|pce|gdp|payroll|pmi|fred|bls|bea|eurostat|liquidity/.test(raw))return'macro';
    if(t==='rates'||/treasury|bond|yield|bund|btp|gilt|credit spread|high yield|cds/.test(raw))return'rates';
    if(t==='central'||/fed|ecb|boe|boj|snb|rba|central bank/.test(raw))return'central';
    if(t==='commodities'||/gold|silver|oil|brent|wti|copper|opec|gas/.test(raw))return'commodities';
    if(t==='fx'||/forex|eurusd|eur\/usd|dxy|usd[jy]|gbp|sterling|dollar|yen/.test(raw))return'fx';
    if(t==='volatility'||/vix|volatility|options|gamma|put.?call|open interest/.test(raw))return'volatility';
    if(t==='geopolitics'||/geopolitic|sanction|tariff|war|conflict|ukraine|russia|iran|israel/.test(raw))return'geopolitics';
    if(t==='social'||/reddit|social|sentiment|wallstreetbets/.test(raw))return'social';
    if(t==='company'||/earnings|company|corporate|sec filing|revenue|guidance|buyback|jpmorgan|goldman|banking/.test(raw))return'company';
    if(/finance|market|stock|equity|etf|nasdaq|s&p|dow|dax|nikkei|ftse|msci/.test(raw))return'finance';
    return'news';
  }

  function dedupe(items){
    const seen=new Set();
    return (Array.isArray(items)?items:[]).filter(x=>{
      const key=String(x?.url||x?.link||x?.id||x?.title||'').trim().toLowerCase();
      if(!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0,MAX_PER_CATEGORY);
  }

  function normalizeScan(scan){
    if(!scan || typeof scan!=='object') return scan;
    const items=Array.isArray(scan.items)?scan.items:[];
    if(!items.length) return scan;
    const supplied=scan.categories&&typeof scan.categories==='object'?scan.categories:{};
    const derived=Object.fromEntries(GROUPS.map(k=>[k,[]]));
    items.forEach(x=>derived[categoryOf(x)].push(x));
    const suppliedCount=GROUPS.reduce((n,k)=>n+(Array.isArray(supplied[k])?supplied[k].length:0),0);
    const coverage=suppliedCount/items.length;
    const suspicious=coverage<0.75;
    const categories=Object.fromEntries(GROUPS.map(k=>{
      const src=Array.isArray(supplied[k])?supplied[k]:[];
      const fallback=derived[k]||[];
      // Keep the server's populated category when healthy. If it is empty or
      // the whole snapshot is structurally incomplete, recover from items.
      const chosen=(src.length===0&&fallback.length>0)||(suspicious&&fallback.length>0)?fallback:src;
      return [k,dedupe(chosen)];
    }));
    return {...scan,categories,categorySummary:Object.fromEntries(GROUPS.map(k=>[k,categories[k].length])) ,newsCategoriesRecovered:suspicious||GROUPS.some(k=>!(Array.isArray(supplied[k]))||supplied[k].length===0&&derived[k].length>0)};
  }

  async function loadScan() {
    // Dashboard reads the persisted central dataset first. This avoids making
    // every browser load trigger a fresh network scan. The normalization layer
    // below makes persisted snapshots backward-compatible and self-healing.
    try {
      const live = await json('/api/live');
      const snapshot = live?.news;
      if (hasNews(snapshot)) {
        return normalizeScan({ ...snapshot, ok: true, recoveredFromSnapshot: true, snapshotTimestamp: live.timestamp || snapshot.timestamp });
      }
    } catch (e) { console.warn('News Core live snapshot failed:', e.message); }

    try {
      const scan = await json('/api/full-scan');
      if (hasNews(scan)) return normalizeScan(scan);
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

  async function forceNewsScan() {
    const rawScan = await json('/api/full-scan');
    const scan=normalizeScan(rawScan);
    const market = await loadMarket();
    if (!scan || scan.ok === false) throw new Error(scan?.error || 'Scansione notizie non disponibile');
    window.ML.set({ scan, market, updatedAt: new Date().toISOString() });
    window.ML.emit('data', { scan, market, manual: true });
    return { scan, market };
  }

  window.ML.data = { refresh, forceNewsScan, normalizeScan };
  window.ML.on('panel', panel => {
    if (panel === 'radar') window.ML.data.refresh().catch(e => console.warn('Miracolo Lab data refresh:', e.message));
  });
  document.addEventListener('DOMContentLoaded', () => {
    window.ML.data.refresh().catch(e => console.warn('Miracolo Lab data refresh:', e.message));
    setInterval(() => window.ML.data.refresh().catch(e => console.warn('Miracolo Lab data refresh:', e.message)), 300000);
  });
})();
