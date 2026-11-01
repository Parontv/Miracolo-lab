/* Miracolo Lab — read-only research council inspired by multi-agent research workflows.
 * PAPER-only advisory output. This module cannot submit, modify, or cancel orders.
 * It reuses existing server decision modules and keeps correlated evidence grouped.
 */
const labelDirection=d=>d>0?'LONG':d<0?'SHORT':'NEUTRAL';
const get=(modules,family)=>modules.find(x=>x?.family===family)||null;
function analyst(name,role,items){
 const usable=items.filter(Boolean),votes=usable.filter(x=>x.dataAvailable&&x.direction!==0);
 const weight=votes.reduce((s,x)=>s+(Number(x.weight)||0),0);
 const score=weight?votes.reduce((s,x)=>x.direction*(Number(x.strength)||1)*(Number(x.confidence)||50)/100*(Number(x.weight)||0)+s,0)/weight:0;
 const coverage=usable.length?usable.filter(x=>x.dataAvailable).length/usable.length:0;
 const direction=Math.abs(score)<.12?0:Math.sign(score);
 return{name,role,direction,stance:labelDirection(direction),score:Number(score.toFixed(3)),confidence:votes.length?Math.round(votes.reduce((s,x)=>s+(Number(x.confidence)||0),0)/votes.length):0,coverage:Number(coverage.toFixed(2)),sources:usable.map(x=>x.family),evidence:usable.flatMap(x=>Array.isArray(x.evidence)?x.evidence:[]).slice(0,5),status:votes.length?'CONTRIBUTING':'INSUFFICIENT_DATA'};
}
export function buildResearchCouncil(modules=[],decision=null,risk=null){
 const market=analyst('Market Analyst','Market breadth and price regime',[get(modules,'market'),get(modules,'historical')]);
 const technical=analyst('Technical Analyst','Price action and technical indicators',[get(modules,'technical')]);
 const news=analyst('News Analyst','News flow and event risk',[get(modules,'news')]);
 const macro=analyst('Macro Analyst','Rates, inflation and macro conditions',[get(modules,'macro')]);
 const crypto=analyst('Crypto Analyst','BTC market context (informational)',[get(modules,'crypto')]);
 const analysts=[market,technical,news,macro,crypto];
 const active=analysts.filter(x=>x.status==='CONTRIBUTING');
 const bullish=active.filter(x=>x.direction>0).length,bearish=active.filter(x=>x.direction<0).length;
 const stance=bullish===bearish?'MIXED':bullish>bearish?'BULLISH':'BEARISH';
 const conflicts=bullish>0&&bearish>0;
 return{
  version:1,mode:'ADVISORY_ONLY',generatedAt:new Date().toISOString(),
  title:'Research Council',analysts,
  synthesis:{stance:active.length?stance:'INSUFFICIENT_DATA',activeAnalysts:active.length,bullish,bearish,conflicts,consensusDirection:decision?.direction??0,consensusScore:decision?.score??0,summary:conflicts?'Gli analisti presentano evidenze contrastanti: mantenere prudenza e verificare le fonti.':active.length?'Il quadro consultivo è '+stance.toLowerCase()+'; non costituisce un ordine.':'Copertura insufficiente per una sintesi affidabile.'},
  riskReview:{status:risk?.allowed?'GUARDRAILS_PASS':'GUARDRAILS_BLOCK_OR_WAIT',allowedForPaper:risk?.allowed===true,flags:Array.isArray(risk?.flags)?risk.flags:[],reason:risk?.reason||'Risk review non disponibile.'},
  limitations:['Analisti derivati dai moduli attuali; non sono agenti LLM indipendenti.','Market e historical condividono evidenze correlate e non contano come due fonti indipendenti.','Output consultivo: non modifica consenso, rischio o ordini.']
 };
}
