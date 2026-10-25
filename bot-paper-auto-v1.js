/* Miracolo Lab — autonomous PAPER execution. Runs only after V15 Portfolio Manager approval. */
import { runBot as analyzeBot } from './bot-server-engine-v15.js';
import { executePaperDecision } from './bot-paper-executor-v1.js';
const STATE='state/latest';
async function read(env,key,f=null){try{const x=await env.ML_KV?.get(key);return x?JSON.parse(x):f}catch{return f}}
function pickSymbol(state){const rows=Array.isArray(state?.market?.indices)?state.market.indices:[];for(const s of ['SPY','QQQ','IWM']){const x=rows.find(r=>String(r?.ticker||'').toUpperCase()===s);if(x)return{symbol:s,price:Number(x.price||x.close||x.last)||null}}return null}
export async function runAutoPaperBot(env){
 const result=await analyzeBot(env); if(!result?.ok)return result;
 const p=result.decision?.portfolio;
 if(!p?.approved||!['BUY','SELL'].includes(String(p.action).toUpperCase())){result.execution={executed:false,mode:'PAPER',action:'HOLD',reason:p?.reason||'Portfolio Manager non approva.'};return result;}
 const state=await read(env,STATE,{}),instrument=pickSymbol(state);
 if(!instrument){result.execution={executed:false,mode:'PAPER',action:'HOLD',reason:'Nessuno strumento PAPER supportato disponibile.'};return result;}
 const action=String(p.action).toUpperCase();
 const notional=Math.min(200,Math.max(25,Number(env.PAPER_NOTIONAL||100)));
 const clientOrderId=`miracolo-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${instrument.symbol}-${action.toLowerCase()}-${Math.floor(Date.now()/900000)}`.slice(0,48);
 try{result.execution=await executePaperDecision(env,{action,symbol:instrument.symbol,notional,clientOrderId});}
 catch(e){result.execution={executed:false,mode:'PAPER',action,reason:String(e.message||e),error:true}}
 result.status=result.execution.executed?'PAPER_ORDER_SUBMITTED':'READY'; return result;
}
