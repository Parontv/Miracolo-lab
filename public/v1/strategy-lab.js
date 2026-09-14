/* Miracolo Lab — Strategy Lab UI
 * Dedicated workspace for strategy/agent research.
 * Operational trading remains in the Bot tab.
 */
(()=>{
  'use strict';
  const BOX='strategyLabBox';
  const AGENTS=[
    {id:'jesse',icon:'⚡',name:'Jesse',desc:'Confluence tecnica e indicatori'},
    {id:'technical',icon:'📐',name:'Technical',desc:'WolfBot-style technical engine'},
    {id:'multi',icon:'🧠',name:'Multi-Agent',desc:'Decisione con più agenti'},
    {id:'historical',icon:'📚',name:'Historical',desc:'Strategie sullo storico'},
    {id:'backtest',icon:'🧪',name:'Backtest',desc:'Confronto delle performance'}
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function style(){if(document.getElementById('strategy-lab-style'))return;const s=document.createElement('style');s.id='strategy-lab-style';s.textContent=`
    #${BOX}{padding:10px 0}.sl-head{padding:4px 2px 12px}.sl-head b{font-size:17px}.sl-head small{display:block;color:#7f8a9a;margin-top:4px;line-height:1.45}.sl-menu{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:12px}.sl-tab{border:1px solid #273140;background:rgba(30,40,58,.35);color:inherit;border-radius:12px;padding:10px 7px;text-align:left;cursor:pointer}.sl-tab.active{border-color:rgba(120,180,220,.65);background:rgba(70,95,130,.28)}.sl-tab b{display:block;font-size:11px}.sl-tab small{display:block;color:#758092;font-size:8px;line-height:1.3;margin-top:3px}.sl-icon{font-size:17px;margin-bottom:5px;display:block}.sl-content{border:1px solid #252e3b;border-radius:15px;padding:14px;background:rgba(15,21,30,.55)}.sl-title{font-size:14px;font-weight:800}.sl-sub{font-size:10px;color:#778293;margin-top:4px;line-height:1.5}.sl-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.sl-btn{border:1px solid rgba(120,150,190,.35);border-radius:10px;background:rgba(70,95,130,.2);color:inherit;padding:10px 13px;font-weight:800;cursor:pointer}.sl-status{margin-top:12px;padding:10px;border-radius:10px;background:#0c1118;color:#8792a3;font-size:10px;line-height:1.5}.sl-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.sl-flow div{padding:10px;border:1px solid #202833;border-radius:10px}.sl-flow b{display:block;font-size:10px}.sl-flow span{display:block;color:#697588;font-size:8px;margin-top:3px}.sl-note{font-size:9px;color:#626e7f;line-height:1.5;margin-top:12px}@media(max-width:700px){.sl-menu{grid-template-columns:repeat(2,1fr)}.sl-menu .sl-tab:last-child{grid-column:span 2}.sl-flow{grid-template-columns:1fr}.sl-head b{font-size:16px}}
  `;document.head.appendChild(s)}
  function mount(){const side=document.getElementById('sidePanel');if(!side)return null;let b=document.getElementById(BOX);if(!b){b=document.createElement('div');b.id=BOX;b.className='panel-section';side.innerHTML='';side.appendChild(b)}return b}
  function active(){return window.__mlPanel==='strategy'||document.body.dataset.activePanel==='strategy'}
  function runAgent(id){
    const b=mount();if(!b)return;const status=b.querySelector('.sl-status');if(status)status.innerHTML='⏳ Avvio analisi…';
    setTimeout(()=>{
      let msg='Laboratorio pronto. Nessuna operazione reale.';
      if(id==='jesse')msg='Jesse usa la confluence degli indicatori tecnici disponibili. Puoi aprire l’analisi dettagliata dal laboratorio.';
      if(id==='technical')msg='Technical Engine valuta RSI, MACD, EMA, Bollinger, Donchian e momentum sui dati disponibili.';
      if(id==='multi')msg='Multi-Agent combina prospettive diverse prima di produrre una decisione candidata per il Bot.';
      if(id==='historical')msg='Historical prepara strategie e scenari sullo storico disponibile, senza inventare dati mancanti.';
      if(id==='backtest')msg='Backtest confronta rendimento, drawdown, Sharpe e win rate con buy & hold.';
      if(status)status.innerHTML='✓ '+esc(msg);
    },250);
  }
  function render(){const b=mount();if(!b)return;style();let selected=window.__mlStrategyAgent||'jesse';if(!AGENTS.some(x=>x.id===selected))selected='jesse';b.innerHTML=`<div class="sl-head"><b>🧪 Strategy Lab</b><small>Qui costruiamo, confrontiamo e testiamo le strategie. Il Bot riceve soltanto i risultati utili alla decisione.</small></div><div class="sl-menu">${AGENTS.map(a=>`<button type="button" class="sl-tab ${a.id===selected?'active':''}" data-agent="${a.id}"><span class="sl-icon">${a.icon}</span><b>${a.name}</b><small>${a.desc}</small></button>`).join('')}</div><div class="sl-content">${content(selected)}</div>`;b.querySelectorAll('.sl-tab').forEach(x=>x.onclick=()=>{window.__mlStrategyAgent=x.dataset.agent;render()});b.querySelectorAll('.sl-btn[data-agent]').forEach(x=>x.onclick=()=>runAgent(x.dataset.agent));}
  function content(id){const a=AGENTS.find(x=>x.id===id);return `<div class="sl-title">${a.icon} ${a.name}</div><div class="sl-sub">${a.desc}. Modulo separato dal motore operativo del Bot.</div><div class="sl-actions"><button class="sl-btn" data-agent="${id}">▶ Avvia analisi</button></div><div class="sl-status">Pronto. Avvia manualmente il laboratorio quando vuoi.</div><div class="sl-flow"><div><b>1 · Input</b><span>Mercato, prezzi, news e dati storici</span></div><div><b>2 · Analisi</b><span>Strategia/agenti valutano gli stessi dati</span></div><div><b>3 · Output</b><span>Risultato candidato trasferibile al Bot</span></div></div><div class="sl-note">Paper analysis. Nessun ordine reale viene eseguito da questo laboratorio.</div>`}
  function boot(){if(active())render()}
  window.addEventListener('miracolo:panelchange',e=>{if(e.detail?.panel==='strategy')setTimeout(render,40)});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,100));
  window.ML_STRATEGY_LAB={render,runAgent};
})();