/* Miracolo Lab — Top tab navigation + canonical Bot mounting */
(()=>{
  'use strict';
  const PANELS=['radar','market','investimenti','bot','blackswan','settings'];
  const originalSetPanel=window.setPanel;
  let botObserver=null;
  function mountBot(){
    const target=document.getElementById('sidePanel');
    if(typeof window.panelBotUnified!=='function'||!target)return false;
    if(botObserver)botObserver.disconnect();
    target.innerHTML=window.panelBotUnified();
    botObserver=new MutationObserver(()=>{
      if(window.__mlPanel!=='bot')return;
      [...target.children].forEach(node=>{if(!node.classList.contains('bot-unified'))node.remove()});
    });
    botObserver.observe(target,{childList:true});
    window.dispatchEvent(new CustomEvent('miracolo:botui',{detail:{mounted:true}}));
    return true;
  }
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
    document.querySelectorAll('.top-tab').forEach(tab=>{
      const active=tab.dataset.panel===id;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',active?'true':'false');
    });
    if(id==='bot'){
      if(!mountBot())setTimeout(mountBot,40);
    }else if(botObserver){
      botObserver.disconnect();
      botObserver=null;
    }
    if(typeof originalSetPanel==='function' && id!=='bot') originalSetPanel(id);
    window.dispatchEvent(new CustomEvent('miracolo:panelchange',{detail:{panel:id}}));
  }
  window.setPanel=function(id){activate(id);};
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.top-tab').forEach(tab=>{
      tab.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activate(tab.dataset.panel||'radar');},true);
    });
    activate('radar');
  });
})();
