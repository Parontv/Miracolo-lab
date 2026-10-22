/* Miracolo Lab — canonical Bot router
 * Loaded before tab-navigation so legacy panelBot cannot leak into the Bot workspace.
 */
(()=>{
  'use strict';
  const legacy=window.setPanel;
  window.setPanel=function(id){
    if(id==='bot'){
      const mount=()=>{
        const target=document.getElementById('sidePanel');
        if(typeof window.panelBotUnified==='function' && target){
          target.innerHTML=window.panelBotUnified();
          window.dispatchEvent(new CustomEvent('miracolo:botui',{detail:{mounted:true}}));
          return true;
        }
        return false;
      };
      if(!mount()) setTimeout(mount,40);
      return;
    }
    if(typeof legacy==='function') return legacy(id);
  };
})();
