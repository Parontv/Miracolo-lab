/* Miracolo Lab UI V14.9 — radar scan fix */
(()=>{'use strict';
function applyLayout(id){const panel=id||'radar';document.body.dataset.activePanel=panel;document.querySelectorAll('.top-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));const feed=document.getElementById('feedCol'),side=document.querySelector('.side-col');if(feed)feed.classList.toggle('panel-hidden',panel!=='radar');if(side)side.classList.toggle('panel-full',panel!=='radar');window.__mlPanel=panel}
const previous=window.setPanel;window.setPanel=function(id){applyLayout(id);if(typeof previous==='function')previous(id);applyLayout(id)};
window.refreshRadarNow=async function(){
  const b=document.getElementById('radarRefreshBtn');
  if(b){b.disabled=true;b.textContent='⟳ Ricerca…'}
  try{
    if(typeof window.doScan==='function'){
      await window.doScan();
    }else{
      throw new Error('Motore scansione non disponibile')
    }
    if(typeof window.toast==='function')window.toast('Radar aggiornato','success');
  }catch(e){
    console.error('Radar scan error:',e);
    if(typeof window.toast==='function')window.toast('Ricerca non disponibile: '+(e.message||'errore'),'error');
  }finally{
    if(b){b.disabled=false;b.textContent='↻ Cerca ora'}
  }
};
const style=document.createElement('style');style.textContent=`.top-tabs{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#0f172a;border-bottom:1px solid #243044}.top-tab{appearance:none!important;border:1px solid transparent!important;background:transparent!important;color:#94a3b8!important;border-radius:9px!important;padding:9px 13px!important;font:inherit!important;font-size:12px!important;cursor:pointer!important}.top-tab:hover{background:#182235!important;color:#e2e8f0!important}.top-tab.active{background:#1e293b!important;color:#f8fafc!important;border-color:#334155!important;box-shadow:inset 0 -2px 0 #38bdf8!important}.top-tab span{margin-right:5px}.app-body{display:flex;min-width:0}.feed-col.panel-hidden{display:none!important}.side-col.panel-full{width:100%!important;flex:1!important}.side-panel{width:100%}.header-status .status-chip{display:none!important}.radar-manual{display:flex;justify-content:flex-end;margin:8px 0}.radar-manual button{appearance:none;border:1px solid #334155;background:#172033;color:#e2e8f0;border-radius:8px;padding:7px 11px;font-size:10px;cursor:pointer}.radar-manual button:disabled{opacity:.55;cursor:wait}`;document.head.appendChild(style);
function addButton(){if(document.getElementById('radarRefreshBtn'))return;const h=document.querySelector('.feed-head');if(!h)return;const w=document.createElement('div');w.className='radar-manual';w.innerHTML='<button id="radarRefreshBtn" type="button" onclick="refreshRadarNow()">↻ Cerca ora</button>';h.after(w)}
document.addEventListener('DOMContentLoaded',()=>{addButton();applyLayout(window.__mlPanel||'radar')});setTimeout(addButton,600);
})();