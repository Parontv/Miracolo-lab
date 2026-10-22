import assert from 'node:assert/strict';
import { rsiWilder, technicalFromHistory } from '../bot-server-engine-v9.js';

const now=new Date().toISOString();

// Null/empty values must never manufacture numeric signals.
const toNum=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
assert.deepEqual([null,'',undefined,'abc'].map(toNum),[null,null,null,null]);
assert.equal(toNum(12.5),12.5);

// RSI requires enough complete observations.
assert.equal(rsiWilder([100,101,102]),null);

// Technical module must return NO DATA when the sample is too short.
assert.equal(technicalFromHistory([{close:100,high:101,low:99,asOf:now}]),null);

// Complete history produces a structured technical result rather than a fabricated signal.
const history=Array.from({length:60},(_,i)=>({close:100+i*.4,high:101+i*.4,low:99+i*.4,asOf:new Date(Date.now()-(59-i)*86400000).toISOString()}));
const t=technicalFromHistory(history);
assert.ok(t);
assert.ok(['number','object'].includes(typeof t.rsi));
assert.ok(Number.isFinite(t.coverage));
assert.ok(t.asOf);

console.log('bot-engine-v9 behavioral tests: OK');
