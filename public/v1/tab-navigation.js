/* Miracolo Lab — Top tab navigation */
(()=>{
  'use strict';
  const PANELS=['radar','market','investimenti','bot','strategy','blackswan','settings'];
  const originalSetPanel=window.setPanel;
  function activate(id){
    if(!PANELS.includes(id)) id='radar';
    document.body.dataset.activePanel=id;
    window.__mlPanel=id;
    const body=document.querySelector('.app-body');
    const feed=document.getElementById('feedCol');
    const side=document.querySelector('.side-col');
    const dashboard=id==='radar';
    if(body) body.classList.toggle('tab-inside-panel',!dashboard);
    if(feed) feed.classList.toggle('panel-workspace-hidden',!dashboard);
    if(side) side.classList.remove('panel-workspace-hidden');
    document.querySelectorAll('.top-tab[data-panel]').forEach(tab=>{
      const active=tab.dataset.panel===id;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',active?'true':'false');
    });
    if(id==='market'||id==='strategy'){
      if(id==='strategy'){
        if(typeof originalSetPanel==='function') originalSetPanel(id);
        const paint=()=>{
          const lab=window.ML_STRATEGY_LAB;
          if(typeof lab?.render==='function') lab.render('jesse','Strategy Lab pronto','Overview');
          else {
            const side=document.getElementById('sidePanel');
            if(side) side.innerHTML='<div class="panel-section"><b>Strategy Lab</b><p>Modulo non inizializzato. Ricarica la pagina; se il problema continua, controllare gli errori JavaScript.</p></div>';
          }
        };
        paint();
        requestAnimationFrame(paint);
        setTimeout(paint,80);
      }
      window.dispatchEvent(new CustomEvent('miracolo:panelchange',{detail:{panel:id}}));
      return;
    }
    if(typeof originalSetPanel==='function') originalSetPanel(id);
    window.dispatchEvent(new CustomEvent('miracolo:panelchange',{detail:{panel:id}}));
  }
  window.setPanel=function(id){activate(id);};
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.top-tab[data-panel]').forEach(tab=>{
      tab.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activate(tab.dataset.panel);},true);
    });
    activate('radar');
  });
})();