from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()

# Free Workers allow 50 external subrequests per invocation. News Core uses a
# rotating batch, so keep each feed to one direct attempt plus one proxy fallback.
old_getfeed=re.search(r"async function getFeed\(url\)\{.*?\}\nfunction parse",s,re.S)
if not old_getfeed:
    raise SystemExit('getFeed boundary not found')
new_getfeed="""async function getFeed(url){let last='';try{const r=await get(url);if(r.ok)return{r,transport:'direct'};last='HTTP '+r.status}catch(e){last=String(e.message||e)}try{const proxy='https://r.jina.ai/'+url;const r=await get(proxy);if(r.ok)return{r,transport:'proxy',proxy:true}}catch(e){last=String(e.message||e)}throw Error(last||'feed unavailable')}\nfunction parse"""
s=s[:old_getfeed.start()]+new_getfeed+s[old_getfeed.end():]
s=s.replace("const CURSOR_KEY='news/cursor',SNAPSHOT_KEY='news/snapshot',BATCH=18;","const CURSOR_KEY='news/cursor',SNAPSHOT_KEY='news/snapshot',BATCH=12;")
old_rl=re.search(r"async function rateLimit\(req,env,bucket,limit=30\)\{.*?\}\n",s,re.S)
if not old_rl:
    raise SystemExit('rateLimit function not found')
new_rl="""const RL_MEM=new Map();\nfunction rateLimit(req,env,bucket,limit=30){const ip=req.headers.get('CF-Connecting-IP')||'unknown',key=bucket+':'+ip,now=Date.now(),v=RL_MEM.get(key);if(!v||now-v.started>=60000){RL_MEM.set(key,{started:now,count:1});return true}if(v.count>=limit)return false;v.count++;return true}\n"""
s=s[:old_rl.start()]+new_rl+s[old_rl.end():]
start=s.find('async function market(env){')
end=s.find('async function universe',start)
if start<0 or end<0:
    raise SystemExit('market boundaries not found')
market=r'''const MARKET_SNAPSHOT_KEY='market/snapshot',MARKET_CURSOR_KEY='market/cursor',MARKET_BATCH=18;
async function market(env){
  const previous=await readKV(env,MARKET_SNAPSHOT_KEY)||{indices:[]};
  const cursorState=await readKV(env,MARKET_CURSOR_KEY)||{next:0};
  const entries=Object.entries(MARKET),startAt=Number(cursorState.next||0)%Math.max(entries.length,1),selected=[];
  for(let i=0;i<MARKET_BATCH&&i<entries.length;i++)selected.push(entries[(startAt+i)%entries.length]);
  const fresh=await Promise.all(selected.map(async([name,ticker])=>{try{const q=await quote(ticker),changePct=q.previous?((q.price-q.previous)/q.previous)*100:0;const item={name,...q,rsi:rsi(q.closes),changePct,ok:true};item.evaluation=evaluate(item);return item}catch(e){return{name,ticker,ok:false,error:String(e.message||e)}}}));
  const byName=new Map((previous.indices||[]).map(x=>[x.name,x]));for(const x of fresh)byName.set(x.name,x);
  const indices=entries.map(([name,ticker])=>byName.get(name)||{name,ticker,ok:false,error:'Awaiting rotating quote'});
  let crypto=[];try{const r=await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur&include_24hr_change=true');if(r.ok){const d=await r.json();crypto=[['BTC','bitcoin'],['ETH','ethereum']].map(([symbol,id])=>({symbol,price:Number(d[id]?.eur||0),change24h:Number(d[id]?.eur_24h_change||0),ok:Number(d[id]?.eur||0)>0}))}}catch{}
  const [institutional,social,onchain]=await Promise.all([runDataAdapter(env,'institutional'),runDataAdapter(env,'social'),runDataAdapter(env,'onchain')]);
  const next=entries.length?(startAt+MARKET_BATCH)%entries.length:0;
  const out={timestamp:new Date().toISOString(),build:BUILD,marketUniverseVersion:'DATA-EXPANSION-V1',marketUniverse:Object.keys(MARKET),batch:{start:startAt,size:MARKET_BATCH,next},indices,crypto,institutionalData:institutional,socialData:social,onchainData:onchain};
  await writeKV(env,MARKET_CURSOR_KEY,{next,timestamp:out.timestamp});
  await writeKV(env,MARKET_SNAPSHOT_KEY,out,900);
  return out;
}
'''
s=s[:start]+market+s[end:]
if 'MARKET_BATCH=18' not in s or 'BATCH=12' not in s or 'const MARKET_SNAPSHOT_KEY' not in s or 'const RL_MEM=new Map()' not in s:
    raise SystemExit('free-budget patch markers missing')
if re.search(r"async function getFeed\(url\)\{.*?for\(let attempt=0;attempt<2;attempt\+\+\)",s,re.S):
    raise SystemExit('two-attempt feed loop remains')
if re.search(r'(?<![A-Za-z0-9_])market\(\)',s):
    raise SystemExit('unbound market() call remains')
p.write_text(s)
print('Applied Workers Free subrequest-safe rotating news/market batches and in-memory HTTP rate limiting')
