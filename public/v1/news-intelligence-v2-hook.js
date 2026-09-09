/* News Intelligence V3 UI hook
   The intelligence engine is shared data, not a Bot panel.
   Dashboard/Market Sentiment consumes window.ML_NEWS_INTELLIGENCE.
*/
(()=>{
  'use strict';
  window.addEventListener('miracolo:panelchange',e=>{
    if(e?.detail?.panel==='radar'&&typeof window.ML_NEWS_INTELLIGENCE_RUN==='function')setTimeout(window.ML_NEWS_INTELLIGENCE_RUN,80);
  });
})();
