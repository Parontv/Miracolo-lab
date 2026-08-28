/* Miracolo Lab Worker V16.1 — Massive Source Engine + Market Monitor */
const BUILD='ML-20260829-V16.1-MASSIVE-SOURCES';
const BUILD_TIME=new Date().toISOString();
const UA_BROWSER='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const ASSETS={GOLD:{symbol:'GOLD',isin:'FR0013416716',name:'Amundi Physical Gold ETC',market:'Milan',yahoo:['GOLD.MI','AGOLD.MI']},SWDA:{symbol:'SWDA',isin:'IE00B4L5Y983',name:'iShares Core MSCI World UCITS ETF',market:'Milan',yahoo:['SWDA.MI']},XMME:{symbol:'XMME',isin:'IE00BTJRMP35',name:'Xtrackers MSCI Emerging Markets UCITS ETF',market:'Milan',yahoo:['XMME.MI']}};
const FEEDS=[
{name:'CNBC Finance',type:'news',cat:'markets',url:'https://www.cnbc.com/id/100003114/device/rss/rss.html'},
{name:'CNBC Top News',type:'news',cat:'markets',url:'https://www.cnbc.com/id/100003114/device/rss/rss_2.0.xml'},
{name:'MarketWatch Top Stories',type:'news',cat:'markets',url:'https://feeds.marketwatch.com/marketwatch/topstories/'},
{name:'MarketWatch Markets',type:'news',cat:'markets',url:'https://feeds.marketwatch.com/marketwatch/marketpulse/'},
{name:'Investing Markets',type:'news',cat:'markets',url:'https://www.investing.com/rss/news_25.rss'},
{name:'Investing Economy',type:'news',cat:'macro',url:'https://www.investing.com/rss/news_14.rss'},
{name:'Seeking Alpha Market News',type:'news',cat:'markets',url:'https://seekingalpha.com/market_currents.xml'},
{name:'Seeking Alpha Earnings',type:'news',cat:'earnings',url:'https://seekingalpha.com/feed.xml'},
{name:'Nasdaq Market News',type:'news',cat:'markets',url:'https://www.nasdaq.com/feed/rssoutbound?category=Markets'},
{name:'Nasdaq Stocks',type:'news',cat:'stocks',url:'https://www.nasdaq.com/feed/rssoutbound?category=Stocks'},
{name:'Nasdaq ETF',type:'news',cat:'etf',url:'https://www.nasdaq.com/feed/rssoutbound?category=ETFs'},
{name:'Nasdaq Commodities',type:'news',cat:'commodities',url:'https://www.nasdaq.com/feed/rssoutbound?category=Commodities'},
{name:'Investopedia Markets',type:'news',cat:'markets',url:'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_articles'},
{name:'Forbes Business',type:'news',cat:'business',url:'https://www.forbes.com/business/feed/'},
{name:'Forbes Markets',type:'news',cat:'markets',url:'https://www.forbes.com/markets/feed/'},
{name:'Forbes Innovation',type:'news',cat:'technology',url:'https://www.forbes.com/innovation/feed/'},
{name:'Fortune Finance',type:'news',cat:'markets',url:'https://fortune.com/feed/fortune-feeds/finance/'},
{name:'Business Insider Markets',type:'news',cat:'markets',url:'https://www.businessinsider.com/rss'},
{name:'The Economist Finance',type:'news',cat:'markets',url:'https://www.economist.com/finance-and-economics/rss.xml'},
{name:'Financial Times Markets',type:'news',cat:'markets',url:'https://www.ft.com/markets?format=rss'},
{name:'Financial Times Companies',type:'news',cat:'stocks',url:'https://www.ft.com/companies?format=rss'},
{name:'Reuters World via GDELT',type:'news',cat:'world',url:'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcecountry:US%20OR%20sourcecountry:GB&mode=artlist&format=rss&maxrecords=100&sort=datedesc'},
{name:'GDELT Markets',type:'news',cat:'markets',url:'https://api.gdeltproject.org/api/v2/doc/doc?query=stock%20market%20OR%20S%26P%20500%20OR%20Nasdaq%20OR%20Dow&mode=artlist&format=rss&maxrecords=100&sort=datedesc'},
{name:'GDELT Macro',type:'news',cat:'macro',url:'https://api.gdeltproject.org/api/v2/doc/doc?query=inflation%20OR%20interest%20rates%20OR%20Federal%20Reserve%20OR%20ECB%20OR%20GDP&mode=artlist&format=rss&maxrecords=100&sort=datedesc'},
{name:'GDELT Crypto',type:'news',cat:'crypto',url:'https://api.gdeltproject.org/api/v2/doc/doc?query=Bitcoin%20OR%20Ethereum%20OR%20crypto&mode=artlist&format=rss&maxrecords=100&sort=datedesc'},
{name:'Google Finance',type:'news',cat:'markets',url:'https://news.google.com/rss/search?q=stock+market+OR+S%26P+500+OR+Nasdaq+OR+Dow+OR+earnings&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Macro',type:'news',cat:'macro',url:'https://news.google.com/rss/search?q=inflation+OR+CPI+OR+PCE+OR+GDP+OR+jobs+OR+payrolls&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Fed',type:'news',cat:'macro',url:'https://news.google.com/rss/search?q=Federal+Reserve+OR+Fed+OR+Powell+OR+FOMC&hl=en-US&gl=US&ceid=US:en'},
{name:'Google ECB',type:'news',cat:'macro',url:'https://news.google.com/rss/search?q=ECB+OR+European+Central+Bank+OR+Lagarde&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Treasury',type:'news',cat:'rates',url:'https://news.google.com/rss/search?q=US+Treasury+OR+10-year+yield+OR+2-year+yield+OR+bond+market&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Dollar',type:'news',cat:'fx',url:'https://news.google.com/rss/search?q=DXY+OR+dollar+OR+EURUSD+OR+USDJPY&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Gold',type:'news',cat:'commodities',url:'https://news.google.com/rss/search?q=gold+OR+silver+OR+precious+metals&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Oil',type:'news',cat:'commodities',url:'https://news.google.com/rss/search?q=oil+OR+Brent+OR+WTI+OR+OPEC&hl=en-US&gl=US&ceid=US:en'},
{name:'Google AI',type:'news',cat:'technology',url:'https://news.google.com/rss/search?q=AI+OR+artificial+intelligence+OR+Nvidia+OR+semiconductor&hl=en-US&gl=US&ceid=US:en'},
{name:'Google ETF',type:'news',cat:'etf',url:'https://news.google.com/rss/search?q=ETF+OR+MSCI+World+OR+emerging+markets+ETF&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Emerging Markets',type:'news',cat:'emerging',url:'https://news.google.com/rss/search?q=emerging+markets+OR+MSCI+Emerging+Markets+OR+EM+stocks&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Italy Finance',type:'news',cat:'italy',url:'https://news.google.com/rss/search?q=borsa+italiana+OR+FTSE+MIB+OR+Milano+Finanza+OR+Sole+24+Ore&hl=it&gl=IT&ceid=IT:it'},
{name:'Google Europe Finance',type:'news',cat:'europe',url:'https://news.google.com/rss/search?q=European+stocks+OR+Euro+Stoxx+50+OR+DAX&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Japan Finance',type:'news',cat:'asia',url:'https://news.google.com/rss/search?q=Japan+stocks+OR+Nikkei+OR+BOJ&hl=en-US&gl=US&ceid=US:en'},
{name:'Google China Finance',type:'news',cat:'asia',url:'https://news.google.com/rss/search?q=China+stocks+OR+CSI+300+OR+China+economy+OR+PBOC&hl=en-US&gl=US&ceid=US:en'},
{name:'CoinDesk Crypto',type:'news',cat:'crypto',url:'https://www.coindesk.com/arc/outboundfeeds/rss/'},
{name:'Cointelegraph',type:'news',cat:'crypto',url:'https://cointelegraph.com/rss'},
{name:'Decrypt',type:'news',cat:'crypto',url:'https://decrypt.co/feed'},
{name:'Blockworks',type:'news',cat:'crypto',url:'https://blockworks.co/feed'},
{name:'CryptoSlate',type:'news',cat:'crypto',url:'https://cryptoslate.com/feed/'},
{name:'Bitcoin Magazine',type:'news',cat:'crypto',url:'https://bitcoinmagazine.com/.rss/full/'},
{name:'Google Bitcoin',type:'news',cat:'crypto',url:'https://news.google.com/rss/search?q=Bitcoin+OR+BTC+OR+Bitcoin+ETF&hl=en-US&gl=US&ceid=US:en'},
{name:'Google Ethereum',type:'news',cat:'crypto',url:'https://news.google.com/rss/search?q=Ethereum+OR+ETH+OR+Ethereum+ETF&hl=en-US&gl=US&ceid=US:en'},
{name:'Reddit Investing',type:'social',cat:'social',url:'https://www.reddit.com/r/investing/.rss'},
{name:'Reddit Stocks',type:'social',cat:'social',url:'https://www.reddit.com/r/stocks/.rss'},
{name:'Reddit WallStreetBets',type:'social',cat:'social',url:'https://www.reddit.com/r/wallstreetbets/.rss'},
{name:'Reddit Options',type:'social',cat:'social',url:'https://www.reddit.com/r/options/.rss'},
{name:'Reddit ValueInvesting',type:'social',cat:'social',url:'https://www.reddit.com/r/ValueInvesting/.rss'},
{name:'Reddit CryptoCurrency',type:'social',cat:'social',url:'https://www.reddit.com/r/CryptoCurrency/.rss'},
{name:'Reddit Bitcoin',type:'social',cat:'social',url:'https://www.reddit.com/r/Bitcoin/.rss'},
{name:'Reddit Ethereum',type:'social',cat:'social',url:'https://www.reddit.com/r/ethereum/.rss'},
{name:'Reddit Nvidia',type:'social',cat:'social',url:'https://www.reddit.com/r/Nvidia/.rss'},
{name:'Reddit Technology',type:'social',cat:'social',url:'https://www.reddit.com/r/technology/.rss'},
{name:'ECB Press Releases',type:'primary',cat:'macro',url:'https://www.ecb.europa.eu/rss/press.html'},
{name:'ECB Statistical Releases',type:'primary',cat:'macro',url:'https://www.ecb.europa.eu/rss/statpress.html'},
{name:'ECB Monetary Policy',type:'primary',cat:'macro',url:'https://www.ecb.europa.eu/rss/press.html'},
{name:'Federal Reserve Press',type:'primary',cat:'macro',url:'https://www.federalreserve.gov/feeds/press_all.xml'},
{name:'Federal Reserve Speeches',type:'primary',cat:'macro',url:'https://www.federalreserve.gov/feeds/speeches.xml'},
{name:'Federal Reserve Monetary Policy',type:'primary',cat:'macro',url:'https://www.federalreserve.gov/feeds/press_monetary.xml'},
{name:'SEC Company Filings',type:'primary',cat:'filings',url:'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&output=atom'},
{name:'SEC Litigation',type:'primary',cat:'regulation',url:'https://www.sec.gov/news/pressreleases.rss'},
{name:'BLS News Releases',type:'primary',cat:'macro',url:'https://www.bls.gov/feed/bls_latest.rss'},
{name:'BEA News',type:'primary',cat:'macro',url:'https://www.bea.gov/rss/news.xml'},
{name:'EIA Today in Energy',type:'primary',cat:'energy',url:'https://www.eia.gov/rss/todayinenergy.xml'},
{name:'OPEC News',type:'primary',cat:'energy',url:'https://www.opec.org/opec_web/en/press_room/28.htm'},
{name:'Eurostat News',type:'primary',cat:'macro',url:'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'}
];
const MARKET={S_P500:'^GSPC',NASDAQ100:'^NDX',DOW:'^DJI',VIX:'^VIX',RUSSELL2000:'^RUT',NIKKEI:'^N225',DAX:'^GDAXI',EUROSTOXX50:'^STOXX50E',DXY:'DX-Y.NYB',GOLD_FUTURES:'GC=F',BRENT:'BZ=F',WTI:'CL=F',COPPER:'HG=F'};
function strip(s=''){return String(s).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/g,"'").replace(/\s+/g,' ').trim()}
function field(x,n){const m=x.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+n+'>','i'));return m?strip(m[1]):''}
function linkField(x){let m=x.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);if(m)return m[1];m=x.match(/<link[^>]*>([\s\S]*?)<\/link>/i);return m?strip(m[1]):''}
async function fetchTimeout(url,options={},ms=9000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...options,signal:c.signal,redirect:'follow'})}finally{clearTimeout(timer)}}
function scoreItem(i){const t=(i.title+' '+i.description).toLowerCase();let s=1;if(/crash|collapse|recession|war|default|panic|surge|plunge|rate cut|rate hike|inflation|tariff|bank failure|liquidat/.test(t))s+=2;if(/bitcoin|ethereum|crypto|nasdaq|s&p|sp500|fed|ecb|oil|gold/.test(t))s+=1;if(/breaking|urgent|record|all-time high|all-time low/.test(t))s+=1;return Math.min(6,s)}
function parseXML(text,feed){const out=[],re=/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi;let m;while((m=re.exec(text))){const x=m[0],title=field(x,'title'),description=field(x,'description')||field(x,'summary')||field(x,'content'),date=field(x,'pubDate')||field(x,'published')||field(x,'updated'),link=linkField(x);if(title&&link)out.push({title,description,date,link,source:feed.name,cat:feed.cat,kind:feed.type,score:scoreItem({title,description})})}return out}
function dedupe(items){const seen=new Set();return items.filter(i=>{const k=(i.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,180);if(!k||seen.has(k))return false;seen.add(k);return true})}
async function fullScan(){const results=await Promise.all(FEEDS.map(async f=>{try{const r=await fetchTimeout(f.url,{headers:{'User-Agent':UA_BROWSER,Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8'}},9000);if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();const items=parseXML(text,f);return{name:f.name,cat:f.cat,type:f.type,status:'ok',count:items.length,error:null,items}}catch(e){return{name:f.name,cat:f.cat,type:f.type,status:'error',count:0,error:String(e.message||e),items:[]}}}));const raw=results.flatMap(x=>x.items||[]),all=dedupe(raw).sort((a,b)=>Number(b.score||0)-Number(a.score||0));return{ok:true,timestamp:new Date().toISOString(),summary:{configuredSources:FEEDS.length,workingSources:results.filter(x=>x.status==='ok'&&x.count>0).length,reachableSources:results.filter(x=>x.status==='ok').length,failedSources:results.filter(x=>x.status!=='ok').length,total:all.length,rawItems:raw.length,news:all.filter(x=>x.kind==='news').length,social:all.filter(x=>x.kind==='social').length,primary:all.filter(x=>x.kind==='primary').length,strong:all.filter(x=>Number(x.score||0)>=5).length},sources:results.map(({items,...s})=>s),top_signals:all.slice(0,80),signals:all.slice(0,120),blackSwan:{score:0,level:'LOW',triggers:[],active:false}}}
async function yahoo(sym){const r=await fetchTimeout('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=1d&interval=1m&includePrePost=false',{headers:{'User-Agent':UA_BROWSER,Accept:'application/json'}},7000);if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json(),m=d.chart?.result?.[0]?.meta;if(!m)throw Error('No market data');const price=Number(m.regularMarketPrice??m.chartPreviousClose??0);if(!Number.isFinite(price)||price<=0)throw Error('Invalid/zero market price');const prev=Number(m.previousClose??m.chartPreviousClose??price);return{price,prevClose:prev,change:price-prev,changePct:prev?((price-prev)/prev)*100:0,currency:m.currency||'',exchange:m.exchangeName||''}}
async function coinGeckoCrypto(){const r=await fetchTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur&include_24hr_change=true',{headers:{Accept:'application/json'}},9000);if(!r.ok)throw Error('CoinGecko HTTP '+r.status);const d=await r.json();return[['bitcoin','BTC','Bitcoin'],['ethereum','ETH','Ethereum']].map(([id,symbol,name])=>({id,symbol,name,price:Number(d[id]?.eur||0),change24h:Number(d[id]?.eur_24h_change||0)}))}
async function coinbaseOne(symbol,name){const product=symbol==='BTC'?'BTC-EUR':'ETH-EUR';const r=await fetchTimeout('https://api.exchange.coinbase.com/products/'+product+'/ticker',{headers:{Accept:'application/json'}},9000);if(!r.ok)throw Error('Coinbase '+product+' HTTP '+r.status);const d=await r.json(),price=Number(d?.price||0);if(!Number.isFinite(price)||price<=0)throw Error('Coinbase '+product+' invalid price');return{id:product,symbol,name,price,change24h:null}}
async function getCrypto(){let coins=[];try{coins=await coinGeckoCrypto()}catch{}const out=[];for(const [symbol,name] of [['BTC','Bitcoin'],['ETH','Ethereum']]){let c=coins.find(x=>x.symbol===symbol&&x.price>0);if(c)out.push({...c,verified:true,source:'CoinGecko EUR spot'});else try{c=await coinbaseOne(symbol,name);out.push({...c,verified:true,source:'Coinbase EUR spot'})}catch(e){out.push({symbol,name,price:null,verified:false,error:String(e.message||e)})}}return{ok:out.every(x=>x.verified&&x.price>0),timestamp:new Date().toISOString(),coins:out}}
async function marketMonitor(){const rows=await Promise.all(Object.entries(MARKET).map(async([name,ticker])=>{try{const q=await yahoo(ticker);return{name,ticker,...q,verified:true}}catch(e){return{name,ticker,price:null,verified:false,error:String(e.message||e)}}}));let btc=null;try{btc=(await getCrypto()).coins}catch{}return{ok:rows.some(x=>x.verified)||!!btc,timestamp:new Date().toISOString(),indices:rows,crypto:btc||[],regime:deriveRegime(rows,btc||[])}}
function deriveRegime(rows,crypto){const g=n=>rows.find(x=>x.name===n)?.changePct;const v=g('VIX'),sp=g('S_P500'),nd=g('NASDAQ100'),gold=g('GOLD_FUTURES'),score=(sp>0?1:-1)+(nd>0?1:-1)+(v<0?1:-1)+(gold<0?1:0);return{score,label:score>=2?'RISK-ON':score<=-2?'RISK-OFF':'NEUTRALE',drivers:{sp500:sp??null,nasdaq100:nd??null,vix:v??null,gold:gold??null}}}
async function getPrices(symbolsStr){const requested=[...new Set((symbolsStr||'').split(',').map(s=>s.trim()).filter(Boolean))].slice(0,50),results=[];for(const original of requested){const key=String(original).toUpperCase(),meta=ASSETS[key];let q=null,lastError='';if(meta)for(const source of meta.yahoo){try{q=await yahoo(source);if(key==='XMME'&&(q.currency!=='EUR'||q.price<60||q.price>100))throw Error('XMME sanity check failed: '+q.price);if(key==='GOLD'&&(q.currency!=='EUR'||q.price<100||q.price>250))throw Error('GOLD sanity check failed: '+q.price);if(key==='SWDA'&&(q.currency!=='EUR'||q.price<80||q.price>180))throw Error('SWDA sanity check failed: '+q.price);break}catch(e){lastError=String(e.message||e);q=null}}else{try{q=await yahoo(original)}catch(e){lastError=String(e.message||e)}}results.push(q&&q.price>0?{symbol:meta?.symbol||original,isin:meta?.isin,name:meta?.name||original,price:q.price,prevClose:q.prevClose,change:q.change,changePct:q.changePct,currency:q.currency,exchange:q.exchange,verified:true,sourceTicker:meta?.yahoo?.[0]||original}:{symbol:meta?.symbol||original,isin:meta?.isin,name:meta?.name||original,price:null,verified:false,error:lastError||'No valid non-zero market price'})}return{ok:true,timestamp:new Date().toISOString(),prices:results}}
function json(data){return Response.json(data,{headers:{'Cache-Control':'no-store, max-age=0','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}})}
export default{async fetch(request,env){const u=new URL(request.url),p=u.pathname;if(request.method==='OPTIONS')return new Response(null,{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,OPTIONS'}});if(p==='/version')return json({ok:true,live:true,build:BUILD,buildTime:BUILD_TIME,sourceEngine:{configured:FEEDS.length,categories:[...new Set(FEEDS.map(x=>x.cat))],types:[...new Set(FEEDS.map(x=>x.type))]},assets:ASSETS,market:MARKET,check:'NONZERO-GUARD'});if(p==='/api/health')return json({ok:true,service:'Miracolo Lab',build:BUILD,timestamp:new Date().toISOString(),sources:FEEDS.length});if(p==='/api/full-scan'||p==='/api/news')return json(await fullScan());if(p==='/api/crypto')return json(await getCrypto());if(p==='/api/market-monitor')return json(await marketMonitor());if(p==='/api/prices')return json(await getPrices(u.searchParams.get('symbols')||''));if(p==='/api/market')return json(await getPrices(u.searchParams.get('symbols')||'^GSPC,^NDX,^DJI,^VIX,GC=F,GOLD,SWDA,XMME'));if(env?.ASSETS)return env.ASSETS.fetch(new Request(request));return new Response('Not found',{status:404})}};