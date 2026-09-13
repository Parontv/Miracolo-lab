/* Miracolo Lab V1 — data adapter. Canonical News Contract is the only category authority. */
(() => {
  'use strict';
  const CONTRACT=window.ML_NEWS_CONTRACT;
  if(!CONTRACT) throw new Error('Miracolo Lab: News Contract missing');
  async function json(url){const r=await fetch(url+(url.includes('?')?'&':'?')+'ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(url+' HTTP '+r.status);return r.json()}
  function hasNews(scan){return Array.isArray(scan?.items)&&scan.items.length>0}
  function normalize(scan){return CONTRACT.normalize(scan)}
  function extractNews(payload){
    if(!payload||typeof payload!=='object')return null;
    const candidates=[payload.news,payload.scan,payload.snapshot,payload.data,payload];
    for(const candidate of candidates){
      if(candidate&&typeof candidate==='object'&&hasNews(candidate))return candidate;
    }
    return null;
  }
  async function loadScan(){
    try{
      const live=await json('/api/live');
      const snapshot=extractNews(live);
      if(snapshot){
        const scan=normalize({...snapshot,ok:true,recoveredFromSnapshot:true,snapshotTimestamp:live.timestamp||snapshot.timestamp});
        const check=CONTRACT.validate(scan);
        if(check.ok)return scan;
        console.warn('News Contract rejected live snapshot:',check.error);
      }
    }catch(e){console.warn('News Core live snapshot failed:',e.message)}
    try{
      const raw=await json('/api/full-scan');
      const scan=normalize(extractNews(raw)||raw);
      if(hasNews(scan)){
        const check=CONTRACT.validate(scan);
        if(!check.ok)throw new Error('News Contract invalid: '+check.error);
      }
      return scan;
    }catch(e){
      console.warn('News Core full scan failed:',e.message);
      throw e;
    }
  }
  async function loadMarket(){try{return await json('/api/market-monitor-v2')}catch{try{return await json('/api/market-monitor')}catch{return{indices:[]}}}}
  async function refresh(){try{const[scan,market]=await Promise.all([loadScan(),loadMarket()]);window.ML.set({scan,market,updatedAt:new Date().toISOString()});window.ML.emit('data',{scan,market});return{scan,market}}catch(e){window.ML.emit('error',e);throw e}}
  async function forceNewsScan(){const raw=await json('/api/full-scan');const scan=normalize(extractNews(raw)||raw);const check=CONTRACT.validate(scan);if(!check.ok)throw new Error('News Contract invalid: '+check.error);const market=await loadMarket();window.ML.set({scan,market,updatedAt:new Date().toISOString()});window.ML.emit('data',{scan,market,manual:true});return{scan,market}}
  window.ML.data={refresh,forceNewsScan,normalizeScan:normalize};
  window.ML.on('panel',panel=>{if(panel==='radar')window.ML.data.refresh().catch(e=>console.warn('Miracolo Lab data refresh:',e.message))});
  document.addEventListener('DOMContentLoaded',()=>{window.ML.data.refresh().catch(e=>console.warn('Miracolo Lab data refresh:',e.message));setInterval(()=>window.ML.data.refresh().catch(e=>console.warn('Miracolo Lab data refresh:',e.message)),300000)});
})();
