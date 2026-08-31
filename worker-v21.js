/* Miracolo Lab V21.1 — expanded intelligence layer.
   Keeps the V20 engine, adds high-volume Reddit ingestion, optional X API,
   server-side AI snapshots and a compact market narrative endpoint. */
import base from './worker-v20.js';

const VERSION = '21.1.0';
const SCAN_CACHE_KEY = new Request('https://miracolo-lab.local/v21/full-scan');
const HISTORY_KEY = new Request('https://miracolo-lab.local/v21/ai-history');
const CACHE_TTL_MS = 4 * 60 * 1000;
const HISTORY_MAX = 500;

const REDDIT = [
  ['Reddit Stocks','stocks'],['Reddit Investing','investing'],['Reddit WSB','wallstreetbets'],
  ['Reddit Crypto','CryptoCurrency'],['Reddit Bitcoin','Bitcoin'],['Reddit Ethereum','ethereum'],
  ['Reddit Options','options'],['Reddit Value','ValueInvesting'],['Reddit Stocks Market','StockMarket'],
  ['Reddit Day Trading','Daytrading']
];

function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}})}
async function get(url,headers={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);try{return await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':'MiracoloLab/21.1 (+https://miracolo-lab.pages.dev)',Accept:'application/json,application/rss+xml,application/atom+xml,text/xml,text/plain',...headers}})}finally{clearTimeout(t)}}
async function read(key){try{const r=await caches.default.match(key);return r?r.json():null}catch{return null}}
async function write(key,data,ttl=3600){try{await caches.default.put(key,new Response(JSON.stringify(data),{headers:{'content-type':'application/json','cache-control':`max-age=${ttl}`,'x-ml-ts':String(Date.now())}}))}catch{}}

async function redditFeed(label,sub){
  try{
    const r=await get(`https://www.reddit.com/r/${encodeURIComponent(sub)}/new.json?limit=100&raw_json=1`);
    if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json();
    const items=(d.data?.children||[]).map(x=>x.data).filter(x=>x?.title).map(x=>({
      title:String(x.title),description:String(x.selftext||'').slice(0,3000),date:x.created_utc?new Date(x.created_utc*1000).toISOString():'',
      url:x.url_overridden_by_dest||`https://www.reddit.com${x.permalink||''}`,link:x.url_overridden_by_dest||`https://www.reddit.com${x.permalink||''}`,
      source:label,type:'social',cat:'social',subreddit:sub,author:x.author||null,score:Number(x.score||0),comments:Number(x.num_comments||0),socialProvider:'reddit'
    }));
    return {name:label,type:'social',url:`https://www.reddit.com/r/${sub}/new.json?limit=100`,status:'ok',count:items.length,items};
  }catch(e){return {name:label,type:'social',url:`https://www.reddit.com/r/${sub}/new.json?limit=100`,status:'error',count:0,error:String(e.message||e),items:[]}}
}

async function xFeed(env){
  if(!env?.X_BEARER_TOKEN)return {name:'X / Twitter',type:'social',status:'disabled',count:0,items:[],error:'X_BEARER_TOKEN not configured'};
  const queries=['$BTC OR bitcoin',' $ETH OR ethereum','stocks OR Nasdaq OR S&P500','Fed OR ECB OR inflation'];
  const all=[];
  for(const q of queries){
    try{
      const r=await get('https://api.x.com/2/tweets/search/recent?max_results=100&tweet.fields=created_at,author_id,public_metrics&query='+encodeURIComponent(q+' -is:retweet lang:en'),{Authorization:`Bearer ${env.X_BEARER_TOKEN}`});
      if(!r.ok)continue;const d=await r.json();
      for(const x of (d.data||[]))all.push({title:x.text?.slice(0,220)||'X post',description:x.text||'',date:x.created_at||'',url:`https://x.com/i/web/status/${x.id}`,link:`https://x.com/i/web/status/${x.id}`,source:'X / Twitter',type:'social',cat:'social',socialProvider:'x',authorId:x.author_id||null,metrics:x.public_metrics||{}});
    }catch{}
  }
  return {name:'X / Twitter',type:'social',status:'ok',count:all.length,items:all};
}

async function readScanCache(){const x=await read(SCAN_CACHE_KEY);if(!x)return null;const ts=Number(x._ts||0);return ts&&Date.now()-ts<=CACHE_TTL_MS?x:null}
async function writeScanCache(data){data._ts=Date.now();await write(SCAN_CACHE_KEY,data,CACHE_TTL_MS/1000)}

function makeNarrative(data){
  const s=data.summary||{}, m=data.market||{}, items=data.items||[];
  const pos=Number(s.sentiment?.positive||0), neg=Number(s.sentiment?.negative||0), total=pos+neg+Number(s.sentiment?.neutral||0);
  const ratio=total?pos/Math.max(1,pos+neg):.5;
  const social=Number(s.social||0), news=Number(s.news||0);
  const crypto=m.crypto||[]; const btc=crypto.find(x=>x.symbol==='BTC'), eth=crypto.find(x=>x.symbol==='ETH');
  const marketBits=[];
  if(btc?.ok)marketBits.push(`BTC ${btc.change24h>=0?'+':''}${btc.change24h.toFixed(1)}%`);
  if(eth?.ok)marketBits.push(`ETH ${eth.change24h>=0?'+':''}${eth.change24h.toFixed(1)}%`);
  let sentiment='NEUTRAL',score=50;
  if(ratio>=.62){sentiment='BULLISH';score=65+Math.min(25,Math.round((ratio-.62)*100))}
  else if(ratio<=.38){sentiment='BEARISH';score=35-Math.min(25,Math.round((.38-ratio)*100))}
  const drivers=[];
  if(news)drivers.push(`${news} news`); if(social)drivers.push(`${social} segnali social`); if(marketBits.length)drivers.push(marketBits.join(', '));
  const lead=sentiment==='BULLISH'?'Il quadro è moderatamente costruttivo.':sentiment==='BEARISH'?'Il quadro mostra una pressione ribassista.':'Il quadro resta misto e richiede conferme.';
  const text=`${lead} La lettura combina ${drivers.length?drivers.join(', '):'i dati disponibili'}. Il sentiment aggregato è ${sentiment.toLowerCase()} con score ${score}/100. ${items.length?'Le fonti social e news vengono usate come segnali complementari, non come conferma autonoma.':''}`;
  return {sentiment,score,text,drivers,updatedAt:new Date().toISOString()};
}

async function market(){
  try{const r=await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur&include_24hr_change=true');if(r.ok){const d=await r.json();return{crypto:[['BTC','bitcoin'],['ETH','ethereum']].map(([symbol,id])=>({symbol,price:Number(d[id]?.eur||0),change24h:Number(d[id]?.eur_24h_change||0),ok:Number(d[id]?.eur||0)>0}))}}}catch{}
  return {crypto:[]};
}

async function fullScan(req,env,ctx){
  const cached=await readScanCache();if(cached){return {...cached,version:VERSION,cached:true}}
  const upstream=await base.fetch(new Request(new URL('/api/full-scan',req.url),req),env,ctx);
  const raw=await upstream.text();let baseData;try{baseData=JSON.parse(raw)}catch{return new Response(raw,{status:upstream.status,headers:upstream.headers})}
  const states=await Promise.all(REDDIT.map(([l,s])=>redditFeed(l,s))); const x=await xFeed(env);
  const extras=states.concat(x); const all=[...(baseData.items||[]),...extras.flatMap(z=>z.items)];
  const key=x=>`${String(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}|${x.source||''}`;
  const unique=[...new Map(all.filter(x=>x.title).map(x=>[key(x),x])).values()].slice(0,5000);
  const sources=[...(baseData.sources||[]),...extras.map(({items,...s})=>s)];
  const positive=unique.filter(i=>/\b(bullish|rally|surge|beat|inflow|upgrade|record|growth|breakout|buy)\b/i.test(`${i.title} ${i.description||''}`)).length;
  const negative=unique.filter(i=>/\b(bearish|crash|dump|selloff|plunge|outflow|downgrade|recession|panic|default|sell)\b/i.test(`${i.title} ${i.description||''}`)).length;
  const summary={...(baseData.summary||{}),configured:sources.length,reachable:sources.filter(s=>s.status==='ok').length,failed:sources.filter(s=>s.status==='error').length,disabled:sources.filter(s=>s.status==='disabled').length,items:unique.length,total:unique.length,news:unique.filter(x=>['news','company','equity','macro','rates','central','commodities','fx','crypto','flows','volatility','geopolitics','regulatory'].includes(x.type)).length,social:unique.filter(x=>x.type==='social').length,sentiment:{positive,negative,neutral:Math.max(0,unique.length-positive-negative)}};
  const data={...baseData,version:VERSION,items:unique,sources,summary,market:await market(),aiMarket:null,cached:false}; data.aiMarket=makeNarrative(data);
  const history=(await read(HISTORY_KEY))||[]; const snapshot={ts:data.timestamp||new Date().toISOString(),sentiment:data.aiMarket.sentiment,score:data.aiMarket.score,text:data.aiMarket.text,drivers:data.aiMarket.drivers,summary:{items:summary.items,news:summary.news,social:summary.social}};
  const last=history[history.length-1];if(!last||last.text!==snapshot.text){history.push(snapshot);await write(HISTORY_KEY,history.slice(-HISTORY_MAX),86400)}
  await writeScanCache(data,); return data;
}

export default {
  async scheduled(event,env,ctx){if(base.scheduled)ctx.waitUntil(base.scheduled(event,env,ctx));},
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname==='/api/version')return response({version:VERSION,engine:'worker-v20+v21.1',entrypoint:'worker-v21.js',refresh:'5m',reddit:true,x:Boolean(env?.X_BEARER_TOKEN),aiHistory:true});
    if(u.pathname==='/api/full-scan')return response(await fullScan(req,env,ctx));
    if(u.pathname==='/api/ai-history')return response({version:VERSION,history:(await read(HISTORY_KEY))||[]});
    return base.fetch(req,env,ctx);
  }
};
