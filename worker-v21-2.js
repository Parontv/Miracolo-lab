/* Miracolo Lab V1 — high-volume source aggregation layer. */
import current from './worker-v21-1.js';

const VERSION='1.0.5';
const GDELT_CACHE=new Request('https://miracolo-lab.local/v1/gdelt-cache');
const GDELT_QUERIES=[
 ['GDELT News','news','markets OR stocks OR financial markets OR breaking news'],
 ['GDELT Finance','finance','stocks OR equities OR Nasdaq OR S&P500 OR Dow Jones OR FTSE OR DAX OR CAC'],
 ['GDELT Macro','macro','inflation OR CPI OR PCE OR GDP OR PMI OR payrolls OR unemployment OR economic growth'],
 ['GDELT Rates','rates','Treasury OR bond yields OR Bund OR BTP OR gilts OR credit spreads OR interest rates'],
 ['GDELT Central Banks','central','Federal Reserve OR ECB OR Bank of England OR Bank of Japan OR central bank'],
 ['GDELT Commodities','commodities','gold OR silver OR oil OR Brent OR WTI OR copper OR natural gas OR OPEC'],
 ['GDELT Forex','fx','EUR USD OR USD JPY OR GBP USD OR DXY OR foreign exchange OR forex'],
 ['GDELT Volatility','volatility','VIX OR implied volatility OR options OR put call OR gamma OR volatility index'],
 ['GDELT Geopolitics','geopolitics','tariffs OR sanctions OR trade war OR geopolitics OR Ukraine OR Russia OR Iran OR Israel OR Middle East'],
 ['GDELT Crypto','crypto','Bitcoin OR Ethereum OR cryptocurrency OR stablecoin OR crypto ETF'],
 ['GDELT Companies','company','earnings OR revenue OR guidance OR buyback OR Nvidia OR Microsoft OR Apple OR JPMorgan'],
 ['GDELT Social','social','domain:reddit.com stocks OR investing OR wallstreetbets OR Bitcoin OR ethereum OR options']
];

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}})}
async function read(k){try{const r=await caches.default.match(k);return r?r.json():null}catch{return null}}
async function write(k,v){try{await caches.default.put(k,json(v))}catch{}}

async function gdelt(q){
 const [name,type,query]=q;
 try{
  const u='https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent(query)+'&mode=artlist&format=json&timespan=24h&maxrecords=250&sort=datedesc';
  const r=await fetch(u,{redirect:'follow',headers:{Accept:'application/json','User-Agent':'MiracoloLab/1.0'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();
  const items=(Array.isArray(d?.articles)?d.articles:[]).map(x=>({title:String(x.title||'').trim(),description:String(x.seendate||''),date:x.seendate||'',url:x.url||'',link:x.url||'',source:name,type,cat:type,publisher:x.domain||'GDELT'})).filter(x=>x.title&&x.url);
  return{name,type,url:u,status:'ok',count:items.length,items};
 }catch(e){return{name,type,status:'error',count:0,error:String(e.message||e),items:[]}}
}
async function refresh(){
 const states=await Promise.all(GDELT_QUERIES.map(gdelt));
 await write(GDELT_CACHE,{timestamp:new Date().toISOString(),states,items:states.flatMap(s=>s.items)});
 return states;
}

const CATEGORY_BY_SOURCE={
 'Google Macro':'macro','Google Inflation':'macro','Google Labor':'macro','Google PMI':'macro','Google GDP':'macro','Google Housing':'macro','Google Retail':'macro','Google Liquidity':'macro','BLS':'macro','BEA':'macro','FRED Releases':'macro','Eurostat News':'macro','BIS Statistics':'macro','BIS Research':'macro','BIS Data Releases':'macro',
 'Google Bonds':'rates','Google Treasury':'rates','Google Bund':'rates','Google BTP':'rates','Google Credit':'rates',
 'Google Central Banks':'central','Google ECB Policy':'central','Google Fed Policy':'central','Google BoE Policy':'central','Google BoJ Policy':'central','ECB Press':'central','Fed Press':'central','Bank of Canada':'central','RBA Media':'central','BoJ News':'central','BIS Press':'central','BIS Central Bank Speeches':'central',
 'Google Commodities':'commodities','Google Oil':'commodities','Google Metals':'commodities','Google Gas':'commodities','EIA':'commodities','CFTC RSS':'commodities',
 'Google FX':'fx','Google FX Majors':'fx','Google Dollar':'fx',
 'Google Volatility':'volatility','Google Options':'volatility',
 'Google Geopolitics':'geopolitics',
 'Google Crypto':'crypto','Google Crypto Markets':'crypto','Google Crypto ETF':'crypto','CoinDesk':'crypto',
 'Google Earnings':'company','Google Banks':'company','Google Banking':'company','Google AI':'company','Google Semiconductors':'company','SEC Press':'company',
 'Google Finance':'finance','Google Europe':'finance','Google USA':'finance','Google Global Indices':'finance','Google Small Caps':'finance','Google US Tech':'finance','Google US Small Caps':'finance','Google Europe Markets':'finance','Google Asia Markets':'finance','Google Emerging Markets':'finance'
};
function normalize(x){
 const source=String(x?.source||x?.publisher||'');
 const forced=CATEGORY_BY_SOURCE[source];
 if(forced)return {...x,type:forced,cat:forced};
 const raw=`${x?.type||''} ${x?.cat||''} ${source} ${x?.title||''}`.toLowerCase();
 if(/inflation|cpi|pce|gdp|pmi|payroll|unemployment|economic growth|liquidity|money supply|fred|bls|bea|eurostat/.test(raw))return {...x,type:'macro',cat:'macro'};
 if(/treasury|bond|yield|bund|btp|gilt|credit spread|high yield|cds/.test(raw))return {...x,type:'rates',cat:'rates'};
 if(/fed|ecb|boe|boj|snb|rba|central bank/.test(raw))return {...x,type:'central',cat:'central'};
 if(/oil|brent|wti|gold|silver|copper|gas|opec/.test(raw))return {...x,type:'commodities',cat:'commodities'};
 if(/forex|eurusd|usd/?jpy|gbp/?usd|dxy|foreign exchange/.test(raw))return {...x,type:'fx',cat:'fx'};
 if(/vix|volatility|options|gamma|put.?call|open interest/.test(raw))return {...x,type:'volatility',cat:'volatility'};
 if(/geopolitic|sanction|tariff|trade war|ukraine|russia|iran|israel|middle east/.test(raw))return {...x,type:'geopolitics',cat:'geopolitics'};
 if(/crypto|bitcoin|ethereum|stablecoin/.test(raw))return {...x,type:'crypto',cat:'crypto'};
 if(/earnings|revenue|guidance|buyback|company|corporate/.test(raw))return {...x,type:'company',cat:'company'};
 if(/stock|equity|market|nasdaq|sp500|dow|ftse|dax|finance|etf/.test(raw))return {...x,type:'finance',cat:'finance'};
 return x;
}
function cleanBase(data){return {...data,items:(data.items||[]).map(normalize),sources:(data.sources||[])};}
function merge(base,extra){
 base=cleanBase(base);
 const all=[...(base.items||[]),...(extra?.items||[])].filter(x=>x?.title).map(normalize);
 const key=x=>String(x.title).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const items=[...new Map(all.map(x=>[key(x),x])).values()].filter(x=>x.title).slice(0,10000);
 const sources=[...(base.sources||[]),...((extra?.states||[]).map(({items,...s})=>s))];
 const newsTypes=new Set(['news','finance','company','equity','macro','rates','central','commodities','fx','crypto','flows','volatility','geopolitics','regulatory','social']);
 const summary={...(base.summary||{}),items:items.length,total:items.length,news:items.filter(x=>newsTypes.has(x.type)&&x.type!=='social').length,social:items.filter(x=>x.type==='social').length,configured:sources.length,reachable:sources.filter(s=>s.status==='ok').length,failed:sources.filter(s=>s.status==='error').length,workingSources:sources.filter(s=>s.status==='ok').length};
 return {...base,version:VERSION,items,sources,summary};
}

export default {
 async scheduled(event,env,ctx){if(current.scheduled)ctx.waitUntil(current.scheduled(event,env,ctx));ctx.waitUntil(refresh())},
 async fetch(req,env,ctx){
  const u=new URL(req.url);
  if(u.pathname==='/api/version')return json({version:VERSION,entrypoint:'worker-v21-2.js',engine:'V1 high-volume source aggregation',refresh:'5m',gdelt:true});
  if(u.pathname==='/api/source-diagnostics'){const c=await read(GDELT_CACHE);return json({version:VERSION,generatedAt:c?.timestamp||null,sources:c?.states||[]})}
  if(u.pathname==='/api/full-scan'){
   const upstream=await current.fetch(req,env,ctx);const text=await upstream.text();let base;try{base=JSON.parse(text)}catch{return new Response(text,{status:upstream.status,headers:upstream.headers})}
   let c=await read(GDELT_CACHE);if(!c){await refresh();c=await read(GDELT_CACHE)}
   return json(merge(base,c),upstream.status);
  }
  return current.fetch(req,env,ctx);
 }
};
