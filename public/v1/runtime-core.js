/* Miracolo Lab V1 — consolidated secondary runtime facade. */
(()=>{
'use strict';
/* Canonical panel registry. Bot is the only trading surface; there is no separate Trading Desk. */
const panelSet=['radar','market','investimenti','bot','strategy','blackswan','settings'];
window.ML=window.ML||{};
window.ML.panels=panelSet.slice();
window.ML.refresh=()=>window.ML.data?.refresh?.().catch(()=>{});
window.ML.openPanel=id=>{
  const panel=panelSet.includes(id)?id:'radar';
  if(typeof window.setPanel==='function') window.setPanel(panel);
  else window.ML.setPanel?.(panel);
};
window.ML.runtime={version:'1.1',owner:'V1',legacy:false};
})();
