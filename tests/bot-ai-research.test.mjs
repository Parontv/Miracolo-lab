import assert from 'node:assert/strict';
import { runAIResearchCouncil } from '../bot-ai-research.js';

const base={state:{market:{timestamp:'2026-11-01T12:00:00Z'}},modules:[{family:'market',dataAvailable:true,direction:1,confidence:70,evidence:['Breadth 65%']}],decision:{direction:1,score:.4,dataCoverage:.8,confidence:69},risk:{allowed:false,reason:'blocked',flags:['risk']}};
const disabled=await runAIResearchCouncil({},base);
assert.equal(disabled.status,'DISABLED');
assert.equal(disabled.affectsOrders,undefined);

const noData=await runAIResearchCouncil({AI:{run:async()=>{throw new Error('should not run')}}},{...base,modules:[]});
assert.equal(noData.status,'INSUFFICIENT_DATA');

const valid=await runAIResearchCouncil({AI:{run:async(model,args)=>{assert.equal(model,'@cf/meta/llama-3.1-8b-instruct');assert.match(args.messages[1].content,/Evidenze attuali/);return{response:JSON.stringify({stance:'MIXED',confidence:72,summary:'Evidenze divergenti.',bullCase:'Breadth positiva.',bearCase:'Rischio macro.',risks:['Volatilità'],missingData:['Volumi'],evidenceFamilies:['market']})}}}},base);
assert.equal(valid.status,'ok');
assert.equal(valid.stance,'MIXED');
assert.equal(valid.advisoryOnly,true);
assert.equal(valid.affectsConsensus,false);
assert.equal(valid.affectsRiskGate,false);
assert.equal(valid.affectsOrders,false);
assert.equal(valid.risks.length,1);

const invalid=await runAIResearchCouncil({AI:{run:async()=>({response:'not json'})}},base);
assert.equal(invalid.status,'INVALID_OUTPUT');

const error=await runAIResearchCouncil({AI:{run:async()=>{throw new Error('offline')}}},base);
assert.equal(error.status,'ERROR');
assert.equal(error.affectsOrders,false);
console.log('AI research council contracts: OK');
