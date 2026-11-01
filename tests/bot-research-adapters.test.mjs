import test from 'node:test';
import assert from 'node:assert/strict';
import {listResearchAdapters,normalizeResearchAdapterResult} from '../bot-research-adapters.js';

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
