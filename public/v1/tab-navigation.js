/* Miracolo Lab — Top tab navigation
   Each top tab is a real workspace. Content is rendered only for the active panel.
*/
(()=>{
  'use strict';
  const PANELS=['radar','investimenti','bot','learning','blackswan','settings'];
  const originalSetPanel=window.setPanel;

  function activate(id){
    if(!PANELS.includes(id)) id='radar';
    document.body.dataset.activePanel=id;
    window.__mlPanel=id;

    document.querySelectorAll('.top-tab[data-panel]').forEach(tab=>{
      const active=tab.dataset.panel===id;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',active?'true':'false');
    });

    // Never leave the Dashboard feed visible underneath another workspace.
    const feed=document.getElementById('feedCol');
    const side=document.querySelector('.side-col');
    if(feed) feed.classList.toggle('panel-workspace-hidden',id!=='radar');
    if(side) side.classList.toggle('panel-workspace-hidden',id!=='radar');

    let host=document.getElementById('panelWorkspace');
    if(!host){
      host=document.createElement('main');
      host.id='panelWorkspace';
      host.className='panel-workspace';
      const body=document.querySelector('.app-body');
      if(body) body.appendChild(host);
    }
    host.hidden=id==='radar';
    host.dataset.panel=id;

    // Give the existing application renderer a chance to populate the selected tab.
    if(id!=='radar' && typeof originalSetPanel==='function'){
      try{ originalSetPanel(id); }catch(e){ console.warn('panel renderer:',e); }
    }

    window.dispatchEvent(new CustomEvent('miracolo:panelchange',{detail:{panel:id}}));
  }

  window.setPanel=function(id){ activate(id); };

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.top-tab[data-panel]').forEach(tab=>{
      tab.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        activate(tab.dataset.panel);
      },true);
    });
    activate('radar');
  });
})();
