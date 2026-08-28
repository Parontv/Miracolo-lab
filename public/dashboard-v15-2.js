/* Miracolo Lab V15.4 — Dashboard scan: direct, stable and testable */
(()=>{'use strict';
const style=document.createElement('style');style.textContent='.build-badge{display:inline-block!important;color:#fff!important;font-size:18px!important;font-weight:800!important;line-height:1!important;letter-spacing:.2px!important;margin-top:4px!important;padding:0!important;border:0!important;background:transparent!important}';document.head.appendChild(style);
async function runDashboardScan(){
 const b=document.getElementById('radarRefreshBtn'); if(window.__mlScanInProgress)return; window.__mlScanInProgress=true; if(b){b.disabled=true;b.textContent='⟳ Ricerca…'}
 try{
  const r=await fetch('/api/full-scan?ts='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}}); const d=await r.json(); if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));
  if(typeof S!=='undefined'){S.signals=Array.isArray(d.top_signals)?d.top_signals:[];S.sources=Array.isArray(d.sources)?d.sources:[];S.summary=d.summary||{};if(d.blackSwan)S.blackSwan=d.blackSwan}
  const sum=d.summary||{},set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('hNews',sum.news??0);set('hSocial',sum.social??0);set('hStrong',sum.strong??0);set('hTime',new Date().toLocaleTimeString('it-IT'));set('feedInfo',`${sum.workingSources??0} fonti · ${sum.total??0} segnali`);
  if(typeof renderSources==='function')renderSources(S.sources); if(typeof renderFeed==='function')renderFeed(); if(typeof setStatus==='function')setStatus('ONLINE','ok');
  try{localStorage.setItem('ml_last_scan',new Date().toISOString())}catch{} if(typeof toast==='function')toast(`Radar aggiornato · ${sum.workingSources??0} fonti · ${sum.total??0} segnali`,'success','📡'); return d;
 }catch(e){console.error('Dashboard scan failed:',e);if(typeof setStatus==='function')setStatus('ERRORE','bad');if(typeof toast==='function')toast('Ricerca fallita: '+(e.message||'errore'),'error');throw e}
 finally{window.__mlScanInProgress=false;if(b){b.disabled=false;b.textContent='↻ Cerca ora'}}
}
window.refreshRadarNow=runDashboardScan;window.doScan=runDashboardScan;
})();
