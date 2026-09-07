from pathlib import Path

p = Path('worker.js')
s = p.read_text()
s = s.replace("const BUILD='ML-20260906-V4-NEWS-TRANSPORT';", "const BUILD='ML-20260908-V18-BING-HIGH-DENSITY-100';")
old_get = "async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);try{return await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain,application/json'}})}finally{clearTimeout(t)}}"
new_get = "async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);try{return await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain,application/json'}})}finally{clearTimeout(t)}}"
if old_get in s:s=s.replace(old_get,new_get,1)
start=s.find('async function scan(')
end=s.find('async function quote(',start)
if start<0 or end<0:raise SystemExit('scan boundaries not found')
scan=r'''async function scan(){
const BING=[
['news','Bing Market News 1','stock market finance markets'],['news','Bing Market News 2','Wall Street S&P 500 Dow Nasdaq'],
['finance','Bing Finance 1','stocks equities Nasdaq S&P 500'],['finance','Bing Finance 2','share price equity markets investing'],
['crypto','Bing Crypto 1','bitcoin ethereum cryptocurrency stablecoin'],['crypto','Bing Crypto 2','crypto ETF bitcoin ETF ethereum ETF blockchain'],
['macro','Bing Macro 1','inflation CPI PCE GDP PMI'],['macro','Bing Macro 2','economic growth employment payrolls recession economy'],
['rates','Bing Rates 1','Treasury bonds yields Bund BTP'],['rates','Bing Rates 2','interest rates bond auction credit spread high yield'],
['central','Bing Central 1','Federal Reserve ECB BoE BoJ'],['central','Bing Central 2','central bank monetary policy Fed ECB rate decision'],
['commodities','Bing Commodities 1','oil Brent WTI gold copper'],['commodities','Bing Commodities 2','natural gas OPEC silver commodity prices'],
['fx','Bing Forex 1','forex EURUSD USDJPY GBPUSD'],['fx','Bing Forex 2','DXY dollar euro yen currency'],
['volatility','Bing Volatility 1','VIX volatility options'],['volatility','Bing Volatility 2','implied volatility gamma put call open interest'],
['geopolitics','Bing Geopolitics 1','geopolitics sanctions tariffs war markets'],['geopolitics','Bing Geopolitics 2','Ukraine Russia Iran Israel China trade'],
['social','Bing Social 1','Reddit WallStreetBets retail investors'],['social','Bing Social 2','investor sentiment retail trading meme stocks'],
['company','Bing Company 1','earnings revenue guidance company results'],['company','Bing Company 2','buyback profit quarterly results corporate companies']
];
async function bingFeed(cat,label,q){const u='https://www.bing.com/news/search?q='+encodeURIComponent(q)+'&format=rss&count=100&setlang=en-US';try{const r=await get(u);if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();const items=parse(text,[label,cat,u]).map(x=>({...x,score:sentiment(x)}));return{name:label,type:cat,url:u,status:'ok',count:items.length,transport:'bing',items}}catch(e){return{name:label,type:cat,url:u,status:'error',count:0,error:String(e.message||e),items:[]}}}
const primary=FEEDS.slice(0,20);
const [feedStates,bingStates]=await Promise.all([
Promise.all(primary.map(async f=>{try{const r=await get(f[2]);if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();const items=parse(text,f).map(x=>({...x,score:sentiment(x)}));return{name:f[0],type:f[1],url:f[2],status:'ok',count:items.length,transport:'direct',items}}catch(e){return{name:f[0],type:f[1],url:f[2],status:'error',count:0,error:String(e.message||e),items:[]}}})),
Promise.all(BING.map(x=>bingFeed(x[0],x[1],x[2])))
]);
const states=[...feedStates,...bingStates],all=states.flatMap(x=>x.items),buckets=Object.fromEntries(GROUPS.map(k=>[k,[]]));
for(const x of all)buckets[categoryOf(x)].push(x);
for(const k of GROUPS){const seen=new Set();buckets[k]=buckets[k].filter(x=>{const key=(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,300)}
const items=GROUPS.flatMap(k=>buckets[k]),pos=items.filter(x=>x.score>0).length,neg=items.filter(x=>x.score<0).length,categorySummary=Object.fromEntries(GROUPS.map(k=>[k,{count:buckets[k].length,complete:buckets[k].length>=200}]));
return{timestamp:new Date().toISOString(),sources:states.map(({items,...x})=>x),items,categories:buckets,categorySummary,summary:{configured:44,reachable:states.filter(x=>x.status==='ok').length,failed:states.filter(x=>x.status==='error').length,items:items.length,strong:items.filter(x=>Math.abs(x.score)>=1).length,news:items.filter(x=>['news','company','equity'].includes(x.type)).length,social:items.filter(x=>x.type==='social').length,sentiment:{positive:pos,negative:neg,neutral:items.length-pos-neg}}};
}
'''
s=s[:start]+scan+s[end:]
p.write_text(s)
print('Built V18: 20 primary feeds + 24 Bing feeds at count=100')