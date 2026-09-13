/* Miracolo Lab V1 — runtime bridge for secondary controls and server-side AI UI. */
(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  if(typeof window.doScan==='function') window.doScan=()=>window.ML?.data?.refresh?.().catch(()=>{});
  if(typeof window.panelSettings==='function'){
    const legacy=window.panelSettings;
    window.panelSettings=()=>String(legacy())
      .replace(/Version<\/span><span class="stat-val">4\.0<\/span>/g,'Version</span><span class="stat-val">1.0</span>')
      .replace(/Gemini 1\.5 Flash \(gratis\)/g,'Gemini 2.5 Flash')
      .replace(/Gemini 3\.8 Flash/g,'Gemini 2.5 Flash')
      .replace(/<span class="stat-val">15 feed<\/span>/g,'<span class="stat-val">45 feed</span>');
  }
  const marketCard=()=>document.querySelector('.v1-market-card');
  const content=()=>document.getElementById('v1-market-content');
  function renderAI(ai){
    const card=marketCard(),box=content(); if(!card||!box)return;
    const score=card.querySelector('.v1-card-head strong');
    if(score){score.textContent='';score.style.display='none';}
    const label=card.querySelector('.v1-market-label');
    if(label)label.textContent=ai?.regime||'Market Intelligence';
    if(!ai){box.innerHTML='<div class="v1-ai-loading">In attesa della Market Intelligence…</div>';return;}
    box.innerHTML=`<div class="v1-ai-headline">${esc(ai.headline||'Market Intelligence')}</div>${ai.thesis?`<div class="v1-ai-thesis"><span>${esc(ai.thesis)}</span></div>`:''}${ai.summary?`<div class="v1-ai-summary">${esc(ai.summary)}</div>`:''}`;
  }
  async function refreshAI(){
    try{
      const r=await fetch(`/api/ai?ts=${Date.now()}`,{cache:'no-store'}); if(!r.ok)throw new Error(`AI HTTP ${r.status}`);
      const d=await r.json(); if(d?.ai)renderAI(d.ai); return d?.ai||null;
    }catch(e){console.warn('Market Intelligence fetch:',e.message);return null;}
  }
  function bootAI(){refreshAI();setInterval(refreshAI,300000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootAI,{once:true});else bootAI();
  window.getAiAnalysis=async()=>null;
})();
