import assert from 'node:assert/strict';
import { getCryptoDecision } from '../bot-crypto-engine.js';
import { executePaperDecision } from '../bot-paper-executor.js';

const originalFetch=global.fetch;
try{
  global.fetch=async(url,options={})=>{
    const u=String(url);
    assert.match(u,/data\.alpaca\.markets\/v1beta3\/crypto\/us\//,'crypto data must use Alpaca crypto API');
    assert.equal(options.headers['APCA-API-KEY-ID'],'test-key');
    if(u.includes('/latest/orderbooks'))return new Response(JSON.stringify({orderbooks:{'BTC/USD':{b:[{p:100,s:10},{p:99,s:10}],a:[{p:101,s:2},{p:102,s:2}],t:'2026-10-26T12:00:00Z'}}}),{status:200});
    if(u.includes('/snapshots'))return new Response(JSON.stringify({snapshots:{'BTC/USD':{latestTrade:{p:100},latestQuote:{bp:99,bs:10,ap:101,as:2}}}}),{status:200});
    if(u.includes('/bars'))return new Response(JSON.stringify({bars:{'BTC/USD':Array.from({length:30},(_,i)=>({t:`2026-10-26T11:${String(i).padStart(2,'0')}:00Z`,c:100+i*.1}))}}),{status:200});
    throw new Error('unexpected URL');
  };
  const signal=await getCryptoDecision({ALPACA_API_KEY:'test-key',ALPACA_API_SECRET:'test-secret'});
  assert.equal(signal.ok,true);
  assert.equal(signal.symbol,'BTC/USD');
  assert.equal(signal.marketOpen24x7,true);
  assert.ok(signal.orderBook.imbalance>0);
  assert.ok(signal.direction>=0);

  const env={BOT_MODE:'PAPER',PAPER_AUTO_EXECUTION:'true',ALPACA_BASE_URL:'https://paper-api.alpaca.markets/v2',ALPACA_API_KEY:'test-key',ALPACA_API_SECRET:'test-secret'};
  global.fetch=async(url,options={})=>{
    const u=String(url);
    assert.match(u,/paper-api\.alpaca\.markets\/v2/,'paper execution must use Alpaca Paper endpoint');
    assert.equal(options.headers['APCA-API-KEY-ID'],'test-key');
    if(u.endsWith('/orders'))return new Response(JSON.stringify({id:'paper-test-order',status:'accepted',symbol:'BTC/USD'}),{status:200});
    throw new Error('unexpected paper URL');
  };
  const execution=await executePaperDecision(env,{action:'BUY',symbol:'BTC/USD',notional:100,clientOrderId:'crypto-paper-test-1'});
  assert.equal(execution.executed,true);
  assert.equal(execution.mode,'PAPER');
  assert.equal(execution.symbol,'BTC/USD');
  assert.equal(execution.timeInForce,'gtc');

  global.fetch=async(url,options={})=>{
    const u=String(url),method=String(options.method||'GET').toUpperCase();
    assert.match(u,/paper-api\.alpaca\.markets\/v2/,'exit must use Alpaca Paper endpoint');
    if(u.endsWith('/positions')&&method==='GET')return new Response(JSON.stringify([{symbol:'BTCUSD',qty:'0.0036'}]),{status:200});
    if(u.includes('/orders?status=open')&&method==='GET')return new Response(JSON.stringify([{id:'old-protection',symbol:'BTC/USD',side:'sell',status:'new'}]),{status:200});
    if(u.endsWith('/orders/old-protection')&&method==='DELETE')return new Response('',{status:204});
    if(u.endsWith('/orders')&&method==='POST'){
      const body=JSON.parse(options.body);
      assert.equal(body.side,'sell');assert.equal(body.qty,0.0036);assert.equal(body.notional,undefined);
      return new Response(JSON.stringify({id:'paper-exit-order',status:'accepted',symbol:'BTC/USD'}),{status:200});
    }
    throw new Error('unexpected exit URL '+method+' '+u);
  };
  const exit=await executePaperDecision(env,{action:'SELL',symbol:'BTC/USD',notional:100,clientOrderId:'crypto-paper-exit-test'});
  assert.equal(exit.executed,true);assert.equal(exit.qty,0.0036);assert.equal(exit.cancelledOrders,1);
  console.log('BTC position-aware exit contract: PASS');
  console.log('BTC crypto decision contract: PASS');
  console.log('BTC paper execution contract: PASS');
} finally { global.fetch=originalFetch; }
