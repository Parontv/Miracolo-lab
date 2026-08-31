/* Miracolo Lab V21.2.0 — expanded source layer with diagnostics.
   Baseline: V21.1.1. Existing engine remains intact; this layer adds cached GDELT news
   discovery and source-health metadata without increasing per-page subrequests. */
import current from './worker-v21-1.js';

const VERSION = '21.2.0';
const GDELT_CACHE = new Request('https://miracolo-lab.local/v21/gdelt-cache');
const GDELT_QUERIES = [
  ['GDELT Global Markets','news','stocks OR Nasdaq OR S&P500 OR Dow Jones'],
  ['GDELT Macro & Central Banks','macro','Federal Reserve OR ECB OR inflation OR interest rates OR Treasury'],
  ['GDELT Crypto','crypto','Bitcoin OR Ethereum OR crypto OR cryptocurrency OR Bitcoin ETF'],
  ['GDELT Commodities','commodities','gold OR oil OR crude OR copper OR natural gas'],
  ['GDELT Geopolitics','geopolitics','tariffs OR sanctions OR trade war OR geopolitics OR Ukraine OR Middle East'],
  ['GDELT AI & Semiconductors','company','Nvidia OR semiconductor OR artificial intelligence OR Microsoft OR TSMC']
];

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}})}
async function readCache(){try{const r=await caches.default.match(GDELT_CACHE);return r?r.json():null}catch{return null}}
async function writeCache(data){try{await caches.default.put(GDELT_CACHE,new Response(JSON.stringify(data),{headers:{'content-type':'application/json','cache-control':'max-age=600','x-ml-ts':String(Date.now())}}))}catch{}}
async function fetchGdelt(label,type,query){
  const started=Date.now();
  try{
    const u='https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent(query)+'&mode=artlist&format=json&timespan=24h&maxrecords=100&sort=datedesc';
    const r=await fetch(u,{redirect:'follow',headers:{'User-Agent':'MiracoloLab/21.2 (+https://miracolo-lab.pages.dev)',Accept:'application/json'}});
    if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json();
    const raw=Array.isArray(d?.articles)?d.articles:Array.isArray(d?.data)?d.data:[];
    const items=raw.map(x=>({
      title:String(x.title||x.name||'').trim(),
      description:'',
      date:x.seendate||x.date||'',
      url:x.url||x.url_mobile||'',
      link:x.url||x.url_mobile||'',
      source:label,
      type,
      cat:type,
      publisher:x.domain||x.sourcecountry||'GDELT',
      language:x.language||null,
      sourcecountry:x.sourcecountry||null
    })).filter(x=>x.title&&x.url);
    return {name:label,type,url:u,status:'ok',count:items.length,latencyMs:Date.now()-started,error:null,items};
  }catch(e){return {name:label,type,status:'error',count:0,latencyMs:Date.now()-started,error:String(e.message||e),items:[]}}
}
async function refreshGdelt(){
  const states=[];
  for(const q of GDELT_QUERIES) states.push(await fetchGdelt(q[0],q[1],q[2]));
  const items=states.flatMap(x=>x.items);
  await writeCache({timestamp:new Date().toISOString(),states,items});
  return {states,items};
}
function merge(baseData,extra){
  const all=[...(baseData.items||[]),...(extra?.items||[])].filter(x=>x?.title);
  const key=x=>`${String(x.title).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}|${x.source||''}`;
  const items=[...new Map(all.map(x=>[key(x),x])).values()].slice(0,10000);
  const sources=[...(baseData.sources||[]),...((extra?.states||[]).map(({items,...s})=>s))];
  const newsTypes=new Set(['news','company','equity','macro','rates','central','commodities','fx','crypto','flows','volatility','geopolitics','regulatory']);
  const social=items.filter(x=>x.type==='social').length;
  const news=items.filter(x=>newsTypes.has(x.type)).length;
  const summary={...(baseData.summary||{}),items:items.length,total:items.length,news,social,configured:sources.length,reachable:sources.filter(s=>s.status==='ok').length,failed:sources.filter(s=>s.status==='error').length,disabled:sources.filter(s=>s.status==='disabled').length,workingSources:sources.filter(s=>s.status==='ok').length};
  return {...baseData,version:VERSION,items,sources,summary};
}
export default {
  async scheduled(event,env,ctx){
    if(current.scheduled)ctx.waitUntil(current.scheduled(event,env,ctx));
    ctx.waitUntil(refreshGdelt());
  },
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname==='/api/version')return json({version:VERSION,entrypoint:'worker-v21-2.js',baseline:'21.1.1',engine:'worker-v20+v21.1+v21.2',refresh:'5m',reddit:true,x:Boolean(env?.X_BEARER_TOKEN),gdelt:true,aiHistory:true});
    if(u.pathname==='/api/source-diagnostics'){
      const cached=await readCache();
      return json({version:VERSION,generatedAt:cached?.timestamp||null,sources:cached?.states||[]});
    }
    if(u.pathname==='/api/full-scan'){
      const upstream=await current.fetch(req,env,ctx);
      const raw=await upstream.text();
      let baseData;try{baseData=JSON.parse(raw)}catch{return new Response(raw,{status:upstream.status,headers:upstream.headers})}
      const cached=await readCache();
      return json(merge(baseData,cached),upstream.status);
    }
    return current.fetch(req,env,ctx);
  }
};
