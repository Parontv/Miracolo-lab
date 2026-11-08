import assert from 'node:assert/strict';
import { assessPositionRisk } from '../bot-position-risk.js';

const bracket=[{id:'entry-1',symbol:'SPY',side:'buy',type:'market',status:'filled',qty:'10',legs:[
 {id:'tp-1',symbol:'SPY',side:'sell',type:'limit',status:'accepted',qty:'10',limit_price:'105',group_role:'take_profit'},
 {id:'sl-1',symbol:'SPY',side:'sell',type:'stop',status:'accepted',qty:'10',stop_price:'98',group_role:'stop_loss'}
]}];
const verified=assessPositionRisk([{symbol:'SPY',qty:'10',side:'long',avg_entry_price:'100',market_value:'1000'}],bracket)[0];
assert.equal(verified.riskVerified,true);
assert.equal(verified.risk,20);
assert.equal(verified.protectiveStop,98);
assert.equal(verified.protectiveOrderId,'sl-1');

const partial=assessPositionRisk([{symbol:'SPY',qty:'10',side:'long',avg_entry_price:'100'}],[{id:'sl-partial',symbol:'SPY',side:'sell',type:'stop',status:'accepted',qty:'8',stop_price:'98'}])[0];
assert.equal(partial.riskVerified,false);
assert.equal(partial.risk,null);

const cancelled=assessPositionRisk([{symbol:'SPY',qty:'10',side:'long',avg_entry_price:'100'}],[{id:'sl-cancelled',symbol:'SPY',side:'sell',type:'stop',status:'canceled',qty:'10',stop_price:'98'}])[0];
assert.equal(cancelled.riskVerified,false);

const wrongSymbol=assessPositionRisk([{symbol:'SPY',qty:'10',side:'long',avg_entry_price:'100'}],[{id:'sl-qqq',symbol:'QQQ',side:'sell',type:'stop',status:'accepted',qty:'10',stop_price:'98'}])[0];
assert.equal(wrongSymbol.riskVerified,false);

const short=assessPositionRisk([{symbol:'TSLA',qty:'-5',side:'short',avg_entry_price:'100'}],[{id:'sl-short',symbol:'TSLA',side:'buy',type:'stop_limit',status:'new',qty:'5',stop_price:'110'}])[0];
assert.equal(short.riskVerified,true);
assert.equal(short.risk,50);

const lockedProfit=assessPositionRisk([{symbol:'IWM',qty:'2',side:'long',avg_entry_price:'200'}],[{id:'sl-profit',symbol:'IWM',side:'sell',type:'stop',status:'accepted',qty:'2',stop_price:'205'}])[0];
assert.equal(lockedProfit.riskVerified,true);
assert.equal(lockedProfit.risk,0);

console.log('Alpaca protective position risk verification: PASS');

const held=assessPositionRisk([{symbol:'SPY',qty:'10',side:'long',avg_entry_price:'100'}],[{id:'sl-held',symbol:'SPY',side:'sell',type:'stop',status:'held',qty:'10',stop_price:'98'}])[0];
assert.equal(held.riskVerified,false);

const partialFill=assessPositionRisk([{symbol:'SPY',qty:'8',side:'long',avg_entry_price:'100'}],[{id:'sl-partial-fill',symbol:'SPY',side:'sell',type:'stop',status:'partially_filled',qty:'10',remaining_qty:'8',stop_price:'98'}])[0];
assert.equal(partialFill.riskVerified,true);
assert.equal(partialFill.protectiveOrderQty,8);
