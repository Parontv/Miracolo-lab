/* Miracolo Lab V20.01.09 — consolidated multi-source intelligence.
   Keeps the existing core worker and restores the expanded V19 source layer without loading legacy frontend modules. */
import base from './worker.js';

const VERSION='20.01.09';
const EXTRA=[
['Google US Tech','equity','https://news.google.com/rss/search?q=US+technology+stocks+OR+Nasdaq+OR+semiconductors&hl=en-US&gl=US&ceid=US:en'],
['Google US Small Caps','equity','https://news.google.com/rss/search?q=Russell+2000+OR+small+caps+OR+smallcap+stocks&hl=en-US&gl=US&ceid=US:en'],
['Google Europe Markets','equity','https://news.google.com/rss/search?q=European+stocks+OR+STOXX+50+OR+DAX+OR+CAC+40+OR+FTSE+MIB&hl=en-US&gl=US&ceid=US:en'],
['Google Asia Markets','equity','https://news.google.com/rss/search?q=Asian+stocks+OR+Nikkei+OR+Hang+Seng+OR+KOSPI+OR+Shanghai&hl=en-US&gl=US&ceid=US:en'],
['Google Emerging Markets','equity','https://news.google.com/rss/search?q=emerging+markets+OR+MSCI+Emerging+Markets&hl=en-US&gl=US&ceid=US:en'],
['Google Treasury','rates','https://news.google.com/rss/search?q=US+Treasury+OR+Treasury+10Y+OR+Treasury+auction+OR+real+yields&hl=en-US&gl=US&ceid=US:en'],
['Google Bund','rates','https://news.google.com/rss/search?q=German+Bund+OR+Bund+yield+OR+German+10Y&hl=en-US&gl=US&ceid=US:en'],
['Google BTP','rates','https://news.google.com/rss/search?q=Italy+BTP+OR+BTP-Bund+spread+OR+Italian+bonds&hl=en-US&gl=US&ceid=US:en'],
['Google Credit','rates','https://news.google.com/rss/search?q=credit+spread+OR+high+yield+bonds+OR+investment+grade+bonds&hl=en-US&gl=US&ceid=US:en'],
['Google ECB Policy','central','https://news.google.com/rss/search?q=ECB+rates+OR+ECB+policy+OR+Lagarde+speech&hl=en-US&gl=US&ceid=US:en'],
['Google Fed Policy','central','https://news.google.com/rss/search?q=FOMC+OR+Fed+rates+OR+Powell+speech&hl=en-US&gl=US&ceid=US:en'],
['Google BoE Policy','central','https://news.google.com/rss/search?q=Bank+of+England+OR+BoE+rates+OR+Bailey+speech&hl=en-US&gl=US&ceid=US:en'],
['Google BoJ Policy','central','https://news.google.com/rss/search?q=Bank+of+Japan+OR+BoJ+rates+OR+Ueda+speech&hl=en-US&gl=US&ceid=US:en'],
['Google Inflation','macro','https://news.google.com/rss/search?q=US+inflation+OR+CPI+OR+PCE+OR+core+inflation&hl=en-US&gl=US&ceid=US:en'],
['Google Labor','macro','https://news.google.com/rss/search?q=US+jobs+OR+payrolls+OR+unemployment+OR+wages&hl=en-US&gl=US&ceid=US:en'],
['Google PMI','macro','https://news.google.com/rss/search?q=PMI+OR+ISM+OR+manufacturing+OR+services+PMI&hl=en-US&gl=US&ceid=US:en'],
['Google GDP','macro','https://news.google.com/rss/search?q=GDP+OR+economic+growth+OR+recession+OR+soft+landing&hl=en-US&gl=US&ceid=US:en'],
['Google Housing','macro','https://news.google.com/rss/search?q=US+housing+OR+home+sales+OR+housing+starts+OR+mortgages&hl=en-US&gl=US&ceid=US:en'],
['Google Retail','macro','https://news.google.com/rss/search?q=US+retail+sales+OR+consumer+spending+OR+consumer+confidence&hl=en-US&gl=US&ceid=US:en'],
['Google Oil','commodities','https://news.google.com/rss/search?q=crude+oil+OR+Brent+OR+WTI+OR+OPEC+oil&hl=en-US&gl=US&ceid=US:en'],
['Google Metals','commodities','https://news.google.com/rss/search?q=gold+OR+silver+OR+copper+prices&hl=en-US&gl=US&ceid=US:en'],
['Google Gas','commodities','https://news.google.com/rss/search?q=natural+gas+OR+LNG+prices&hl=en-US&gl=US&ceid=US:en'],
['Google FX Majors','fx','https://news.google.com/rss/search?q=EURUSD+OR+USDJPY+OR+GBPUSD+OR+USDCHF&hl=en-US&gl=US&ceid=US:en'],
['Google Dollar','fx','https://news.google.com/rss/search?q=DXY+OR+US+dollar+index+OR+dollar+strength&hl=en-US&gl=US&ceid=US:en'],
['Google Crypto Markets','crypto','https://news.google.com/rss/search?q=Bitcoin+OR+Ethereum+OR+crypto+market+OR+crypto+flows&hl=en-US&gl=US&ceid=US:en'],
['Google Crypto ETF','crypto','https://news.google.com/rss/search?q=spot+Bitcoin+ETF+OR+Ethereum+ETF+OR+crypto+ETF+flows&hl=en-US&gl=US&ceid=US:en'],
['Google Options','volatility','https://news.google.com/rss/search?q=options+market+OR+put+call+OR+implied+volatility&hl=en-US&gl=US&ceid=US:en'],
['Google Geopolitics','geopolitics','https://news.google.com/rss/search?q=tariffs+OR+sanctions+OR+trade+war+OR+geopolitics+markets&hl=en-US&gl=US&ceid=US:en'],
['Google Banks','company','https://news.google.com/rss/search?q=US+banks+OR+European+banks+OR+bank+earnings+OR+bank+stocks&hl=en-US&gl=US&ceid=US:en'],
['Google AI','company','https://news.google.com/rss/search?q=AI+stocks+OR+artificial+intelligence+earnings+OR+Nvidia+OR+Microsoft&hl=en-US&gl=US&ceid=US:en'],
['Google Semiconductors','company','https://news.google.com/rss/search?q=semiconductor+stocks+OR+chip+earnings+OR+TSMC+OR+AMD&hl=en-US&gl=US&ceid=US:en']
];

const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const field=(x,n)=>{const m=x.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+n+'>','i'));return m?clean(m[1]):''};
const getLink=x=>{let m=x.match(/<link[^>]*href=["']([^"']+)["']/i);if(m)return m[1];m=x.match(/<link[^>]*>([\s\S]*?)<\/link>/i);return m?clean(m[1]):''};
async function fetchFeed(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);try{return await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':'MiracoloLab/20.01.09',Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain'}})}finally{clearTimeout(t)}}
function parse(txt,f){const out=[],re=/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi;let m;while((m=re.exec(txt))){const x=m[0],title=field(x,'title'),description=field(x,'description')||field(x,'summary')||field(x,'content'),date=field(x,'pubDate')||field(x,'published')||field(x,'updated'),url=getLink(x);if(title)out.push({title,description,date,url,link:url,source:f[0],type:f[1],cat:f[1]})}return out}
async function scanExtra(){const states=await Promise.all(EXTRA.map(async f=>{try{const r=await fetchFeed(f[2]);if(!r.ok)throw Error('HTTP '+r.status);const items=parse(await r.text(),f);return{name:f[0],type:f[1],url:f[2],status:'ok',count:items.length,items}}catch(e){return{name:f[0],type:f[1],url:f[2],status:'error',count:0,error:String(e.message||e),items:[]}}}));return{states,items:states.flatMap(x=>x.items)}}
const json=x=>Response.json(x,{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
const cacheKey=new Request('https://miracolo-lab.local/v20-extra');
async function putExtra(x){try{await caches.default.put(cacheKey,json(x))}catch{}}
export default{
 async scheduled(event,env,ctx){if(base.scheduled)ctx.waitUntil(base.scheduled(event,env,ctx));ctx.waitUntil(scanExtra().then(putExtra))},
 async fetch(req,env,ctx){
   const u=new URL(req.url);
   if(u.pathname==='/api/full-scan'){
     const baseRes=await base.fetch(new Request(new URL('/api/full-scan',u),req),env,ctx);
     const b=await baseRes.json();
     const e=await scanExtra();
     const items=[...(b.items||[]),...e.items];
     const unique=[...new Map(items.map(x=>[(x.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),x])).values()].filter(x=>x.title).slice(0,5000);
     const sources=[...(b.sources||[]),...e.states.map(({items,...x})=>x)];
     return json({...b,version:VERSION,items:unique,top_signals:unique,summary:{...(b.summary||{}),configured:sources.length,reachable:sources.filter(x=>x.status==='ok').length,failed:sources.filter(x=>x.status==='error').length,items:unique.length,total:unique.length,workingSources:sources.filter(x=>x.status==='ok').length,news:unique.filter(x=>['news','company','equity'].includes(x.type)).length,social:unique.filter(x=>x.type==='social').length},sources});
   }
   if(u.pathname==='/api/version')return json({version:VERSION,sourceLayer:'V20.01.09',baseWorker:'worker.js'});
   return base.fetch(req,env,ctx);
 }
};
