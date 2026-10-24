/* Miracolo Lab Bot V11 — orchestration layer around the single V10 decision brain. PAPER ONLY. */
import { runBot as runCoreBot, getBotDecision as getCoreDecision } from './bot-server-engine-v10.js';
import { newsContract } from './news-event-engine-v1.js';
import { riskEngine } from './bot-risk-engine-v1.js';

const STATE='bot/decision-v11';
const get=async(env,k,d=null)=>{try{const x=await env.ML_KV?.get(k);return x?JSON.parse(x):d}catch{return d}};
const put=async(env,k,v,ttl=3600)=>{try{if(!env.ML_KV)return false;await env.ML_KV.put(k,JSON.stringify(v),{expirationTtl:ttl});return true}catch{return false}};

export async function runBot(env){
 const baseState=await get(env,'state/latest',{});
 const contract=newsContract(baseState?.news?.items||[]);
 const current=await getCoreDecision(env);
 const positions=await get(env,'bot/positions-v10',[]);
 const journal=await get(env,'bot/journal-v10',[]);
 const preliminaryRisk=riskEngine({decision:current?.decision||{},positions,journal,eventRisk:{level:contract.summary.criticalCount>=2?'CRITICAL':contract.summary.criticalCount===1?'HIGH':'NORMAL',count:contract.summary.criticalCount}});
 if(!preliminaryRisk.allowed&&preliminaryRisk.flags.length){
   const blocked={...(current||{}),version:'BOT-SERVER-V11',mode:'PAPER',decision:{...(current?.decision||{}),direction:0,reason:preliminaryRisk.reason,evidence:[...(current?.decision?.evidence||[]),'RISK ENGINE V1']},newsEvent:contract.summary,risk:preliminaryRisk};
   await put(env,STATE,blocked,3600);
   return blocked;
 }
 const out=await runCoreBot(env);
 const refreshedContract=newsContract((await get(env,'state/latest',baseState))?.news?.items||baseState?.news?.items||[]);
 const finalRisk=riskEngine({decision:out?.decision||{},positions:out?.paper?.positions||[],journal:out?.paper?.journal||[],eventRisk:{level:refreshedContract.summary.criticalCount>=2?'CRITICAL':refreshedContract.summary.criticalCount===1?'HIGH':'NORMAL',count:refreshedContract.summary.criticalCount}});
 const result={...out,version:'BOT-SERVER-V11',newsEvent:refreshedContract.summary,risk:finalRisk,limits:{...(out?.limits||{}),mode:'PAPER ONLY',riskEngine:'V1',newsEventEngine:'V1'}};
 await put(env,STATE,result,3600);
 return result;
}
export async function getBotDecision(env){return get(env,STATE,null)||getCoreDecision(env)}
