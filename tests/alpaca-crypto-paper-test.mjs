import assert from 'node:assert/strict';
import {runAlpacaCryptoPaperSmokeTest} from '../alpaca-crypto-paper-test.js';
const calls=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 const u=new URL(url),method=String(options.method||'GET').toUpperCase();calls.push({path:u.pathname+u.search,method,body:options.body?JSON.parse(options.body):null});
 if(u.pathname==='/v2/account')return Response.json({cash:'1000',trading_blocked:false});
 if(u.pathname==='/v2/assets')return Response.json([{symbol:'BTC/USD',asset_class:'crypto',tradable:true,fractionable:true,min_order_size:'0.0001'}]);
 if(u.pathname==='/v2/positions')return Response.json([]);
 if(u.pathname==='/v2/orders'&&u.searchParams.get('status')==='open')return Response.json([]);
 if(u.pathname==='/v2/orders'&&method==='POST'){
  const body=JSON.parse(options.body);return Response.json({id:body.side==='buy'?'buy-1':'sell-1',status:'new',client_order_id:body.client_order_id});
 }
 if(u.pathname==='/v2/orders/buy-1')return Response.json({id:'buy-1',status:'filled',filled_qty:'0.00013',filled_avg_price:'76923.08',notional:'10'});
 if(u.pathname==='/v2/orders/sell-1')return Response.json({id:'sell-1',status:'filled',filled_qty:'0.00013',filled_avg_price:'76920.00'});
 throw Error('Unexpected Alpaca test request '+method+' '+u.pathname+u.search);
};
try{
 const env={BOT_MODE:'PAPER',ALPACA_API_KEY:'paper-key',ALPACA_API_SECRET:'paper-secret',ML_KV:{put:async()=>{throw Error('KV quota exceeded')},delete:async()=>{throw Error('KV quota exceeded')}}};
 const r=await runAlpacaCryptoPaperSmokeTest(env);
 assert.equal(r.ok,true);assert.equal(r.mode,'PAPER');assert.equal(r.result,'ROUND_TRIP_FILLED_AND_FLAT');
 assert.equal(r.buy.filledQty,.00013);assert.equal(r.sell.filledQty,.00013);assert.equal(r.positionAfter,null);
 assert.equal(calls.filter(x=>x.path==='/v2/orders'&&x.method==='POST').length,2);
 assert.ok(calls.some(x=>x.method==='POST'&&x.body?.side==='buy'&&x.body?.notional==='10'));
 assert.ok(calls.some(x=>x.method==='POST'&&x.body?.side==='sell'&&x.body?.qty==='0.00013'));
 await assert.rejects(()=>runAlpacaCryptoPaperSmokeTest({...env,BOT_MODE:'LIVE'}),/PAPER/);
 console.log('Alpaca Crypto PAPER $10 round-trip: PASS');
 console.log('Fractional buy, exact-quantity close, flat-position check: PASS');
 console.log('Paper-only guard and KV-quota independence: PASS');
}finally{globalThis.fetch=originalFetch}
