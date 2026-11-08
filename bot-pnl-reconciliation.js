/* Reconcile Alpaca cumulative order fills into conservative gross realized P&L.
 * Uses weighted-average long inventory. Missing or truncated history yields UNKNOWN,
 * never a fabricated zero. Fees, slippage and tax are intentionally excluded.
 */
const num=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const timestamp=o=>Date.parse(o?.filled_at||o?.updated_at||o?.submitted_at||o?.created_at||'')||0;
export function reconcileFilledOrders(orders,{limit=500}={}){
 const list=Array.isArray(orders)?orders:[];
 const historyComplete=list.length<limit;
 const inventory=new Map(),byOrderId=new Map();
 const sorted=[...list].filter(o=>o?.id&&num(o.filled_qty)>0).sort((a,b)=>timestamp(a)-timestamp(b));
 let processedFills=0;
 for(const order of sorted){
  const id=String(order.id),symbol=String(order.symbol||'').toUpperCase(),side=String(order.side||'').toLowerCase();
  const qty=num(order.filled_qty),price=num(order.filled_avg_price);
  if(!symbol||!(qty>0)||!['buy','sell'].includes(side))continue;
  processedFills++;
  let inv=inventory.get(symbol);
  if(!inv){inv={qty:0,cost:0,known:true};inventory.set(symbol,inv)}
  let realizedGross=null,realizedStatus='NOT_AN_EXIT';
  if(side==='buy'){
   if(!(price>0)){inv.qty+=qty;inv.cost=0;inv.known=false}
   else if(inv.known){inv.cost+=qty*price;inv.qty+=qty}
   else inv.qty+=qty;
  }else{
   if(!historyComplete)realizedStatus='HISTORY_TRUNCATED';
   else if(!(price>0))realizedStatus='MISSING_FILL_PRICE';
   else if(!inv.known)realizedStatus='UNKNOWN_COST_BASIS';
   else if(inv.qty+1e-10<qty){realizedStatus='INSUFFICIENT_RECONCILED_INVENTORY';inv.known=false;inv.qty=Math.max(0,inv.qty-qty);inv.cost=0}
   else{
    const averageCost=inv.cost/inv.qty;
    realizedGross=Number(((price-averageCost)*qty).toFixed(6));
    realizedStatus='GROSS_WEIGHTED_AVERAGE';
    inv.qty-=qty;inv.cost-=averageCost*qty;
    if(inv.qty<1e-10){inv.qty=0;inv.cost=0;inv.known=true}
   }
   if(realizedGross===null&&inv.known&&inv.qty>=qty){inv.qty-=qty;inv.cost=inv.qty>0?inv.cost:0;if(inv.qty<1e-10){inv.qty=0;inv.cost=0;inv.known=true}}
  }
  byOrderId.set(id,{realizedGross,realizedStatus,fillQty:qty,fillPrice:price,side,symbol});
 }
 return{byOrderId,historyComplete,processedFills};
}
