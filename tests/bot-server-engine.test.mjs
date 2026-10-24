import test from 'node:test';
import assert from 'node:assert/strict';
import { rsiWilder, ema, atr, technicalFromHistory } from '../bot-server-engine-v10.js';

test('RSI uses Wilder smoothing and returns no data for insufficient history',()=>{
  assert.equal(rsiWilder(Array.from({length:10},(_,i)=>100+i)),null);
  assert.equal(rsiWilder(Array.from({length:40},(_,i)=>100+i*.5)),100);
});

test('EMA and ATR return no data when the minimum sample is not available',()=>{
  assert.equal(ema([1,2,3],5),null);
  assert.equal(atr([{close:1,high:1.1,low:.9},{close:1.05,high:1.15,low:1}],14),null);
});

test('technical module keeps missing data as NO DATA instead of zero',()=>{
  const history=Array.from({length:60},(_,i)=>({close:i===59?null:100+i*.2,high:100+i*.2+.5,low:100+i*.2-.5,asOf:new Date(Date.UTC(2026,0,1+i)).toISOString()}));
  const result=technicalFromHistory(history);
  assert.ok(result);
  assert.notEqual(result.price,0);
  assert.equal(typeof result.coverage,'number');
});

test('technical module exposes a structured contract with sufficient history',()=>{
  const history=Array.from({length:60},(_,i)=>({asOf:new Date(Date.UTC(2026,0,1+i)).toISOString(),close:100+i*.2,high:100+i*.2+.5,low:100+i*.2-.5}));
  const result=technicalFromHistory(history);
  assert.ok(result);
  assert.equal(typeof result.direction,'number');
  assert.ok(Array.isArray(result.evidence));
  assert.ok(result.asOf);
});
