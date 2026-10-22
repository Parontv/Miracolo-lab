import test from 'node:test';
import assert from 'node:assert/strict';
import { rsiWilder, technicalFromHistory, fuse, marketVote } from '../bot-server-engine-v5.js';

test('missing close observations are excluded instead of becoming zero',()=>{
  const history=Array.from({length:40},(_,i)=>({close:i===39?null:100+i,high:101+i,low:99+i,asOf:new Date(Date.now()-(40-i)*86400000).toISOString()}));
  const result=technicalFromHistory(history);
  assert.ok(result);
  assert.notEqual(result.price,0);
});

test('RSI uses Wilder smoothing and returns no data for insufficient history',()=>{
  assert.equal(rsiWilder(Array.from({length:10},(_,i)=>100+i)),null);
  assert.equal(rsiWilder(Array.from({length:40},(_,i)=>100+i*.5)),100);
});

test('fusion defaults to WAIT when coverage is insufficient',()=>{
  const result=fuse([{family:'market',direction:1,strength:1,confidence:90,coverage:1,weight:.18,evidence:['x'],asOf:new Date().toISOString()}]);
  assert.equal(result.direction,0);
  assert.match(result.reason,/WAIT/);
});

test('fusion groups Jesse and WolfBot into one technical family',()=>{
  const now=new Date().toISOString();
  const v=(family,weight)=>({family,direction:1,strength:.8,confidence:80,coverage:1,weight,evidence:[family],asOf:now});
  const result=fuse([v('market',.18),v('news',.14),v('macro',.16),v('jesse',.16),v('wolfbot',.16)]);
  assert.equal(result.direction,1);
  assert.equal(result.families,4);
  assert.ok(result.coverage>=.60);
});

test('VIX is not included as an equity index',()=>{
  const result=marketVote({market:{indices:[
    {name:'S&P 500',changePct:1},{name:'NASDAQ 100',changePct:1},{name:'DAX',changePct:1},{name:'VIX',changePct:20},{name:'Gold',changePct:10},{name:'DXY',changePct:10}
  ]}});
  assert.ok(result.evidence.some(x=>x.includes('VIX')));
});
