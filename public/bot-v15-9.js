/* Miracolo Lab V15.9 — Bot controls compatibility + first operating bridge */
(()=>{'use strict';
function wire(){
  const panel=document.getElementById('sidePanel'); if(!panel||document.body.dataset.activePanel!=='bot')return;
  panel.querySelectorAll('button[onclick]').forEach(b=>{b.disabled=false;b.removeAttribute('aria-disabled')});
  const controls=panel.querySelector('.bot-controls');
  if(controls&&!document.getElementById('botRefreshDataBtn')){
    const b=document.createElement('button');b.id='botRefreshDataBtn';b.className='bot-btn';b.type='button';b.textContent='↻ Aggiorna dati';
    b.addEventListener('click',async()=>{b.disabled=true;b.textContent='⟳ Aggiornamento…';try{if(typeof fetchCrypto==='function')await fetchCrypto();if(typeof fetchAllPrices==='function')await fetchAllPrices();if(typeof doScan==='function')await doScan();if(typeof toast==='function')toast('Bot aggiornato con gli ultimi dati','success','🤖')}catch(e){console.error(e);if(typeof toast==='function')toast('Aggiornamento bot non riuscito','error')}finally{b.disabled=false;b.textContent='↻ Aggiorna dati'}});controls.prepend(b);
  }
}
const oldSet=window.setPanel;window.setPanel=function(id){if(typeof oldSet==='function')oldSet(id);setTimeout(wire,0);};
document.addEventListener('DOMContentLoaded',()=>setTimeout(wire,300));window.addEventListener('load',()=>setTimeout(wire,500));
})();
