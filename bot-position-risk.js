/* Conservative risk verification for Alpaca long/short positions.
 * A position is verified only when one active native stop order covers its full
 * current quantity. Nested bracket/OCO legs are inspected; P&L is not used as risk.
 */
const n=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const ACTIVE=new Set(['new','accepted','pending_new','partially_filled']);
const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function flattenOrders(orders){const out=[];for(const order of Array.isArray(orders)?orders:[]){if(!order||typeof order!=='object')continue;out.push(order);for(const leg of Array.isArray(order.legs)?order.legs:[])if(leg&&typeof leg==='object')out.push(leg)}return out}
export function assessPositionRisk(positions=[],orders=[]){
 const allOrders=flattenOrders(orders);
 return(Array.isArray(positions)?positions:[]).map(position=>{
  const symbol=String(position?.symbol||''),qtyRaw=n(position?.qty),qty=Math.abs(qtyRaw||0),entry=n(position?.avg_entry_price),side=String(position?.side||(qtyRaw<0?'short':'long')).toLowerCase(),isLong=side!=='short';
  if(!symbol||!(qty>0)||!(entry>0))return{...position,risk:null,riskVerified:false,protectiveStop:null,riskVerificationReason:'Posizione priva di simbolo, quantità o prezzo medio valido.'};
  const candidates=allOrders.filter(order=>{
   const type=String(order?.type||'').toLowerCase(),orderSide=String(order?.side||'').toLowerCase(),status=String(order?.status||'').toLowerCase(),stop=n(order?.stop_price),orderQty=Math.abs(n(order?.remaining_qty)??n(order?.qty)??0);
   return norm(order?.symbol)===norm(symbol)&&orderSide===(isLong?'sell':'buy')&&ACTIVE.has(status)&&['stop','stop_limit'].includes(type)&&stop>0&&orderQty+1e-8>=qty;
  });
  const ranked=candidates.map(order=>({order,stop:n(order.stop_price)})).sort((a,b)=>isLong?b.stop-a.stop:a.stop-b.stop);
  const selected=ranked[0];
  if(!selected)return{...position,risk:null,riskVerified:false,protectiveStop:null,riskVerificationReason:'Nessun ordine stop attivo verificato copre l’intera quantità della posizione.'};
  const stop=selected.stop,risk=isLong?Math.max(0,(entry-stop)*qty):Math.max(0,(stop-entry)*qty);
  return{...position,risk:Number(risk.toFixed(2)),riskVerified:true,protectiveStop:stop,protectiveOrderId:selected.order.id||null,protectiveOrderQty:Math.abs(n(selected.order.remaining_qty)??n(selected.order.qty)??0),riskVerificationReason:'Stop nativo attivo verificato sulla quantità completa.'};
 });
}
