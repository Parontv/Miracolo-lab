import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientOrderId, sameSymbol, preflightPaperGuardrails, runAutoPaperBot } from '../bot-paper-auto.js';
import { executePaperDecision } from '../bot-paper-executor.js';

function env(store=new Map()){
  return {
    BOT_MODE:'PAPER',
    ALPACA_BASE_URL:'https://paper-api.alpaca.markets/v2',
    ALPACA_API_KEY:'test-key',
    ALPACA_API_SECRET:'test-secret',
    PAPER_MAX_BUYS_PER_DAY:'3',
    PAPER_MAX_POSITIONS:'3',
    PAPER_MAX_EXPOSURE:'1800',
    PAPER_COOLDOWN_MINUTES:'30',
    ML_KV:{
      async get(k){return store.get(k)||null},
      async put(k,v){store.set(k,v)}
    }
  };
}

const openClock={is_open:true};
const closedClock={is_open:false};

function mockFetch({positions=[],orders=[],clock=openClock,postResponse=null,postStatus=200,getOrder=null}){
  return async (url,options={})=>{
    const u=new URL(url);
    if(u.pathname==='/positions')return new Response(JSON.stringify(positions),{status:200});
    if(u.pathname==='/orders'&&options.method==='POST')return new Response(JSON.stringify(postResponse||{id:'order-1',status:'accepted'}),{status:postStatus});
    if(u.pathname==='/orders'&&(!options.method||options.method==='GET'))return new Response(JSON.stringify(orders),{status:200});
    if(u.pathname==='/orders/order-1')return new Response(JSON.stringify(getOrder||postResponse||{id:'order-1',status:'accepted'}),{status:200});
    if(u.pathname==='/clock')return new Response(JSON.stringify(clock),{status:200});
    throw new Error(`Unexpected URL ${url}`);
  };
}

test('BTC position matching normalizes BTCUSD and BTC/USD',()=>{
  assert.equal(sameSymbol('BTCUSD','BTC/USD'),true);
  assert.equal(sameSymbol('btc/usd','BTCUSD'),true);
  assert.equal(sameSymbol('SPY','QQQ'),false);
});

test('client_order_id is deterministic for the same signal/day',()=>{
  const a=buildClientOrderId({day:'2026-10-27',symbol:'SPY',action:'BUY',direction:1,score:.412});
  const b=buildClientOrderId({day:'2026-10-27',symbol:'SPY',action:'BUY',direction:1,score:.412});
  const c=buildClientOrderId({day:'2026-10-27',symbol:'SPY',action:'BUY',direction:1,score:.413});
  assert.equal(a,b);
  assert.notEqual(a,c);
  assert.ok(a.length<=48);
});

test('preflight blocks the fourth BUY in one day using Alpaca orders as source of truth',async()=>{
  const day='2026-10-27';
  const orders=[1,2,3].map(i=>({id:`o${i}`,side:'buy',status:'filled',submitted_at:`${day}T0${i}:00:00.000Z`}));
  const old=globalThis.fetch;globalThis.fetch=mockFetch({orders});
  try{
    const e=env();
    const r=await preflightPaperGuardrails(e,{action:'BUY',symbol:'SPY',notional:100,clientOrderId:'new-id',now:new Date(`${day}T10:00:00.000Z`)});
    assert.equal(r.allowed,false);
    assert.equal(r.code,'DAILY_BUY_LIMIT');
  }finally{globalThis.fetch=old}
});

test('preflight blocks duplicate deterministic client_order_id',async()=>{
  const day='2026-10-27';
  const id=buildClientOrderId({day,symbol:'SPY',action:'BUY',direction:1,score:.4});
  const old=globalThis.fetch;globalThis.fetch=mockFetch({orders:[{client_order_id:id,side:'buy',status:'filled',submitted_at:`${day}T09:00:00.000Z`}]});
  try{
    const r=await preflightPaperGuardrails(env(),{action:'BUY',symbol:'SPY',notional:100,clientOrderId:id,now:new Date(`${day}T10:00:00.000Z`)});
    assert.equal(r.allowed,false);
    assert.equal(r.code,'DUPLICATE_CLIENT_ORDER_ID');
  }finally{globalThis.fetch=old}
});

test('missing KV fails explicitly before paper execution',async()=>{
  await assert.rejects(()=>runAutoPaperBot({BOT_MODE:'PAPER'}),/ML_KV binding missing/);
});

test('equity order is queued when market is closed and no order is sent',async()=>{
  const old=globalThis.fetch;let posts=0;globalThis.fetch=async(url,options={})=>{if(options.method==='POST')posts++;return mockFetch({clock:closedClock})(url,options)};
  try{
    const r=await preflightPaperGuardrails(env(),{action:'BUY',symbol:'SPY',notional:100,clientOrderId:'closed-market',now:new Date('2026-10-27T10:00:00.000Z')});
    assert.equal(r.allowed,false);assert.equal(r.code,'MARKET_CLOSED');assert.equal(r.queued,true);assert.equal(posts,0);
  }finally{globalThis.fetch=old}
});

test('executor surfaces Alpaca 403 rejection',async()=>{
  const old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({message:'forbidden'}),{status:403});
  try{await assert.rejects(()=>executePaperDecision(env(),{action:'BUY',symbol:'SPY',notional:100,clientOrderId:'reject-403'}),e=>e.status===403);}
  finally{globalThis.fetch=old}
});

test('executor surfaces Alpaca 422 rejection',async()=>{
  const old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({message:'unprocessable'}),{status:422});
  try{await assert.rejects(()=>executePaperDecision(env(),{action:'BUY',symbol:'SPY',notional:100,clientOrderId:'reject-422'}),e=>e.status===422);}
  finally{globalThis.fetch=old}
});

test('executor re-reads order and distinguishes accepted from filled',async()=>{
  const old=globalThis.fetch;globalThis.fetch=mockFetch({postResponse:{id:'order-1',status:'accepted'},getOrder:{id:'order-1',status:'filled',filled_qty:'0.5'}});
  try{
    const r=await executePaperDecision(env(),{action:'BUY',symbol:'SPY',notional:100,clientOrderId:'accepted-then-filled'});
    assert.equal(r.status,'filled');assert.equal(r.filled,true);assert.equal(r.orderId,'order-1');
  }finally{globalThis.fetch=old}
});

console.log('paper-execution: PASS');
