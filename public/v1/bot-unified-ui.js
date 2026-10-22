/* Miracolo Lab — Unified Bot UI v1.0
 * One workspace: sources -> analysis -> decision -> paper operation.
 * Keeps existing engines; changes only presentation/orchestration surface.
 */
(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=n=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:2});
const pct=n=>(n>=0?'+':'')+fmt(n)+'%';
const sourceIcon={news:'📰',social:'💬',macro:'🌍',crypto:'₿'};
function sourceGroups(){
  const list=Array.isArray(window.S?.sources)?window.S.sources:[];
  const groups={news:[],social:[],macro:[],crypto:[],other:[]};
  list.forEach(s=>{const g=groups[s.cat]?s.cat:'other';groups[g].push(s)});
  return groups;
}
function sourcesBlock(){
  const g=sourceGroups(), labels={news:'Notizie',social:'Social',macro:'Macro & economia',crypto:'Crypto',other:'Altre fonti'};
  const keys=Object.keys(g);
  return `<details class="bot-fold bot-sources-fold"><summary><span>📡 Fonti</span><em>${g.news.length+g.social.length+g.macro.length+g.crypto.length+g.other.length} rilevate</em></summary><div class="bot-source-groups">${keys.map(k=>{
    if(!g[k].length)return '';
    const ok=g[k].filter(s=>s.status==='ok').length;
    return `<details class="bot-source-group"><summary><span>${sourceIcon[k]||'📡'} ${labels[k]}</span><em>${ok}/${g[k].length} OK</em></summary><div class="bot-source-list">${g[k].map(s=>`<div class="bot-source-row"><span>${esc(s.name)}</span><b class="${s.status==='ok'?'ok':'err'}">${s.status==='ok'?'OK':'ERR'}${s.count!=null?' · '+esc(s.count):''}</b></div>`).join('')}</div></details>`;
  }).join('')}</div></details>`;
}
function strategyMount(){
  return `<section class="bot-module bot-strategy-module"><div class="bot-module-head"><div><b>Strategie</b><small>Jesse · WolfBot · Multi-Agent · Historical · Backtest · Learning · Memory</small></div><span class="bot-module-state">PAPER</span></div><div id="miracoloBotStrategyBox" class="bot-strategy-inline"></div></section>`;
}
function panelBotUnified(){
  const BOT=window.BOT;
  const pv=BOT?.portfolioValue?BOT.portfolioValue(window.S?.cryptoPrices||{}):0;
  const pnl=pv-(BOT?.initialBudget||0), pnlPct=BOT?.initialBudget?pnl/BOT.initialBudget*100:0;
  const status=BOT?.status||'ACTIVE';
  return `<div class="bot-unified">
    <header class="bot-hero"><div><div class="bot-kicker">🤖 BOT · CENTRO OPERATIVO</div><h1>Analisi e decisione</h1><p>Una sola pipeline: fonti → strategie → consensus → rischio → paper trading.</p></div><div class="bot-hero-actions"><span class="bot-paper-pill">PAPER ONLY</span><button class="bot-main-run bot-run" id="botUnifiedRun">▶ Avvia analisi</button></div></header>
    <section class="bot-command-card"><div class="bot-command-status"><span class="bot-live-dot"></span><b id="botStatus">READY · WAIT</b><small id="botLast">Nessuna scansione in questa sessione</small></div><div class="bot-command-note">Il comando esegue l'intero ciclo senza ordini reali.</div></section>
    <section class="bot-overview-grid"><div class="bot-overview-card"><span>Mercato</span><strong id="botMarketSummary">—</strong><small>indici e strumenti live</small></div><div class="bot-overview-card"><span>News</span><strong id="botNewsSummary">—</strong><small>sentiment e contesto</small></div><div class="bot-overview-card"><span>Consensus</span><strong id="botConsensusSummary">—</strong><small>peso effettivamente usato</small></div><div class="bot-overview-card"><span>Paper</span><strong>${status==='ACTIVE'?'READY':'PAUSED'}</strong><small>${fmt(pv)}€ · P&L ${pct(pnlPct)}</small></div></section>
    ${sourcesBlock()}
    <section class="bot-module bot-analysis-module"><div class="bot-module-head"><div><b>Analisi della scansione</b><small>Il riepilogo completo compare qui dopo l'avvio.</small></div><span>LIVE</span></div><div id="botResult" class="bot-result-shell"><div class="bot-empty-state"><b>Pronto per la scansione</b><span>Premi “Avvia analisi” per acquisire mercato, news, macro e strategie.</span></div></div></section>
    ${strategyMount()}
    <details class="bot-fold bot-operation-fold"><summary><span>💼 Operatività paper</span><em>controllo manuale</em></summary><div class="bot-operation-body"><div class="bot-paper-stats"><div><span>Budget</span><b>${fmt(BOT?.initialBudget||0)}€</b></div><div><span>Cash</span><b>${fmt(BOT?.cash||0)}€</b></div><div><span>Posizioni</span><b>${Object.keys(BOT?.positions||{}).length}/${BOT?.params?.maxPositions||3}</b></div><div><span>Accuratezza</span><b>${BOT?.accuracy?.rate||0}%</b></div></div><div class="bot-operation-note">Nessun ordine reale. Le proposte richiedono sempre la tua approvazione.</div></div></details>
    <details class="bot-fold"><summary><span>📚 Storico e apprendimento</span><em>${BOT?.trades?.length||0} operazioni</em></summary><div class="bot-history-body"><div class="bot-history-note">Il registro delle operazioni e gli esiti alimentano Learning nelle scansioni successive.</div><button class="bot-secondary-btn" onclick="setPanel('learning')">Apri Learning</button></div></details>
  </div>`;
}
function syncOverview(){
  const d=window.ML_BOT_DECISION;if(!d)return;
  const m=(d.evidence||[]).find(x=>x.name==='Indici / Mercato'),n=(d.evidence||[]).find(x=>x.name==='Notizie / Sentiment');
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('botMarketSummary',m?`${m.action} · ${m.confidence}%`:'—');
  set('botNewsSummary',n?`${n.action} · ${n.confidence}%`:'—');
  set('botConsensusSummary',`${d.action} · ${d.confidence}%`);
}
function bind(){
  const b=document.getElementById('botUnifiedRun');
  if(b)b.addEventListener('click',e=>{if(typeof window.runMiracoloBotDecision==='function')window.runMiracoloBotDecision(e);else if(typeof window.runMiracoloDecisionCycle==='function')window.runMiracoloDecisionCycle(e);});
}
const oldPanel=window.panelBot;
window.panelBot=panelBotUnified;
window.addEventListener('miracolo:botdecision',syncOverview);
const oldRender=window.renderPanel;
window.renderPanel=function(){oldRender.apply(this,arguments);if(window.S?.activePanel==='bot'){setTimeout(bind,0);setTimeout(syncOverview,50);}};
function cleanup(){document.querySelectorAll('#miracoloWolfBotEngineBox').forEach(x=>x.remove());}
window.addEventListener('load',()=>{if(window.S?.activePanel==='bot'){bind();cleanup()}});
})();
