/* Miracolo Lab — Alpaca Paper Trading adapter.
 * Server-side only: API credentials are Cloudflare secrets, never exposed to the browser.
 */
const DEFAULT_BASE='https://paper-api.alpaca.markets/v2';
const KEY='ALPACA_API_KEY';
const SECRET='ALPACA_API_SECRET';
const COUNT_PREFIX='alpaca/orders/';
function headers(env){
  const key=env?.[KEY], secret=env?.[SECRET];
  if(!key||!secret) throw new Error('Credenziali Alpaca mancanti: configura ALPACA_API_KEY e ALPACA_API_SECRET');
  return {'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json','Content-Type':'application/json'};
}
function base(env){return String(env?.ALPACA_BASE_URL||DEFAULT_BASE).replace(/\/$/,'');}
function out(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
async function call(env,path,options={}){
  const r=await fetch(base(env)+path,{...options,headers:{...headers(env),...(options.headers||{})}});
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data={raw:text}}
  if(!r.ok){const message=data?.message||data?.error||`Alpaca HTTP ${r.status}`;throw Object.assign(new Error(message),{status:r.status,data})}
  return data;
}
async function countToday(env){
  const day=new Date().toISOString().slice(0,10),key=COUNT_PREFIX+day;
  try{const raw=await env.ML_KV?.get(key);return Number(raw||0)}catch{return 0}
}
async function incrementToday(env){
  if(!env.ML_KV)return 0;
  const day=new Date().toISOString().slice(0,10),key=COUNT_PREFIX+day,n=await countToday(env)+1;
  await env.ML_KV.put(key,String(n),{expirationTtl:172800});
  return n;
}
function symbolFromPath(path){return decodeURIComponent(path.split('/').pop()||'').trim().toUpperCase()}
export async function alpacaStatus(env){
  const [account,clock]=await Promise.all([call(env,'/account'),call(env,'/clock')]);
  return {ok:true,mode:'PAPER',provider:'Alpaca',base:base(env),account,clock,ordersToday:await countToday(env)};
}
export async function alpacaRequest(request,env){
  const url=new URL(request.url),path=url.pathname;
  try{
    if(path==='/api/alpaca/status') return out(await alpacaStatus(env));
    if(path==='/api/alpaca/account' && request.method==='GET') return out({ok:true,mode:'PAPER',account:await call(env,'/account')});
    if(path==='/api/alpaca/clock' && request.method==='GET') return out({ok:true,mode:'PAPER',clock:await call(env,'/clock')});
    if(path==='/api/alpaca/positions' && request.method==='GET') return out({ok:true,mode:'PAPER',positions:await call(env,'/positions')});
    if(path==='/api/alpaca/orders' && request.method==='GET'){
      const qs=url.searchParams.toString();
      return out({ok:true,mode:'PAPER',orders:await call(env,'/orders'+(qs?'?'+qs:''))});
    }
    if(path==='/api/alpaca/orders' && request.method==='POST'){
      const max=Number(env.ALPACA_MAX_ORDERS_PER_DAY||3),used=await countToday(env);
      if(used>=max)return out({ok:false,error:`Limite paper giornaliero raggiunto (${max} ordini).`,ordersToday:used,maxOrdersPerDay:max},429);
      const body=await request.json();
      const allowed=['symbol','qty','notional','side','type','time_in_force','limit_price','stop_price','trail_price','trail_percent','extended_hours','client_order_id'];
      const order=Object.fromEntries(Object.entries(body||{}).filter(([k])=>allowed.includes(k)));
      if(!order.symbol||!order.side||!order.type||!order.time_in_force)return out({ok:false,error:'Ordine incompleto: symbol, side, type e time_in_force sono obbligatori.'},400);
      if(!order.qty&&!order.notional)return out({ok:false,error:'Specificare qty oppure notional.'},400);
      const result=await call(env,'/orders',{method:'POST',body:JSON.stringify(order)});
      const ordersToday=await incrementToday(env);
      return out({ok:true,mode:'PAPER',order:result,ordersToday,maxOrdersPerDay:max});
    }
    if(path.startsWith('/api/alpaca/positions/') && request.method==='DELETE'){
      const symbol=symbolFromPath(path);
      if(!symbol)return out({ok:false,error:'Simbolo mancante.'},400);
      const result=await call(env,'/positions/'+encodeURIComponent(symbol),{method:'DELETE'});
      const ordersToday=await incrementToday(env);
      return out({ok:true,mode:'PAPER',result,ordersToday});
    }
    return null;
  }catch(e){
    return out({ok:false,mode:'PAPER',provider:'Alpaca',error:String(e.message||e),details:e.data||null},e.status||502);
  }
}
