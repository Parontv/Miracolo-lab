import assert from 'node:assert/strict';
import { buildNewsEvents, summarizeEvents, newsContract } from '../news-event-engine-v1.js';
import { riskEngine } from '../bot-risk-engine-v1.js';

const now=Date.parse('2026-10-24T08:00:00.000Z');
const items=Array.from({length:12},(_,i)=>({title:`Market event ${i}`,description:i===0?'bank failure risk rises':'normal market growth',date:new Date(now-i*3600000).toISOString(),source:'test',cat:i===0?'finance':'macro'}));
const events=buildNewsEvents(items,now);
assert.equal(events.length,12,'news engine must deduplicate only exact normalized titles');
const summary=summarizeEvents(events);
assert.equal(summary.count,12);
assert.ok(summary.criticalCount>=1);
const contract=newsContract(items);
assert.equal(contract.version,'NEWS-EVENT-V1');
assert.equal(contract.contract.aiDoesNotVoteDirectly,true);

const blocked=riskEngine({decision:{direction:1,confidence:90},positions:[],journal:[],eventRisk:{level:'CRITICAL',count:2}});
assert.equal(blocked.allowed,false);
assert.ok(blocked.flags.includes('EVENT_CRITICAL'));

const allowed=riskEngine({decision:{direction:1,confidence:90},positions:[],journal:[],eventRisk:{level:'NORMAL',count:0}});
assert.equal(allowed.allowed,true);
assert.equal(allowed.mode,'PAPER');

console.log('BOT V11 NEWS/RISK TESTS PASS');
