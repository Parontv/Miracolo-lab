import base from './worker.js';

const EXTRA_FEEDS = [
  ['Reuters Markets','news','https://news.google.com/rss/search?q=Reuters+markets+stocks+finance&hl=en-US&gl=US&ceid=US:en'],
  ['Bloomberg Markets','news','https://news.google.com/rss/search?q=Bloomberg+markets+stocks+finance&hl=en-US&gl=US&ceid=US:en'],
  ['Yahoo Finance','news','https://news.google.com/rss/search?q=Yahoo+Finance+markets+stocks&hl=en-US&gl=US&ceid=US:en'],
  ['Investing.com','news','https://news.google.com/rss/search?q=site%3Ainvesting.com+markets+stocks&hl=en-US&gl=US&ceid=US:en'],
  ['Financial Times Markets','news','https://news.google.com/rss/search?q=Financial+Times+markets&hl=en-US&gl=US&ceid=US:en'],
  ['Seeking Alpha','news','https://news.google.com/rss/search?q=site%3Aseekingalpha.com+stocks+ETF&hl=en-US&gl=US&ceid=US:en'],
  ['Barrons','news','https://news.google.com/rss/search?q=site%3Abarrons.com+markets&hl=en-US&gl=US&ceid=US:en'],
  ['Nasdaq','news','https://news.google.com/rss/search?q=site%3Anasdaq.com+markets&hl=en-US&gl=US&ceid=US:en'],
  ['Federal Reserve','macro','https://www.federalreserve.gov/feeds/press_all.xml'],
  ['ECB','macro','https://www.ecb.europa.eu/rss/press.html'],
  ['Eurostat','macro','https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/?format=JSON&lang=en'],
  ['IMF','macro','https://www.imf.org/en/News/RSS'],
  ['Bank of England','macro','https://www.bankofengland.co.uk/rss/news'],
  ['CoinTelegraph','crypto','https://cointelegraph.com/rss'],
  ['Decrypt','crypto','https://decrypt.co/feed'],
  ['The Block','crypto','https://www.theblock.co/rss.xml'],
  ['Blockworks','crypto','https://blockworks.co/feed'],
  ['TechCrunch','tech','https://techcrunch.com/feed/'],
  ['The Verge','tech','https://www.theverge.com/rss/index.xml'],
  ['Ars Technica','tech','https://feeds.arstechnica.com/arstechnica/index'],
  ['MIT Technology Review','tech','https://www.technologyreview.com/feed/'],
  ['EIA','commodities','https://www.eia.gov/rss/todayinenergy.xml'],
  ['OPEC','commodities','https://www.opec.org/opec_web/en/press_room/28.htm'],
  ['Kitco','commodities','https://www.kitco.com/rss/news.rss'],
  ['Il Sole 24 Ore','italy','https://www.ilsole24ore.com/rss/finanza-e-mercati.xml'],
  ['Milano Finanza','italy','https://www.milanofinanza.it/rss']
];
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const strip=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const field=(x,n)=>{const m=x.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+n+'>','i'));return m?strip(m[1]):''};
const link=(x)=>{let m=x.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);if(m)return m[1];m=x.match(/<link[^>]*>([\s\S]*?)<\/link>/i);return m?strip(m[1]):''};
async function feed(f){try{const r=await fetch(f[2],{headers:{'User-Agent':UA,Accept:'application/rss+xml, application/xml, text/xml, text/html;q=0.8'},redirect:'follow'});if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text(),out=[],re=/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi;let m;while((m=re.exec(text))&&out.length<30){const x=m[0],title=field(x,'title'),description=field(x,'description')||field(x,'summary')||field(x,'content'),date=field(x,'pubDate')||field(x,'published')||field(x,'updated'),url=link(x);if(title&&url)out.push({title,description,date,link:url,source:f[0],cat:f[1],kind:'news',score:1})}return{name:f[0],type:'news',cat:f[1],status:'ok',count:out.length,error:null,items:out}}catch(e){return{name:f[0],type:'news',cat:f[1],status:'error',count:0,error:String(e.message||e),items:[]}}}
async function enrichedScan(request,env,ctx){const baseRes=await base.fetch(request,env,ctx);let baseData;try{baseData=await baseRes.clone().json()}catch{return baseRes}const extra=await Promise.all(EXTRA_FEEDS.map(feed));const all=[...(baseData.top_signals||[]),...extra.flatMap(x=>x.items||[])];const seen=new Set(),dedup=all.filter(x=>{const k=String(x.link||x.title||'').toLowerCase().replace(/\W/g,'');if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>Number(b.score||0)-Number(a.score||0));const sources=[...(baseData.sources||[]),...extra.map(({items,...s})=>s)];const summary={...(baseData.summary||{}),workingSources:sources.filter(x=>x.status==='ok').length,failedSources:sources.filter(x=>x.status!=='ok').length,total:dedup.length,news:dedup.filter(x=>x.cat!=='crypto').length,social:dedup.filter(x=>x.kind==='social').length,strong:dedup.filter(x=>Number(x.score||0)>=5).length};return Response.json({...baseData,timestamp:new Date().toISOString(),summary,sources,top_signals:dedup.slice(0,80),signals:dedup.slice(0,120)},{headers:{'Cache-Control':'no-store, max-age=0','Access-Control-Allow-Origin':'*'}})}
export default {
  fetch(request,env,ctx){const u=new URL(request.url);if(u.pathname==='/api/full-scan'||u.pathname==='/api/news')return enrichedScan(request,env,ctx);return base.fetch(request,env,ctx)},
  async scheduled(event,env,ctx){const baseUrl=new URL('https://miracolo-lab.listaconcerti.workers.dev');const run=async path=>{try{const url=new URL(path,baseUrl);url.searchParams.set('cron',String(Date.now()));return await fetch(url.toString(),{cache:'no-store',headers:{Accept:'application/json'}})}catch(e){console.error('scheduled task failed',path,e);return null}};ctx.waitUntil((async()=>{await Promise.allSettled([run('/api/full-scan'),run('/api/prices?symbols=^GSPC,^NDX,^DJI,^RUT,^FTSE,^GDAXI,^FCHI,^STOXX50E,GC=F,AGOLD.MI,SWDA.MI,XMME.MI'),run('/api/crypto')])})())}
};
