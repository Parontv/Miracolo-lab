import test from 'node:test';
import assert from 'node:assert/strict';
import {listResearchAdapters,normalizeResearchAdapterResult,runVibeTradingAdapter,runAIHedgeFundAdapter} from '../bot-research-adapters.js';

test('research adapters are registered read-only and cannot affect execution',()=>{
  const adapters=listResearchAdapters();
  assert.ok(adapters.some(x=>x.id==='tradingagents'));
  assert.ok(adapters.some(x=>x.id==='vibe-trading'));
  assert.ok(adapters.some(x=>x.id==='ai-hedge-fund'));
  assert.ok(adapters.every(x=>x.readOnly&&x.affectsConsensus===false&&x.affectsRiskGate===false&&x.affectsOrders===false&&x.execution===false));
});

test('adapter output is normalized, bounded and advisory',()=>{
  const result=normalizeResearchAdapterResult('tradingagents',{status:'ok',items:[{title:'A'.repeat(300),summary:'evidence',source:'feed',url:'https://example.com',confidence:150}]});
  assert.equal(result.status,'ok');
  assert.equal(result.items[0].title.length,160);
  assert.equal(result.items[0].confidence,100);
  assert.equal(result.affectsOrders,false);
});

test('unknown adapters are rejected safely',()=>{
  const result=normalizeResearchAdapterResult('unknown',{status:'ok',items:[{title:'should not pass'}]});
  assert.equal(result.status,'REJECTED');
  assert.equal(result.affectsOrders,false);
});

test('Vibe Trading internal lens summarizes existing modules without changing controls',()=>{
  const modules=[
    {family:'market',direction:1,confidence:70,dataAvailable:true},
    {family:'technical',direction:1,confidence:65,dataAvailable:true},
    {family:'news',direction:-1,confidence:60,dataAvailable:true},
    {family:'flow',direction:0,confidence:50,dataAvailable:true}
  ];
  const result=runVibeTradingAdapter(modules);
  assert.equal(result.adapterId,'vibe-trading');
  assert.equal(result.status,'ok');
  assert.equal(result.stance,'BULLISH');
  assert.equal(result.readOnly,true);
  assert.equal(result.affectsConsensus,false);
  assert.equal(result.affectsRiskGate,false);
  assert.equal(result.affectsOrders,false);
  assert.equal(runVibeTradingAdapter([]).status,'INSUFFICIENT_DATA');
});

test('AI Hedge Fund analyst synthesis remains advisory and reports risk gate only',()=>{
 const modules=[{family:'macro',direction:1,confidence:70,dataAvailable:true},{family:'news',direction:1,confidence:60,dataAvailable:true},{family:'technical',direction:-1,confidence:65,dataAvailable:true},{family:'flow',direction:1,confidence:55,dataAvailable:true}];
 const result=runAIHedgeFundAdapter(modules,{portfolio:{approved:false}});
 assert.equal(result.status,'ok');assert.equal(result.analysts.length,4);
 assert.equal(result.analysts.find(x=>x.id==='risk').stance,'RISK_GATE_BLOCKED');
 assert.equal(result.affectsConsensus,false);assert.equal(result.affectsRiskGate,false);assert.equal(result.affectsOrders,false);
});
