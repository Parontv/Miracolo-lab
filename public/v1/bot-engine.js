/* Miracolo Lab — Bot client controller v3
 * The Worker is the only decision maker. This file only starts a PAPER scan,
 * normalizes server module evidence for the existing consultable UI, and emits one event.
 */
(()=>{
'use strict';
const JOURNAL='mlBotJournal';
const params={capital:2000,risk:10,maxTradesPerDay:3,minConfidence:65};
function localJournal(){try{const x=JSON.parse(localStorage.getItem(JOURNAL)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function emit(detail){window.ML_BOT_DECISION=detail;window.dispatchEvent(new CustomEvent('miracolo:botdecision',{detail}));return detail}
function normalize(result){
 if(!result||!result.decision)return result;
 const modules=Array.isArray(result.modules)?result.modules:[];
 return {...result,decision:{...result.decision,evidence:modules,explanationEvidence:result.decision.evidence||[]}};
}
async function request(path,options={}){const response=await fetch(path+(path.includes('?')?'&':'?')+'ts='+Date.now(),{cache:'no-store',...options,headers:{Accept:'application/json',...(options.headers||{})}});let data=null;try{data=await response.json()}catch{data={}}if(!response.ok)throw Error(data?.message||data?.error||`HTTP ${response.status}`);return data}
async function run(){
 if(window.__mlBotBusy)return window.ML_BOT_DECISION||null;
 window.__mlBotBusy=true;
 emit({mode:'PAPER',status:'RUNNING',action:'WAIT',confidence:0,reason:'Scansione completa in corso…',asOf:new Date().toISOString()});
 try{
  const result=normalize(await request('/api/bot/run',{method:'POST'}));
  return emit(result);
 }catch(error){
  return emit({mode:'PAPER',status:'ERROR',action:'WAIT',confidence:0,reason:`Scansione non completata: ${error.message||error}`,asOf:new Date().toISOString(),paper:{capital:params.capital,riskPerTrade:params.risk,maxTradesPerDay:params.maxTradesPerDay,positions:[],journal:localJournal()}});
 }finally{window.__mlBotBusy=false}
}
async function load(){try{return emit(normalize(await request('/api/bot/decision')))}catch{return null}}
window.MiracoloBot={run,load,journal:localJournal,params};
window.MiracoloOperationalBot=window.MiracoloBot;
})();
