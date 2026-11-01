import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchCouncil } from '../bot-research-council.js';

test('research council is advisory-only and surfaces independent analyst perspectives',()=>{
 const modules=[
  {family:'market',direction:1,strength:.7,confidence:70,weight:.14,dataAvailable:true,evidence:['breadth positive']},
  {family:'historical',direction:1,strength:.5,confidence:60,weight:.07,dataAvailable:true,evidence:['SPY positive']},
  {family:'technical',direction:-1,strength:.6,confidence:65,weight:.17,dataAvailable:true,evidence:['RSI weak']},
  {family:'news',direction:1,strength:.4,confidence:58,weight:.13,dataAvailable:true,evidence:['news net positive']},
  {family:'macro',direction:0,strength:0,confidence:50,weight:.13,dataAvailable:true,evidence:['macro mixed']},
  {family:'crypto',direction:-1,strength:.8,confidence:75,weight:.08,dataAvailable:true,evidence:['BTC momentum negative']}
 ];
 const decision={direction:1,score:.22,confidence:63};
 const risk={allowed:false,flags:['DAILY_TRADE_LIMIT'],reason:'daily limit reached'};
 const council=buildResearchCouncil(modules,decision,risk);
 assert.equal(council.mode,'ADVISORY_ONLY');
 assert.equal(council.analysts.length,5);
 assert.equal(council.synthesis.consensusDirection,1);
 assert.equal(council.synthesis.conflicts,true);
 assert.equal(council.riskReview.allowedForPaper,false);
 assert.deepEqual(council.riskReview.flags,['DAILY_TRADE_LIMIT']);
 assert.ok(council.limitations.some(x=>x.includes('non sono agenti LLM indipendenti')));
});

test('research council handles missing evidence without inventing a stance',()=>{
 const council=buildResearchCouncil([],null,null);
 assert.equal(council.synthesis.stance,'INSUFFICIENT_DATA');
 assert.equal(council.synthesis.activeAnalysts,0);
 assert.equal(council.riskReview.allowedForPaper,false);
});
