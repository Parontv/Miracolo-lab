/* Bot V15 UI diagnostics: exposes pipeline state without changing trading logic. */
(()=>{
'use strict';
window.MiracoloBotDiagnostics={
  render(d){
    const el=document.getElementById('botDiagnosticTrace');
    if(!el)return;
    const stages=d?.diagnostics?.pipeline||[];
    const mods=Array.isArray(d?.modules)?d.modules:[];
    const map=Object.fromEntries(mods.map(x=>[x.family,x]));
    const rows=stages.map(s=>`<div class="bot-diag-row"><b>${s}</b><span>OK</span></div>`);
    if(map.macro?.dataAvailable===false)rows.push(`<div class="bot-diag-row"><b>MACRO/FRED</b><span>NO DATA · ${map.macro.evidence?.[0]||'FRED non disponibile'}</span></div>`);
    if(map.ai?.status==='FALLBACK')rows.push(`<div class="bot-diag-row"><b>AI</b><span>FALLBACK · Gemini non disponibile</span></div>`);
    el.innerHTML=rows.join('');
  }
};
})();
