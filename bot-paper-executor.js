/* Miracolo Lab — autonomous PAPER execution guard. Never routes to live Alpaca. */
const PAPER_BASE='https://paper-api.alpaca.markets/v2';
const keyOf=env=>env?.ALPACA_API_KEY;
const secretOf=env=>env?.ALPACA_API_SECRET;
const cooldownKey=s=>`alpaca/cooldown/${String(s||'').toUpperCase()}`;
const dailyKey=()=>`alpaca/daily-buys/${new Date().toISOString().slice(0,10)}`;
const now=()=>Date.now();
async function cooldownUntil(env,symbol){try{return Number(await env.ML_KV?.get(cooldownKey(symbol))||0)}catch{return 0}}
async function setCooldown(env,symbol,minutes=60){if(env.ML_KV)await env.ML_KV.put(cooldownKey(symbol),String(now()+minutes*60000),{expirationTtl:Math.max(3600,minutes*60+600)})}
async function dailyBuys(env){try{return Number(await env.ML_KV?.get(dailyKey())||0)}catch{return 0}}
async function incrementDailyBuys(env){if(!env.ML_KV)return;const key=dailyKey(),value=(await dailyBuys(env))+1;await env.ML_KV.put(key,String(value),{expirationTtl:172800})}
async function alpaca(env,path,options={}){if(env?.BOT_MODE!=='PAPER')throw new Error('PAPER execution blocked: BOT_MODE must be PAPER.');if(String(env?.PAPER_AUTO_EXECUTION??'true').toLowerCase()!=='true')throw new Error('PAPER auto execution disabled.');if(!keyOf(env)||!secretOf(env))throw new Error('Alpaca Paper credentials missing.');const base=String(env?.ALPACA_BASE_URL||PAPER_BASE).replace(/\/$/,'');if(base!==PAPER_BASE)throw new Error('Safety block: only Alpaca Paper endpoint is allowed.');const r=await fetch(base+path,{...options,headers:{'APCA-API-KEY-ID':keyOf(env),'APCA-API-SECRET-KEY':secretOf(env),'Content-Type':'application/json','Accept':'application/json'}});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={raw:text}}if(!r.ok)throw Object.assign(new Error(data?.message||data?.error||`Alpaca HTTP ${r.status}`),{status:r.status,data});return data}
export async function executePaperDecision(env,{action,symbol,notional,clientOrderId}){
 const normalized=String(action||'HOLD').toUpperCase(),ticker=String(symbol||'').trim().toUpperCase(),isCrypto=ticker.includes('/');
 if(!['BUY','SELL'].includes(normalized))return{executed:false,mode:'PAPER',action:'HOLD',reason:'Nessun ordine richiesto.'};
 if(!ticker)return{executed:false,mode:'PAPER',action:'HOLD',reason:'Simbolo mancante.'};
 const cooldown=await cooldownUntil(env,ticker);if(cooldown>now())return{executed:false,mode:'PAPER',action:normalized,symbol:ticker,reason:`Cooldown attivo su ${ticker}.`,retryAt:new Date(cooldown).toISOString()};
 const existing=await alpaca(env,'/positions');
 const pos=Array.isArray(existing)?existing.find(p=>String(p.symbol).toUpperCase()===ticker):null;
 if(normalized==='BUY'&&pos&&Number(pos.qty)>0)return{executed:false,mode:'PAPER',action:'BUY',symbol:ticker,reason:`Posizione ${ticker} già aperta.`,position:pos};
 if(normalized==='SELL'&&pos&&Number(pos.qty)>0){const closed=await alpaca(env,`/positions/${encodeURIComponent(ticker)}`,{method:'DELETE'});await setCooldown(env,ticker,isCrypto?30:60);return{executed:true,mode:'PAPER',action:'SELL',symbol:ticker,reason:'Chiusura della posizione PAPER eseguita automaticamente.',order:closed};}
 if(normalized==='SELL'&&!pos)return{executed:false,mode:'PAPER',action:'SELL',symbol:ticker,reason:`Nessuna posizione ${ticker} da chiudere.`};
 const maxDaily=Math.max(1,Number(env?.PAPER_MAX_BUYS_PER_DAY||3));
 const usedToday=await dailyBuys(env);
 if(usedToday>=maxDaily)return{executed:false,mode:'PAPER',action:'BUY',symbol:ticker,reason:`Limite giornaliero PAPER raggiunto (${maxDaily} ingressi).`,dailyBuys:usedToday};
 const openOrders=await alpaca(env,'/orders?status=open&limit=50&direction=desc');
 const duplicate=Array.isArray(openOrders)&&openOrders.some(o=>String(o.client_order_id||'')===String(clientOrderId||''));
 if(duplicate)return{executed:false,mode:'PAPER',action:'BUY',symbol:ticker,reason:'Ordine PAPER già aperto per questa decisione.',duplicate:true};
 const amount=Math.max(25,Math.min(Number(notional)||100,isCrypto?200:200));
 const order=await alpaca(env,'/orders',{method:'POST',body:JSON.stringify({symbol:ticker,notional:amount,side:'buy',type:'market',time_in_force:isCrypto?'gtc':'day',client_order_id:clientOrderId})});
 await setCooldown(env,ticker,isCrypto?60:60);await incrementDailyBuys(env);
 return{executed:true,mode:'PAPER',action:'BUY',symbol:ticker,notional:amount,timeInForce:isCrypto?'gtc':'day',order,dailyBuys:usedToday+1};
}
