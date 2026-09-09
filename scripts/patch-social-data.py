from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()
marker='async function market(env){'
if marker not in s:
    raise SystemExit('market(env) not found')
helper=r'''const SOCIAL_KEY='social/latest';
const SOCIAL_TTL=900;
async function socialData(env){
  const cached=await readKV(env,SOCIAL_KEY);
  if(cached?.timestamp && Date.now()-Date.parse(cached.timestamp)<SOCIAL_TTL*1000)return cached;
  const symbols=['SPY','QQQ','NVDA','TSLA','AAPL','BTC.X','ETH.X'];
  const results=await Promise.allSettled(symbols.map(async symbol=>{
    const r=await fetch('https://api.stocktwits.com/api/2/streams/symbol/'+encodeURIComponent(symbol)+'.json',{headers:{'User-Agent':UA,Accept:'application/json'}});
    if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json();
    const messages=(d?.messages||[]).slice(0,30);
    let bullish=0,bearish=0,neutral=0;
    for(const m of messages){const s=String(m?.entities?.sentiment?.basic||'').toUpperCase();if(s==='BULLISH')bullish++;else if(s==='BEARISH')bearish++;else neutral++;}
    return{symbol,messages:messages.length,bullish,bearish,neutral,sentimentScore:messages.length?Number(((bullish-bearish)/messages.length*100).toFixed(1)):0,ok:true};
  }));
  const data={timestamp:new Date().toISOString(),source:'StockTwits public stream',symbols:results.map((x,i)=>x.status==='fulfilled'?x.value:{symbol:symbols[i],ok:false,error:String(x.reason?.message||x.reason||'unavailable')})};
  await writeKV(env,SOCIAL_KEY,data,SOCIAL_TTL);
  return data;
}
'''
s=s.replace(marker,helper+marker,1)
needle='return{timestamp:new Date().toISOString(),indices,crypto,institutionalData:institutional}'
if needle not in s:
    # tolerate the same return object with additional fields already present
    if 'institutionalData:institutional' not in s:
        raise SystemExit('institutionalData return anchor not found')
    raise SystemExit('market return anchor not found')
replacement="let social=null;try{social=await socialData(env)}catch(e){social={timestamp:new Date().toISOString(),error:String(e.message||e)}}"+needle[:-1]+',socialData:social}'
s=s.replace(needle,replacement,1)
if 'socialData:social' not in s:
    raise SystemExit('socialData return was not inserted')
p.write_text(s)
print('Added KV-cached StockTwits retail sentiment as separate socialData')
