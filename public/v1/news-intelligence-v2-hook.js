/* News Intelligence V2 UI hook
   Runs only after the tab-navigation layer has activated the Bot panel.
   It does not touch News Core. */
(()=>{
  'use strict';
  function run(e){
    if(e?.detail?.panel!=='bot')return;
    if(typeof window.runNewsIntelligenceV2==='function')setTimeout(window.runNewsIntelligenceV2,80);
  }
  window.addEventListener('miracolo:panelchange',run);
  document.addEventListener('DOMContentLoaded',()=>{
    if(window.__mlPanel==='bot'||document.body.dataset.activePanel==='bot')setTimeout(run,80);
  });
})();
