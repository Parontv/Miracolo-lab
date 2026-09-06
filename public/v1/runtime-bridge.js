/* Miracolo Lab V1 — runtime bridge for remaining secondary controls. */
(()=>{
  'use strict';
  if(typeof window.doScan==='function'){
    window.doScan=()=>window.ML?.data?.refresh?.().catch(()=>{});
  }
  if(typeof window.panelSettings==='function'){
    const legacy=window.panelSettings;
    window.panelSettings=()=>String(legacy())
      .replace(/Version<\/span><span class="stat-val">4\.0<\/span>/g,'Version</span><span class="stat-val">1.0</span>')
      .replace(/Gemini 1\.5 Flash \(gratis\)/g,'Gemini 3.8 Flash')
      .replace(/<span class="stat-val">15 feed<\/span>/g,'<span class="stat-val">45 feed</span>');
  }
})();
