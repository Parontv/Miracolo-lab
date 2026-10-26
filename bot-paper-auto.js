/* Miracolo Lab — autonomous PAPER execution. Equities during market hours, BTC/USD 24/7. */
import { runBot as analyzeBot } from './bot-server-engine.js';
import { executePaperDecision } from './bot-paper-executor.js';
const STATE='state/latest';
const PAPER_BASE='https://paper-api.alpaca.markets/v2';
const DEFAULT_MAX_BUYS=3;
const DEFAULT_MAX_POSITIONS=3;
const DEFAULT_MAX_EXPOSURE=1800;
const DEFAULT_COOLDOWN_MINUTES=30;
const ACTIVE_ORDER_STATUSES=new Set(['new','accepted','pending_new','partially_filled','accepted_for_bidding','calculated','pending_cancel','pending_replace']);
const COUNTED_BUY_STATUSES=new Set(['new','accepted','pending_new','partially_filled','accepted_for_bidding','calculated','filled']);
function requireKV(env){if(!env?.ML_KV)throw new Error('ML_KV binding missing: configure the ML_KV KV namespace before running the Bot.');return env.ML_KV;}
async function read(env,key,f=null){const kv=requireKV(env);const x=await kv.get(key);if(!x)return f;try{return JSON.parse(x)}catch(e){throw new Error(`KV JSON non valido per ${key}: ${e.message||e}`)}}
async function write(env,key,value,ttl=3600){const kv=requireKV(env);await kv.put(key,JSON.stringify(value),{expirationTtl:ttl});return true}
function alpacaHeaders(env){const key=env?.ALPACA_API_KEY,secret=env?.ALPACA_API_SECRET;if(!key||!secret)throw new Error('Credenziali Alpaca Paper mancanti.');return{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json','Content-Type':'application/json'};}
function ensurePaper(env){const base=String(env?.ALPACA_BASE_URL||PAPER_BASE).replace(/\/$/,'');if(String(env?.BOT_MODE||'PAPER').toUpperCase()!=='PAPER'||base!==PAPER_BASE)throw new Error('Sicurezza: il Bot può operare esclusivamente su Alpaca PAPER.');return base}
async function alpacaGet(env,path){const r=await fetch(ensurePaper(env)+path,{headers:alpacaHeaders(env)});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}if(!r.ok)throw Object.assign(new Error(data?.message||data?.error||`Alpaca HTTP ${r.status}`),{status:r.status,data});return data}
function normalizedSymbol(v){return String(v||'').toUpperCase().replace(/\//g,'').trim()}
export function sameSymbol(a,b){return normalizedSymbol(a)===normalizedSymbol(b)}
export function buildClientOrderId({day,symbol,action,direction=0,score=0}){const raw=`${day}|${normalizedSymbol(symbol)}|${String(action).toUpperCase()}|${Number(direction)||0}|${Number(score||0).toFixed(3)}`;let h=2166136261;for(const ch of raw){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return `miracolo-${day.replaceAll('-','')}-${normalizedSymbol(symbol)}-${String(action).toLowerCase()}-${(h>>>0).toString(36)}`.slice(0,48)}
function dateBounds(now=new Date()){const day=now.toISOString().slice(0,10);return{day,after:`${day}T00:00:00.000Z`,until:`${day}T23:59:59.999Z`}}
async function btcPosition(env){const rows=await alpacaGet(env,'/positions');return Array.isArray(rows)?rows.find(p=>sameSymbol(p?.symbol,'BTCUSD'))||null:null}
async function positions(env){const rows=await alpacaGet(env,'/positions');return Array.isArray(rows)?rows:[]}
async function ordersToday(env,now=new Date()){const {after,until}=dateBounds(now);const q=new URLSearchParams({status:'all',limit:'500',after,until,direction:'desc'});const rows=await alpacaGet(env,`/orders?${q.toString()}`);return Array.isArray(rows)?rows:[]}
async function getClock(env){return alpacaGet(env,'/clock')}
function numeric(v){return Number.isFinite(Number(v))?Number(v):null}
function positionExposure(rows){return rows.reduce((sum,p)=>sum+Math.abs(numeric(p?.market_value)||numeric(p?.notional)||0),0)}
function activePositionCount(rows){return rows.filter(p=>Math.abs(numeric(p?.qty)||0)>0).length}
function buyCount(rows){return rows.filter(o=>String(o?.side||'').toLowerCase()==='buy'&&COUNTED_BUY_STATUSES.has(String(o?.status||'').toLowerCase())).length}
function recentOrder(rows,minutes,now=Date.now()){const cutoff=now-minutes*60000;return rows.find(o=>{const t=Date.parse(o?.submitted_at||o?.created_at||'');return Number.isFinite(t)&&t>=cutoff&&['buy','sell'].includes(String(o?.side||'').toLowerCase())&&!['rejected','canceled','expired'].includes(String(o?.status||'').toLowerCase())})||null}
function duplicateOrder(rows,clientOrderId){return rows.find(o=>String(o?.client_order_id||'')===clientOrderId)||null}
function findPosition(rows,symbol){return rows.find(p=>sameSymbol(p?.symbol,symbol)&&Math.abs(numeric(p?.qty)||0)>0)||null}
export async function preflightPaperGuardrails(env,{action,symbol,notional,clientOrderId,now=new Date()}){
 const rows=await positions(env),orders=await ordersToday(env,now),clock=await getClock(env),maxBuys=Number(env.PAPER_MAX_BUYS_PER_DAY||DEFAULT_MAX_BUYS),maxPositions=Number(env.PAPER_MAX_POSITIONS||DEFAULT_MAX_POSITIONS),maxExposure=Number(env.PAPER_MAX_EXPOSURE||DEFAULT_MAX_EXPOSURE),cooldown=Number(env.PAPER_COOLDOWN_MINUTES||DEFAULT_COOLDOWN_MINUTES),exposure=positionExposure(rows),existing=findPosition(rows,symbol),buys=buyCount(orders),duplicate=duplicateOrder(orders,clientOrderId),recent=recentOrder(orders,cooldown,now.getTime()),isCrypto=normalizedSymbol(symbol)==='BTCUSD'||String(symbol).includes('/');
 if(duplicate)return{allowed:false,code:'DUPLICATE_CLIENT_ORDER_ID',reason:`Ordine già presente con client_order_id ${clientOrderId}.`,duplicate,positions:rows,orders,clock};
 if(action==='BUY'&&buys>=maxBuys)return{allowed:false,code:'DAILY_BUY_LIMIT',reason:`Limite massimo di ${maxBuys} acquisti PAPER raggiunto oggi.`,positions:rows,orders,clock,buyCount:buys};
 if(action==='BUY'&&!existing&&activePositionCount(rows)>=maxPositions)return{allowed:false,code:'POSITION_LIMIT',reason:`Limite massimo di ${maxPositions} posizioni PAPER raggiunto.`,positions:rows,orders,clock};
 if(action==='BUY'&&exposure+Number(notional||0)>maxExposure)return{allowed:false,code:'EXPOSURE_LIMIT',reason:`Esposizione massima PAPER superata: ${Math.round(exposure)} + ${Number(notional||0)} > ${maxExposure}.`,positions:rows,orders,clock,exposure,maxExposure};
 if(recent)return{allowed:false,code:'COOLDOWN',reason:`Cooldown di ${cooldown} minuti attivo dopo l'ordine ${recent.client_order_id||recent.id||'precedente'}.`,positions:rows,orders,clock,recent};
 if(!isCrypto&&!clock?.is_open)return{allowed:false,code:'MARKET_CLOSED',queued:true,reason:'Mercato equity chiuso: ordine mantenuto in coda, nessun ordine day inviato.',positions:rows,orders,clock};
 if(action==='SELL'&&!existing)return{allowed:false,code:'NO_POSITION',reason:`Nessuna posizione Alpaca da chiudere per ${symbol}.`,positions:rows,orders,clock};
 return{allowed:true,positions:rows,orders,clock,existing};
}
async function logExecution(env,entry){const latest={...entry,loggedAt:new Date().toISOString()};const history=await read(env,'bot/execution/log',[]);const next=[latest,...(Array.isArray(history)?history:[])].slice(0,50);await write(env,'bot/execution/latest',latest);await write(env,'bot/execution/log',next);return latest}
function pickSymbol(state){const rows=Array.isArray(state?.market?.indices)?state.market.indices:[];for(const s of ['SPY','QQQ','IWM']){const x=rows.find(r=>String(r?.ticker||'').toUpperCase()===s);if(x)return{symbol:s,price:Number(x.price||x.close||x.last)||null}}return null}
function cryptoAction(signal,position){if(!signal?.ok)return null;const hasPosition=Boolean(position&&Number(position.qty)>0);if(!hasPosition&&signal.direction>0&&signal.confidence>=68)return'BUY';if(hasPosition&&signal.direction<0&&signal.confidence>=65)return'SELL';return null}
export async function runAutoPaperBot(env,{execute=true}={}){
 requireKV(env);
 const result=await analyzeBot(env);if(!result?.ok)return result;
 const crypto=result.crypto||null;const btcPos=await btcPosition(env);if(crypto)crypto.position=btcPos?{qty:btcPos.qty,marketValue:btcPos.market_value,unrealizedPl:btcPos.unrealized_pl}:null;
 const state=await read(env,STATE,{}),equityInstrument=pickSymbol(state),cryptoActionValue=cryptoAction(crypto,btcPos),equityPortfolio=result.decision?.portfolio,cryptoEligible=Boolean(cryptoActionValue)&&String(env?.PAPER_CRYPTO_ENABLED??'true').toLowerCase()==='true';
 let action='HOLD',symbol=null,notional=Number(env.PAPER_NOTIONAL||100),reason='Nessun trade approvato.';
 if(cryptoEligible){action=cryptoActionValue;symbol='BTC/USD';reason=action==='BUY'?'BTC 24/7: segnale crypto rialzista sopra soglia.':'BTC 24/7: segnale crypto ribassista con posizione aperta.'}
 else if(equityPortfolio?.approved&&['BUY','SELL'].includes(String(equityPortfolio.action).toUpperCase())&&equityInstrument){action=String(equityPortfolio.action).toUpperCase();symbol=equityInstrument.symbol;reason=equityPortfolio.reason||'Portfolio Manager approva.'}
 else if(equityPortfolio?.approved&&['BUY','SELL'].includes(String(equityPortfolio.action).toUpperCase())&&!equityInstrument){reason='Segnale equity presente ma nessuno strumento equity disponibile.'}
 else{reason=crypto?.reason||equityPortfolio?.reason||'Nessuna condizione operativa sufficiente.'}
 result.botAction={action,symbol,reason,market:symbol==='BTC/USD'?'CRYPTO_24_7':'EQUITY'};
 if(action==='HOLD'||!symbol){result.execution={executed:false,mode:'PAPER',action:'HOLD',dryRun:!execute,reason};result.status='READY';return result}
 const amount=Math.min(200,Math.max(25,notional)),now=new Date(),day=now.toISOString().slice(0,10),clientOrderId=buildClientOrderId({day,symbol,action,direction:result.decision?.direction,score:result.decision?.score});
 if(!execute){result.execution={executed:false,mode:'PAPER',dryRun:true,action,symbol,notional:amount,clientOrderId,reason:'Dry-run: decisione pronta, nessun ordine inviato.'};result.status='PAPER_PLAN_READY';return result}
 try{
   const guard=await preflightPaperGuardrails(env,{action,symbol,notional:amount,clientOrderId,now});
   if(!guard.allowed){result.execution={executed:false,mode:'PAPER',action,symbol,notional:amount,clientOrderId,queued:Boolean(guard.queued),status:guard.code==='MARKET_CLOSED'?'QUEUED':'BLOCKED',reason:guard.reason,guardrail:guard.code,clock:guard.clock};result.status=guard.queued?'PAPER_ORDER_QUEUED':'READY';await logExecution(env,{kind:'decision',decision:result.decision,botAction:result.botAction,payload:null,response:null,error:null,status:result.execution.status,reason:guard.reason,guardrail:guard.code,clientOrderId});return result}
   const position=guard.existing;
   const qty=action==='SELL'?Math.abs(Number(position?.qty||0)):undefined;
   const payload={action,symbol,notional:action==='BUY'?amount:undefined,qty};
   let execution;
   try{execution=await executePaperDecision(env,{action,symbol,notional:payload.notional,qty:payload.qty,clientOrderId})}catch(e){execution={executed:false,mode:'PAPER',action,symbol,notional:payload.notional,qty:payload.qty,clientOrderId,status:'REJECTED',error:true,errorStatus:e.status||null,reason:String(e.message||e),response:e.data||null};await logExecution(env,{kind:'order',decision:result.decision,botAction:result.botAction,payload,response:e.data||null,error:{message:String(e.message||e),status:e.status||null},status:'REJECTED',clientOrderId});result.execution=execution;result.status='READY';return result}
   result.execution=execution;result.status=execution.status==='filled'?'PAPER_ORDER_FILLED':'PAPER_ORDER_SUBMITTED';await logExecution(env,{kind:'order',decision:result.decision,botAction:result.botAction,payload,response:execution.order||null,error:null,status:execution.status,clientOrderId});return result;
 }catch(e){const execution={executed:false,mode:'PAPER',action,symbol,clientOrderId,status:'ERROR',error:true,reason:String(e.message||e),errorStatus:e.status||null,response:e.data||null};result.execution=execution;result.status='ERROR';await logExecution(env,{kind:'error',decision:result.decision,botAction:result.botAction,payload:null,response:e.data||null,error:{message:String(e.message||e),status:e.status||null},status:'ERROR',clientOrderId});return result;}
}
