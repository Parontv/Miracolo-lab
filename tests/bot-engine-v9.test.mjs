import assert from 'node:assert/strict';
import { fuse, rsiWilder, technicalFromHistory } from '../bot-server-engine-v9.js';

const now=new Date().toISOString();
const base=(family,direction,weight,confidence=80)=>({family,direction,strength:1,confidence,coverage:1,weight,evidence:[family],asOf:now});

// Null/empty values must never become numeric zero and must not manufacture a signal.
const missing=[null,'',undefined,'abc'].map(v=>Number.isFinite(Number(v))?Number(v):null);
assert.deepEqual(missing,[null,null,null,null]);

// RSI requires enough complete observations.
assert.equal(rsiWilder([100,101,102]),null);

// Technical module must return NO DATA when the sample is too short.
assert.equal(technicalFromHistory([{close:100,high:101,low:99,asOf:now}]),null);

// One family alone cannot produce a trade.
let d=fuse([base('market',1,.18,90)]);
assert.equal(d.direction,0);
assert.match(d.reason,/WAIT/);

// Correlated technical votes are represented by one family only.
d=fuse([
  base('market',1,.18,90),
  base('technical',1,.16,90),
  base('ai',1,.08,80)
]);
assert.equal(d.direction,1);
assert.ok(d.coverage>=.6);
assert.equal(d.families,3);

// A stale contributor is excluded from the decision.
d=fuse([
  base('market',1,.18,90),
  base('technical',1,.16,90),
  {...base('macro',1,.16,90),asOf:new Date(Date.now()-31*60*1000).toISOString()}
]);
assert.equal(d.families,2);
assert.equal(d.direction,0);

console.log('bot-engine-v9 behavioral tests: OK');
