/* Miracolo Lab Bot V11 — orchestration layer around the single V10 decision brain. PAPER ONLY. */
import { runBot as runCoreBot, getBotDecision as getCoreDecision } from './bot-server-engine-v10.js';
import { newsContract } from './news-event-engine-v1.js';
import { riskEngine } from './bot-risk-engine-v1.js';

const STATE='bot/decision-v11';
const get=async(env,k,d=null)=>{try{const x=await env.ML_KV?.get(k);return x?JSON.parse(x):d}catch{return d}};
const put=async(env,k,v,ttl=3600)=>{try{if(!env.ML_KV)return false;await env.ML_KV.put(k,JSON.stringify(v),{expirationTtl:ttl});return true}catch{return false}};
const eventLevel=summary=>summary.criticalCount>=2?'CRITICAL':summary.criticalCount===1?'HIGH':'NORMAL';

export async function runBot(env){
 const baseState=await get(env,'state/latest',{});
 const contract=newsContract(baseState?.news?.items||[]);
 const current=await getCoreDecision(env);
 const positions=await get(env,'bot/positions-v10',[]);
 const journal=await get(env,'bot/journal-v10',[]);
 const preliminaryRisk=riskEngine({decision:current?.decision||{},positions,journal,eventRisk:{level:eventLevel(contract.summary),count:contract.summary.criticalCount}});
 if(!preliminaryRisk.allowed&&preliminaryRisk.flags.length){
   const currentDecision=current?.decision||{};
   const blocked={...(current||{}),version:'BOT-SERVER-V11',mode:'PAPER',decision:{...currentDecision,direction:0,reason:preliminaryRisk.reason,evidence:currentDecision.evidence||[],contributors:currentDecision.contributors||[],coverage:currentDecision.coverage||0,confidence:currentDecision.confidence||0,score:currentDecision.score||0,asOf:currentDecision.asOf||new Date().toISOString()},modules:Array.isArray(current?.modules)?current.modules:[],paper:{capital:2000,riskPerTrade:10,maxTradesPerDay:3,maxPositions:3,positions,journal,opened:null},newsEvent:contract.summary,risk:preliminaryRisk};
   await put(env,STATE,blocked,3600);
   return blocked;
 }
 const out=await runCoreBot(env);
 const refreshedState=await get(env,'state/latest',baseState);
 const refreshedContract=newsContract(refreshedState?.news?.items||baseState?.news?.items||[]);
 const finalRisk=riskEngine({decision:out?.decision||{},positions:out?.paper?.positions||[],journal:out?.paper?.journal||[],eventRisk:{level:eventLevel(refreshedContract.summary),count:refreshedContract.summary.criticalCount}});
 const result={...out,version:'BOT-SERVER-V11',newsEvent:refreshedContract.summary,risk:finalRisk,limits:{...(out?.limits||{}),mode:'PAPER ONLY',riskEngine:'V1',newsEventEngine:'V1'}};
 await put(env,STATE,result,3600);
 return result;
}
export async function getBotDecision(env){const v=await get(env,STATE,null);return v||await getCoreDecision(env)}
