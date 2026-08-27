/* Binance chart data helper — public API */
export async function getBinanceKlines(symbol='BTCUSDT', interval='1h', limit=48){
  const allowed=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT'];
  if(!allowed.includes(symbol)) throw new Error('Symbol non consentito');
  const safeInterval=['15m','1h','4h','1d','1w'].includes(interval)?interval:'1h';
  const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${safeInterval}&limit=${Math.min(100,Math.max(10,Number(limit)||48))}`);
  if(!r.ok) throw new Error(`Binance HTTP ${r.status}`);
  const rows=await r.json();
  return {ok:true,symbol,interval:safeInterval,data:rows.map(k=>({time:k[0],open:Number(k[1]),high:Number(k[2]),low:Number(k[3]),close:Number(k[4]),volume:Number(k[5])}))};
}
