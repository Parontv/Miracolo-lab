import assert from 'node:assert/strict';
import { rsiWilder, ema, atr, technicalFromHistory } from '../bot-server-engine-v10.js';

assert.equal(rsiWilder([100,101,102,103,104],14),null,'RSI must be NO DATA below minimum sample');
assert.equal(ema([1,2,3],5),null,'EMA must be NO DATA below period');
assert.equal(atr([{close:1,high:1.1,low:.9},{close:1.05,high:1.15,low:1}],14),null,'ATR must be NO DATA below period');

const history=Array.from({length:60},(_,i)=>({
  asOf:new Date(Date.UTC(2026,0,1+i)).toISOString(),
  close:100+i*.2,
  high:100+i*.2+.5,
  low:100+i*.2-.5
}));
const tech=technicalFromHistory(history);
assert.ok(tech,'technical module must produce a structured result with sufficient history');
assert.equal(typeof tech.direction,'number');
assert.equal(typeof tech.coverage,'number');
assert.ok(Array.isArray(tech.evidence));
assert.ok(tech.asOf,'technical result must expose asOf');

console.log('BOT V10 TESTS PASS');
