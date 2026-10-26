/* Miracolo Lab — autonomous PAPER execution. Equities during market hours, BTC/USD 24/7. */
import { runBot as analyzeBot } from './bot-server-engine-v15.js';
import { getCryptoDecision } from './bot-crypto-engine-v1.js';
import { executePaperDecision } from './bot-paper-executor-v1.js';
const STATE='state/latest';
async function read(env,key,f=null){try{const x=await env.ML_KV?.get(key);return x?JSON.parse(x):f}catch{return f}}
function pickSymbol(state){const rows=Array.isArray(state?.market?.indices)?state.market.indices:[];for(const s of ['SPY','QQQ','IWM']){const x=rows.find(r=>String(r?.ticker||'').toUpperCase()===s);if(x)return{symbol:s,price:Number(x.price||x.close||x.last)||null}}return null}
function cryptoAction(signal){if(!signal?.ok||signal.direction===0)return null;if(signal.direction>0&&signal.confidence>=68)return'BUY';return null}
export async function runAutoPaperBot(env){
 const result=await analyzeBot(env); if(!result?.ok)return result;
 const crypto=await getCryptoDecision(env);result.crypto=crypto;
 const state=await read(env,STATE,{}),equityInstrument=pickSymbol(state);
 const cryptoBuy=cryptoAction(crypto);
 const equityPortfolio=result.decision?.portfolio;
 const cryptoEligible=Boolean(cryptoBuy)&&String(env?.PAPER_CRYPTO_ENABLED??'true').toLowerCase()==='true';
 let action='HOLD',symbol=null,notional=Number(env.PAPER_NOTIONAL||100),reason='Nessun trade approvato.';
 if(cryptoEligible){action=cryptoBuy;symbol='BTC/USD';reason='BTC 24/7: segnale crypto sopra soglia.'}
 else if(equityPortfolio?.approved&&['BUY','SELL'].includes(String(equityPortfolio.action).toUpperCase())&&equityInstrument){action=String(equityPortfolio.action).toUpperCase();symbol=equityInstrument.symbol;reason=equityPortfolio.reason||'Portfolio Manager approva.'}
 else if(equityPortfolio?.approved&&['BUY','SELL'].includes(String(equityPortfolio.action).toUpperCase())&&!equityInstrument){reason='Segnale equity presente ma nessuno strumento equity disponibile.'}
 else{reason=crypto?.reason||equityPortfolio?.reason||'Nessuna condizione operativa sufficiente.'}
 result.botAction={action,symbol,reason,market:symbol==='BTC/USD'?'CRYPTO_24_7':'EQUITY'};
 if(action==='HOLD'||!symbol){result.execution={executed:false,mode:'PAPER',action:'HOLD',reason};result.status='READY';return result;}
 const amount=Math.min(200,Math.max(25,notional));
 const clientOrderId=`miracolo-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${symbol.replace('/','')}-${action.toLowerCase()}-${Math.floor(Date.now()/900000)}`.slice(0,48);
 try{result.execution=await executePaperDecision(env,{action,symbol,notional:amount,clientOrderId});}
 catch(e){result.execution={executed:false,mode:'PAPER',action,symbol,reason:String(e.message||e),error:true}}
 result.status=result.execution.executed?'PAPER_ORDER_SUBMITTED':'READY'; return result;
}
