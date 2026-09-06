/* Miracolo Lab V1 — consolidated secondary runtime facade. */
(()=>{
'use strict';
/* V1 owns the shared panel lifecycle. Legacy implementations remain available only
   behind these narrow calls until each panel is migrated to its dedicated module. */
const panelSet=['radar','investimenti','bot','learning','blackswan','settings'];
window.ML=window.ML||{};
window.ML.panels=panelSet;
window.ML.refresh=()=>window.ML.data?.refresh?.().catch(()=>{});
window.ML.openPanel=id=>{
  const panel=panelSet.includes(id)?id:'radar';
  if(typeof window.setPanel==='function') window.setPanel(panel);
  else window.ML.setPanel?.(panel);
};
window.ML.runtime={version:'1.0',owner:'V1',legacy:false};
})();
