/* Miracolo Lab — BTC/USD 24/7 paper-trading signal engine. */
const BASE='https://data.alpaca.markets/v1beta3/crypto/us';
const SYMBOL='BTC/USD';
const iso=()=>new Date().toISOString();
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
async function get(url,env){
  const key=env?.ALPACA_API_KEY,secret=env?.ALPACA_API_SECRET;
  if(!key||!secret)throw new Error('Alpaca Paper credentials missing.');
  const r=await fetch(url,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json','User-Agent':'MiracoloLab/1.0'}});
  if(!r.ok)throw new Error(`Alpaca data HTTP ${r.status}`);
  return r.json();
}
function mean(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
function imbalance(book,levels=10){
  const bids=(book?.b||[]).slice(0,levels).map(x=>n(x.s)).filter(x=>x!=null);
  const asks=(book?.a||[]).slice(0,levels).map(x=>n(x.s)).filter(x=>x!=null);
  const bid=mean(bids)||0,ask=mean(asks)||0;
  const total=bid+ask;
  return {bidSize:bid,askSize:ask,ratio:total?(bid-ask)/total:0,levels:Math.min(bids.length,asks.length)};
}
export async function getCryptoDecision(env){
  try{
    const [bookData,snapData,barsData]=await Promise.all([
      get(`${BASE}/latest/orderbooks?symbols=${encodeURIComponent(SYMBOL)}`,env),
      get(`${BASE}/snapshots?symbols=${encodeURIComponent(SYMBOL)}`,env),
      get(`${BASE}/bars?symbols=${encodeURIComponent(SYMBOL)}&timeframe=5Min&limit=60&sort=desc`,env)
    ]);
    const book=bookData?.orderbooks?.[SYMBOL]||{};
    const snap=snapData?.snapshots?.[SYMBOL]||{};
    const bars=(barsData?.bars?.[SYMBOL]||[]).slice().reverse();
    const quote=snap.latestQuote||snap.quote||{};
    const trade=snap.latestTrade||snap.trade||{};
    const last=n(trade.p)||n(snap.latestBar?.c)||n(quote.ap);
    const bid=n(quote.bp),ask=n(quote.ap),mid=bid!=null&&ask!=null?(bid+ask)/2:last;
    const im=imbalance(book,10);
    const closes=bars.map(x=>n(x.c)).filter(x=>x!=null);
    const current=closes.at(-1)||mid;
    const previous=closes.at(-6)||null;
    const momentum=previous&&current?(current/previous-1):0;
    const short=mean(closes.slice(-6)),long=mean(closes.slice(-30));
    const trend=short&&long?clamp(short/long-1,-.03,.03)/.03:0;
    const score=clamp(im.ratio*0.55+clamp(momentum*100,-1,1)*0.20+trend*0.25,-1,1);
    const direction=Math.abs(score)>=.22?Math.sign(score):0;
    const confidence=Math.round(clamp(50+Math.abs(score)*40+Math.min(im.levels,10),50,92));
    const status=direction?'CONTRIBUISCE':'READY';
    return {ok:true,symbol:SYMBOL,marketOpen24x7:true,direction,strength:Math.abs(score),confidence,coverage:im.levels>=5?1:.5,status,dataAvailable:true,price:last,mid,bid,ask,spread:bid!=null&&ask!=null?ask-bid:null,orderBook:{bidSize:im.bidSize,askSize:im.askSize,imbalance:im.ratio,levels:im.levels},momentum25m:momentum,trend,score,evidence:[`Order book imbalance ${(im.ratio*100).toFixed(1)}%`,`Momentum 25m ${(momentum*100).toFixed(2)}%`,`Trend short/long ${(trend*100).toFixed(1)}%`,`Bid/ask ${bid??'N/A'} / ${ask??'N/A'}`],reason:direction?`BTC/USD ${direction>0?'LONG':'SHORT'}: order flow e momentum convergono.`:'BTC/USD: nessuna convergenza sufficiente per aprire una posizione.',asOf:book?.t||iso()};
  }catch(e){
    return {ok:false,symbol:SYMBOL,marketOpen24x7:true,direction:0,strength:0,confidence:0,coverage:0,status:'NO_DATA',dataAvailable:false,evidence:[String(e.message||e)],reason:'Dati crypto non disponibili.'};
  }
}
