import assert from 'node:assert/strict';
import { reconcileFilledOrders } from '../bot-pnl-reconciliation.js';

const orders=[
 {id:'b1',symbol:'SPY',side:'buy',filled_qty:'10',filled_avg_price:'100',filled_at:'2026-11-01T10:00:00Z'},
 {id:'b2',symbol:'SPY',side:'buy',filled_qty:'10',filled_avg_price:'110',filled_at:'2026-11-01T11:00:00Z'},
 {id:'s1',symbol:'SPY',side:'sell',filled_qty:'15',filled_avg_price:'120',filled_at:'2026-11-01T12:00:00Z'},
 {id:'s2',symbol:'SPY',side:'sell',filled_qty:'5',filled_avg_price:'90',filled_at:'2026-11-01T13:00:00Z'},
];
const result=reconcileFilledOrders(orders);
assert.equal(result.historyComplete,true);
assert.equal(result.processedFills,4);
assert.equal(result.byOrderId.get('b1').realizedGross,null);
assert.equal(result.byOrderId.get('s1').realizedGross,225);
assert.equal(result.byOrderId.get('s1').realizedStatus,'GROSS_WEIGHTED_AVERAGE');
assert.equal(result.byOrderId.get('s2').realizedGross,-75);

const missingBasis=reconcileFilledOrders([{id:'s0',symbol:'QQQ',side:'sell',filled_qty:'1',filled_avg_price:'500',filled_at:'2026-11-01T12:00:00Z'}]);
assert.equal(missingBasis.byOrderId.get('s0').realizedGross,null);
assert.equal(missingBasis.byOrderId.get('s0').realizedStatus,'INSUFFICIENT_RECONCILED_INVENTORY');

const missingPrice=reconcileFilledOrders([
 {id:'b0',symbol:'IWM',side:'buy',filled_qty:'2',filled_avg_price:null,filled_at:'2026-11-01T10:00:00Z'},
 {id:'s3',symbol:'IWM',side:'sell',filled_qty:'2',filled_avg_price:'200',filled_at:'2026-11-01T11:00:00Z'},
]);
assert.equal(missingPrice.byOrderId.get('s3').realizedGross,null);
assert.equal(missingPrice.byOrderId.get('s3').realizedStatus,'UNKNOWN_COST_BASIS');

const truncated=reconcileFilledOrders([...orders,...Array.from({length:496},(_,i)=>({id:'x'+i,symbol:'DIA',side:'buy',filled_qty:'1',filled_avg_price:'10',filled_at:'2026-11-02T10:00:00Z'}))],{limit:500});
assert.equal(truncated.historyComplete,false);
assert.equal(truncated.byOrderId.get('s1').realizedGross,null);
assert.equal(truncated.byOrderId.get('s1').realizedStatus,'HISTORY_TRUNCATED');

console.log('Alpaca realized P&L reconciliation: PASS');
