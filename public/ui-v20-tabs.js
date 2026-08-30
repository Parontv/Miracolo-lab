/* Miracolo Lab V20.01.08 — tab navigation + restored button styling */
(()=>{'use strict';
const VERSION='20.01.08';
const panels=['radar','investimenti','bot','learning','blackswan','settings'];
function apply(id){
 id=panels.includes(id)?id:'radar';
 window.__mlPanel=id;
 document.body.dataset.activePanel=id;
 document.querySelectorAll('.top-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));
 const feed=document.getElementById('feedCol'),side=document.querySelector('.side-col');
 if(feed)feed.classList.toggle('panel-hidden',id!=='radar');
 if(side)side.classList.toggle('panel-full',id!=='radar');
 if(id!=='radar') document.querySelector('.feed-col')?.scrollTo(0,0);
}
const previous=window.setPanel;
window.setPanel=function(id){
 apply(id);
 if(typeof previous==='function' && previous!==window.setPanel){try{previous(id)}catch(e){console.error('Legacy panel handler blocked:',e)}}
 apply(id);
 if(id==='investimenti')window.dispatchEvent(new CustomEvent('miracolo:investments-open'));
 if(id==='bot')window.dispatchEvent(new CustomEvent('miracolo:bot-open'));
 if(id==='learning')window.dispatchEvent(new CustomEvent('miracolo:learning-open'));
 if(id==='blackswan')window.dispatchEvent(new CustomEvent('miracolo:alerts-open'));
 if(id==='settings')window.dispatchEvent(new CustomEvent('miracolo:settings-open'));
};
function style(){
 const s=document.createElement('style');s.id='ml-v20-tabs-style';s.textContent=`
.top-tabs{display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;padding:9px 10px!important;background:#fff!important;border-bottom:1px solid #e5e7eb!important;overflow:hidden!important;}
.top-tab{appearance:none!important;-webkit-appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;flex:1 1 0!important;min-width:0!important;max-width:145px!important;border:1px solid #d9dee7!important;background:#fff!important;color:#475569!important;border-radius:9px!important;padding:8px 7px!important;font-family:inherit!important;font-size:11px!important;font-weight:700!important;line-height:1.15!important;cursor:pointer!important;white-space:nowrap!important;box-shadow:0 1px 2px rgba(15,23,42,.06)!important;}
.top-tab:hover{background:#f8fafc!important;color:#1e293b!important;border-color:#cbd5e1!important}.top-tab.active{background:#f1f5f9!important;color:#0f172a!important;border-color:#94a3b8!important;box-shadow:inset 0 -2px 0 #0ea5e9,0 1px 2px rgba(15,23,42,.08)!important}.top-tab span{margin-right:2px!important;flex:0 0 auto!important}
@media(max-width:520px){.top-tabs{gap:4px!important;padding:7px 5px!important}.top-tab{padding:8px 3px!important;font-size:10px!important;border-radius:8px!important}.top-tab span{font-size:12px!important}}
`;
 document.head.appendChild(s);
}
function init(){style();apply(window.__mlPanel||'radar');const badge=document.querySelector('.build-badge');if(badge)badge.textContent=VERSION;document.documentElement.dataset.mlVersion=VERSION;}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
