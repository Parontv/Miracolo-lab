import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeOrderFlow, refreshBinanceOrderFlow } from '../bot-order-flow.js';
const now=Date.parse('2026-11-08T16:00:00Z');
function trades({count=40,last=now,buy=true}={}){return Array.from({length:count},(_,i)=>({a:i,p:String(100+i*.001),q:'2',T:last-count*1000+i*1000,m:buy?i%4===0:false}))}
function book(){return{bids:[['100.01','10'],['100','8'],['99.99','7']],asks:[['100.02','5'],['100.03','6'],['100.04','7']]}}
test('calculates aggressor delta and order-book imbalance from real Binance fields',()=>{
 const row=analyzeOrderFlow('BTCUSDT',trades(),book(),now);
 assert.equal(row.status,'ok');
 assert.equal(row.tradeCount,40);
 assert.ok(row.deltaRatio>0);
 assert.ok(row.obi>0);
 assert.ok(row.score>0);
 assert.ok(row.spreadBps>0);
 assert.ok(Date.parse(row.freshUntil)>now);
});
test('rejects stale trades and insufficient samples',()=>{
 assert.equal(analyzeOrderFlow('BTCUSDT',trades({last:now-120000}),book(),now).status,'stale');
 assert.equal(analyzeOrderFlow('BTCUSDT',trades({count:5}),book(),now).status,'unavailable');
});
test('rejects crossed or incomplete order books',()=>{
 assert.equal(analyzeOrderFlow('BTCUSDT',trades(),{bids:[['100.02','2']],asks:[['100.01','2']]},now).status,'unavailable');
 assert.equal(analyzeOrderFlow('BTCUSDT',trades(),{bids:[],asks:[]},now).status,'unavailable');
});
test('refreshes BTC and ETH with four read-only public REST requests',async()=>{
 let calls=0;
 const fetcher=async url=>{calls++;return{ok:true,status:200,async json(){return String(url).includes('aggTrades')?trades():book()}}};
 const result=await refreshBinanceOrderFlow({fetcher,now});
 assert.equal(calls,4);
 assert.equal(result.fetches,4);
 assert.equal(result.status,'ok');
 assert.equal(result.readOnly,true);
 assert.equal(result.executionEnabled,false);
 assert.equal(result.instrumentCount,2);
});
test('partial provider failures never claim full coverage',async()=>{
 const fetcher=async url=>({ok:!String(url).includes('ETHUSDT'),status:503,async json(){return String(url).includes('aggTrades')?trades():book()}});
 const result=await refreshBinanceOrderFlow({fetcher,now});
 assert.equal(result.status,'partial');
 assert.equal(result.freshness,'incomplete');
 assert.equal(result.instrumentCount,1);
});
console.log('PASS Binance order-flow data validation and safety contracts');

test('falls back to official Binance public spot market-data API on Futures geo-block',async()=>{
 let calls=0;
 const fetcher=async url=>{calls++;const u=String(url);if(u.includes('fapi.binance.com'))return{ok:false,status:403,async json(){return{}}};return{ok:true,status:200,async json(){return u.includes('aggTrades')?trades():book()}}};
 const result=await refreshBinanceOrderFlow({fetcher,now});
 assert.equal(calls,8);
 assert.equal(result.fetches,8);
 assert.equal(result.status,'ok');
 assert.equal(result.provider,'Binance Spot (public data API)');
 assert.ok(result.instruments.every(x=>x.marketType==='spot'));
});

test('falls back to Bybit Linear public REST when Binance hosts are blocked',async()=>{
 let calls=0;
 const fetcher=async url=>{
  calls++;const u=String(url);
  if(u.includes('fapi.binance.com')||u.includes('data-api.binance.vision'))return{ok:false,status:403,async json(){return{}}};
  if(u.includes('/v5/market/recent-trade'))return{ok:true,status:200,async json(){return{retCode:0,retMsg:'OK',result:{list:trades().map(t=>({price:t.p,size:t.q,time:String(t.T),side:t.m?'Sell':'Buy',isRPITrade:false}))}}}};
  return{ok:true,status:200,async json(){return{retCode:0,retMsg:'OK',result:{b:book().bids,a:book().asks,ts:now}}}};
 };
 const result=await refreshBinanceOrderFlow({fetcher,now});
 assert.equal(calls,12);
 assert.equal(result.fetches,12);
 assert.equal(result.status,'ok');
 assert.equal(result.provider,'Bybit Linear public REST');
 assert.ok(result.instruments.every(x=>x.venue==='Bybit Linear public REST'));
 assert.ok(result.instruments.every(x=>x.marketType==='perpetual'));
});
