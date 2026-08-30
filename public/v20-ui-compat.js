/* Miracolo Lab V20.01.07 — UI compatibility layer. Keeps legacy functional modules while restoring the established visual language. */
(()=>{'use strict';
const VERSION='20.01.07';
function apply(){
 document.querySelectorAll('.build-badge').forEach(el=>el.textContent=VERSION);
 document.documentElement.dataset.mlVersion=VERSION;
 const styleId='ml-v20-ui-compat';
 if(!document.getElementById(styleId)){
  const s=document.createElement('style');s.id=styleId;
  s.textContent=`
  .top-tabs{display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:8px 12px!important;background:#0f172a!important;border-bottom:1px solid #243044!important;overflow:hidden!important;}
  .top-tab{appearance:none!important;-webkit-appearance:none!important;border:1px solid transparent!important;background:transparent!important;color:#94a3b8!important;border-radius:9px!important;padding:9px 13px!important;font:inherit!important;font-size:12px!important;font-weight:600!important;cursor:pointer!important;box-shadow:none!important;}
  .top-tab:hover{background:#182235!important;color:#e2e8f0!important;}
  .top-tab.active{background:#1e293b!important;color:#f8fafc!important;border-color:#334155!important;box-shadow:inset 0 -2px 0 #38bdf8!important;}
  .top-tab span{margin-right:5px!important;}
  button{font-family:inherit;}
  .build-badge{display:inline-block!important;margin-top:3px!important;padding:2px 6px!important;border:1px solid #334155!important;border-radius:5px!important;background:transparent!important;color:#64748b!important;font-size:8px!important;letter-spacing:.3px!important;line-height:1.3!important;}
  @media(max-width:700px){.top-tabs{gap:3px!important;padding:7px 4px!important;}.top-tab{padding:8px 7px!important;font-size:10px!important;min-width:0!important;}.top-tab span{margin-right:2px!important;}}
  `;document.head.appendChild(s);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
setTimeout(apply,250);setTimeout(apply,1000);
})();
