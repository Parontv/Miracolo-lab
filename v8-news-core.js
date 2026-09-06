async function scan(){
const categoryFeeds=[
['news','Market News 1','stock market OR finance OR markets'],['news','Market News 2','Wall Street OR S&P 500 OR Dow OR Nasdaq'],
['finance','Finance 1','stocks OR equities OR Nasdaq OR S&P 500'],['finance','Finance 2','share price OR stock market OR equity markets'],
['crypto','Crypto 1','bitcoin OR ethereum OR crypto OR stablecoin'],['crypto','Crypto 2','crypto ETF OR bitcoin ETF OR ethereum ETF OR blockchain'],
['macro','Macro 1','inflation OR CPI OR PCE OR GDP OR PMI'],['macro','Macro 2','economic growth OR employment OR payrolls OR recession OR consumer spending'],
['rates','Rates 1','Treasury OR Bund OR BTP OR bond OR yield'],['rates','Rates 2','interest rates OR bond auction OR credit spread OR high yield'],
['central','Central Banks 1','Federal Reserve OR ECB OR BoE OR BoJ'],['central','Central Banks 2','central bank OR Fed OR ECB OR rate decision OR monetary policy'],
['commodities','Commodities 1','oil OR Brent OR WTI OR gold OR copper'],['commodities','Commodities 2','natural gas OR OPEC OR silver OR commodity prices'],
['fx','Forex 1','forex OR EURUSD OR USDJPY OR GBPUSD'],['fx','Forex 2','DXY OR dollar OR euro OR yen OR sterling OR currency'],
['volatility','Volatility 1','VIX OR volatility OR options'],['volatility','Volatility 2','implied volatility OR gamma OR put call OR open interest'],
['geopolitics','Geopolitics 1','geopolitics OR sanctions OR tariffs OR war'],['geopolitics','Geopolitics 2','Ukraine OR Russia OR Iran OR Israel OR China trade'],
['social','Social 1','Reddit OR WallStreetBets OR retail investors'],['social','Social 2','investor sentiment OR retail trading OR meme stocks'],
['company','Company 1','earnings OR revenue OR guidance OR company results'],['company','Company 2','buyback OR profit OR quarterly results OR corporate']
];
async function fetchCategory(url){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
 try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain'}});if(r.ok)return{r,transport:'direct'};throw Error('HTTP '+r.status)}
 catch(e){try{const r=await fetch('https://r.jina.ai/'+url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':UA,Accept:'text/plain'}});if(r.ok)return{r,transport:'proxy'}}catch(_){}throw e}
 finally{clearTimeout(t)}
}
const buckets=Object.fromEntries(GROUPS.map(k=>[k,[]])),sources=[];
for(const f of categoryFeeds){const q=encodeURIComponent(f[2]),url='https://news.google.com/rss/search?q='+q+'&when:7d&hl=en-US&gl=US&ceid=US:en';try{const got=await fetchCategory(url),text=await got.r.text(),items=parse(text,[f[1],f[0],url]).map(x=>({...x,score:sentiment(x),cat:f[0],type:f[0]}));sources.push({name:f[1],type:f[0],url,status:'ok',count:items.length,transport:got.transport});buckets[f[0]].push(...items)}catch(e){sources.push({name:f[1],type:f[0],url,status:'error',count:0,error:String(e.message||e)})}}
for(const k of GROUPS){const seen=new Set();buckets[k]=buckets[k].filter(x=>{const key=(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,300)}
const items=GROUPS.flatMap(k=>buckets[k]),pos=items.filter(x=>x.score>0).length,neg=items.filter(x=>x.score<0).length,categorySummary=Object.fromEntries(GROUPS.map(k=>[k,{count:buckets[k].length,complete:buckets[k].length>=200}]));
return{timestamp:new Date().toISOString(),sources,items,categories:buckets,categorySummary,summary:{configured:categoryFeeds.length,reachable:sources.filter(x=>x.status==='ok').length,failed:sources.filter(x=>x.status==='error').length,items:items.length,strong:items.filter(x=>Math.abs(x.score)>=1).length,news:items.length,social:buckets.social.length,sentiment:{positive:pos,negative:neg,neutral:items.length-pos-neg}}};
}
