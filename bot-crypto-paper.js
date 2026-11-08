/* Miracolo Lab — independent 24/7 crypto PAPER engine.
 * Public Binance market data only. Simulated fills are never sent to an exchange.
 */
const BASE='https://data-api.binance.vision/api/v3';
const KEY='crypto/paper/v1';
const SYMBOLS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
const CONFIG={capital:1000,orderUsd:50,maxPositions:3,maxTradesPerDay:20,stopLossPct:1,takeProfitPct:1.8,feePct:.1,slippagePct:.05};
const now=()=>new Date().toISOString();
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const round=(v,d=8)=>Number(Number(v).toFixed(d));
async function json(url){const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'MiracoloLab-CryptoPaper/1.0'}});if(!r.ok)throw Error('Market data HTTP '+r.status+' '+url);return r.json()}
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
 return{action:bullish?'BUY':bearish?'SELL':'WAIT',price:last,momentum5m:m5,momentum15m:m15,ema9:fast,ema21:slow,volumeRatio:volRatio,coverage:1,reason:bullish?'Momentum e trend rialzisti confermati dal volume.':bearish?'Momentum e trend ribassisti confermati dal volume.':'Nessuna convergenza sufficiente: attesa.'};
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
export async function runCryptoPaperCycle(env,{fetcher=json}={}){
 const s=await read(env)||emptyState(),today=now().slice(0,10);if(s.daily?.date!==today)s.daily={date:today,trades:0};
 const results=await Promise.all(SYMBOLS.map(async symbol=>{try{const rows=await fetcher(BASE+'/klines?symbol='+symbol+'&interval=1m&limit=60');const sig=cryptoSignal(rows);return{symbol,ok:true,...sig}}catch(e){return{symbol,ok:false,action:'NO_DATA',reason:String(e.message||e)}}}));
 for(const r of results){if(r.ok){s.symbols[r.symbol]={...(s.symbols[r.symbol]||{}),...r,checkedAt:now()};applySignal(s,r.symbol,r)}else{s.errors.push({symbol:r.symbol,error:r.reason,time:now()})}}
 s.errors=s.errors.slice(-30);s.orders=s.orders.slice(-300);s.cycles++;s.updatedAt=now();s.lastCycle={at:s.updatedAt,available:results.filter(x=>x.ok).length,total:results.length,signals:results};markEquity(s);await write(env,s);
 return{ok:results.some(x=>x.ok),mode:'PAPER',market:'CRYPTO_24_7',state:s};
}
export async function getCryptoPaperStatus(env){const s=await read(env);return{ok:Boolean(s),mode:'PAPER',market:'CRYPTO_24_7',running:Boolean(s?.lastCycle),state:s||emptyState(),message:s?'Ultimo ciclo crypto disponibile.':'In attesa del primo ciclo cron.'}}
