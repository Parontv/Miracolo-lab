/* Miracolo Lab — Bot cockpit + multi-agent decision layer
 * One operational surface: the Bot. Paper trading only.
 */
(()=>{
'use strict';
const BOX='miracoloTradingAgentsBox';
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const pct=v=>v==null?'—':`${v>=0?'+':''}${Number(v).toFixed(2)}%`;
let busy=false;
function active(){return document.body.dataset.activePanel==='bot'||window.__mlPanel==='bot'}
function mount(){if(!active())return null;const side=document.getElementById('sidePanel');if(!side)return null;let b=document.getElementById(BOX);if(!b){b=document.createElement('div');b.id=BOX;b.className='panel-section';side.prepend(b)}return b}
function shell(b){if(!b)return;if(!b.querySelector('.bot-cockpit'))b.innerHTML='<div class="panel-section-label">BOT · OPERATIVO</div><section class="bot-cockpit"><header class="bot-cockpit-head"><div><div class="bot-kicker">AI TRADING BOT</div><h1>Centro operativo</h1><p>Il Bot raccoglie mercato, news e macro, confronta specialisti e decide se esiste un setup. Solo paper trading.</p></div><div class="bot-status" id="botStatus">READY</div></header><div class="bot-actions"><button class="bot-run" type="button">▶ SCANSIONA MERCATO</button><button class="bot-multi" type="button">🧠 MULTI-AGENT DECISION</button><span class="bot-last" id="botLast">Nessuna scansione eseguita</span></div><div class="bot-result" id="botResult"><div class="bot-empty"><b>Il Bot è pronto.</b><span>Avvia una scansione o Multi-Agent Decision. Se i dati non sono sufficienti, il Bot mostrerà WAIT e non inventerà un segnale.</span></div></div></section>'}
async function fetchJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url} HTTP ${r.status}`);return r.json()}
async function get(){
 const results=await Promise.allSettled([
  fetchJson('/api/market-monitor-v2?ts='+Date.now()),
  fetchJson('/api/market-monitor?ts='+Date.now()),
  fetchJson('/api/ai?ts='+Date.now()),
  fetchJson('/api/bot-monitor?ts='+Date.now()),
  fetchJson('/api/full-scan?ts='+Date.now())
 ]);
 const value=i=>results[i].status==='fulfilled'?results[i].value:null;
 const market=value(0)||value(1);
 const aiRaw=value(2);
 return{market,ai:aiRaw?.ai||aiRaw||null,bot:value(3),scan:value(4),availability:results.map(x=>x.status),partial:results.some(x=>x.status==='rejected'),errors:results.map((x,i)=>x.status==='rejected'?`Fonte ${i+1}: ${x.reason?.message||'errore'}`:null).filter(Boolean)};
}
function indices(c){return Array.isArray(c?.market?.indices)?c.market.indices:Array.isArray(c?.indices)?c.indices:[]}
function specialist(c){
 const ix=indices(c), crypto=Array.isArray(c.market?.crypto)?c.market.crypto:[], tech=Array.isArray(c.bot?.candidates)?c.bot.candidates:[];
 const equity=avg(ix.map(x=>num(x.changePct)).filter(v=>v!==null));
 const cryptoMove=avg(crypto.map(x=>num(x.change24h)).filter(v=>v!==null));
 const find=re=>ix.find(x=>re.test(String(x.name||x.symbol||x.ticker||'')));
 const dxy=find(/DXY/i),us10=find(/US10Y|10Y/i),vix=find(/VIX/i),oil=find(/BRENT|WTI|OIL/i);
 const rates=num(us10?.changePct),dollar=num(dxy?.changePct),vol=num(vix?.changePct),oilMove=num(oil?.changePct);
 const newsText=String(c.ai?.commentary||c.ai?.summary||'');
 let macro=0,sentiment=0,technical=0;
 macro+=rates!==null?(rates<0?2:rates>0?-2:0):0;
 macro+=dollar!==null?(dollar<0?1:dollar>0?-1:0):0;
 macro+=oilMove!==null?(oilMove>1?-1:oilMove<-1?1:0):0;
 sentiment+=equity>0.25?2:equity<-0.25?-2:0;
 sentiment+=cryptoMove>0.8?1:cryptoMove<-0.8?-1:0;
 sentiment+=vol!==null?(vol>2?-2:vol<-2?1:0):0;
 const scored=tech.map(x=>num(x.score??x.fused)).filter(v=>v!==null);technical=scored.length?Math.max(-4,Math.min(4,(avg(scored)-50)/12.5)):0;
 const newsBull=/costruttiv|rialz|support|positivo|favor|ripres|bull/i.test(newsText),newsBear=/prudenz|pression|debole|ribass|inflazion|volatil/i.test(newsText);
 sentiment+=newsBull&&!newsBear?1:newsBear&&!newsBull?-1:0;
 const total=macro+sentiment+technical;
 return{bull:{score:total,drivers:[equity!==0?`Azionario ${pct(equity)}`:'Azionario neutro',dollar!==null?`Dollaro ${pct(dollar)}`:'Dollaro n/d']},bear:{score:-total,drivers:[rates!==null&&rates>0?'Rendimenti in rialzo':null,oilMove!==null&&oilMove>1?'Energia in pressione inflazionistica':null,vol!==null&&vol>2?'Volatilità in aumento':null].filter(Boolean)},macro:{score:macro,rates,dollar,oil:oilMove},sentiment:{score:sentiment,equity,crypto:cryptoMove,volatility:vol},technical:{score:technical,candidates:tech.slice(0,5)}};
}
function choose(c,a){
 const candidates=Array.isArray(c.bot?.candidates)?c.bot.candidates:Array.isArray(c.market?.candidates)?c.market.candidates:[];
 let base=candidates.slice().sort((x,y)=>Number(y.score??y.fused??50)-Number(x.score??x.fused??50))[0]||null;
 const baseScore=num(base?.score??base?.fused);
 const net=a.bull.score;
 let direction=net>=2?'LONG':net<=-2?'SHORT':'WAIT';
 if(baseScore!==null){if(baseScore>=70&&net>=1)direction='LONG';else if(baseScore<=30&&net<=-1)direction='SHORT';else if(Math.abs(net)<1)direction='WAIT'}
 const confidence=Math.round(Math.max(50,Math.min(88,55+Math.abs(net)*6+(baseScore!==null?Math.abs(baseScore-50)*.25:0))));
 const risk=(a.sentiment.volatility!==null&&a.sentiment.volatility>2)||(a.macro.oil!==null&&a.macro.oil>2)?'ALTO':confidence>=70?'MEDIO':'ELEVATO';
 const approved=direction!=='WAIT'&&confidence>=65&&risk!=='ALTO';
 const price=num(base?.price??base?.last??base?.close),stopPct=0.6,targetPct=1.8;
 const stop=price!==null?price*(direction==='LONG'?1-stopPct/100:1+stopPct/100):null,target=price!==null?price*(direction==='LONG'?1+targetPct/100:1-targetPct/100):null;
 return{direction,confidence,risk,approved,base,price,stop,target,rr:3,reason:direction==='WAIT'?'Le evidenze non sono sufficientemente convergenti: nessuna operazione.':approved?'Il consenso supera la soglia del Bot e il rischio è compatibile con un paper trade.':'La direzione esiste, ma il Risk Manager non approva l’ingresso.'};
}
function paperJournal(d){if(!d.approved||!d.base)return;const key=`${d.direction}|${d.base.symbol||d.base.name}|${Math.round(d.price||0)}`;let rows=[];try{rows=JSON.parse(localStorage.getItem('mlBotJournal')||'[]')}catch{}if(rows.some(x=>x.key===key))return;rows.unshift({key,time:new Date().toISOString(),direction:d.direction,symbol:d.base.symbol||d.base.name,price:d.price,stop:d.stop,target:d.target,confidence:d.confidence,status:'PROPOSTA'});localStorage.setItem('mlBotJournal',JSON.stringify(rows.slice(0,30)))}
function journalHTML(){let rows=[];try{rows=JSON.parse(localStorage.getItem('mlBotJournal')||'[]')}catch{}if(!rows.length)return '<span>Nessun paper trade registrato.</span>';return rows.slice(0,8).map(x=>`<div><span>${new Date(x.time).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span><b>${esc(x.direction)} · ${esc(x.symbol)}</b><span>${x.price!=null?Number(x.price).toFixed(2):'—'} · ${esc(x.status)}</span></div>`).join('')}
function render(c,a,d){const b=mount();if(!b)return;const r=b.querySelector('#botResult'),base=d.base||{};const agents=[['Market Agent',`Azionario ${pct(a.sentiment.equity)} · tecnico ${a.technical.score.toFixed(1)}`],['News Agent',c.ai?.commentary||c.ai?.summary||'Nessun commento AI disponibile'],['Macro Agent',`score ${a.macro.score.toFixed(1)} · tassi ${pct(a.macro.rates)} · DXY ${pct(a.macro.dollar)}`],['Risk Agent',`${d.risk} · stop obbligatorio · paper only`]];const sourceNote=c.partial?`Dati parziali: ${c.errors.join(' · ')}`:'Tutte le fonti principali hanno risposto.';r.innerHTML=`<div class="bot-decision ${d.direction.toLowerCase()}"><div class="bot-decision-main"><small>DECISIONE DEL BOT</small><strong>${d.direction}</strong><span>${esc(d.reason)}</span></div><div class="bot-decision-stats"><div><small>CONVICTION</small><b>${d.confidence}%</b></div><div><small>RISCHIO</small><b>${d.risk}</b></div><div><small>STATO</small><b>${d.approved?'PAPER · PROPOSTA':'NESSUN TRADE'}</b></div></div></div>${d.approved?`<div class="bot-trade-card"><div class="bot-trade-title"><div><small>SETUP OPERATIVO</small><h2>${esc(base.name||base.symbol||'Mercato')}</h2></div><span>${esc(d.direction)}</span></div><div class="bot-trade-grid"><div><small>ENTRY</small><b>${d.price!==null?d.price.toFixed(2):'—'}</b></div><div><small>STOP</small><b>${d.stop!==null?d.stop.toFixed(2):'—'}</b></div><div><small>TARGET</small><b>${d.target!==null?d.target.toFixed(2):'—'}</b></div><div><small>R/R</small><b>1 : ${d.rr.toFixed(1)}</b></div></div><div class="bot-riskline">Capitale paper €2.000 · rischio massimo €10 (0,5%) · massimo 3 operazioni/giorno</div><button class="bot-paper-btn" type="button" data-paper-approve="1">✓ REGISTRA COME PAPER TRADE</button></div>`:'<div class="bot-no-trade"><b>WAIT — nessuna operazione</b><span>Il Bot preferisce non entrare quando le evidenze non sono abbastanza solide.</span></div>'}<div class="bot-agents"><div class="bot-section-title">Decisione multi-agent</div>${agents.map(x=>`<article><b>${esc(x[0])}</b><span>${esc(x[1])}</span></article>`).join('')}</div><div class="bot-explain"><b>Fonti: </b>${esc(sourceNote)}</div><div class="bot-section-title bot-journal-title">Diario paper</div><div class="bot-journal" id="botJournal">${journalHTML()}</div>`;paperJournal(d);const j=b.querySelector('#botJournal');if(j)j.innerHTML=journalHTML()}
async function run(){if(busy||!active())return;busy=true;const b=mount();shell(b);const btn=b?.querySelector('.bot-multi'),runBtn=b?.querySelector('.bot-run'),st=b?.querySelector('#botStatus');if(btn){btn.disabled=true;btn.textContent='⏳ MULTI-AGENT IN ANALISI…'}if(runBtn)runBtn.disabled=true;if(st)st.textContent='SCANSIONE';try{const c=await get(),a=specialist(c),d=choose(c,a);render(c,a,d);if(b?.querySelector('#botLast'))b.querySelector('#botLast').textContent='Decisione aggiornata '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});if(st)st.textContent=d.approved?'SEGNALE':'WAIT';window.ML_TRADING_BOT={context:c,agents:a,decision:d,updatedAt:new Date().toISOString()}}catch(e){if(st)st.textContent='ERRORE';if(b)b.querySelector('#botResult').innerHTML=`<div class="bot-error"><b>Multi-Agent Decision non disponibile.</b><span>${esc(e.message||e)}</span><small>Il Bot non genera segnali in assenza di dati verificabili.</small></div>`}finally{busy=false;if(btn){btn.disabled=false;btn.textContent='🧠 MULTI-AGENT DECISION'}if(runBtn)runBtn.disabled=false}}
function bind(b){if(!b)return;shell(b);if(b.dataset.botBound==='1')return;b.dataset.botBound='1';b.addEventListener('click',e=>{if(e.target.closest('.bot-run')||e.target.closest('.bot-multi'))run();if(e.target.closest('[data-paper-approve]')){let rows=[];try{rows=JSON.parse(localStorage.getItem('mlBotJournal')||'[]')}catch{}if(rows[0]){rows[0].status='PAPER REGISTRATO';localStorage.setItem('mlBotJournal',JSON.stringify(rows));const j=b.querySelector('#botJournal');if(j)j.innerHTML=journalHTML()}}})}
function boot(){bind(mount());window.addEventListener('miracolo:panelchange',e=>{if(e.detail?.panel==='bot')setTimeout(()=>bind(mount()),30)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.runMiracoloBot=run;
})();
