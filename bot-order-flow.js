const BASE='https://fapi.binance.com';
const SYMBOLS=['BTCUSDT','ETHUSDT'];
const MAX_AGE_MS=60_000;
const TIMEOUT_MS=4_000;
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
async function getJson(url,fetcher=fetch,timeoutMs=TIMEOUT_MS){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher(url,{signal:controller.signal,headers:{Accept:'application/json','Cache-Control':'no-cache'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  return await response.json();
 }catch(e){throw Error(e?.name==='AbortError'?'timeout':String(e?.message||e))}
 finally{clearTimeout(timer)}
}
export function analyzeOrderFlow(symbol,trades,book,now=Date.now()){
 const valid=(Array.isArray(trades)?trades:[]).map(t=>({price:n(t?.p),qty:n(t?.q),time:n(t?.T),buyerMaker:t?.m})).filter(t=>t.price>0&&t.qty>0&&t.time>0&&typeof t.buyerMaker==='boolean').sort((a,b)=>a.time-b.time);
 if(valid.length<20)return{symbol,status:'unavailable',reason:'Meno di 20 scambi aggregati validi.',tradeCount:valid.length};
 const lastTradeAt=valid[valid.length-1].time,firstTradeAt=valid[0].time,ageMs=now-lastTradeAt;
 if(ageMs< -5000||ageMs>MAX_AGE_MS)return{symbol,status:'stale',reason:'Ultimo scambio Binance non aggiornato.',tradeCount:valid.length,lastTradeAt,ageMs};
 const bids=Array.isArray(book?.bids)?book.bids.map(x=>[n(x?.[0]),n(x?.[1])]).filter(x=>x[0]>0&&x[1]>0):[];
 const asks=Array.isArray(book?.asks)?book.asks.map(x=>[n(x?.[0]),n(x?.[1])]).filter(x=>x[0]>0&&x[1]>0):[];
 if(!bids.length||!asks.length)return{symbol,status:'unavailable',reason:'Order book privo di bid o ask validi.',tradeCount:valid.length,lastTradeAt};
 bids.sort((a,b)=>b[0]-a[0]);asks.sort((a,b)=>a[0]-b[0]);
 const bestBid=bids[0][0],bestAsk=asks[0][0],mid=(bestBid+bestAsk)/2;
 if(!(mid>0)||bestAsk<bestBid)return{symbol,status:'unavailable',reason:'Order book incrociato o prezzi non validi.',tradeCount:valid.length,lastTradeAt};
 let buyNotional=0,sellNotional=0;
 for(const t of valid){const value=t.price*t.qty;if(t.buyerMaker)sellNotional+=value;else buyNotional+=value}
 const totalNotional=buyNotional+sellNotional;
 if(!(totalNotional>0))return{symbol,status:'unavailable',reason:'Volume eseguito nullo.',tradeCount:valid.length,lastTradeAt};
 const deltaNotional=buyNotional-sellNotional,deltaRatio=deltaNotional/totalNotional;
 const bidDepth=bids.filter(([p])=>p>=mid*(1-10/10000)).reduce((sum,[p,q])=>sum+p*q,0);
 const askDepth=asks.filter(([p])=>p<=mid*(1+10/10000)).reduce((sum,[p,q])=>sum+p*q,0);
 const depthTotal=bidDepth+askDepth;
 if(!(depthTotal>0))return{symbol,status:'unavailable',reason:'Profondità entro 10 punti base non disponibile.',tradeCount:valid.length,lastTradeAt};
 const obi=(bidDepth-askDepth)/depthTotal,spreadBps=(bestAsk-bestBid)/mid*10000;
 const score=Math.max(-1,Math.min(1,deltaRatio*.7+obi*.3));
 return{symbol,status:'ok',venue:'Binance USD-M Futures',marketType:'perpetual',tradeCount:valid.length,sampleTruncated:valid.length>=1000,sampleFrom:new Date(firstTradeAt).toISOString(),sampleTo:new Date(lastTradeAt).toISOString(),sampleSpanMs:lastTradeAt-firstTradeAt,lastTradeAt,ageMs,bookAt:new Date(now).toISOString(),bestBid,bestAsk,mid,spreadBps:Number(spreadBps.toFixed(3)),buyNotional:Number(buyNotional.toFixed(2)),sellNotional:Number(sellNotional.toFixed(2)),deltaNotional:Number(deltaNotional.toFixed(2)),deltaRatio:Number(deltaRatio.toFixed(4)),bidDepth10bps:Number(bidDepth.toFixed(2)),askDepth10bps:Number(askDepth.toFixed(2)),obi:Number(obi.toFixed(4)),score:Number(score.toFixed(4)),freshUntil:new Date(lastTradeAt+MAX_AGE_MS).toISOString()};
}
export async function refreshBinanceOrderFlow({fetcher=fetch,now=Date.now(),symbols=SYMBOLS}={}){
 const started=Date.now(),results=await Promise.all(symbols.map(async symbol=>{
  try{
   const [trades,book]=await Promise.all([
    getJson(BASE+'/fapi/v1/aggTrades?symbol='+encodeURIComponent(symbol)+'&limit=1000',fetcher),
    getJson(BASE+'/fapi/v1/depth?symbol='+encodeURIComponent(symbol)+'&limit=20',fetcher)
   ]);
   return analyzeOrderFlow(symbol,trades,book,now);
  }catch(e){return{symbol,status:'unavailable',reason:String(e?.message||e)}}
 }));
 const good=results.filter(x=>x.status==='ok'),errors=results.filter(x=>x.status!=='ok');
 const freshUntil=good.length?new Date(Math.min(...good.map(x=>Date.parse(x.freshUntil)))).toISOString():new Date(now+30_000).toISOString();
 return{provider:'Binance USD-M Futures public REST',source:'aggregate trades + depth snapshot',marketType:'perpetual',status:good.length===symbols.length?'ok':good.length?'partial':'unavailable',freshness:good.length===symbols.length?'fresh':'incomplete',symbols:[...symbols],instrumentCount:good.length,expectedInstruments:symbols.length,instruments:results,errors:errors.map(x=>({symbol:x.symbol,reason:x.reason})),fetches:symbols.length*2,generatedAt:new Date(now).toISOString(),durationMs:Date.now()-started,freshUntil,readOnly:true,executionEnabled:false};
}
