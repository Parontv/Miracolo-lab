/* Miracolo Lab — TradingAgents-style decision layer
 * Clean-room implementation inspired by the multi-agent workflow of
 * TauricResearch/TradingAgents. No source code is copied.
 * Proof-of-concept: deterministic specialist agents consume the existing
 * Market Intelligence + WolfBot snapshots, then produce Bull/Bear/Trader/Risk.
 * Paper analysis only. No order execution.
 */
(()=>{
  'use strict';
  const BOX='miracoloTradingAgentsBox';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const pct=(v)=>v==null?'—':`${v>=0?'+':''}${v.toFixed(2)}%`;
  let busy=false;

  function active(){return document.body.dataset.activePanel==='bot'||window.__mlPanel==='bot'}
  function mount(){
    if(!active())return null;
    const side=document.getElementById('sidePanel'); if(!side)return null;
    let b=document.getElementById(BOX); if(!b){b=document.createElement('div');b.id=BOX;b.className='panel-section';side.prepend(b)}
    return b;
  }
  function shell(b){if(b&&!b.querySelector('.ta-card'))b.innerHTML='<div class="panel-section-label">BOT · AI TRADING DESK</div><div class="ta-card"><div class="ta-head"><div><b>Multi-Agent Decision Engine</b><small>News · Macro · Technical · Bull/Bear · Trader · Risk</small></div><span class="ta-status">READY</span></div><div class="ta-intro">Analisi sperimentale in modalità PAPER. Il motore separa gli specialisti e solo dopo costruisce la decisione.</div><button class="ta-run" type="button">▶ Esegui analisi multi-agent</button><div class="ta-result"><div class="ta-empty">Premi il pulsante per costruire il primo consensus.</div></div></div>'}

  async function get(){
    const [market,ai,bot]=await Promise.all([
      fetch('/api/market-monitor-v2?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>({})),
      fetch('/api/ai?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>({})),
      fetch('/api/bot-monitor?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>({}))
    ]);
    return {market,ai:ai?.ai||null,bot};
  }

  function specialist(context){
    const indices=Array.isArray(context.market?.indices)?context.market.indices:[];
    const crypto=Array.isArray(context.market?.crypto)?context.market.crypto:[];
    const tech=Array.isArray(context.bot?.candidates)?context.bot.candidates:[];
    const moves=indices.map(x=>n(x.changePct)).filter(v=>v!==null), cm=crypto.map(x=>n(x.change24h)).filter(v=>v!==null);
    const equity=avg(moves), cryptoMove=avg(cm);
    const find=(re)=>indices.find(x=>re.test(String(x.name||'')));
    const dxy=find(/DXY/i), us10=find(/US10Y|10Y/i), vix=find(/VIX/i), gold=find(/GOLD/i), oil=find(/BRENT|WTI|OIL/i);
    const rates=n(us10?.changePct), dollar=n(dxy?.changePct), vol=n(vix?.changePct), goldMove=n(gold?.changePct), oilMove=n(oil?.changePct);
    const newsText=String(context.ai?.commentary||'');
    let macro=0, sentiment=0, technical=0;
    macro+=(rates!==null?(rates<0?2:rates>0?-2:0):0); macro+=(dollar!==null?(dollar<0?1:dollar>0?-1:0):0); macro+=(oilMove!==null?(oilMove>1?-1:oilMove<-1?1:0):0);
    sentiment+=(equity>0.25?2:equity<-0.25?-2:0); sentiment+=(cryptoMove>0.8?2:cryptoMove<-0.8?-2:0); sentiment+=(vol!==null?(vol>2?-2:vol<-2?1:0):0);
    const scored=tech.map(x=>n(x.score??x.fused)).filter(v=>v!==null); technical=scored.length?avg(scored)/25:0;
    const newsBull=/costruttiv|rialz|support|positivo|favor|ripres|bull/i.test(newsText),newsBear=/prudenz|pression|risch|debole|ribass|inflazion|volatil/i.test(newsText); sentiment+=newsBull&&!newsBear?1:newsBear&&!newsBull?-1:0;
    const bull={score:macro+sentiment+technical,thesis:`Macro ${macro>=0?'favorevole':'sfavorevole'}, rischio ${sentiment>=0?'costruttivo':'difensivo'} e componente tecnica ${technical>=0?'positiva':'negativa'}.`,drivers:[equity!==0?`Azionario ${pct(equity)}`:'Azionario neutro',cryptoMove!==0?`Crypto ${pct(cryptoMove)}`:'Crypto neutra',dollar!==null?`Dollaro ${pct(dollar)}`:'Dollaro n/d'].filter(Boolean)};
    const bear={score:-(macro+sentiment+technical),thesis:`Il caso contrario resta legato a ${vol!==null&&vol>2?'volatilità elevata e': ''} divergenze tra prezzo, tassi e propensione al rischio.`,drivers:[rates!==null&&rates>0?'Rendimenti in rialzo':null,oilMove!==null&&oilMove>1?'Energia in pressione inflazionistica':null,vol!==null&&vol>2?'Volatilità in aumento':null].filter(Boolean)};
    return {bull,bear,macro:{score:macro,rates,dollar,oil:oilMove,gold:goldMove},sentiment:{score:sentiment,equity,crypto:cryptoMove,volatility:vol},technical:{score:technical,candidates:tech.slice(0,5).map(x=>({symbol:x.symbol,name:x.name,action:x.action,score:x.score??x.fused}))}};
  }

  function decide(a){
    const net=a.bull.score+a.bear.score;
    const direction=net>=2?'LONG':net<=-2?'SHORT':'HOLD';
    const contradiction=Math.abs(a.bull.score)<=2 || (a.bull.score>0&&a.bear.score>0);
    const confidence=Math.round(Math.max(52,Math.min(88,54+Math.abs(net)*7-(contradiction?8:0))));
    const risk=(a.sentiment.volatility!==null&&a.sentiment.volatility>2)||(a.macro.oil!==null&&a.macro.oil>2)?'HIGH':confidence>=72?'MEDIUM':'ELEVATED';
    const approved=direction==='HOLD'?false:confidence>=62&&risk!=='HIGH';
    return {direction,confidence,risk,approved,reason:direction==='HOLD'?'Le evidenze non sono sufficientemente convergenti per una posizione direzionale.':approved?'La confluence supera la soglia minima e il rischio resta compatibile con una posizione paper.':'La tesi direzionale esiste, ma il Risk Manager non approva l\'ingresso in questa configurazione.'};
  }

  function render(context,a,d){
    const b=mount();if(!b)return;const r=b.querySelector('.ta-result'),status=b.querySelector('.ta-status');
    status.textContent='LIVE';
    const tech=a.technical.candidates.map(x=>`<span>${esc(x.symbol||x.name||'asset')}: <b>${esc(x.action||'WAIT')}</b></span>`).join(' · ')||'Nessun candidato tecnico disponibile';
    r.innerHTML=`<div class="ta-decision"><div><small>PORTFOLIO MANAGER</small><strong class="ta-${d.direction.toLowerCase()}">${d.direction}</strong></div><div><small>CONVICTION</small><strong>${d.confidence}%</strong></div><div><small>RISK</small><strong>${d.risk}</strong></div><div><small>STATUS</small><strong>${d.approved?'APPROVED · PAPER':'REVIEW'}</strong></div></div><div class="ta-grid"><article><b>News / Market Analyst</b><p>${esc(context.ai?.commentary||'Analisi AI non disponibile; il motore utilizza i dati di mercato locali.')}</p></article><article><b>Macro / Rates Analyst</b><p>${esc(a.bull.thesis)} ${esc(a.bear.thesis)}</p></article><article><b>Bull Researcher</b><p>${esc(a.bull.drivers.join(' · ')||'Nessun driver dominante.')}</p></article><article><b>Bear Researcher</b><p>${esc(a.bear.drivers.join(' · ')||'Nessun rischio dominante.')}</p></article></div><div class="ta-trader"><b>Trader Agent</b><span>Consensus: ${esc(d.direction)} · ${esc(d.reason)}</span></div><div class="ta-risk"><b>Risk Manager</b><span>${esc(d.risk)} · Nessun ordine reale · ${esc(tech)}</span></div><div class="ta-foot">Snapshot: ${new Date().toLocaleTimeString('it-IT')} · architettura multi-agent POC</div>`;
    window.ML_TRADING_AGENTS={context,agents:a,decision:d,updatedAt:new Date().toISOString()};
  }

  async function run(){if(busy||!active())return;busy=true;const b=mount();shell(b);const button=b?.querySelector('.ta-run'),status=b?.querySelector('.ta-status');if(button){button.disabled=true;button.textContent='⏳ Elaborazione agenti…'}try{const context=await get(),a=specialist(context),d=decide(a);render(context,a,d)}catch(e){const r=b?.querySelector('.ta-result');if(r)r.innerHTML=`<div class="ta-error">Multi-agent engine non disponibile: ${esc(e.message||e)}</div>`}finally{busy=false;const b2=mount(),button2=b2?.querySelector('.ta-run');if(button2){button2.disabled=false;button2.textContent='▶ Esegui analisi multi-agent'}}}
  function boot(){const b=mount();if(b){shell(b);b.addEventListener('click',e=>{if(e.target.closest('.ta-run'))run()})}window.addEventListener('miracolo:panelchange',e=>{if(e.detail?.panel==='bot'){setTimeout(()=>{const x=mount();if(x)shell(x)},30)}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
