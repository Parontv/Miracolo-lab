/* Miracolo Lab — Bot tab visibility bridge
 * Ensures the strategy-engine workspace is mounted when the Bot tab is opened.
 * It is deliberately independent from the strategy calculation modules: it only
 * guarantees lifecycle/UI mounting and fetches the paper-trading monitor snapshot.
 */
(()=>{
  'use strict';
  const BOX_ID='miracoloWolfBotEngineBox';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  let loading=false;

  function active(){return document.body.dataset.activePanel==='bot'||window.__mlPanel==='bot'}
  function mount(){
    if(!active())return null;
    const side=document.getElementById('sidePanel');
    if(!side)return null;
    let box=document.getElementById(BOX_ID);
    if(!box){
      box=document.createElement('div');
      box.id=BOX_ID;
      box.className='panel-section';
      side.prepend(box);
    }
    return box;
  }

  function shell(box){
    if(!box)return;
    if(box.querySelector('.bot-strategy-card'))return;
    box.innerHTML=`<div class="panel-section-label">BOT · STRATEGY ENGINES</div><div class="bot-strategy-card"><div class="bot-strategy-head"><div><b>Technical Strategy Engine</b><small>WolfBot concepts · Jesse-style analysis · paper only</small></div><span class="bot-live-dot">READY</span></div><div class="bot-analysis-intro">Il motore tecnico è stato montato nel tab Bot. Apri <b>⚡ Analisi Jesse</b> per eseguire l'analisi manuale sugli asset disponibili.</div><div class="bot-strategy-loading">Caricamento monitor tecnico…</div></div>`;
  }

  async function refresh(){
    if(!active()||loading)return;
    const box=mount();if(!box)return;
    shell(box);
    loading=true;
    try{
      const r=await fetch('/api/bot-monitor?ts='+Date.now(),{cache:'no-store'});
      const d=await r.json();
      if(!active())return;
      const card=box.querySelector('.bot-strategy-card');if(!card)return;
      const candidates=Array.isArray(d?.candidates)?d.candidates:[];
      const rows=candidates.slice(0,8).map(c=>`<div class="bot-strategy-row"><span><b>${esc(c.name||c.symbol||'Asset')}</b></span><span class="bot-action wait">MONITOR</span><strong>${c.price!=null?esc(c.price):'—'}</strong></div>`).join('');
      card.innerHTML=`<div class="bot-strategy-head"><div><b>Technical Strategy Engine</b><small>WolfBot concepts · Jesse-style analysis · paper only</small></div><span class="bot-live-dot">LIVE</span></div><div class="bot-summary-grid"><div><span>Monitorati</span><strong>${esc(d?.monitored??candidates.length)}</strong></div><div><span>Candidati</span><strong>${candidates.length}</strong></div><div><span>Storico</span><strong>5d/1h</strong></div><div><span>Modalità</span><strong>PAPER</strong></div></div><div class="bot-strategy-title">Motore tecnico</div><div class="bot-analysis-intro">WolfBot-style: indicatori composabili, confluence e gestione del rischio. Jesse-style: analisi RSI2, MACD, EMA, Bollinger, Donchian e ATR. Nessun ordine reale.</div><div class="bot-candidates">${rows||'<div class="bot-strategy-empty">Nessun candidato disponibile dal monitor.</div>'}</div><div class="bot-strategy-foot">Ultimo monitor: ${d?.timestamp?new Date(d.timestamp).toLocaleTimeString('it-IT'):'—'} · paper trading soltanto</div>`;
      window.ML_BOT_TAB_BRIDGE={data:d,updatedAt:new Date().toISOString()};
    }catch(e){
      const card=box.querySelector('.bot-strategy-card');
      if(card)card.innerHTML=`<div class="bot-strategy-head"><div><b>Technical Strategy Engine</b><small>WolfBot concepts · Jesse-style analysis · paper only</small></div><span class="bot-live-dot">OFFLINE</span></div><div class="bot-strategy-error">Monitor tecnico non disponibile: ${esc(e.message||e)}</div>`;
    }finally{loading=false}
  }

  function boot(){
    if(active()){mount();refresh()}
    window.addEventListener('miracolo:panelchange',e=>{if(e.detail?.panel==='bot'){setTimeout(refresh,30)}});
    const obs=new MutationObserver(()=>{if(active()&&!document.getElementById(BOX_ID))setTimeout(refresh,20)});
    obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
