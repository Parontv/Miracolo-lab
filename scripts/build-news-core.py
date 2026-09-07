from pathlib import Path

p = Path('worker.js')
s = p.read_text()
s = s.replace("const BUILD='ML-20260906-V4-NEWS-TRANSPORT';", "const BUILD='ML-20260908-V15-33-FEEDS-12-GDELT-CATEGORIES';")
old_get = "async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);try{return await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain,application/json'}})}finally{clearTimeout(t)}}"
new_get = "async function get(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);try{return await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain,application/json'}})}finally{clearTimeout(t)}}"
if old_get in s:s=s.replace(old_get,new_get,1)
start=s.find('async function scan(')
end=s.find('async function quote(',start)
if start<0 or end<0:raise SystemExit('scan boundaries not found')
scan=r'''async function scan(){
const GDELT=[
['news','GDELT News','stocks OR Nasdaq OR S&P500 OR Dow Jones OR Wall Street'],
['finance','GDELT Finance','stocks OR equities OR Nasdaq OR S&P500 OR investing OR markets'],
['crypto','GDELT Crypto','Bitcoin OR Ethereum OR cryptocurrency OR crypto ETF OR stablecoin'],
['macro','GDELT Macro','inflation OR CPI OR PCE OR GDP OR payrolls OR PMI OR recession'],
['rates','GDELT Rates','Treasury OR bonds OR yields OR Bund OR BTP OR credit spread OR high yield'],
['central','GDELT Central Banks','Federal Reserve OR ECB OR BoE OR BoJ OR SNB OR RBA OR central bank'],
['commodities','GDELT Commodities','oil OR Brent OR WTI OR gold OR silver OR copper OR natural gas OR OPEC'],
['fx','GDELT FX','EURUSD OR DXY OR USDJPY OR GBPUSD OR forex OR dollar OR yen'],
['volatility','GDELT Volatility','VIX OR volatility OR options OR gamma OR put call OR open interest'],
['geopolitics','GDELT Geopolitics','geopolitics OR sanctions OR tariffs OR war OR conflict OR Ukraine OR Russia OR Iran OR Israel'],
['social','GDELT Social','investors OR retail trading OR WallStreetBets OR Reddit stocks OR meme stocks'],
['company','GDELT Company','earnings OR revenue OR guidance OR buyback OR banking OR Nvidia OR Microsoft OR Apple OR companies']
];
async function gdeltFeed(cat,label,query){
  try{
    const u='https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent(query)+'&mode=artlist&format=json&timespan=24h&maxrecords=250&sort=datedesc';
    const r=await get(u);if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json();const raw=Array.isArray(d?.articles)?d.articles:[];
    const items=raw.map(x=>({title:String(x.title||'').trim(),description:'',date:x.seendate||x.date||'',url:x.url||x.url_mobile||'',link:x.url||x.url_mobile||'',source:label,type:cat,cat,publisher:x.domain||'GDELT'})).filter(x=>x.title&&x.url).map(x=>({...x,score:sentiment(x)}));
    return{name:label,type:cat,url:u,status:'ok',count:items.length,transport:'gdelt',items};
  }catch(e){return{name:label,type:cat,status:'error',count:0,error:String(e.message||e),items:[]}}
}
const primary=FEEDS.slice(0,33);
const [feedStates,gdeltStates]=await Promise.all([
  Promise.all(primary.map(async f=>{try{const r=await get(f[2]);if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();const items=parse(text,f).map(x=>({...x,score:sentiment(x)}));return{name:f[0],type:f[1],url:f[2],status:'ok',count:items.length,transport:'direct',items}}catch(e){return{name:f[0],type:f[1],url:f[2],status:'error',count:0,error:String(e.message||e),items:[]}}})),
  Promise.all(GDELT.map(x=>gdeltFeed(x[0],x[1],x[2])))
]);
const states=[...feedStates,...gdeltStates];
const all=states.flatMap(x=>x.items);const buckets=Object.fromEntries(GROUPS.map(k=>[k,[]]));
for(const x of all)buckets[categoryOf(x)].push(x);
for(const k of GROUPS){const seen=new Set();buckets[k]=buckets[k].filter(x=>{const key=(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,300)}
const items=GROUPS.flatMap(k=>buckets[k]);const pos=items.filter(x=>x.score>0).length,neg=items.filter(x=>x.score<0).length;
const categorySummary=Object.fromEntries(GROUPS.map(k=>[k,{count:buckets[k].length,complete:buckets[k].length>=300}]));
return{timestamp:new Date().toISOString(),sources:states.map(({items,...x})=>x),items,categories:buckets,categorySummary,summary:{configured:45,reachable:states.filter(x=>x.status==='ok').length,failed:states.filter(x=>x.status==='error').length,items:items.length,strong:items.filter(x=>Math.abs(x.score)>=1).length,news:items.filter(x=>['news','company','equity'].includes(x.type)).length,social:items.filter(x=>x.type==='social').length,sentiment:{positive:pos,negative:neg,neutral:items.length-pos-neg}}};
}
'''
s=s[:start]+scan+s[end:]
p.write_text(s)
print('Built V15: 33 direct feeds + 12 GDELT category feeds')