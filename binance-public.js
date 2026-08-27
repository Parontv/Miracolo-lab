/* Binance public market data — no API key required */
const BINANCE_BASE = 'https://api.binance.com';
const BINANCE_SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT'];

async function binanceGet(path) {
  const r = await fetch(BINANCE_BASE + path, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`Binance HTTP ${r.status}`);
  return r.json();
}

export async function getBinanceMarketData() {
  const results = await Promise.allSettled(BINANCE_SYMBOLS.map(async symbol => {
    const [ticker, candles, book] = await Promise.all([
      binanceGet(`/api/v3/ticker/24hr?symbol=${symbol}`),
      binanceGet(`/api/v3/klines?symbol=${symbol}&interval=1h&limit=50`),
      binanceGet(`/api/v3/depth?symbol=${symbol}&limit=20`)
    ]);
    const closes = candles.map(k => Number(k[4]));
    const volumes = candles.map(k => Number(k[5]));
    const sma20 = closes.slice(-20).reduce((a,b)=>a+b,0) / Math.min(20, closes.length);
    const sma50 = closes.reduce((a,b)=>a+b,0) / closes.length;
    const gains=[], losses=[];
    for(let i=1;i<closes.length;i++){ const d=closes[i]-closes[i-1]; if(d>=0) gains.push(d); else losses.push(Math.abs(d)); }
    const avgGain = gains.slice(-14).reduce((a,b)=>a+b,0)/14;
    const avgLoss = losses.slice(-14).reduce((a,b)=>a+b,0)/14;
    const rsi = avgLoss === 0 ? 100 : 100-(100/(1+(avgGain/avgLoss)));
    const bid = Number(book.bids?.[0]?.[0] || 0), ask = Number(book.asks?.[0]?.[0] || 0);
    const bidQty = Number(book.bids?.[0]?.[1] || 0), askQty = Number(book.asks?.[0]?.[1] || 0);
    const imbalance = (bidQty+askQty) ? (bidQty-askQty)/(bidQty+askQty) : 0;
    const price = Number(ticker.lastPrice);
    const trend = price > sma20 && sma20 > sma50 ? 'BULLISH' : price < sma20 && sma20 < sma50 ? 'BEARISH' : 'MIXED';
    const score = Math.max(0, Math.min(100, Math.round(50 + (price>sma20?12:-12) + (sma20>sma50?15:-15) + (rsi>55&&rsi<70?10:rsi<35?8:rsi>75?-12:0) + imbalance*12)));
    return { symbol, price, change24h:Number(ticker.priceChangePercent), volume24h:Number(ticker.volume), high24h:Number(ticker.highPrice), low24h:Number(ticker.lowPrice), sma20, sma50, rsi:Math.round(rsi*10)/10, bid, ask, spread:ask-bid, orderBookImbalance:Math.round(imbalance*1000)/1000, trend, score, candles:closes.map((c,i)=>({close:c,volume:volumes[i]})) };
  }));
  return { ok:true, source:'Binance public API', timestamp:new Date().toISOString(), assets:results.filter(x=>x.status==='fulfilled').map(x=>x.value), errors:results.filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason)) };
}
