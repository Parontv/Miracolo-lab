/* Miracolo Lab 2.0 — Strategy Lab */
(()=>{
'use strict';
const BOX='strategyLabBox';
const MODULES=[
{id:'jesse',icon:'⚡',name:'Jesse',desc:'Confluenza tecnica',sections:['Overview','Market Structure','Trend Analysis','Momentum','RSI','MACD','EMA / SMA','Bollinger Bands','Support & Resistance','Breakout Detection','Volume Analysis','Volatility','Multi-Timeframe','Signal','Confidence','Historical Comparison','Strategy Performance']},
{id:'technical',icon:'📐',name:'WolfBot',desc:'Indicatori e segnali',sections:['Overview','Trend','Momentum','RSI / MACD','Moving Averages','Bollinger Bands','Breakout','Volume','Volatility','Support / Resistance','Signal','Risk / Reward','Confidence','Performance']},
{id:'multi',icon:'🧠',name:'Multi-Agent',desc:'Bull · Bear · Trader · Risk',sections:['Overview','Bull Agent','Bear Agent','Trader Agent','Risk Agent','Evidence','Debate','Consensus','Confidence','Risk Flags']},
{id:'historical',icon:'📚',name:'Historical',desc:'Confronto con lo storico',sections:['Overview','Data Quality','Analogues','Market Regimes','Similar Events','Outcome Distribution','Time Horizons','Reliability','Limitations']},
{id:'backtest',icon:'🧪',name:'Backtest',desc:'Rendimento · DD · Robustezza',sections:['Overview','Returns','Trades','Win Rate','Drawdown','Profit Factor','Benchmark','Risk Adjusted','Robustness','Limitations']},
{id:'learning',icon:'📈',name:'Learning',desc:'Performance del sistema',sections:['Overview','Accuracy','Signal Quality','Strategy Performance','Error Analysis','Recent Outcomes','Drift','Reliability','Improvements','Limits']}
];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const series=c=>{for(const x of [c?.closes,c?.closeHistory,c?.history,c?.prices,c?.priceHistory,c?.candles?.map(z=>z.close)]){if(Array.isArray(x)){const a=x.map(Number).filter(Number.isFinite);if(a.length>=5)return a}}return[]};
const ema=(a,p)=>{if(a.length<p)return null;let e=avg(a.slice(0,p)),k=2/(p+1);for(let i=p;i<a.length;i++)e=a[i]*k+e*(1-k);return e};
const rsi=(a,p=14)=>{if(a.length<p+1)return null;let g=0,l=0;for(let i=a.length-p;i<a.length;i++){const d=a[i]-a[i-1];if(d>0)g+=d;else l-=d}return l?100-100/(1+g/l):100};
const technical=c=>{const a=series(c),p=n(c?.price),rows=[];if(a.length>=15){const r=rsi(a),e12=ema(a,12),e26=ema(a,26);if(r!==null)rows.push(['RSI',r<30?'BUY':r>70?'SELL':'WAIT',r.toFixed(1)]);if(e12!==null&&e26!==null)rows.push(['EMA 12/26',e12>e26?'BUY':'SELL',e12>e26?'rialzista':'ribassista']);if(a.length>=20){const x=a.slice(-20),m=avg(x),sd=Math.sqrt(avg(x.map(v=>(v-m)**2)));rows.push(['Bollinger',p<m-2*sd?'BUY':p>m+2*sd?'SELL':'WAIT','posizione prezzo']);const hi=Math.max(...x),lo=Math.min(...x);rows.push(['Donchian',p>=hi?'BUY':p<=lo?'SELL':'WAIT',p>=hi?'breakout high':p<=lo?'breakout low':'channel']);}}const b=rows.filter(x=>x[1]==='BUY').length,s=rows.filter(x=>x[1]==='SELL').length;return{rows,b,s,action:b>s?'BUY':s>b?'SELL':'WAIT',history:a.length};};
const backtest=c=>{const a=series(c);if(a.length<30)return{ok:false,points:a.length};let cash=1000,units=0,entry=0,peak=1000,dd=0,trades=[];for(let i=26;i<a.length;i++){const x=technical({closes:a.slice(0,i+1),price:a[i]}).action;if(x==='BUY'&&!units){units=(cash*.98)/a[i];cash=0;entry=a[i]}else if(x==='SELL'&&units){cash=units*a[i]*.999;trades.push((a[i]/entry-1)*100);units=0}const eq=cash+units*a[i];peak=Math.max(peak,eq);dd=Math.max(dd,(peak-eq)/peak*100)}if(units)cash=units*a.at(-1)*.999;const ret=(cash/1000-1)*100,w=trades.filter(x=>x>0);return{ok:true,points:a.length,ret,dd,trades:trades.length,win:trades.length?w.length/trades.length*100:0,benchmark:(a.at(-1)/a[0]-1)*100};};
let state={candidates:[],market:null,ai:null,results:{}};
async function data(){const [bot,market,ai]=await Promise.all([fetch('/api/bot-monitor?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),fetch('/api/market-monitor-v2?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>null),fetch('/api/ai?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>null)]);state={...state,candidates:Array.isArray(bot?.candidates)?bot.candidates:[],market,ai:ai?.ai||null};return state;}
function mount(){const side=document.getElementById('sidePanel');if(!side)return null;let b=document.getElementById(BOX);if(!b){b=document.createElement('div');b.id=BOX;b.className='panel-section';side.innerHTML='';side.appendChild(b)}return b}
function css(){if(document.getElementById('sl2-css'))return;const s=document.createElement('style');s.id='sl2-css';s.textContent=`#${BOX}{padding:10px 0}.sl2-head{padding:4px 2px 12px}.sl2-head b{font-size:17px}.sl2-head small{display:block;color:#7f8a9a;margin-top:4px;line-height:1.45}.sl2-menu{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}.sl2-tab,.sl2-btn{border:1px solid #273140;background:rgba(30,40,58,.35);color:inherit;border-radius:11px;padding:10px;cursor:pointer}.sl2-tab.active{border-color:rgba(120,180,220,.7);background:rgba(70,95,130,.28)}.sl2-tab b,.sl2-tab small{display:block}.sl2-tab b{font-size:11px}.sl2-tab small{font-size:8px;color:#758092;margin-top:3px}.sl2-icon{font-size:17px;display:block;margin-bottom:4px}.sl2-content{border:1px solid #252e3b;border-radius:15px;padding:14px;background:rgba(15,21,30,.55)}.sl2-title{font-size:14px;font-weight:800}.sl2-sub,.sl2-note{font-size:10px;color:#778293;line-height:1.5;margin-top:4px}.sl2-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.sl2-btn{font-weight:800}.sl2-btn:disabled{opacity:.55;cursor:wait}.sl2-status{margin-top:12px;padding:10px;border-radius:10px;background:#0c1118;font-size:10px;line-height:1.5}.sl2-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}.sl2-stat{border:1px solid #202833;border-radius:10px;padding:9px}.sl2-stat span{display:block;color:#778293;font-size:8px}.sl2-stat b{display:block;margin-top:3px;font-size:13px}.sl2-table{margin-top:12px}.sl2-row{display:grid;grid-template-columns:1fr 70px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid #202833;font-size:10px}.sl2-submenu{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:12px}.sl2-subtab{text-align:left;border:1px solid #202833;background:rgba(20,27,38,.55);color:inherit;border-radius:9px;padding:8px;cursor:pointer;font-size:10px}.sl2-subtab.active{border-color:rgba(120,180,220,.65);background:rgba(70,95,130,.2)}.sl2-detail{margin-top:12px;padding:10px;border:1px solid #202833;border-radius:10px;background:#0c1118;font-size:10px;line-height:1.55}.buy{color:#7ce0a4}.sell{color:#e08c96}.wait{color:#c5cbd3}@media(max-width:700px){.sl2-menu{grid-template-columns:repeat(2,1fr)}.sl2-grid{grid-template-columns:repeat(2,1fr)}}`;document.head.appendChild(s)}
function render(id='jesse',status='Pronto',section=null){const b=mount();if(!b)return;css();const m=MODULES.find(x=>x.id===id)||MODULES[0];const active=section||m.sections[0];const tabs=MODULES.map(x=>`<button type="button" class="sl2-tab ${x.id===id?'active':''}" data-id="${x.id}"><span class="sl2-icon">${x.icon}</span><b>${x.name}</b><small>${x.desc}</small></button>`).join('');const submenu=m.sections.map(x=>`<button type="button" class="sl2-subtab ${x===active?'active':''}" data-section="${esc(x)}">${esc(x)}</button>`).join('');b.innerHTML=`<div class="sl2-head"><b>🧪 Strategy Lab 2.0</b><small>Laboratorio separato dal Bot: analizza, confronta e trasferisce al Bot solo il risultato utile.</small></div><div class="sl2-menu">${tabs}</div><div class="sl2-content"><div class="sl2-title">${m.icon} ${m.name}</div><div class="sl2-sub">${m.desc}. Ogni modulo ora ha un percorso analitico completo, non una semplice lista di funzioni.</div><div class="sl2-submenu">${submenu}</div><div class="sl2-detail">${detail(m.id,active)}</div><div class="sl2-actions"><button class="sl2-btn sl2-run" type="button">▶ Analizza ${m.name}</button></div><div class="sl2-status">${esc(status)}</div>${state.results[id]?`<div class="sl2-table">${state.results[id]}</div>`:''}<div class="sl2-note">Modalità PAPER. Nessun ordine reale viene eseguito dallo Strategy Lab.</div></div>`;b.querySelectorAll('.sl2-tab').forEach(x=>x.onclick=()=>render(x.dataset.id));b.querySelectorAll('.sl2-subtab').forEach(x=>x.onclick=()=>render(id,status,x.dataset.section));b.querySelectorAll('.sl2-run').forEach(x=>x.onclick=()=>run(id))}
function detail(id,section){const descriptions={
'Overview':'Panoramica del modulo, stato dei dati disponibili e risultato sintetico dell’analisi.',
'Market Structure':'Valuta struttura del mercato, direzione, massimi/minimi e condizioni di trend.',
'Trend Analysis':'Analizza trend di breve e medio periodo e la loro coerenza.',
'Trend':'Analizza direzione e persistenza del trend sui dati disponibili.',
'Momentum':'Misura accelerazione, rallentamento e pressione direzionale.',
'RSI':'Individua condizioni di ipercomprato, ipervenduto e momentum neutrale.',
'MACD':'Confronta momentum e direzione attraverso le medie mobili disponibili.',
'RSI / MACD':'Confronta momentum RSI e segnali derivati dalle medie mobili.',
'EMA / SMA':'Valuta posizione del prezzo rispetto alle principali medie mobili.',
'Moving Averages':'Valuta la posizione del prezzo rispetto alle medie mobili.',
'Bollinger Bands':'Valuta distanza dalla media e condizioni di espansione/compressione.',
'Bollinger Bands':'Valuta distanza dalla media e condizioni di espansione/compressione.',
'Support & Resistance':'Individua aree tecniche di supporto e resistenza.',
'Support / Resistance':'Individua aree tecniche di supporto e resistenza.',
'Breakout Detection':'Cerca rotture di range e segnali di continuazione o falsa rottura.',
'Breakout':'Cerca rotture di range e pressione direzionale.',
'Volume Analysis':'Valuta conferma del movimento tramite volume quando disponibile.',
'Volume':'Valuta conferma del movimento tramite volume quando disponibile.',
'Volatility':'Valuta ampiezza e cambiamento della volatilità.',
'Multi-Timeframe':'Confronta i segnali disponibili su orizzonti temporali differenti.',
'Signal':'Sintetizza i segnali disponibili in BUY, SELL o WAIT.',
'Confidence':'Stima quanto i segnali disponibili siano concordanti e affidabili.',
'Historical Comparison':'Confronta il quadro attuale con condizioni storiche disponibili.',
'Strategy Performance':'Valuta la qualità storica della strategia quando esistono dati sufficienti.',
'Risk / Reward':'Confronta potenziale rendimento e rischio del segnale.',
'Performance':'Sintesi della performance osservata del motore.',
'Bull Agent':'Costruisce l’ipotesi rialzista a partire dalle evidenze disponibili.',
'Bear Agent':'Costruisce l’ipotesi ribassista a partire dalle evidenze disponibili.',
'Trader Agent':'Valuta la tradabilità del segnale e il timing.',
'Risk Agent':'Cerca condizioni che rendono il segnale fragile o rischioso.',
'Evidence':'Raccoglie e confronta le evidenze che sostengono le diverse ipotesi.',
'Debate':'Confronta tesi rialzista e ribassista prima del consenso.',
'Consensus':'Combina le evidenze degli agenti in un orientamento unico.',
'Risk Flags':'Evidenzia contraddizioni, anomalie e rischi.',
'Data Quality':'Misura quantità e profondità dei dati realmente disponibili.',
'Analogues':'Cerca situazioni storiche comparabili senza inventare analogie.',
'Market Regimes':'Classifica il contesto di mercato quando i dati lo consentono.',
'Similar Events':'Confronta eventi o configurazioni simili nello storico.',
'Outcome Distribution':'Analizza la distribuzione degli esiti osservati.',
'Time Horizons':'Confronta risultati su diversi orizzonti temporali.',
'Reliability':'Valuta affidabilità e limiti del campione.',
'Limitations':'Indica esplicitamente cosa non può essere concluso dai dati.',
'Returns':'Rendimento cumulato e confronto con benchmark.',
'Trades':'Numero, frequenza e qualità delle operazioni simulate.',
'Win Rate':'Percentuale di operazioni positive sul campione disponibile.',
'Drawdown':'Massimo drawdown osservato nella simulazione.',
'Profit Factor':'Rapporto tra profitti e perdite quando il campione lo consente.',
'Benchmark':'Confronto della strategia con il semplice buy-and-hold.',
'Risk Adjusted':'Lettura del rendimento insieme al rischio assunto.',
'Robustness':'Verifica della stabilità del risultato al variare del campione.',
'Accuracy':'Misura delle previsioni valutabili nello stato persistente.',
'Signal Quality':'Valuta quanto i segnali abbiano prodotto esiti coerenti.',
'Strategy Performance':'Segue la performance delle strategie nel tempo.',
'Error Analysis':'Analizza gli errori e le condizioni in cui il sistema fallisce.',
'Recent Outcomes':'Osserva gli ultimi risultati registrati.',
'Drift':'Cerca cambiamenti nella qualità dei segnali nel tempo.',
'Improvements':'Individua aree dove il sistema può essere migliorato.',
'Limits':'Definisce i limiti del processo di apprendimento.'};return esc(descriptions[section]||'Sezione analitica del modulo. I risultati vengono utilizzati internamente dal Strategy Consensus.')}
async function run(id){const b=mount(),btn=b?.querySelector('.sl2-run');if(btn){btn.disabled=true;btn.textContent='⏳ Analisi in corso…'}try{await data();if(id==='jesse'||id==='technical'){const out=state.candidates.slice(0,8).map(c=>({c,x:technical(c)}));state.results[id]=out.map(z=>`<div class="sl2-row"><b>${esc(z.c.name||z.c.symbol)}</b><b class="${z.x.action.toLowerCase()}">${z.x.action}</b><span>BUY ${z.x.b} · SELL ${z.x.s} · ${z.x.history} prezzi</span></div>`).join('')||'<div class="sl2-status">Nessun candidato disponibile.</div>'}else if(id==='multi'){const moves=state.candidates.map(c=>n(c.changePct)).filter(v=>v!==null),score=avg(moves)||0,news=String(state.ai?.commentary||''),bull=/rialz|positivo|support|ripres|bull/i.test(news),bear=/ribass|risch|prudenz|inflaz|volatil/i.test(news),direction=score>0.25&&bull?'LONG':score<-.25&&bear?'SHORT':'HOLD';state.results[id]=`<div class="sl2-grid"><div class="sl2-stat"><span>Market</span><b>${score.toFixed(2)}%</b></div><div class="sl2-stat"><span>News</span><b>${bull?'BULL':bear?'BEAR':'NEUTRAL'}</b></div><div class="sl2-stat"><span>Consensus</span><b>${direction}</b></div><div class="sl2-stat"><span>Candidati</span><b>${state.candidates.length}</b></div></div><div class="sl2-status">Multi-Agent combina market snapshot, commento AI e pressione direzionale. Il risultato è trasferibile al Bot come consensus, non come ordine.</div>`}else if(id==='backtest'){const out=state.candidates.slice(0,8).map(c=>({c,x:backtest(c)})).filter(z=>z.x.ok).sort((a,z)=>z.x.ret-a.x.ret);state.results[id]=out.map(z=>`<div class="sl2-row"><b>${esc(z.c.name||z.c.symbol)}</b><b class="${z.x.ret>=0?'buy':'sell'}">${z.x.ret.toFixed(1)}%</b><span>DD ${z.x.dd.toFixed(1)}% · WR ${z.x.win.toFixed(0)}% · ${z.x.trades} trade</span></div>`).join('')||'<div class="sl2-status">Storico insufficiente per il backtest.</div>'}else if(id==='historical'){const rows=state.candidates.slice(0,8).map(c=>{const a=series(c);return `<div class="sl2-row"><b>${esc(c.name||c.symbol||'Asset')}</b><span>${a.length} prezzi</span><span>${a.length>=30?'UTILIZZABILE':'INSUFFICIENTE'}</span></div>`}).join('');state.results[id]=rows||'<div class="sl2-status">Nessun candidato disponibile.</div>'}else if(id==='learning'){let d=null;try{d=JSON.parse(localStorage.getItem('ml_bot')||'null')}catch{};const a=d?.accuracy||{};state.results[id]=`<div class="sl2-grid"><div class="sl2-stat"><span>Accuratezza</span><b>${esc(a.rate??0)}%</b></div><div class="sl2-stat"><span>Valutate</span><b>${esc(a.total??0)}</b></div><div class="sl2-stat"><span>Approvate</span><b>${Array.isArray(d?.suggestions)?d.suggestions.filter(x=>x.status==='APPROVED').length:0}</b></div><div class="sl2-stat"><span>Saltate</span><b>${Array.isArray(d?.suggestions)?d.suggestions.filter(x=>x.status==='SKIPPED').length:0}</b></div></div>`}else{state.results[id]=`<div class="sl2-status">Analisi completata. ${state.candidates.length} candidati ricevuti dal monitor.</div>`}window.ML_STRATEGY_LAB={results:state.results,updatedAt:new Date().toISOString()};window.dispatchEvent(new CustomEvent('miracolo:strategyupdate',{detail:window.ML_STRATEGY_LAB}));render(id,'✓ Analisi completata')}catch(e){render(id,'Errore: '+e.message)}}
function boot(){if(window.__mlPanel==='strategy'||document.body.dataset.activePanel==='strategy')render();window.addEventListener('miracolo:panelchange',e=>{if(e.detail?.panel==='strategy')setTimeout(()=>render(),30)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();