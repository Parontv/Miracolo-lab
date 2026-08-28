/* Miracolo Lab V15.2 — Dashboard scan bridge */
(()=>{'use strict';
const original=window.doScan;
function ensureLegacyScanNodes(){
  let b=document.getElementById('scanBtn');
  if(!b){b=document.createElement('button');b.id='scanBtn';b.type='button';b.style.display='none';document.body.appendChild(b)}
  let i=document.getElementById('scanIcon');
  if(!i){i=document.createElement('span');i.id='scanIcon';i.style.display='none';document.body.appendChild(i)}
}
async function scan(){
  ensureLegacyScanNodes();
  if(typeof original!=='function') throw new Error('Motore Dashboard non disponibile');
  return original();
}
window.doScan=scan;
window.refreshRadarNow=async function(){
  const b=document.getElementById('radarRefreshBtn');
  if(b){b.disabled=true;b.textContent='⟳ Ricerca…'}
  try{
    await scan();
    if(typeof window.toast==='function') window.toast('Radar aggiornato','success');
  }catch(e){
    console.error('Dashboard scan:',e);
    if(typeof window.toast==='function') window.toast('Ricerca non disponibile: '+(e.message||'errore'),'error');
  }finally{
    if(b){b.disabled=false;b.textContent='↻ Cerca ora'}
  }
};
})();
