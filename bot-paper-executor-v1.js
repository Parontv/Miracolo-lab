/* Miracolo Lab — autonomous PAPER execution guard. Never routes to live Alpaca. */
const PAPER_BASE='https://paper-api.alpaca.markets/v2';
const keyOf=env=>env?.ALPACA_API_KEY;
const secretOf=env=>env?.ALPACA_API_SECRET;
const day=()=>new Date().toISOString().slice(0,10);
async function count(env){try{return Number(await env.ML_KV?.get(`alpaca/orders/${day()}`)||0)}catch{return 0}}
async function inc(env){if(!env.ML_KV)return 0;const n=await count(env)+1;await env.ML_KV.put(`alpaca/orders/${day()}`,String(n),{expirationTtl:172800});return n}
async function alpaca(env,path,options={}){if(env?.BOT_MODE!=='PAPER')throw new Error('PAPER execution blocked: BOT_MODE must be PAPER.');if(String(env?.PAPER_AUTO_EXECUTION??'true').toLowerCase()!=='true')throw new Error('PAPER auto execution disabled.');if(!keyOf(env)||!secretOf(env))throw new Error('Alpaca Paper credentials missing.');const base=String(env?.ALPACA_BASE_URL||PAPER_BASE).replace(/\/$/,'');if(base!==PAPER_BASE)throw new Error('Safety block: only Alpaca Paper endpoint is allowed.');const r=await fetch(base+path,{...options,headers:{'APCA-API-KEY-ID':keyOf(env),'APCA-API-SECRET-KEY':secretOf(env),'Content-Type':'application/json','Accept':'application/json'}});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={raw:text}}if(!r.ok)throw Object.assign(new Error(data?.message||data?.error||`Alpaca HTTP ${r.status}`),{status:r.status,data});return data}
export async function executePaperDecision(env,{action,symbol,notional,clientOrderId}){
 const normalized=String(action||'HOLD').toUpperCase();
 if(!['BUY','SELL'].includes(normalized))return{executed:false,mode:'PAPER',action:'HOLD',reason:'Nessun ordine richiesto.'};
 const max=Number(env?.ALPACA_MAX_ORDERS_PER_DAY||3),used=await count(env);if(used>=max)return{executed:false,mode:'PAPER',action:normalized,reason:`Limite giornaliero ${max} raggiunto.`,ordersToday:used};
 const existing=await alpaca(env,'/positions');
 const pos=Array.isArray(existing)?existing.find(p=>String(p.symbol).toUpperCase()===String(symbol).toUpperCase()):null;
 if(normalized==='BUY'&&pos&&Number(pos.qty)>0)return{executed:false,mode:'PAPER',action:'BUY',reason:`Posizione ${symbol} già aperta.`,position:pos};
 if(normalized==='SELL'&&pos&&Number(pos.qty)>0){const closed=await alpaca(env,`/positions/${encodeURIComponent(symbol)}`,{method:'DELETE'});const ordersToday=await inc(env);return{executed:true,mode:'PAPER',action:'SELL',symbol,reason:'Chiusura della posizione PAPER eseguita automaticamente.',order:closed,ordersToday};}
 if(normalized==='SELL'&&!pos)return{executed:false,mode:'PAPER',action:'SELL',reason:`Nessuna posizione ${symbol} da chiudere.`};
 const openOrders=await alpaca(env,'/orders?status=open&limit=50&direction=desc');
 const duplicate=Array.isArray(openOrders)&&openOrders.some(o=>String(o.client_order_id||'')===String(clientOrderId||''));
 if(duplicate)return{executed:false,mode:'PAPER',action:'BUY',symbol,reason:'Ordine PAPER già aperto per questa decisione.',duplicate:true};
 const amount=Math.max(25,Math.min(Number(notional)||100,200));
 const order=await alpaca(env,'/orders',{method:'POST',body:JSON.stringify({symbol:String(symbol).toUpperCase(),notional:amount,side:'buy',type:'market',time_in_force:'day',client_order_id:clientOrderId})});
 const ordersToday=await inc(env);return{executed:true,mode:'PAPER',action:'BUY',symbol:String(symbol).toUpperCase(),notional:amount,order,ordersToday};
}
