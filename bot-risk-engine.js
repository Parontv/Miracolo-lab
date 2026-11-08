/* Miracolo Lab — deterministic risk guardrails, PAPER only. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const n=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const ACTIVE_ORDER_STATUSES=new Set(['new','accepted','pending_new','partially_filled','filled','pending_replace','held']);
function countTradesToday(journal,day){
 const seen=new Set();let count=0;
 for(const x of journal||[]){
  if(String(x.time||'').slice(0,10)!==day)continue;
  const status=String(x.status||'').toLowerCase();
  if(status&&!ACTIVE_ORDER_STATUSES.has(status))continue;
  const groupRole=String(x.groupRole||x.group_role||'').toLowerCase(),isProtectiveLeg=['take_profit','stop_loss'].includes(groupRole)||Boolean(x.parentOrderId||x.parent_order_id);
  if(isProtectiveLeg&&!['partially_filled','filled'].includes(status))continue;
  const id=x.orderId||x.clientOrderId;
  if(id){if(seen.has(String(id)))continue;seen.add(String(id));}
  count++;
 }
 return count;
}
export function riskEngine({decision,positions=[],journal=[],eventRisk={level:'NORMAL',count:0},capital=2000,riskPerTrade=8,stopLossPct=1.5,maxTradesPerDay=null,maxPositions=3,now=new Date()}){
 const day=now.toISOString().slice(0,10),tradesToday=countTradesToday(journal,day);
 const exposure=(positions||[]).reduce((s,p)=>s+Math.abs(n(p.notional)||0),0);
 const verifiedPositions=(positions||[]).filter(p=>p.riskVerified===true&&n(p.risk)!==null);
 const unknownRiskPositions=(positions||[]).filter(p=>p.riskVerified!==true||n(p.risk)===null);
 const riskBudget=verifiedPositions.reduce((s,p)=>s+Math.max(0,n(p.risk)||0),0);
 const eventLevel=String(eventRisk?.level||'NORMAL').toUpperCase(),flags=[];
 if(eventLevel==='CRITICAL')flags.push('EVENT_CRITICAL');
 if(maxPositions!=null&&(positions||[]).length>=maxPositions)flags.push('POSITION_LIMIT');
 if(maxTradesPerDay!=null&&tradesToday>=Number(maxTradesPerDay))flags.push('DAILY_TRADE_LIMIT');
 if(unknownRiskPositions.length)flags.push('EXISTING_POSITION_RISK_UNKNOWN');
 if(riskBudget>=capital*.02)flags.push('RISK_BUDGET_LIMIT');
 if(exposure>=capital*.9)flags.push('EXPOSURE_LIMIT');
 const aiRisk=decision?.contributors?.some(x=>x.family==='ai'&&x.riskFlag);if(aiRisk)flags.push('AI_RISK_VETO');
 const direction=Number(decision?.direction)||0,confidence=Number(decision?.confidence)||0;
 const signal=Boolean(direction)&&confidence>=65;
 const stopPct=clamp(n(stopLossPct)??1.5,.1,20);
 const riskUsd=Math.max(0,n(riskPerTrade)??8);
 const maxNotionalUsd=Number((riskUsd/(stopPct/100)).toFixed(2));
 const allowed=signal&&(direction<0||flags.length===0);
 const reason=!signal?'Segnale insufficiente.':direction<0?'Uscita consentita: i limiti di ingresso non bloccano la riduzione del rischio.':flags.length?'Ingresso bloccato: '+flags.join(', '):'Guardrail superati; ingresso PAPER dimensionato sul rischio.';
 return{mode:'PAPER',allowed,flags,level:flags.length?'RESTRICTED':'NORMAL',capital,riskPerTradeUsd:riskUsd,stopLossPct:stopPct,maxNotionalUsd,modeledStopRiskUsd:Number((maxNotionalUsd*stopPct/100).toFixed(2)),maxTradesPerDay,maxPositions,tradesToday,openPositions:(positions||[]).length,unknownRiskPositions:unknownRiskPositions.length,exposure,riskBudget,eventRisk:eventLevel,score:clamp(Number(decision?.score)||0,-1,1),reason};
}
