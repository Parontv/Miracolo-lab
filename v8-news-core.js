async function scan(){
const categoryFeeds=[
['news','Market News 1','stock market finance markets'],['news','Market News 2','Wall Street S&P 500 Dow Nasdaq'],
['finance','Finance 1','stocks equities Nasdaq S&P 500'],['finance','Finance 2','share price equity markets investing'],
['crypto','Crypto 1','bitcoin ethereum cryptocurrency stablecoin'],['crypto','Crypto 2','crypto ETF bitcoin ETF ethereum ETF blockchain'],
['macro','Macro 1','inflation CPI PCE GDP PMI'],['macro','Macro 2','economic growth employment payrolls recession economy'],
['rates','Rates 1','Treasury bonds yields Bund BTP'],['rates','Rates 2','interest rates bond auction credit spread high yield'],
['central','Central Banks 1','Federal Reserve ECB BoE BoJ'],['central','Central Banks 2','central bank monetary policy Fed ECB rate decision'],
['commodities','Commodities 1','oil Brent WTI gold copper'],['commodities','Commodities 2','natural gas OPEC silver commodity prices'],
['fx','Forex 1','forex EURUSD USDJPY GBPUSD'],['fx','Forex 2','DXY dollar euro yen sterling currency'],
['volatility','Volatility 1','VIX volatility options'],['volatility','Volatility 2','implied volatility gamma put call open interest'],
['geopolitics','Geopolitics 1','geopolitics sanctions tariffs war markets'],['geopolitics','Geopolitics 2','Ukraine Russia Iran Israel China trade'],
['social','Social 1','Reddit WallStreetBets retail investors'],['social','Social 2','investor sentiment retail trading meme stocks'],
['company','Company 1','earnings revenue guidance company results'],['company','Company 2','buyback profit quarterly results corporate companies']
];
async function fetchCategory(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'application/rss+xml,application/xml,text/xml,text/plain'}});if(!r.ok)throw Error('HTTP '+r.status);return{r,transport:'direct'}}finally{clearTimeout(t)}}
const buckets=Object.fromEntries(GROUPS.map(k=>[k,[]]));
const states=await Promise.all(categoryFeeds.map(async f=>{const q=encodeURIComponent(f[2]),url='https://www.bing.com/news/search?q='+q+'&format=rss&setlang=en-US';try{const got=await fetchCategory(url),text=await got.r.text(),items=parse(text,[f[1],f[0],url]).map(x=>({...x,score:sentiment(x),cat:f[0],type:f[0]}));return{name:f[1],type:f[0],url,status:'ok',count:items.length,transport:got.transport,items}}catch(e){return{name:f[1],type:f[0],url,status:'error',count:0,error:String(e.message||e),items:[]}}}));
for(const s of states)for(const x of s.items)buckets[x.cat].push(x);
for(const k of GROUPS){const seen=new Set();buckets[k]=buckets[k].filter(x=>{const key=(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,300)}
const items=GROUPS.flatMap(k=>buckets[k]),pos=items.filter(x=>x.score>0).length,neg=items.filter(x=>x.score<0).length,categorySummary=Object.fromEntries(GROUPS.map(k=>[k,{count:buckets[k].length,complete:buckets[k].length>=200}]));
return{timestamp:new Date().toISOString(),sources:states.map(({items,...x})=>x),items,categories:buckets,categorySummary,summary:{configured:categoryFeeds.length,reachable:states.filter(x=>x.status==='ok').length,failed:states.filter(x=>x.status==='error').length,items:items.length,strong:items.filter(x=>Math.abs(x.score)>=1).length,news:items.length,social:buckets.social.length,sentiment:{positive:pos,negative:neg,neutral:items.length-pos-neg}}};
}
