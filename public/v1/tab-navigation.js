/* Miracolo Lab — Top tab navigation */
(()=>{
  'use strict';
  const PANELS=['radar','investimenti','bot','learning','blackswan','settings'];
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
