/* Miracolo Lab — independent 24/7 crypto PAPER engine.
 * Public Binance market data only. Simulated fills are never sent to an exchange.
 */
import { runBot } from './bot-server-engine.js';
import { newsContract } from './news-event-engine.js';
import { getCryptoDecision } from './bot-crypto-engine.js';
import { refreshBinanceOrderFlow } from './bot-order-flow.js';
const BASE='https://data-api.binance.vision/api/v3';
const KRAKEN_PAIRS={BTCUSDT:'XBTUSD',ETHUSDT:'ETHUSD',SOLUSDT:'SOLUSD',BNBUSDT:'BNBUSD',XRPUSDT:'XRPUSD'};
const COINBASE_PRODUCTS={BTCUSDT:'BTC-USD',ETHUSDT:'ETH-USD',SOLUSDT:'SOL-USD',BNBUSDT:'BNB-USD',XRPUSDT:'XRP-USD'};
const KEY='crypto/paper/v1';
const SYMBOLS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
const CONFIG={capital:1000,orderUsd:50,maxPositions:3,maxTradesPerDay:8,stopLossPct:1,takeProfitPct:1.8,feePct:.1,slippagePct:.05};
const now=()=>new Date().toISOString();
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const round=(v,d=8)=>Number(Number(v).toFixed(d));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
async function json(url){const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'MiracoloLab-CryptoPaper/1.0'}});if(!r.ok)throw Error('Market data HTTP '+r.status+' '+url);return r.json()}
function normalizeCoinbase(rows){if(!Array.isArray(rows))throw Error('Coinbase response non valida');return rows.map(x=>[Number(x[0])*1000,Number(x[3]),Number(x[2]),Number(x[1]),Number(x[4]),Number(x[5])]).sort((a,b)=>a[0]-b[0])}
function normalizeKraken(payload){const result=payload?.result;if(!result||payload.error?.length)throw Error('Kraken response non valida: '+(payload?.error||[]).join(', '));const key=Object.keys(result).find(k=>k!=='last');const rows=key?result[key]:null;if(!Array.isArray(rows))throw Error('Kraken OHLC non disponibile');return rows.map(x=>[Number(x[0])*1000,Number(x[1]),Number(x[2]),Number(x[3]),Number(x[4]),Number(x[6])])}
async function fetchMarketCandles(symbol,fetcher=json){
 const errors=[];
 const urls=[
  {provider:'BINANCE',url:BASE+'/klines?symbol='+symbol+'&interval=1m&limit=60',parse:x=>x},
  {provider:'COINBASE',url:'https://api.exchange.coinbase.com/products/'+(COINBASE_PRODUCTS[symbol]||symbol.replace('USDT','-USD'))+'/candles?granularity=60',parse:normalizeCoinbase},
  {provider:'KRAKEN',url:'https://api.kraken.com/0/public/OHLC?pair='+(KRAKEN_PAIRS[symbol]||symbol.replace('USDT','USD'))+'&interval=1',parse:normalizeKraken}
 ];
 for(const source of urls){try{const payload=await fetcher(source.url);const candles=source.parse(payload);if(!Array.isArray(candles)||candles.length<30)throw Error(source.provider+' returned fewer than 30 candles');const lastAt=Number(candles.at(-1)?.[0]);if(!Number.isFinite(lastAt)||lastAt>Date.now()+60_000||Date.now()-lastAt>3*60_000)throw Error(source.provider+' candles stale or timestamp invalid');return{candles,provider:source.provider}}catch(e){errors.push(source.provider+': '+String(e.message||e))}}
 throw Error('Tutte le fonti crypto non disponibili. '+errors.join(' | '));
}
async function read(env){try{const raw=await env.ML_KV?.get(KEY);return raw?JSON.parse(raw):null}catch{return null}}
async function write(env,state){if(!env.ML_KV)throw Error('KV ML_KV non configurato: stato paper non persistibile');await env.ML_KV.put(KEY,JSON.stringify(state),{expirationTtl:90*24*3600})}
function ema(values,period){if(values.length<period)return null;const k=2/(period+1);let x=values.slice(0,period).reduce((a,b)=>a+b,0)/period;for(const v of values.slice(period))x=v*k+x*(1-k);return x}
export function cryptoSignal(candles){
 const rows=(candles||[]).filter(x=>Array.isArray(x)&&Number.isFinite(Number(x[4]))&&Number.isFinite(Number(x[5])));
 if(rows.length<30)return{action:'WAIT',reason:'Servono almeno 30 candele valide.',coverage:rows.length/30};
 const closes=rows.map(x=>Number(x[4])),volumes=rows.map(x=>Number(x[5]));
 const last=closes.at(-1),prev5=closes.at(-6),prev15=closes.at(-16),m5=prev5?last/prev5-1:0,m15=prev15?last/prev15-1:0;
 const fast=ema(closes.slice(-30),9),slow=ema(closes.slice(-30),21),baseVol=volumes.slice(-21,-1).reduce((a,b)=>a+b,0)/20,volRatio=baseVol?volumes.at(-1)/baseVol:0;
 const bullish=m5>=.0012&&m15>0&&fast>slow&&volRatio>=1.15;
 const bearish=m5<=-.0012&&m15<0&&fast<slow&&volRatio>=1.15;
 const momentumScore=clamp(m5/.003,-1,1)*.30+clamp(m15/.008,-1,1)*.25,trendScore=fast>slow?1:fast<slow?-1:0,volumeSign=Math.sign(momentumScore+trendScore);const score=clamp(momentumScore+trendScore*.30+(volRatio>=1.15?volumeSign*.15:0),-1,1);return{action:bullish?'BUY':bearish?'SELL':'WAIT',score,price:last,momentum5m:m5,momentum15m:m15,ema9:fast,ema21:slow,volumeRatio:volRatio,coverage:1,reason:bullish?'Momentum e trend rialzisti confermati dal volume.':bearish?'Momentum e trend ribassisti confermati dal volume.':'Nessuna convergenza sufficiente: attesa.'};
}
function freshModule(m,maxAgeMs=6*60*60*1000){if(!m||m.dataAvailable===false||!(Number(m.coverage)>0))return false;const t=Date.parse(m.asOf||m.generatedAt||'')||0,until=Date.parse(m.freshUntil||'')||Infinity;return Boolean(t&&t<=Date.now()+60_000&&Date.now()-t<=maxAgeMs&&until>Date.now()&&m.freshness!=='stale'&&m.freshness!=='incomplete')}
function moduleScore(m){const d=Math.max(-1,Math.min(1,Number(m?.direction)||0)),strength=Math.max(0,Math.min(1,Number(m?.strength)||0));return d*strength}
async function loadCryptoContext(env,contextProvider){
 if(contextProvider)return await contextProvider(env);
 try{const raw=await env.ML_KV?.get('state/latest');let state=raw?JSON.parse(raw):null;if(!state?.market)return{ok:false,reason:'Contesto condiviso non disponibile in KV.'};const [orderFlow,btcMarket]=await Promise.all([refreshBinanceOrderFlow(),getCryptoDecision(env,{force:true})]);state={...state,market:{...(state.market||{}),orderFlow},crypto:btcMarket};const result=await runBot(env,state,{cryptoOverride:btcMarket});if(!result?.ok)return{ok:false,reason:result?.decision?.reason||'Decision engine non disponibile.'};const byFamily=Object.fromEntries((result.modules||[]).map(m=>[m.family,m]));const cryptoItems=(Array.isArray(state.news?.items)?state.news.items:[]).filter(x=>/\b(bitcoin|btc|ethereum|eth|crypto|cryptocurrency|binance|coinbase|stablecoin|defi|solana|xrp|token|digital asset|crypto etf)\b/i.test(String(x.title||'')+' '+String(x.description||x.summary||'')));const cryptoNews=newsContract(cryptoItems).summary;byFamily.crypto_news={family:'crypto_news',direction:Math.sign(cryptoNews.net),strength:Math.abs(cryptoNews.net),confidence:cryptoNews.count?55+Math.abs(cryptoNews.net)*30:0,coverage:Math.min(1,cryptoNews.count/20),dataAvailable:cryptoNews.count>0,asOf:cryptoNews.asOf,evidence:cryptoNews.top.slice(0,5).map(x=>x.title)};return{ok:true,modules:byFamily,generatedAt:new Date().toISOString(),source:'Miracolo unified decision engine + crypto-filtered news'};}catch(e){return{ok:false,reason:String(e.message||e)}}}
function cryptoConsensus(local,context,symbol){
 const m=context?.modules||{},votes=[];
 if(Number.isFinite(Number(local?.score)))votes.push({family:'technical',direction:Math.sign(local.score),score:local.score,weight:.48,coverage:local.coverage||0,source:'OHLCV '+(local.provider||'market')});
 const flow=m.flow;if(freshModule(flow,90_000)&&['perpetual','spot','mixed-crypto'].includes(String(flow.marketType||'').toLowerCase()))votes.push({family:'order_flow',direction:Math.sign(moduleScore(flow)),score:moduleScore(flow),weight:.22,coverage:Number(flow.coverage)||0,source:flow.source||'Order Flow'});
 const macro=m.macro,news=m.crypto_news;
 if(freshModule(macro,45*86400_000))votes.push({family:'macro',direction:Math.sign(moduleScore(macro)),score:moduleScore(macro),weight:.08,coverage:Number(macro.coverage)||0,source:'FRED macro'});
 if(freshModule(news,72*60*60*1000))votes.push({family:'crypto_news',direction:Math.sign(moduleScore(news)),score:moduleScore(news),weight:.08,coverage:Number(news.coverage)||0,source:'Crypto-filtered news'});
 const btc=m.crypto;if(symbol!=='BTCUSDT'&&freshModule(btc,5*60_000)&&btc.symbol==='BTC/USD')votes.push({family:'btc_market',direction:Math.sign(moduleScore(btc)),score:moduleScore(btc),weight:.08,coverage:Number(btc.coverage)||0,source:'BTC/USD market structure'});
 const ai=m.ai;if(freshModule(ai,60*60*1000)&&Number(ai.confidence)>=65&&Math.abs(Number(ai.direction)||0)>0)votes.push({family:'ai_context',direction:Math.sign(moduleScore(ai)),score:moduleScore(ai),weight:.06,coverage:Number(ai.coverage)||0,source:'AI consultiva'});
 const weight=votes.reduce((a,v)=>a+v.weight,0),score=weight?votes.reduce((a,v)=>a+v.score*v.weight,0)/weight:0;
 const directional=votes.filter(v=>v.direction!==0),agreementCount=directional.filter(v=>v.direction===Math.sign(score)).length,agree=directional.length?agreementCount/directional.length:0,agreementLabel=directional.length<2?`NON SIGNIFICATIVO (${directional.length}/2 voti direzionali minimi)`:`${Math.round(agree*100)}% (${agreementCount}/${directional.length})`;
 const independent=votes.length,active=directional.length,confidence=Math.round(Math.min(95,50+Math.abs(score)*35+Math.min(10,active*3)));
 const enough=independent>=3&&active>=2&&agree>=.67&&Math.abs(score)>=.25&&confidence>=62;
 const action=enough?(score>0?'BUY':'SELL'):'WAIT';
 return{action,score:Number(score.toFixed(4)),confidence,agreement:Number(agree.toFixed(3)),agreementCount,agreementLabel,independentVotes:independent,activeVotes:active,coverage:independent?Number((votes.reduce((a,v)=>a+v.coverage,0)/independent).toFixed(3)):0,thresholds:{minIndependentVotes:3,minActiveVotes:2,minAgreement:.67,minAbsScore:.25,minConfidence:62},votes,reason:enough?'Consenso crypto: tecnica, order flow e contesto indipendente convergono.':`WAIT: ${independent}/3 voti indipendenti, ${active}/2 voti direzionali minimi, agreement ${agreementLabel}, score ${score.toFixed(2)} (soglia ±0,25).`};
}
function emptyState(){return{version:1,mode:'PAPER',createdAt:now(),updatedAt:now(),config:CONFIG,cash:CONFIG.capital,equity:CONFIG.capital,realizedPnl:0,fees:0,positions:[],orders:[],daily:{date:now().slice(0,10),trades:0},symbols:{},errors:[],cycles:0}}
function markEquity(s){const value=s.positions.reduce((a,p)=>a+p.qty*p.markPrice,0);s.equity=round(s.cash+value,2);return s}
function closePosition(s,p,price,reason){
 const gross=price*p.qty-p.costBasis,fee=price*p.qty*CONFIG.feePct/100,net=gross-fee;
 s.cash=round(s.cash+price*p.qty-fee,2);s.realizedPnl=round(s.realizedPnl+net,2);s.fees=round(s.fees+fee,4);
 s.orders.push({id:'cp-'+Date.now()+'-'+s.orders.length,symbol:p.symbol,side:'SELL',qty:p.qty,price,fee,pnl:round(net,4),reason,time:now(),mode:'PAPER'});
 s.positions=s.positions.filter(x=>x.symbol!==p.symbol);s.daily.trades++;
}
function applySignal(s,symbol,signal){
 const p=s.positions.find(x=>x.symbol===symbol),raw=signal.price;if(!(raw>0))return;
 if(p){p.markPrice=raw;const pnlPct=(raw/p.entryPrice-1)*100;
  if(pnlPct<=-CONFIG.stopLossPct)closePosition(s,p,raw*(1-CONFIG.slippagePct/100),'STOP_LOSS');
  else if(pnlPct>=CONFIG.takeProfitPct)closePosition(s,p,raw*(1-CONFIG.slippagePct/100),'TAKE_PROFIT');
  else if(signal.action==='SELL')closePosition(s,p,raw*(1-CONFIG.slippagePct/100),'SIGNAL_EXIT');
  return;
 }
 if(signal.action!=='BUY'||s.positions.length>=CONFIG.maxPositions||s.daily.trades>=CONFIG.maxTradesPerDay)return;
 const last=s.symbols[symbol]?.lastEntryAt;if(last&&Date.now()-Date.parse(last)<30*60*1000)return;
 const spend=Math.min(CONFIG.orderUsd,s.cash/(1+CONFIG.feePct/100));if(spend<10)return;
 const fill=raw*(1+CONFIG.slippagePct/100),fee=spend*CONFIG.feePct/100,qty=spend/fill;
 s.cash=round(s.cash-spend-fee,2);s.fees=round(s.fees+fee,4);
 s.positions.push({symbol,qty:round(qty),entryPrice:fill,markPrice:raw,costBasis:spend+fee,openedAt:now(),stopLossPct:CONFIG.stopLossPct,takeProfitPct:CONFIG.takeProfitPct});
 s.orders.push({id:'cp-'+Date.now()+'-'+s.orders.length,symbol,side:'BUY',qty:round(qty),price:fill,fee,pnl:null,reason:signal.reason,time:now(),mode:'PAPER'});
 s.symbols[symbol]={...(s.symbols[symbol]||{}),lastEntryAt:now()};s.daily.trades++;
}
export async function runCryptoPaperCycle(env,{fetcher=json,contextProvider=null}={}){
 const s=await read(env)||emptyState(),today=now().slice(0,10);if(s.daily?.date!==today)s.daily={date:today,trades:0};
 const context=await loadCryptoContext(env,contextProvider);const results=await Promise.all(SYMBOLS.map(async symbol=>{try{const market=await fetchMarketCandles(symbol,fetcher);const local=cryptoSignal(market.candles);const consensus=cryptoConsensus({...local,provider:market.provider},context,symbol);const signal={...local,...consensus,localAction:local.action,action:consensus.action,provider:market.provider,reason:consensus.action==='WAIT'?consensus.reason:local.reason+' '+consensus.reason};return{symbol,ok:true,...signal}}catch(e){return{symbol,ok:false,action:'NO_DATA',reason:String(e.message||e)}}}));
 for(const r of results){if(r.ok){s.symbols[r.symbol]={...(s.symbols[r.symbol]||{}),...r,checkedAt:now()};applySignal(s,r.symbol,r)}else{s.errors.push({symbol:r.symbol,error:r.reason,time:now()})}}
 s.errors=s.errors.slice(-30);s.orders=s.orders.slice(-300);s.cycles++;s.updatedAt=now();s.lastCycle={at:s.updatedAt,available:results.filter(x=>x.ok).length,total:results.length,contextAvailable:Boolean(context?.ok),contextReason:context?.reason||null,contextSource:context?.source||'test/injected',signals:results};markEquity(s);await write(env,s);
 return{ok:results.some(x=>x.ok),mode:'PAPER',market:'CRYPTO_24_7',state:s};
}
export async function getCryptoPaperStatus(env){const s=await read(env);return{ok:Boolean(s),mode:'PAPER',market:'CRYPTO_24_7',running:Boolean(s?.lastCycle),state:s||emptyState(),message:s?'Ultimo ciclo crypto disponibile.':'In attesa del primo ciclo cron.'}}
