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
  const indices=['SPY','QQQ','IWM','DIA','EFA','XLE','XLI','XLY'].map((ticker,i)=>({ticker,changePct:.8+i*.05,rsi:55+i,volumeChangePct:20+i*2,smaSignal:.1,emaSignal:.1,atrPct:1.2}));
  const news=Array.from({length:12},(_,i)=>({title:`Market update ${i}`,date:new Date().toISOString(),score:.2}));
  const state={market:{timestamp:new Date().toISOString(),indices},news:{timestamp:new Date().toISOString(),items:news},ai:{status:'ok',direction:'LONG',confidence:75,regime:'risk-on',thesis:'Trend positivo',generatedAt:new Date().toISOString()}};
  const quant={timestamp:new Date().toISOString(),coverage:{available:3},groups:{macro:[{status:'ok',freshness:'fresh',asOf:new Date().toISOString(),maxAgeDays:75,label:'CPI inflation',trendPct:-.4}],rates:[{status:'ok',freshness:'fresh',asOf:new Date().toISOString(),maxAgeDays:7,label:'Fed Funds effective rate',trendPct:-.2}]}};
  const result=await runBot(envWith(state,quant));
  assert.equal(result.ok,true);
  assert.equal(result.mode,'PAPER');
  assert.equal(result.engine,'bot-server-engine');
  assert.equal(result.modules.length,11);
  assert.ok(result.modules.every(m=>typeof m.family==='string'));
  const technical=result.modules.find(m=>m.family==='technical');
  assert.ok(technical.indicators.includes('RSI'));
  assert.ok(technical.indicators.includes('SMA'));
  assert.ok(technical.indicators.includes('EMA'));
  assert.ok(technical.indicators.includes('ATR'));
  assert.ok(result.diagnostics.inputAudit.technicalFields.includes('rsi'));
  assert.ok(result.decision && result.decision.portfolio);
  assert.equal(result.modules.find(m=>m.family==='macro').dataAvailable,true);
  assert.ok(Date.parse(result.modules.find(m=>m.family==='macro').freshUntil)>Date.now());
  assert.equal(result.modules.find(m=>m.family==='ai').dataAvailable,true);
});

test('backtest module never treats an unvalidated market snapshot as backtest evidence',async()=>{const indices=['SPY','QQQ','IWM','DIA','EFA','XLE','XLI','XLY'].map(ticker=>({ticker,changePct:.8}));const state={market:{timestamp:new Date().toISOString(),indices},backtest:{returnPct:1.2,method:'current-market-sanity-check'}};const result=await runBot(envWith(state,{}));const backtest=result.modules.find(m=>m.family==='backtest');assert.equal(backtest.dataAvailable,false);assert.equal(backtest.status,'NO_DATA');});

test('learning excludes closed orders without verified realized PnL',async()=>{const indices=['SPY','QQQ','IWM','DIA','EFA','XLE','XLI','XLY'].map(ticker=>({ticker,changePct:0}));const state={market:{timestamp:new Date().toISOString(),indices}};const store=new Map([['state/latest',JSON.stringify(state)],['quantitative/latest-v2','{}'],['bot/journal/v1',JSON.stringify([{orderId:'unknown-pnl',status:'filled',closedAt:new Date().toISOString(),realized:null}])],['bot/positions/v1','[]']]);const result=await runBot({ML_KV:{async get(k){return store.get(k)||null},async put(k,v){store.set(k,v)}}},state);const learning=result.modules.find(m=>m.family==='learning');assert.equal(learning.dataAvailable,false);assert.equal(learning.status,'NO_DATA');});

test('stale macro and AI inputs never contribute to consensus',async()=>{
  const indices=['SPY','QQQ','IWM','DIA','EFA','XLE','XLI','XLY'].map(ticker=>({ticker,changePct:.8}));
  const state={market:{timestamp:new Date().toISOString(),indices},ai:{status:'stale',direction:'LONG',confidence:95,generatedAt:'2026-11-01T00:00:00Z'}};
  const quant={timestamp:new Date().toISOString(),coverage:{available:1},groups:{macro:[{status:'ok',freshness:'stale',label:'CPI inflation',changePct:-1,value:100}]}};
  const result=await runBot(envWith(state,quant),state);
  const macro=result.modules.find(m=>m.family==='macro');
  const ai=result.modules.find(m=>m.family==='ai');
  assert.equal(macro.dataAvailable,false);
  assert.equal(macro.status,'NO_DATA');
  assert.equal(ai.dataAvailable,false);
  assert.equal(ai.status,'NO_DATA');
});

test('undated and stale news cannot contribute to market consensus',async()=>{
  const indices=['SPY','QQQ','IWM','DIA','EFA','XLE','XLI','XLY'].map(ticker=>({ticker,changePct:0}));
  const state={market:{timestamp:new Date().toISOString(),indices},news:{items:[
    {title:'Old critical market event',date:'2026-10-01T00:00:00Z',cat:'geopolitics',score:-1},
    {title:'Undated critical market event',date:null,cat:'geopolitics',score:-1}
  ]}};
  const result=await runBot(envWith(state,{}),state);
  const news=result.modules.find(m=>m.family==='news');
  assert.equal(news.dataAvailable,false);
  assert.equal(news.status,'NO_DATA');
});
