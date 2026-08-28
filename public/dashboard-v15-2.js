/* Miracolo Lab V15.3 — Dashboard scan: direct, stable and testable */
(()=>{'use strict';
async function runDashboardScan(){
  const b=document.getElementById('radarRefreshBtn');
  if(b){b.disabled=true;b.textContent='⟳ Ricerca…'}
  const previous=window.__mlScanInProgress;
  if(previous)return;
  window.__mlScanInProgress=true;
  try{
    const r=await fetch('/api/full-scan?ts='+Date.now(),{cache:'no-store',headers:{'Accept':'application/json'}});
    const d=await r.json();
    if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));
    if(typeof S!=='undefined'){
      S.signals=d.top_signals||[];
      S.sources=d.sources||[];
      S.summary=d.summary||{};
      if(d.blackSwan)S.blackSwan=d.blackSwan;
    }
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('hNews',d.summary?.news??0);set('hSocial',d.summary?.social??0);set('hStrong',d.summary?.strong??0);set('hTime',new Date().toLocaleTimeString('it-IT'));set('feedInfo',`${d.summary?.workingSources??0} fonti · ${d.summary?.total??0} segnali`);
    if(typeof renderSources==='function')renderSources(d.sources||[]);
    if(typeof renderFeed==='function')renderFeed();
    if(typeof setStatus==='function')setStatus('ONLINE','ok');
    try{localStorage.setItem('ml_last_scan',new Date().toISOString())}catch{}
    if(typeof toast==='function')toast(`Radar aggiornato · ${d.summary?.workingSources??0} fonti · ${d.summary?.total??0} segnali`,'success','📡');
    return d;
  }catch(e){
    console.error('Dashboard scan failed:',e);
    if(typeof setStatus==='function')setStatus('ERRORE','bad');
    if(typeof toast==='function')toast('Ricerca fallita: '+(e.message||'errore'),'error');
    throw e;
  }finally{
    window.__mlScanInProgress=false;
    if(b){b.disabled=false;b.textContent='↻ Cerca ora'}
  }
}
window.refreshRadarNow=runDashboardScan;
window.doScan=runDashboardScan;
})();