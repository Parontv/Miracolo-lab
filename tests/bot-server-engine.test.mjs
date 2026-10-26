import test from 'node:test';
import assert from 'node:assert/strict';
import { runBot, getBotDecision } from '../bot-server-engine.js';

function envWith(state={},quant={}){
  const store=new Map([['state/latest',JSON.stringify(state)],['quantitative/latest-v2',JSON.stringify(quant)],['bot/journal/v1','[]'],['bot/positions/v1','[]']]);
  return {ML_KV:{async get(k){return store.get(k)||null},async put(k,v){store.set(k,v)}}};
}

test('unified engine exports the operational contract',()=>{
  assert.equal(typeof runBot,'function');
  assert.equal(typeof getBotDecision,'function');
});

test('engine fails safely when market state is absent',async()=>{
  const result=await runBot(envWith());
  assert.equal(result.ok,false);
  assert.equal(result.status,'NO_DATA');
  assert.equal(result.mode,'PAPER');
});

test('engine produces explainable modules and a portfolio decision',async()=>{
  const indices=['SPY','QQQ','IWM','DIA','EFA','XLE','XLI','XLY'].map((ticker,i)=>({ticker,changePct:.8+i*.05}));
  const news=Array.from({length:12},(_,i)=>({title:`Market update ${i}`,date:new Date().toISOString(),score:.2}));
  const state={market:{timestamp:new Date().toISOString(),indices},news:{timestamp:new Date().toISOString(),items:news},ai:{status:'ok',direction:'LONG',confidence:75,regime:'risk-on',thesis:'Trend positivo'}};
  const quant={timestamp:new Date().toISOString(),coverage:{available:3},groups:{macro:[{status:'ok',label:'Inflazione USA',trendPct:-.4}],rates:[{status:'ok',label:'Fed Funds effettivo',trendPct:-.2}]}};
  const result=await runBot(envWith(state,quant));
  assert.equal(result.ok,true);
  assert.equal(result.mode,'PAPER');
  assert.equal(result.engine,'bot-server-engine');
  assert.equal(result.modules.length,10);
  assert.ok(result.modules.every(m=>typeof m.family==='string'));
  assert.ok(result.decision && result.decision.portfolio);
});
