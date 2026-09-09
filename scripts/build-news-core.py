from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()
s=s.replace("const BUILD='ML-20260906-V4-NEWS-TRANSPORT';","const BUILD='ML-20260909-V21-CATEGORY-RESCUE';")
s=s.replace("t=setTimeout(()=>c.abort(),20000)","t=setTimeout(()=>c.abort(),12000)")
# Specific feed categories remain authoritative; generic 'news' must still be classified by content/source.
s=re.sub(r"function categoryOf\(x\)\{.*?\}\nasync function scan", "function categoryOf(x){const raw=`${x.cat||x.type||''} ${x.source||''} ${x.title||''} ${x.description||''}`.toLowerCase(),t=String(x.cat||x.type||'').toLowerCase();if(t&&t!=='news'&&GROUPS.includes(t))return t;if(/crypto|bitcoin|ethereum|solana|xrp|coindesk|cryptocurrency/.test(raw))return'crypto';if(/inflation|cpi|pce|gdp|payroll|pmi|fred|bls|bea|eurostat|liquidity|recession/.test(raw))return'macro';if(/treasury|bond|yield|bund|btp|gilt|credit spread|high yield|cds/.test(raw))return'rates';if(/fed|ecb|boe|boj|snb|rba|central bank/.test(raw))return'central';if(/gold|silver|oil|brent|wti|copper|opec|gas/.test(raw))return'commodities';if(/forex|eurusd|eur\/usd|dxy|usd[jy]|gbp|sterling|dollar|yen/.test(raw))return'fx';if(/vix|volatility|options|gamma|put.?call|open interest/.test(raw))return'volatility';if(/geopolitic|sanction|tariff|war|conflict|ukraine|russia|iran|israel/.test(raw))return'geopolitics';if(/reddit|social|sentiment|wallstreetbets/.test(raw))return'social';if(/earnings|company|corporate|sec filing|revenue|guidance|buyback|jpmorgan|goldman|banking|banks/.test(raw))return'company';if(/finance|market|stock|equity|etf|nasdaq|s&p|dow|dax|nikkei|ftse|msci|wall street|nyse/.test(raw))return'finance';return'news'}\nasync function scan",s,count=1,flags=re.S)
start=s.find('async function scan');end=s.find('async function quote(',start)
if start<0 or end<0: raise SystemExit('scan boundaries not found')
scan=r'''async function scan(env){
const CURSOR_KEY='news/cursor',SNAPSHOT_KEY='news/snapshot',BATCH=18;
const RESCUE=[
['news','Rescue News','https://news.google.com/rss/search?q=(stock+market+OR+Wall+Street+OR+markets)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['finance','Rescue Finance','https://news.google.com/rss/search?q=(stocks+OR+equities+OR+Nasdaq+OR+S%26P+500+OR+Wall+Street+OR+NYSE)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['crypto','Rescue Crypto','https://news.google.com/rss/search?q=(bitcoin+OR+ethereum+OR+crypto+OR+stablecoin+OR+crypto+ETF)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['macro','Rescue Macro','https://news.google.com/rss/search?q=(inflation+OR+CPI+OR+PCE+OR+GDP+OR+payrolls+OR+PMI+OR+recession)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['rates','Rescue Rates','https://news.google.com/rss/search?q=(Treasury+OR+bond+OR+yield+OR+credit+spread+OR+high+yield)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['central','Rescue Central Banks','https://news.google.com/rss/search?q=(Fed+OR+ECB+OR+BoE+OR+BoJ+OR+central+bank)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['commodities','Rescue Commodities','https://news.google.com/rss/search?q=(oil+OR+Brent+OR+WTI+OR+gold+OR+copper+OR+gas)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['fx','Rescue FX','https://news.google.com/rss/search?q=(EURUSD+OR+DXY+OR+USDJPY+OR+GBPUSD+OR+forex)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['volatility','Rescue Volatility','https://news.google.com/rss/search?q=(VIX+OR+volatility+OR+options+OR+gamma+OR+put+call)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['geopolitics','Rescue Geopolitics','https://news.google.com/rss/search?q=(geopolitics+OR+sanctions+OR+tariffs+OR+war+OR+conflict)+when:7d&hl=en-US&gl=US&ceid=US:en'],
['social','Rescue Social','https://www.reddit.com/r/investing/.rss'],
['company','Rescue Company','https://news.google.com/rss/search?q=(earnings+OR+revenue+OR+guidance+OR+banking+OR+companies)+when:7d&hl=en-US&gl=US&ceid=US:en']];
async function fetchFeed(f){try{const got=await getFeed(f[2]),text=await got.r.text(),items=parse(text,f).map(x=>({...x,score:sentiment(x)}));return{name:f[0],type:f[1],url:f[2],status:'ok',count:items.length,transport:got.transport,items}}catch(e){return{name:f[0],type:f[1],url:f[2],status:'error',count:0,error:String(e.message||e),items:[]}}}
const cur=await readKV(env,CURSOR_KEY)||{next:0},previous=await readKV(env,SNAPSHOT_KEY),startAt=Number(cur.next||0)%FEEDS.length,selected=[];for(let i=0;i<BATCH&&i<FEEDS.length;i++)selected.push(FEEDS[(startAt+i)%FEEDS.length]);
const states=await Promise.all(selected.map(fetchFeed));
const buckets=Object.fromEntries(GROUPS.map(k=>[k,Array.isArray(previous?.categories?.[k])?previous.categories[k].slice():[]]));
for(const x of states.flatMap(x=>x.items))buckets[categoryOf(x)].push(x);
// Rescue the genuinely weakest categories first. Previous V20 sorted this backwards, so macro/central crowded out crypto/finance.
const weak=GROUPS.filter(k=>(buckets[k]?.length||0)<200).sort((a,b)=>(buckets[a]?.length||0)-(buckets[b]?.length||0));
for(const cat of weak){const f=RESCUE.find(x=>x[0]===cat);if(!f)continue;const extra=await fetchFeed(f);if(extra.status==='ok')buckets[cat].push(...extra.items.map(x=>({...x,cat:cat,rescue:true})));}
for(const k of GROUPS){const seen=new Set();buckets[k]=buckets[k].filter(x=>{const key=(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,300)}
const items=GROUPS.flatMap(k=>buckets[k]),pos=items.filter(x=>x.score>0).length,neg=items.filter(x=>x.score<0).length,categorySummary=Object.fromEntries(GROUPS.map(k=>[k,{count:buckets[k].length,complete:buckets[k].length>=200}]));
const sourceMap=new Map((previous?.sources||[]).map(x=>[x.name,x]));for(const x of states){const{items,...meta}=x;sourceMap.set(x.name,meta)}
const snapshot={timestamp:new Date().toISOString(),batch:{start:startAt,size:BATCH,selected:selected.map(x=>x[0]),next:(startAt+BATCH)%FEEDS.length},sources:[...sourceMap.values()],items,categories:buckets,categorySummary,summary:{configured:FEEDS.length,reachable:[...sourceMap.values()].filter(x=>x.status==='ok').length,failed:[...sourceMap.values()].filter(x=>x.status==='error').length,items:items.length,strong:items.filter(x=>Math.abs(x.score)>=1).length,news:items.filter(x=>['news','company','equity'].includes(x.type)).length,social:items.filter(x=>x.type==='social').length,sentiment:{positive:pos,negative:neg,neutral:items.length-pos-neg}}};
await writeKV(env,CURSOR_KEY,{next:(startAt+BATCH)%FEEDS.length});await writeKV(env,SNAPSHOT_KEY,snapshot);return snapshot}
'''
s=s[:start]+scan+s[end:]
s=s.replace('await scan()','await scan(env)')
p.write_text(s)
print('Built V21 category routing and rescue')
