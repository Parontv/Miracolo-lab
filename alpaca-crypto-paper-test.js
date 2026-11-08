/* One-shot Alpaca Crypto PAPER round-trip smoke test. Fixed $10 BTC/USD; never LIVE. */
const BASE='https://paper-api.alpaca.markets/v2';
let smokeTestRunning=false;
let lastSmokeReport=null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function assertPaper(env){
 if(String(env?.BOT_MODE||'PAPER').toUpperCase()!=='PAPER')throw Error('Test bloccato: BOT_MODE non è PAPER.');
 if(String(env?.ALPACA_BASE_URL||BASE).replace(/\/$/,'')!==BASE)throw Error('Test bloccato: endpoint Alpaca non-Paper.');
 if(!env?.ALPACA_API_KEY||!env?.ALPACA_API_SECRET)throw Error('Credenziali Alpaca Paper mancanti.');
}
async function api(env,path,options={}){
 const r=await fetch(BASE+path,{...options,headers:{'APCA-API-KEY-ID':env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':env.ALPACA_API_SECRET,'Accept':'application/json','Content-Type':'application/json',...(options.headers||{})}});
 const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}};
 if(!r.ok)throw Object.assign(new Error(data?.message||data?.error||'Alpaca HTTP '+r.status),{status:r.status,data});
 return data;
}
async function waitOrder(env,id,maxMs=15000){
 const end=Date.now()+maxMs;let last=null;
 while(Date.now()<end){last=await api(env,'/orders/'+encodeURIComponent(id));if(['filled','canceled','expired','rejected','done_for_day'].includes(String(last.status||'').toLowerCase()))return last;await sleep(1000)}
 return last;
}
export async function runAlpacaCryptoPaperSmokeTest(env){
 assertPaper(env);
 if(smokeTestRunning)throw Error('Test Alpaca Crypto già in esecuzione in questa istanza.');
 smokeTestRunning=true;
 const report={ok:false,mode:'PAPER',provider:'Alpaca',symbol:'BTC/USD',notionalUsd:10,startedAt:new Date().toISOString(),buy:null,sell:null,positionAfter:null};
 try{
  const [account,assets,positions,orders]=await Promise.all([
   api(env,'/account'),api(env,'/assets?asset_class=crypto&status=active'),
   api(env,'/positions'),api(env,'/orders?status=open&nested=true&limit=500')
  ]);
  if(account.trading_blocked||account.account_blocked)throw Error('Account Alpaca Paper non autorizzato al trading.');
  if(Number(account.cash||0)<20)throw Error('Cash Paper insufficiente: servono almeno 20 USD per il round-trip.');
  if(!Array.isArray(assets))throw Error('Risposta elenco asset Crypto non valida.');
  const asset=assets.find(x=>norm(x.symbol)==='BTCUSD');
  if(!asset||asset.tradable!==true)throw Error('BTC/USD non risulta tradabile su questo account Paper.');
  if(!Array.isArray(positions)||!Array.isArray(orders))throw Error('Preflight posizioni/ordini non valido.');
  if(positions.some(x=>norm(x.symbol)==='BTCUSD'&&Math.abs(Number(x.qty||0))>0))throw Error('Test annullato: esiste già una posizione BTC/USD. Non verrà modificata.');
  if(orders.some(x=>norm(x.symbol)==='BTCUSD'))throw Error('Test annullato: esistono già ordini BTC/USD aperti. Non verranno modificati.');
  report.asset={symbol:asset.symbol,tradable:asset.tradable,fractionable:asset.fractionable,min_order_size:asset.min_order_size,min_trade_increment:asset.min_trade_increment};
  report.accountPreflight={cash:Number(account.cash),tradingBlocked:Boolean(account.trading_blocked)};
  const clientOrderId='ml-crypto-test-buy-'+Date.now();
  const buy=await api(env,'/orders',{method:'POST',body:JSON.stringify({symbol:'BTC/USD',notional:'10',side:'buy',type:'market',time_in_force:'gtc',client_order_id:clientOrderId})});
  report.buy={id:buy.id,status:buy.status,clientOrderId:buy.client_order_id,submittedAt:buy.submitted_at||buy.created_at};
  let buyFinal=await waitOrder(env,buy.id,15000);
  if(!['filled','partially_filled'].includes(String(buyFinal?.status||'').toLowerCase())){
   if(!['canceled','expired','rejected'].includes(String(buyFinal?.status||'').toLowerCase())){try{await api(env,'/orders/'+encodeURIComponent(buy.id),{method:'DELETE'});buyFinal=await api(env,'/orders/'+encodeURIComponent(buy.id))}catch(e){report.buy.cancelError=String(e.message||e)}}
  }
  const filledQty=Number(buyFinal?.filled_qty||0);
  report.buy={...report.buy,status:buyFinal?.status||report.buy.status,filledQty,filledAvgPrice:Number(buyFinal?.filled_avg_price||0),submittedNotional:Number(buyFinal?.notional||10)};
  if(!(filledQty>0)){report.ok=false;report.result='BUY_NOT_FILLED';report.completedAt=new Date().toISOString();lastSmokeReport=report;return report;}
  const sell=await api(env,'/orders',{method:'POST',body:JSON.stringify({symbol:'BTC/USD',qty:String(filledQty),side:'sell',type:'market',time_in_force:'gtc',client_order_id:'ml-crypto-test-sell-'+Date.now()})});
  report.sell={id:sell.id,status:sell.status,qty:filledQty,clientOrderId:sell.client_order_id};
  const sellFinal=await waitOrder(env,sell.id,15000);
  report.sell={...report.sell,status:sellFinal?.status||sell.status,filledQty:Number(sellFinal?.filled_qty||0),filledAvgPrice:Number(sellFinal?.filled_avg_price||0)};
  const remaining=await api(env,'/positions');
  const residual=Array.isArray(remaining)?remaining.find(x=>norm(x.symbol)==='BTCUSD'):null;
  report.positionAfter=residual?{qty:Number(residual.qty||0),marketValue:Number(residual.market_value||0),unrealizedPl:Number(residual.unrealized_pl||0)}:null;
  report.ok=String(sellFinal?.status||'').toLowerCase()==='filled'&&!residual;
  report.result=report.ok?'ROUND_TRIP_FILLED_AND_FLAT':residual?'RESIDUAL_POSITION_REQUIRES_REVIEW':'SELL_NOT_FULLY_FILLED';
  report.completedAt=new Date().toISOString();lastSmokeReport=report;return report;
 }catch(e){report.error=String(e.message||e);report.completedAt=new Date().toISOString();lastSmokeReport=report;throw e}
 finally{smokeTestRunning=false}
}
export async function getAlpacaCryptoPaperSmokeReport(){return lastSmokeReport}
