from pathlib import Path

p=Path('worker.js')
s=p.read_text()
marker="const SOCIAL_KEY='social/latest';"
if marker not in s:
    raise SystemExit('social adapter marker not found')
helper=r'''const ONCHAIN_KEY='crypto/onchain/latest';
const ONCHAIN_TTL=900;
async function onchainData(env){
  const cached=await readKV(env,ONCHAIN_KEY);
  if(cached?.timestamp && Date.now()-Date.parse(cached.timestamp)<ONCHAIN_TTL*1000)return cached;
  const assets=['BTC','ETH'];
  const glassKey=env?.GLASSNODE_API_KEY;
  const glassnode=glassKey?await Promise.allSettled(assets.flatMap(a=>[
    fetchJSON('https://api.glassnode.com/v1/metrics/transactions/transfers_volume_exchanges_net?a='+a+'&i=24h&f=json',{headers:{'X-Api-Key':glassKey}}),
    fetchJSON('https://api.glassnode.com/v1/metrics/derivatives/futures_funding_rate_perpetual?a='+a+'&i=1h&f=json',{headers:{'X-Api-Key':glassKey}})
  ])):[];
  const funding=await Promise.allSettled(assets.map(async a=>{const r=await fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol='+a+'USDT&limit=1',{headers:{'User-Agent':UA,Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();return{asset:a,exchange:'Binance',fundingRate:Number(d?.[0]?.fundingRate||0),timestamp:d?.[0]?.fundingTime||null}}));
  const out={timestamp:new Date().toISOString(),assets,provider:glassKey?'Glassnode + Binance':'Binance funding fallback',glassnode:glassnode.map((x,i)=>x.status==='fulfilled'?x.value:{ok:false,error:String(x.reason?.message||x.reason||'unavailable'),asset:assets[Math.floor(i/2)],metric:i%2?'funding':'exchangeNetflow'}),funding:funding.map((x,i)=>x.status==='fulfilled'?{...x.value,ok:true}:{asset:assets[i],ok:false,error:String(x.reason?.message||x.reason||'unavailable')})};
  await writeKV(env,ONCHAIN_KEY,out,ONCHAIN_TTL);
  return out;
}
'''
s=s.replace(marker,helper+marker,1)
old="let institutional=null;try{institutional=await institutionalData(env)}catch(e){institutional={timestamp:new Date().toISOString(),error:String(e.message||e)}}let social=null;try{social=await socialData(env)}catch(e){social={timestamp:new Date().toISOString(),error:String(e.message||e)}}return{timestamp:new Date().toISOString(),indices,crypto,institutionalData:institutional,socialData:social}"
new="let institutional=null;try{institutional=await institutionalData(env)}catch(e){institutional={timestamp:new Date().toISOString(),error:String(e.message||e)}}let social=null;try{social=await socialData(env)}catch(e){social={timestamp:new Date().toISOString(),error:String(e.message||e)}}let onchain=null;try{onchain=await onchainData(env)}catch(e){onchain={timestamp:new Date().toISOString(),error:String(e.message||e)}}return{timestamp:new Date().toISOString(),indices,crypto,institutionalData:institutional,socialData:social,onchainData:onchain}"
if old not in s:
    raise SystemExit('market return signature not found')
s=s.replace(old,new,1)
p.write_text(s)
print('Added KV-cached BTC/ETH onchain and funding context')
