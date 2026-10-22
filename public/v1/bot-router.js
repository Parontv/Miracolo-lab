/* Miracolo Lab — canonical Bot router v1.1
 * Bot owns exactly one visual workspace. Legacy engines may publish data but never mount sibling panels.
 */
(()=>{
  'use strict';
  const legacy=window.setPanel;
  let observer=null;
  function mount(){
    const target=document.getElementById('sidePanel');
    if(typeof window.panelBotUnified!=='function'||!target)return false;
    if(observer)observer.disconnect();
    target.innerHTML=window.panelBotUnified();
    observer=new MutationObserver(()=>{
      if(window.__mlPanel!=='bot')return;
      [...target.children].forEach(node=>{if(!node.classList.contains('bot-unified'))node.remove()});
    });
    observer.observe(target,{childList:true});
    window.dispatchEvent(new CustomEvent('miracolo:botui',{detail:{mounted:true}}));
    return true;
  }
  window.setPanel=function(id){
    if(id==='bot'){
      window.__mlPanel='bot';
      if(!mount())setTimeout(mount,40);
      return;
    }
    if(observer){observer.disconnect();observer=null}
    if(typeof legacy==='function')return legacy(id);
  };
})();
