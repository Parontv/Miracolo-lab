import assert from 'node:assert/strict';
import { riskEngine } from '../bot-risk-engine.js';

const base={decision:{direction:1,confidence:80,score:.6,contributors:[]},positions:[],capital:2000,riskPerTrade:10,maxTradesPerDay:3,maxPositions:3,now:new Date('2026-10-26T12:00:00Z')};
const journal=[
 {time:'2026-10-26T08:00:00Z'},
 {time:'2026-10-26T09:00:00Z'},
 {time:'2026-10-26T10:00:00Z'},
];
const blocked=riskEngine({...base,journal});
assert.equal(blocked.allowed,false);
assert.ok(blocked.flags.includes('DAILY_TRADE_LIMIT'));
assert.equal(blocked.tradesToday,3);

const priorDay=riskEngine({...base,journal:[{time:'2026-10-25T23:00:00Z'}]});
assert.equal(priorDay.allowed,true);
assert.equal(priorDay.tradesToday,0);

console.log('bot-risk-engine: PASS');
