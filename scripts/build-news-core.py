from pathlib import Path

p = Path('worker.js')
s = p.read_text()
s = s.replace("const BUILD='ML-20260906-V4-NEWS-TRANSPORT';", "const BUILD='ML-20260908-V12-BATCHED-PERSISTENT-NEWS';")
old = "async function getFeed(url){let last='';for(let attempt=0;attempt<2;attempt++){try{const r=await get(url);if(r.ok)return{r,transport:'direct'};last='HTTP '+r.status}catch(e){last=String(e.message||e)}}try{const proxy='https://r.jina.ai/'+url;const r=await get(proxy);if(r.ok)return{r,transport:'proxy',proxy:true}}catch(e){last=String(e.message||e)}throw Error(last||'feed unavailable')}"
new = "async function getFeed(url){let last='';try{const r=await get(url);if(r.ok)return{r,transport:'direct'};last='HTTP '+r.status}catch(e){last=String(e.message||e)}try{const proxy='https://r.jina.ai/'+url;const r=await get(proxy);if(r.ok)return{r,transport:'proxy',proxy:true}}catch(e){last=String(e.message||e)}throw Error(last||'feed unavailable')}"
if old not in s:
    raise SystemExit('getFeed pattern not found')
s = s.replace(old, new, 1)
start = s.find('async function scan(){')
end = s.find('async function quote(', start)
if start < 0 or end < 0:
    raise SystemExit('scan boundaries not found')
scan = r'''async function scan(env){
const BATCH=14,CURSOR_KEY='news/cursor',SNAPSHOT_KEY='news/snapshot';
const RESCUE=[
['finance','Rescue Finance','https://news.google.com/rss/search?q=(stocks+OR+equities+OR+Nasdaq+OR+S%26P+500+OR+Wall+Street)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['crypto','Rescue Crypto','https://www.coindesk.com/arc/outboundfeeds/rss/'],
['macro','Rescue Macro','https://news.google.com/rss/search?q=(inflation+OR+CPI+OR+PCE+OR+GDP+OR+payrolls+OR+PMI)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['rates','Rescue Rates','https://news.google.com/rss/search?q=(Treasury+OR+bond+OR+yield+OR+credit+spread)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['central','Rescue Central Banks','https://news.google.com/rss/search?q=(Fed+OR+ECB+OR+BoE+OR+BoJ+OR+central+bank)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['commodities','Rescue Commodities','https://news.google.com/rss/search?q=(oil+OR+Brent+OR+WTI+OR+gold+OR+copper+OR+gas)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['fx','Rescue FX','https://news.google.com/rss/search?q=(EURUSD+OR+DXY+OR+USDJPY+OR+GBPUSD+OR+forex)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['volatility','Rescue Volatility','https://news.google.com/rss/search?q=(VIX+OR+volatility+OR+options+OR+gamma+OR+put+call)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['geopolitics','Rescue Geopolitics','https://news.google.com/rss/search?q=(geopolitics+OR+sanctions+OR+tariffs+OR+war+OR+conflict)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['social','Rescue Social','https://www.reddit.com/r/investing/.rss'],
['company','Rescue Company','https://news.google.com/rss/search?q=(earnings+OR+revenue+OR+guidance+OR+banking+OR+companies)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['news','Rescue News','https://news.google.com/rss/search?q=(stock+market+OR+Wall+Street+OR+markets)+when:7d&hl=en-US&gl=US&ceid=US:en']
];
const cur=await readKV(env,CURSOR_KEY)||{next:0};
const previous=await readKV(env,SNAPSHOT_KEY);
const start=Number(cur.next||0)%FEEDS.length;
const selected=[];for(let i=0;i<BATCH&&i<FEEDS.length;i++)selected.push(FEEDS[(start+i)%FEEDS.length]);
const states=await Promise.all(selected.map(async f=>{try{const got=await getFeed(f[2]);const text=await got.r.text();const items=parse(text,f).map(x=>({...x,score:sentiment(x)}));return{name:f[0],type:f[1],url:f[2],status:'ok',count:items.length,transport:got.transport,items}}catch(e){return{name:f[0],type:f[1],url:f[2],status:'error',count:0,error:String(e.message||e),items:[]}}}));
const buckets=Object.fromEntries(GROUPS.map(k=>[k,Array.isArray(previous?.categories?.[k])?previous.categories[k].slice():[]]));
for(const x of states.flatMap(x=>x.items))buckets[categoryOf(x)].push(x);
const need=GROUPS.filter(k=>(buckets[k]?.length||0)<20).sort((a,b)=>(buckets[a]?.length||0)-(buckets[b]?.length||0)).slice(0,5);
for(const cat of need){const f=RESCUE.find(x=>x[0]===cat);if(!f)continue;try{const got=await getFeed(f[2]);const text=await got.r.text();const extra=parse(text,[f[1],cat,f[2]]).map(x=>({...x,score:sentiment(x),rescue:true}));buckets[cat].push(...extra)}catch{}}
for(const k of GROUPS){const seen=new Set();buckets[k]=buckets[k].filter(x=>{const key=(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,300)}
const sourceMap=new Map((previous?.sources||[]).map(x=>[x.name,x]));for(const x of states){const {items,...meta}=x;sourceMap.set(x.name,meta)}
const sources=[...sourceMap.values()];const items=GROUPS.flatMap(k=>buckets[k]);const pos=items.filter(x=>x.score>0).length,neg=items.filter(x=>x.score<0).length;
const categorySummary=Object.fromEntries(GROUPS.map(k=>[k,{count:buckets[k].length,complete:buckets[k].length>=300}]));
const snapshot={timestamp:new Date().toISOString(),batch:{start,size:BATCH,selected:selected.map(x=>x[0]),next:(start+BATCH)%FEEDS.length},sources,items,categories:buckets,categorySummary,summary:{configured:FEEDS.length,reachable:sources.filter(x=>x.status==='ok').length,failed:sources.filter(x=>x.status==='error').length,items:items.length,strong:items.filter(x=>Math.abs(x.score)>=1).length,news:items.filter(x=>['news','company','equity'].includes(x.type)).length,social:items.filter(x=>x.type==='social').length,sentiment:{positive:pos,negative:neg,neutral:items.length-pos-neg}}};
await writeKV(env,CURSOR_KEY,{next:(start+BATCH)%FEEDS.length});await writeKV(env,SNAPSHOT_KEY,snapshot);return snapshot}
'''
s = s[:start] + scan + s[end:]
s = s.replace('await scan()', 'await scan(env)')
p.write_text(s)
print('Built V12 batched persistent News Core')