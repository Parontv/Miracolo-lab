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

const priorDay=riskEngine({...base,journal:[{time:'2026-10-25T23:00:00Z',status:'filled',orderId:'old'}]});
assert.equal(priorDay.allowed,true);
assert.equal(priorDay.tradesToday,0);

const canceled=riskEngine({...base,journal:[{time:'2026-10-26T08:00:00Z',status:'canceled',orderId:'c1'},{time:'2026-10-26T09:00:00Z',status:'rejected',orderId:'r1'}]});
assert.equal(canceled.allowed,true);
assert.equal(canceled.tradesToday,0);

const deduped=riskEngine({...base,journal:[{time:'2026-10-26T08:00:00Z',status:'filled',orderId:'same'},{time:'2026-10-26T09:00:00Z',status:'filled',orderId:'same'},{time:'2026-10-26T10:00:00Z',status:'new',orderId:'pending'}]});
assert.equal(deduped.allowed,true);
assert.equal(deduped.tradesToday,2);

console.log('bot-risk-engine: PASS');

const sized=riskEngine({...base,riskPerTrade:8,stopLossPct:1.5});
assert.equal(sized.riskPerTradeUsd,8);
assert.equal(sized.maxNotionalUsd,533.33);
assert.equal(sized.modeledStopRiskUsd,8);

const unknownPosition=riskEngine({...base,positions:[{symbol:'SPY',notional:100,risk:5,riskVerified:false}]});
assert.equal(unknownPosition.allowed,false);
assert.ok(unknownPosition.flags.includes('EXISTING_POSITION_RISK_UNKNOWN'));

const verifiedPosition=riskEngine({...base,positions:[{symbol:'SPY',notional:100,risk:1.5,riskVerified:true}]});
assert.equal(verifiedPosition.allowed,true);
assert.equal(verifiedPosition.riskBudget,1.5);

const exitDespiteEntryLimits=riskEngine({...base,decision:{direction:-1,confidence:80,score:-.6,contributors:[]},journal,positions:[{symbol:'SPY',notional:100,risk:null,riskVerified:false}]});
assert.equal(exitDespiteEntryLimits.allowed,true);
assert.ok(exitDespiteEntryLimits.flags.includes('DAILY_TRADE_LIMIT'));
assert.ok(exitDespiteEntryLimits.flags.includes('EXISTING_POSITION_RISK_UNKNOWN'));

const bracketOrders=[
 {time:'2026-10-26T08:00:00Z',status:'filled',orderId:'entry',side:'buy',groupRole:'entry'},
 {time:'2026-10-26T08:01:00Z',status:'accepted',orderId:'tp',side:'sell',parentOrderId:'entry',groupRole:'take_profit'},
 {time:'2026-10-26T08:01:00Z',status:'accepted',orderId:'sl',side:'sell',parentOrderId:'entry',groupRole:'stop_loss'}
];
const bracketPending=riskEngine({...base,journal:bracketOrders});
assert.equal(bracketPending.tradesToday,1,'unfilled protective legs are not separate daily trades');
const bracketExit=riskEngine({...base,journal:[...bracketOrders,{time:'2026-10-26T10:00:00Z',status:'filled',orderId:'tp-filled',side:'sell',parentOrderId:'entry',groupRole:'take_profit'}]});
assert.equal(bracketExit.tradesToday,2,'a filled protective exit counts as an executed operation');
