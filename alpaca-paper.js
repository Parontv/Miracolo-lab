/* Miracolo Lab — Alpaca Paper Trading adapter. */
const DEFAULT_BASE='https://paper-api.alpaca.markets/v2';
const KEY='ALPACA_API_KEY';
const SECRET='ALPACA_API_SECRET';
function headers(env){const key=env?.[KEY],secret=env?.[SECRET];if(!key||!secret)throw new Error('Credenziali Alpaca mancanti: configura ALPACA_API_KEY e ALPACA_API_SECRET');return{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json','Content-Type':'application/json'};}
function base(env){const b=String(env?.ALPACA_BASE_URL||DEFAULT_BASE).replace(/\/$/,'');if(b!==DEFAULT_BASE)throw new Error('Sicurezza: Miracolo accetta esclusivamente Alpaca Paper Trading.');return b;}
function out(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
async function call(env,path,options={}){const r=await fetch(base(env)+path,{...options,headers:{...headers(env),...(options.headers||{})}});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={raw:text}}if(!r.ok){const message=data?.message||data?.error||`Alpaca HTTP ${r.status}`;throw Object.assign(new Error(message),{status:r.status,data})}return data;}
function symbolFromPath(path){return decodeURIComponent(path.split('/').pop()||'').trim().toUpperCase()}
function sameOriginOrder(request){const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin}
export async function alpacaStatus(env){const[account,clock]=await Promise.all([call(env,'/account'),call(env,'/clock')]);return{ok:true,mode:'PAPER',provider:'Alpaca',base:base(env),account,clock,autoExecution:String(env?.PAPER_AUTO_EXECUTION??'true').toLowerCase()==='true'};}
export async function alpacaPositions(env){return call(env,'/positions');}
export async function alpacaOrders(env,query=''){return call(env,'/orders'+(query?`?${query}`:''));}
export async function alpacaRequest(request,env){const url=new URL(request.url),path=url.pathname;try{
 if(path==='/api/alpaca/status')return out(await alpacaStatus(env));
 if(path==='/api/alpaca/account'&&request.method==='GET')return out({ok:true,mode:'PAPER',account:await call(env,'/account')});
 if(path==='/api/alpaca/clock'&&request.method==='GET')return out({ok:true,mode:'PAPER',clock:await call(env,'/clock')});
 if(path==='/api/alpaca/positions'&&request.method==='GET')return out({ok:true,mode:'PAPER',positions:await call(env,'/positions')});
 if(path==='/api/alpaca/orders'&&request.method==='GET'){const qs=url.searchParams.toString();return out({ok:true,mode:'PAPER',orders:await call(env,'/orders'+(qs?'?'+qs:''))});}
 if(path==='/api/alpaca/orders'&&request.method==='POST'){
  if(env.BOT_MODE!=='PAPER')return out({ok:false,error:'Ordini disabilitati: BOT_MODE non è PAPER.'},403);
  if(!sameOriginOrder(request))return out({ok:false,error:'Ordine rifiutato: origine non autorizzata.'},403);
  if(request.headers.get('X-Miracolo-Paper-Confirm')!=='PAPER')return out({ok:false,error:'Conferma PAPER mancante.'},400);
  const body=await request.json(),allowed=['symbol','qty','notional','side','type','time_in_force','limit_price','stop_price','trail_price','trail_percent','extended_hours','client_order_id'];
  const order=Object.fromEntries(Object.entries(body||{}).filter(([k])=>allowed.includes(k)));
  if(!order.symbol||!['buy','sell'].includes(String(order.side).toLowerCase())||!order.type||!order.time_in_force)return out({ok:false,error:'Ordine incompleto: symbol, side, type e time_in_force sono obbligatori.'},400);
  if(!order.qty&&!order.notional)return out({ok:false,error:'Specificare qty oppure notional.'},400);
  const result=await call(env,'/orders',{method:'POST',body:JSON.stringify(order)});return out({ok:true,mode:'PAPER',order:result});
 }
 if(path.startsWith('/api/alpaca/positions/')&&request.method==='DELETE'){if(!sameOriginOrder(request)||request.headers.get('X-Miracolo-Paper-Confirm')!=='PAPER')return out({ok:false,error:'Operazione PAPER non autorizzata.'},403);const symbol=symbolFromPath(path);if(!symbol)return out({ok:false,error:'Simbolo mancante.'},400);const result=await call(env,'/positions/'+encodeURIComponent(symbol),{method:'DELETE'});return out({ok:true,mode:'PAPER',result});}
 return null;
}catch(e){return out({ok:false,mode:'PAPER',provider:'Alpaca',error:String(e.message||e),details:e.data||null},e.status||502)}}
