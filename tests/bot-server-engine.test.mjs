import test from 'node:test';
import assert from 'node:assert/strict';
import { rsiWilder, technicalFromHistory, fuse } from '../bot-server-engine.js';

test('missing close observations are excluded instead of becoming zero',()=>{
 const history=Array.from({length:40},(_,i)=>({close:i===39?null:100+i,high:101+i,low:99+i,asOf:new Date(Date.now()-(40-i)*86400000).toISOString()}));
 const result=technicalFromHistory(history);
 assert.ok(result);
 assert.notEqual(result.price,0);
});

test('RSI uses Wilder smoothing and returns no data for insufficient history',()=>{
 assert.equal(rsiWilder(Array.from({length:10},(_,i)=>100+i)),null);
 const values=Array.from({length:40},(_,i)=>100+i*.5);
 assert.equal(rsiWilder(values),100);
});

test('fusion defaults to WAIT when coverage is insufficient',()=>{
 const now=new Date().toISOString();
 const result=fuse([{family:'market',direction:1,strength:1,confidence:90,coverage:1,evidence:['x'],asOf:now}]);
 assert.equal(result.direction,0); assert.match(result.reason,/WAIT/);
});

test('fusion requires independent families before producing a direction',()=>{
 const now=new Date().toISOString();
 const vote=family=>({family,direction:1,strength:.8,confidence:80,coverage:1,evidence:[family],asOf:now});
 const result=fuse([vote('market'),vote('news'),vote('macro'),vote('technical')]);
 assert.equal(result.direction,1); assert.ok(result.coverage>=.60);
});
