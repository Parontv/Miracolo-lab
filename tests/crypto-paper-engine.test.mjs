import assert from 'node:assert/strict';
import {cryptoSignal,runCryptoPaperCycle,getCryptoPaperStatus} from '../bot-crypto-paper.js';
const candles=Array.from({length:60},(_,i)=>[Date.now()-((59-i)*60_000),0,0,0,100+i*.2,i===59?300:100]);
const sig=cryptoSignal(candles);assert.equal(sig.action,'BUY');assert.ok(sig.volumeRatio>1);
const kv=new Map();const env={ML_KV:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v)}};
const contextProvider=async()=>({ok:true,source:'test-context',modules:{flow:{dataAvailable:true,direction:1,strength:.8,coverage:1,marketType:'perpetual',freshness:'fresh',asOf:new Date().toISOString()},macro:{dataAvailable:true,direction:1,strength:.7,coverage:1,freshness:'fresh',asOf:new Date().toISOString()},news:{dataAvailable:true,direction:1,strength:.7,coverage:1,asOf:new Date().toISOString()},crypto:{dataAvailable:true,symbol:'BTC/USD',direction:1,strength:.7,coverage:1,asOf:new Date().toISOString()}}});
const result=await runCryptoPaperCycle(env,{fetcher:async url=>{assert.match(url,/interval=1m/);return candles},contextProvider});
assert.equal(result.mode,'PAPER');assert.equal(result.state.cycles,1);assert.ok(result.state.positions.length>0);assert.ok(result.state.cash<1000);assert.equal(result.state.orders[0].mode,'PAPER');assert.ok(result.state.lastCycle.signals.every(x=>x.independentVotes>=3&&x.action==='BUY'));assert.equal(result.state.lastCycle.contextAvailable,true);assert.ok(result.state.lastCycle.signals.every(x=>x.votes.some(v=>v.family==='order_flow')&&x.votes.some(v=>v.family==='macro')));
const status=await getCryptoPaperStatus(env);assert.equal(status.ok,true);assert.equal(status.state.cycles,1);
const fallbackKv=new Map();const fallbackEnv={ML_KV:{get:async k=>fallbackKv.get(k)||null,put:async(k,v)=>fallbackKv.set(k,v)}};
const coinbaseRows=Array.from({length:60},(_,i)=>[Math.floor((Date.now()/1000)-((59-i)*60)),100+i*.2,101+i*.2,99+i*.2,100+i*.2,i===59?300:100]);
const fallback=await runCryptoPaperCycle(fallbackEnv,{fetcher:async url=>{if(url.includes('data-api.binance.vision'))throw Error('Market data HTTP 403');if(url.includes('api.exchange.coinbase.com'))return coinbaseRows;throw Error('unexpected fallback provider '+url)},contextProvider});
assert.equal(fallback.ok,true);assert.equal(fallback.state.lastCycle.available,5);assert.ok(fallback.state.lastCycle.signals.every(x=>x.provider==='COINBASE'&&x.ok));assert.ok(fallback.state.cycles===1);

const noContextKv=new Map();const noContextEnv={ML_KV:{get:async k=>noContextKv.get(k)||null,put:async(k,v)=>noContextKv.set(k,v)}};const noContext=await runCryptoPaperCycle(noContextEnv,{fetcher:async()=>candles,contextProvider:async()=>({ok:false,reason:'context missing'})});assert.ok(noContext.state.lastCycle.signals.every(x=>x.action==='WAIT'));assert.equal(noContext.state.lastCycle.contextAvailable,false);
await assert.rejects(()=>runCryptoPaperCycle({},{fetcher:async()=>candles,contextProvider}),/KV ML_KV non configurato/);
console.log('Crypto signal engine: PASS');console.log('Independent PAPER ledger: PASS');console.log('KV persistence and status: PASS');console.log('No exchange order endpoint used: PASS');
