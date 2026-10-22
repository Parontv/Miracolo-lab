/* Miracolo Lab — Bot server engine v10
 * PAPER ONLY. One server-side decision maker.
 * Contract per module: {direction:-1..1,strength,confidence,coverage,evidence[],asOf}.
 */
const STATE_KEY='state/latest';
const DECISION_KEY='bot/decision/latest';
const JOURNAL_KEY='bot/journal/v1';
const POSITIONS_KEY='bot/positions/v1';
const LEARNING_KEY='bot/learning/v1';
const CFG={capital:2000,riskPerTrade:10,maxTradesPerDay:3,maxPositions:3,minCoverage:.60,minFamilies:3,decisionTtlMs:30*60*1000,slippageBps:5,costBps:2,atrStop:1.5,atrTarget:3};

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dir=v=>clamp(n(v)??0,-1,1);
const now=()=>new Date().toISOString();
const clean=v=>String(v??'').replace(/\s+/g,' ').trim().slice(0,700);
async function get(env,key){try{if(!env.ML_KV)return null;const x=await env.ML_KV.get(key);return x?JSON.parse(x):null}catch{return null}}
async function put(env,key,value,ttl=0){if(!env.ML_KV)return false;try{await env.ML_KV.put(key,JSON.stringify(value),ttl?{expirationTtl:ttl}:undefined);return true}catch{return false}}

function module(name,family,direction,strength,confidence,coverage,evidence=[],status='CONTRIBUISCE',weight=1,reason=''){
 const d=dir(direction),s=clamp(n(strength)??Math.abs(d),0,1),c=clamp(n(confidence)??s,0,1),cov=clamp(n(coverage)??0,0,1);
 return {id:name,name,family,direction:d,strength:s,confidence:c,coverage:cov,evidence:Array.isArray(evidence)?evidence.slice(0,8):[],asOf:now(),status,weight:status==='CONTRIBUISCE'?weight:0,reason:clean(reason||'')};
}
function priceChange(items){return (Array.isArray(items)?items:[]).map(x=>n(x?.changePct)).filter(Number.isFinite)}
function equityItems(m){
 const arr=Array.isArray(m?.indices)?m.indices:[];
 return arr.filter(x=>{const s=String(x?.name||x?.ticker||'').toUpperCase();return !/VIX|DXY|US10Y|TREAS|BOND|GOLD|XAU|SILVER|BRENT|WTI|OIL|JPY|EURUSD|USDJPY|GBPUSD|BTC|ETH/.test(s)})
}
function technical(m){
 const items=equityItems(m), changes=priceChange(items), asOf=m?.timestamp||now();
 if(changes.length<10)return module('technical','technical',0,0,0,changes.length/10,[], 'NO DATA',0,'Storico/quotazioni insufficienti per una lettura tecnica affidabile.');
 const avg=changes.reduce((a,b)=>a+b,0)/changes.length;
 const pos=changes.filter(x=>x>0).length/changes.length;
 const d=clamp(avg/1.2 + (pos-.5)*.8,-1,1), c=clamp(.5+Math.abs(d)*.45,.5,.95);
 return {...module('technical','technical',d,Math.abs(d),c,clamp(changes.length/30,.6,1),[
  `Media variazioni azionarie: ${avg.toFixed(2)}%`,`Partecipazione positiva: ${(pos*100).toFixed(0)}%`,`Campione: ${changes.length} strumenti`
 ],'CONTRIBUISCE',1,'Lettura aggregata del mercato azionario; strumenti macro/volatilità esclusi.'),asOf};
}
function volatility(m){
 const v=(Array.isArray(m?.indices)?m.indices:[]).find(x=>/VIX/i.test(String(x?.name||x?.ticker||'')));const ch=n(v?.changePct);if(ch===null)return module('volatility','risk',0,0,0,0,[],'NO DATA',0,'VIX non disponibile.');
 const d=clamp(-ch/5,-1,1),c=clamp(.5+Math.abs(d)*.35,.5,.85);return module('volatility','risk',d,Math.abs(d),c,1,[`VIX variazione: ${ch.toFixed(2)}%`],'CONTRIBUISCE',.7,ch>2?'Volatilità in aumento: pressione risk-off.':'Volatilità non in aumento in modo significativo.');
}
function macro(m){
 const groups=m?.quantitative?.groups;if(!groups||typeof groups!=='object')return module('macro','macro',0,0,0,0,[],'NO DATA',0,'Dati macro non disponibili nel payload market.quantitative.groups.');
 const values=[];for(const [k,g] of Object.entries(groups)){const x=n(g?.changePct??g?.trend);if(x!==null)values.push({k,x})}
 if(values.length<2)return module('macro','macro',0,0,0,values.length/3,[],'NO DATA',0,'Campione macro insufficiente.');
 const score=clamp(values.reduce((a,x)=>a+clamp(x.x,-3,3),0)/Math.max(1,values.length*2),-1,1);return module('macro','macro',score,Math.abs(score),clamp(.5+Math.abs(score)*.35,.5,.85),clamp(values.length/5,.6,1),values.slice(0,6).map(x=>`${x.k}: ${x.x>0?'+':''}${x.x.toFixed(2)}`),'CONTRIBUISCE',1,'Segno derivato dal trend; non dal solo livello assoluto.');
}
function news(m){
 const items=Array.isArray(m?.news?.items)?m.news.items:[];if(items.length<10)return module('news','news',0,0,0,items.length/10,[],'NO DATA',0,'Notizie insufficienti per un segnale robusto.');
 const nowMs=Date.now(),seen=new Set(),rows=[];for(const x of items){const title=clean(x?.title);const key=title.toLowerCase().replace(/[^a-z0-9à-ÿ]+/gi,' ').trim();if(!key||seen.has(key))continue;seen.add(key);const age=(nowMs-(Date.parse(x?.date)||nowMs))/3600000;if(age>72)continue;const decay=Math.pow(.5,Math.max(0,age)/12);let s=n(x?.score);if(s===null){const t=title.toLowerCase();s=/\b(surprise|beat|growth|cuts?|rally|strong|upgrade|approval)\b/.test(t)?1:/\b(inflation|war|recession|miss|crisis|downgrade|default|hawkish)\b/.test(t)?-1:0}const cat=String(x?.cat||x?.type||'').toLowerCase();const w=/macro|rates|central|geopolitic|finance|company/.test(cat)?1.15:/reddit|social/.test(cat)?.65:.9;rows.push({s:clamp(s,-1,1)*decay*w,title})}
 if(rows.length<10)return module('news','news',0,0,0,rows.length/10,[],'NO DATA',0,'Dopo deduplicazione e decadimento non rimangono abbastanza eventi.');
 const score=rows.reduce((a,x)=>a+x.s,0)/rows.length,d=clamp(score,-1,1),c=clamp(.5+Math.abs(d)*.4,.5,.9);return module('news','news',d,Math.abs(d),c,clamp(rows.length/40,.6,1),rows.slice(0,6).map(x=>x.title),'CONTRIBUISCE',.8,'Eventi deduplicati, decadimento 12h e peso per categoria; social separato dalle fonti istituzionali.');
}
function ai(m){const a=m?.ai;if(!a||!['ok','fallback','cached'].includes(a.status))return module('ai','ai',0,0,0,0,[],'NO DATA',0,'Analisi AI strutturata non disponibile.');const text=`${a.regime||''} ${a.thesis||''} ${a.commentary||''}`.toLowerCase();let d=0;if(/bull|risk.?on|costruttiv|positivo|rialzo/.test(text))d=.55;if(/bear|risk.?off|prudente|negativo|ribasso/.test(text))d=-.55;const c=clamp(n(a.confidence)??.55,.35,.85);return module('ai','ai',d,Math.abs(d),c,.8,[clean(a.headline),clean(a.regime)],'CONTRIBUISCE',.35,'AI usata come voto a peso limitato e non come unico decisore.');}
function historical(m){const h=m?.history||m?.historical;if(!h)return module('historical','historical',0,0,0,0,[],'NO DATA',0,'Nessuna serie storica disponibile.');const closes=Array.isArray(h.closes)?h.closes.map(n).filter(Number.isFinite):[];if(closes.length<30)return module('historical','historical',0,0,0,closes.length/30,[],'NO DATA',0,'Campione storico inferiore a 30 osservazioni.');const ret=closes[closes.length-1]/closes[Math.max(0,closes.length-6)]-1;const d=clamp(ret*12,-1,1);return module('historical','historical',d,Math.abs(d),clamp(.5+Math.abs(d)*.3,.5,.8),1,[`Serie: ${closes.length} chiusure`,`Rendimento 5 periodi: ${(ret*100).toFixed(2)}%`],'CONTRIBUISCE',.6,'Confronto storico direzionale; escluso quando il campione è insufficiente.');}
function backtest(m){const b=m?.backtest;if(!b||n(b.sample)<30)return module('backtest','backtest',0,0,0,0,[],'NO DATA',0,'Backtest senza almeno 30 osservazioni valide.');const wr=n(b.winRate);const edge=n(b.edge);if(wr===null||edge===null)return module('backtest','backtest',0,0,0,0,[],'NO DATA',0,'Backtest privo di metriche sufficienti.');const d=clamp(edge,-1,1);return module('backtest','backtest',d,Math.abs(d),clamp(.5+Math.abs(d)*.3,.5,.8),1,[`Campione: ${b.sample}`,`Win rate: ${(wr*100).toFixed(1)}%`,`Edge: ${edge.toFixed(3)}`],'CONTRIBUISCE',.7,'Walk-forward: il risultato entra nel consenso solo con campione sufficiente.');}
function familyVote(mods){const fam=new Map();for(const x of mods.filter(x=>x.status==='CONTRIBUISCE'&&x.weight>0)){const prev=fam.get(x.family);if(!prev||x.weight>prev.weight)fam.set(x.family,x)}return [...fam.values()]}
function consensus(mods){const voters=familyVote(mods),nominal=mods.reduce((a,x)=>a+x.weight,0),used=voters.reduce((a,x)=>a+x.weight,0),coverage=nominal?used/nominal:0;if(voters.length<CFG.minFamilies||coverage<CFG.minCoverage)return {direction:0,strength:0,confidence:Math.round(45+coverage*20),coverage,families:voters.length,reason:`WAIT: copertura ${Math.round(coverage*100)}% e ${voters.length} famiglie indipendenti; servono almeno ${Math.round(CFG.minCoverage*100)}% e ${CFG.minFamilies}.`,voters};const signed=voters.map(x=>x.direction*x.weight*x.confidence),den=voters.reduce((a,x)=>a+x.weight,0),score=clamp(signed.reduce((a,b)=>a+b,0)/den,-1,1),agreement=Math.abs(voters.filter(x=>Math.sign(x.direction)===Math.sign(score)).reduce((a,x)=>a+x.weight,0)/(den||1));const confidence=Math.round(clamp(50+agreement*25+coverage*20+Math.abs(score)*5,0,98));if(Math.abs(score)<.2)return {direction:0,strength:Math.abs(score),confidence,coverage,families:voters.length,reason:'WAIT: segnali troppo contrastanti per un vantaggio sufficiente.',voters};return {direction:Math.sign(score),strength:Math.abs(score),confidence,coverage,families:voters.length,reason:`Consenso ${score>0?'LONG':'SHORT'} con ${voters.length} famiglie indipendenti e copertura ${Math.round(coverage*100)}%.`,voters};}
function dateKey(){return new Date().toISOString().slice(0,10)}
async function journal(env){return (await get(env,JOURNAL_KEY))||[]}
async function positions(env){return (await get(env,POSITIONS_KEY))||[]}
async function evaluatePositions(env,state){const ps=await positions(env),idx=equityItems(state?.market||{});const map=new Map(idx.map(x=>[String(x.ticker||x.symbol||x.name),n(x.price)]));const closed=[],open=[];for(const p of ps){const px=map.get(p.symbol);if(px===null||px===undefined){open.push(p);continue}const hitStop=p.direction>0?px<=p.stop:px>=p.stop;const hitTarget=p.direction>0?px>=p.target:px<=p.target;const age=(Date.now()-Date.parse(p.openedAt))/86400000;if(hitStop||hitTarget||age>=5){const exit=hitStop?p.stop:hitTarget?p.target:px;const gross=(exit-p.entry)*p.quantity*p.direction;const costs=(p.notional*(CFG.costBps+CFG.slippageBps)/10000);const pnl=gross-costs;closed.push({...p,closedAt:now(),exit,reason:hitStop?'STOP':hitTarget?'TARGET':'TIME',pnl});}else open.push({...p,lastPrice:px,unrealized:(px-p.entry)*p.quantity*p.direction})}if(closed.length){const j=await journal(env);await put(env,JOURNAL_KEY,[...closed,...j].slice(0,500),90*86400);await put(env,POSITIONS_KEY,open,7*86400)}return open;}
function tradeDecision(c,state){if(c.direction===0)return {action:'WAIT',reason:c.reason};if(c.confidence<65)return {action:'WAIT',reason:`WAIT: confidence ${c.confidence}% sotto la soglia operativa 65%.`};return {action:c.direction>0?'BUY':'SELL',reason:c.reason};}
async function openPaper(env,decision,state,ps){if(decision.action==='WAIT')return ps;if(ps.length>=CFG.maxPositions)return ps;if(decision.confidence<65)return ps;const day=dateKey(),j=await journal(env),today=j.filter(x=>String(x.closedAt||x.openedAt||'').slice(0,10)===day).length;const openedToday=ps.filter(x=>String(x.openedAt||'').slice(0,10)===day).length;if(today+openedToday>=CFG.maxTradesPerDay)return ps;const asset=equityItems(state?.market||{})[0];const entry=n(asset?.price);if(entry===null)return ps;const atr=n(asset?.atr);const riskDistance=atr&&atr>0?atr*CFG.atrStop:entry*.006;const targetDistance=atr&&atr>0?atr*CFG.atrTarget:riskDistance*2;const direction=decision.action==='BUY'?1:-1;const quantity=Math.max(1,Math.floor(CFG.riskPerTrade/riskDistance));const p={id:`P${Date.now()}`,symbol:String(asset?.ticker||asset?.symbol||asset?.name||'MARKET'),direction,entry,stop:entry-direction*riskDistance,target:entry+direction*targetDistance,quantity,notional:entry*quantity,risk:CFG.riskPerTrade,openedAt:now(),status:'OPEN',mode:'PAPER',decisionConfidence:decision.confidence};const out=[...ps,p];await put(env,POSITIONS_KEY,out,7*86400);return out;}

export async function runBot(env){
 const state=await get(env,STATE_KEY);if(!state)return {mode:'PAPER',status:'NO_DATA',decision:{action:'WAIT',confidence:0,reason:'Dati di mercato non disponibili.',asOf:now()},modules:[],paper:{capital:CFG.capital,positions:[],journal:[]}};
 const ps=await evaluatePositions(env,state);const mods=[technical(state.market||{}),volatility(state.market||{}),macro(state.market||{}),news(state),ai(state),historical(state.market||{}),backtest(state)];
 const c=consensus(mods),d=tradeDecision(c,state);const positionsNow=await openPaper(env,d,state,ps);const j=await journal(env);const result={mode:'PAPER',status:'OK',asOf:now(),decision:{action:d.action,confidence:c.confidence,strength:c.strength,direction:c.direction,coverage:c.coverage,families:c.families,reason:d.reason,consensusReason:c.reason,evidence:mods.filter(x=>x.status==='CONTRIBUISCE')},modules:mods,paper:{capital:CFG.capital,riskPerTrade:CFG.riskPerTrade,maxTradesPerDay:CFG.maxTradesPerDay,positions:positionsNow,journal:j.slice(0,100),limits:{realOrders:false,liveTrading:false}}};
 await put(env,DECISION_KEY,result,CFG.decisionTtlMs/1000);await updateLearning(env,result);return result;
}
async function updateLearning(env,result){const l=(await get(env,LEARNING_KEY))||{version:1,decisions:[],outcomes:[],sample:0};const x={asOf:result.asOf,action:result.decision.action,confidence:result.decision.confidence,coverage:result.decision.coverage,modules:result.modules.map(m=>({id:m.id,direction:m.direction,confidence:m.confidence,coverage:m.coverage,status:m.status}))};l.decisions=[x,...l.decisions].slice(0,500);l.sample=l.outcomes.length;await put(env,LEARNING_KEY,l,180*86400)}
export async function getBotDecision(env){const x=await get(env,DECISION_KEY);if(!x)return null;const age=Date.now()-Date.parse(x.asOf||0);if(age>CFG.decisionTtlMs)return {...x,status:'STALE',decision:{...x.decision,action:'WAIT',reason:'WAIT: ultima decisione oltre il TTL consentito.'}};return x}
