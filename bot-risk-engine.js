/* Miracolo Lab — deterministic risk guardrails, PAPER only. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const n=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
export function riskEngine({decision,positions=[],journal=[],eventRisk={level:'NORMAL',count:0},capital=2000,riskPerTrade=10,maxTradesPerDay=null,maxPositions=3,now=new Date()}){
 const day=now.toISOString().slice(0,10),tradesToday=(journal||[]).filter(x=>String(x.time||'').slice(0,10)===day).length;
 const exposure=(positions||[]).reduce((s,p)=>s+Math.abs(n(p.notional)||0),0),riskBudget=(positions||[]).reduce((s,p)=>s+(n(p.risk)||0),0),eventLevel=String(eventRisk?.level||'NORMAL').toUpperCase(),flags=[];
 if(eventLevel==='CRITICAL')flags.push('EVENT_CRITICAL');
 if(maxPositions!=null&&(positions||[]).length>=maxPositions)flags.push('POSITION_LIMIT');
 if(riskBudget>=capital*.02)flags.push('RISK_BUDGET_LIMIT');
 if(exposure>=capital*.9)flags.push('EXPOSURE_LIMIT');
 const aiRisk=decision?.contributors?.some(x=>x.family==='ai'&&x.riskFlag);if(aiRisk)flags.push('AI_RISK_VETO');
 const allowed=Boolean(decision?.direction)&&Number(decision?.confidence)>=65&&flags.length===0;
 return{mode:'PAPER',allowed,flags,level:flags.length?'RESTRICTED':'NORMAL',capital,riskPerTrade,maxTradesPerDay,maxPositions,tradesToday,openPositions:(positions||[]).length,exposure,riskBudget,eventRisk:eventLevel,score:clamp(Number(decision?.score)||0,-1,1),reason:flags.length?`Ingresso bloccato: ${flags.join(', ')}`:'Guardrail superati; eventuale ordine resta PAPER.'};
}
