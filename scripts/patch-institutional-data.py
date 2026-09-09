from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()

# Make market environment-aware so the structured institutional layer can use KV caching.
s=s.replace('async function market(){', 'async function market(env){', 1)
s=s.replace('await market();', 'await market(env);')
s=s.replace('Promise.all([market(),universe()])', 'Promise.all([market(env),universe()])')
s=s.replace('return json(await market())', 'return json(await market(env))')

start=s.find('async function market(env){')
end=s.find('async function universe', start)
if start<0 or end<0:
    raise SystemExit('market boundaries not found')

market=r'''const INSTITUTIONAL_KEY='institutional/latest';
const INSTITUTIONAL_TTL=900;
async function fetchJSON(url,init={}){const r=await fetch(url,{...init,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*',...(init.headers||{})}});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
async function institutionalData(env){
  const cached=await readKV(env,INSTITUTIONAL_KEY);
  if(cached?.timestamp && Date.now()-Date.parse(cached.timestamp)<INSTITUTIONAL_TTL*1000)return cached;
  const secUniverse=[['AAPL','0000320193'],['MSFT','0000789019'],['NVDA','0001045810'],['AMZN','0001018724'],['GOOGL','0001652044'],['META','0001326801'],['JPM','0000019617'],['TSLA','0001318605']];
  const secStart=(Math.floor(Date.now()/900000)*2)%secUniverse.length;
  const secTargets=[secUniverse[secStart],secUniverse[(secStart+1)%secUniverse.length]];
  const sec=await Promise.allSettled(secTargets.map(async([ticker,cik])=>{const d=await fetchJSON('https://data.sec.gov/submissions/CIK'+cik+'.json');const r=d?.filings?.recent||{};const rows=[];for(let i=0;i<(r.form||[]).length&&rows.length<8;i++){if(['8-K','10-Q','10-K','6-K','20-F'].includes(r.form[i]))rows.push({ticker,form:r.form[i],filingDate:r.filingDate?.[i]||'',accession:r.accessionNumber?.[i]||'',primaryDocument:r.primaryDocument?.[i]||'',reportDate:r.reportDate?.[i]||''})}return{ticker,cik,filings:rows}}));
  const bls=await Promise.allSettled([fetchJSON('https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0'),fetchJSON('https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000'),fetchJSON('https://api.bls.gov/publicAPI/v1/timeseries/data/CES0000000001')]);
  const ecb=await Promise.allSettled([fetchJSON('https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=jsondata&lastNObservations=1')]);
  const eurostat=await Promise.allSettled([fetchJSON('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr?geo=EA20&coicop=CP00&lastTimePeriod=1')]);
  const fredKey=env?.FRED_API_KEY;
  const fred=fredKey?await Promise.allSettled([fetchJSON('https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key='+encodeURIComponent(fredKey)+'&file_type=json&sort_order=desc&limit=1'),fetchJSON('https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key='+encodeURIComponent(fredKey)+'&file_type=json&sort_order=desc&limit=1')]):[];
  const official={directFeeds:[['Fed','https://www.federalreserve.gov/feeds/press_all.xml'],['ECB','https://www.ecb.europa.eu/rss/press.html']]};
  const parseSeries=x=>x.status==='fulfilled'?(x.value?.Results?.series?.[0]?.data?.[0]||null):null;
  const out={timestamp:new Date().toISOString(),sources:{sec:sec.map(x=>x.status==='fulfilled'),bls:bls.map(x=>x.status==='fulfilled'),ecb:ecb.map(x=>x.status==='fulfilled'),eurostat:eurostat.map(x=>x.status==='fulfilled'),fred:fred.map(x=>x.status==='fulfilled'),official},numeric:{sec:sec.filter(x=>x.status==='fulfilled').map(x=>x.value),bls:{cpi:parseSeries(bls[0]),unemployment:parseSeries(bls[1]),payrolls:parseSeries(bls[2])},ecbFx:ecb[0]?.status==='fulfilled'?ecb[0].value:null,eurostatHicp:eurostat[0]?.status==='fulfilled'?eurostat[0].value:null,fred:fred.map(x=>x.status==='fulfilled'?x.value:null).filter(Boolean)}};
  await writeKV(env,INSTITUTIONAL_KEY,out,INSTITUTIONAL_TTL);
  return out;
}
async function market(env){const indices=await Promise.all(Object.entries(MARKET).map(async([name,ticker])=>{try{const q=await quote(ticker),changePct=q.previous?((q.price-q.previous)/q.previous)*100:0;const item={name,...q,rsi:rsi(q.closes),changePct,ok:true};item.evaluation=evaluate(item);return item}catch(e){return{name,ticker,ok:false,error:String(e.message||e)}}}));let crypto=[];try{const r=await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur&include_24hr_change=true');if(r.ok){const d=await r.json();crypto=[['BTC','bitcoin'],['ETH','ethereum']].map(([symbol,id])=>({symbol,price:Number(d[id]?.eur||0),change24h:Number(d[id]?.eur_24h_change||0),ok:Number(d[id]?.eur||0)>0}))}}catch{}let institutional=null;try{institutional=await institutionalData(env)}catch(e){institutional={timestamp:new Date().toISOString(),error:String(e.message||e)}}return{timestamp:new Date().toISOString(),indices,crypto,institutionalData:institutional}}
'''
s=s[:start]+market+s[end:]
p.write_text(s)
print('Added KV-cached institutionalData adapter and preserved market() return compatibility')
