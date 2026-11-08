import assert from 'node:assert/strict';
import { getCryptoDecision } from '../bot-crypto-engine.js';
import { executePaperDecision } from '../bot-paper-executor.js';
import { cryptoAction, runAutoPaperBot, runCryptoAlpacaExitCheck } from '../bot-paper-auto.js';

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
  assert.deepEqual(cryptoAction({ok:true,direction:0,confidence:50},{qty:'0.01',marketValue:98,unrealizedPl:-2}),{action:'SELL',reason:'BTC stop-loss automatico: perdita -2.00% oltre la soglia -1.50%.'});
  assert.deepEqual(cryptoAction({ok:true,direction:0,confidence:50},{qty:'0.01',marketValue:103,unrealizedPl:3}),{action:'SELL',reason:'BTC take-profit automatico: profitto 3.00% oltre la soglia +3.00%.'});
  assert.equal(cryptoAction({ok:true,direction:-1,confidence:70},{qty:'0.01',marketValue:100,unrealizedPl:0}).action,'SELL');
  assert.equal(cryptoAction({ok:true,direction:1,confidence:70},null).action,'BUY');

  const env={BOT_MODE:'PAPER',PAPER_AUTO_EXECUTION:'true',ALPACA_BASE_URL:'https://paper-api.alpaca.markets/v2',ALPACA_API_KEY:'test-key',ALPACA_API_SECRET:'test-secret'};
  global.fetch=async(url,options={})=>{
    const u=String(url);
    assert.match(u,/paper-api\.alpaca\.markets\/v2/,'paper execution must use Alpaca Paper endpoint');
    assert.equal(options.headers['APCA-API-KEY-ID'],'test-key');
    if(u.endsWith('/orders'))return new Response(JSON.stringify({id:'paper-test-order',status:'accepted',symbol:'BTC/USD'}),{status:200});
    throw new Error('unexpected paper URL');
  };
  await assert.rejects(()=>executePaperDecision(env,{action:'BUY',symbol:'BTC/USD',notional:100,clientOrderId:'crypto-paper-test-1'}),/Acquisto crypto automatico disabilitato/);

  global.fetch=async(url,options={})=>{
    const u=String(url),method=String(options.method||'GET').toUpperCase();
    assert.match(u,/paper-api\.alpaca\.markets\/v2/,'exit must use Alpaca Paper endpoint');
    if(u.endsWith('/positions')&&method==='GET')return new Response(JSON.stringify([{symbol:'BTCUSD',qty:'0.0036'}]),{status:200});
    if(u.includes('/orders?status=open')&&method==='GET')return new Response(JSON.stringify([{id:'old-protection',symbol:'BTC/USD',side:'sell',status:'new'}]),{status:200});
    if(u.endsWith('/orders/old-protection')&&method==='DELETE')return new Response(null,{status:204});
    if(u.endsWith('/orders')&&method==='POST'){
      const body=JSON.parse(options.body);
      assert.equal(body.side,'sell');assert.equal(body.qty,0.0036);assert.equal(body.notional,undefined);
      return new Response(JSON.stringify({id:'paper-exit-order',status:'accepted',symbol:'BTC/USD'}),{status:200});
    }
    throw new Error('unexpected exit URL '+method+' '+u);
  };
  const exit=await executePaperDecision(env,{action:'SELL',symbol:'BTC/USD',notional:100,clientOrderId:'crypto-paper-exit-test'});
  assert.equal(exit.executed,true);assert.equal(exit.qty,0.0036);assert.equal(exit.cancelledOrders,1);
  global.fetch=async(url,options={})=>{
    const u=String(url),method=String(options.method||'GET').toUpperCase();
    assert.ok(u.startsWith('https://paper-api.alpaca.markets/v2/'),'equity entry must use Alpaca Paper endpoint');
    assert.equal(method,'POST');
    const body=JSON.parse(options.body);assert.equal(body.side,'buy');assert.equal(body.qty,1);assert.equal(body.notional,undefined);assert.equal(body.order_class,'bracket');assert.ok(body.stop_loss?.stop_price);assert.ok(body.take_profit?.limit_price);
    return new Response(JSON.stringify({id:'paper-equity-bracket',status:'accepted',symbol:'SPY'}),{status:200});
  };
  const equity=await executePaperDecision(env,{action:'BUY',symbol:'SPY',notional:100,referencePrice:100,clientOrderId:'equity-bracket-test'});
  assert.equal(equity.executed,true);assert.equal(equity.orderClass,'bracket');assert.equal(equity.modeledStopRiskUsd,1.5);assert.equal(equity.riskCapUsd,8);
  await assert.rejects(()=>executePaperDecision(env,{action:'BUY',symbol:'QQQ',notional:100}),/prezzo di riferimento non disponibile/);
  const candidate={ok:true,mode:'PAPER',decision:{portfolio:{approved:true,action:'BUY',reason:'Test paper autorizzato.'}},risk:{maxNotionalUsd:533.33},crypto:null};
  const state={market:{indices:[{ticker:'SPY',price:100}]}};
  let submitted=0;
  global.fetch=async(url,options={})=>{
    const u=String(url),method=String(options.method||'GET').toUpperCase();
    if(u.endsWith('/positions')&&method==='GET')return new Response('[]',{status:200});
    if(u.includes('/orders?status=open')&&method==='GET')return new Response('[]',{status:200});
    if(u.endsWith('/orders')&&method==='POST'){submitted++;return new Response(JSON.stringify({id:'paper-auto-order',status:'accepted',symbol:'SPY'}),{status:200});}
    throw new Error('unexpected auto-paper URL '+method+' '+u);
  };
  const disabled=await runAutoPaperBot({...env,PAPER_AUTO_EXECUTION:'false'},{stateOverride:state,decisionOverride:structuredClone(candidate)});
  assert.equal(disabled.execution.executed,false);
  assert.equal(disabled.execution.dryRun,true);
  assert.match(disabled.execution.reason,/PAPER_AUTO_EXECUTION/);
  assert.equal(submitted,0,'disabled auto execution must never submit an order');
  const enabled=await runAutoPaperBot({...env,PAPER_AUTO_EXECUTION:'true'},{stateOverride:state,decisionOverride:structuredClone(candidate)});
  assert.equal(enabled.execution.executed,true);
  assert.equal(enabled.execution.mode,'PAPER');
  assert.equal(submitted,1,'enabled paper execution submits exactly one paper order');
  const wrongMode=await runAutoPaperBot({...env,BOT_MODE:'LIVE',PAPER_AUTO_EXECUTION:'true'},{stateOverride:state,decisionOverride:structuredClone(candidate)});
  assert.equal(wrongMode.execution.executed,false);
  assert.equal(submitted,1,'non-PAPER mode must never submit an order');

  await assert.rejects(()=>executePaperDecision(env,{action:'BUY',symbol:'SPY',notional:1000,referencePrice:100,maxRiskUsd:8}),/supera il limite 8 USD/);
  global.fetch=async(url,options={})=>{
    const u=String(url),method=String(options.method||'GET').toUpperCase();
    assert.ok(u.startsWith('https://paper-api.alpaca.markets/v2/'));
    if(u.endsWith('/positions')&&method==='GET')return new Response(JSON.stringify([{symbol:'BTCUSD',qty:'0.01',market_value:'98',unrealized_pl:'-2'}]),{status:200});
    if(u.includes('/orders?status=open')&&method==='GET')return new Response(JSON.stringify([{id:'btc-protective-stop',symbol:'BTC/USD',side:'sell',type:'stop_limit',status:'new',qty:'0.01',stop_price:'98'}]),{status:200});
    if(u.endsWith('/orders/btc-protective-stop')&&method==='DELETE')return new Response(null,{status:204});
    if(u.endsWith('/orders')&&method==='POST'){const body=JSON.parse(options.body);assert.equal(body.side,'sell');assert.equal(body.symbol,'BTC/USD');assert.equal(body.qty,0.01);return new Response(JSON.stringify({id:'btc-stop-exit',status:'accepted'}),{status:200});}
    throw new Error('unexpected minute exit monitor request '+method+' '+u);
  };
  const managedExit=await runCryptoAlpacaExitCheck(env);
  assert.equal(managedExit.botAction.action,'SELL');
  assert.equal(managedExit.execution.executed,true);
  assert.equal(managedExit.execution.mode,'PAPER');

  global.fetch=async(url,options={})=>{
    const u=String(url),method=String(options.method||'GET').toUpperCase();
    if(u.endsWith('/positions')&&method==='GET')return new Response('[]',{status:200});
    throw new Error('unexpected no-position monitor request '+method+' '+u);
  };
  const noPosition=await runCryptoAlpacaExitCheck(env);
  assert.equal(noPosition.botAction.action,'HOLD');
  assert.equal(noPosition.execution.executed,false);
  console.log('Equity bracket protection contract: PASS');
  console.log('BTC position-aware exit contract: PASS');
  console.log('BTC crypto decision contract: PASS');
  console.log('BTC paper execution contract: PASS');
} finally { global.fetch=originalFetch; }
