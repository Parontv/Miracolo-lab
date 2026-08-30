/* Miracolo Lab V20.01.06 — consolidated stability/version layer */
(()=>{'use strict';
  const VERSION='20.01.06';
  const PANELS=['radar','investimenti','bot','learning','blackswan','settings'];
  const setVersion=()=>{document.querySelectorAll('.build-badge').forEach(b=>b.textContent=VERSION);document.documentElement.dataset.mlVersion=VERSION;};
  const fitTabs=()=>{const nav=document.querySelector('.top-tabs');if(!nav)return;nav.style.display='grid';nav.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';nav.style.width='100%';nav.style.overflow='hidden';nav.style.boxSizing='border-box';nav.querySelectorAll('.top-tab').forEach(b=>{b.style.minWidth='0';b.style.width='100%';b.style.boxSizing='border-box';});};
  const markActive=id=>document.querySelectorAll('.top-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));
  const original=window.setPanel;
  if(typeof original==='function'&&!original.__v20Stable){const wrapped=function(id){if(!PANELS.includes(id))return original(id);markActive(id);return original(id)};wrapped.__v20Stable=true;wrapped.__v20Original=original;window.setPanel=wrapped;}
  const boot=()=>{setVersion();fitTabs();if(window.__mlPanel)markActive(window.__mlPanel);};
  window.addEventListener('resize',fitTabs);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.MiracoloLabV20={version:VERSION,panels:PANELS.slice(),baseline:'20.01.06',stability:true};
})();
