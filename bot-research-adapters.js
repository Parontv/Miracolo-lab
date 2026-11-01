/* Miracolo Lab — external research adapter contracts.
 * Framework-inspired integrations are read-only and normalized before they reach
 * the existing decision engine. No adapter is allowed to submit or manage orders.
 */
const ADAPTERS = Object.freeze([
  { id:'tradingagents', name:'TradingAgents', role:'multi-agent research debate', mode:'INSPIRED_ADAPTER', status:'INTERNAL', execution:false },
  { id:'vibe-trading', name:'Vibe Trading', role:'signal and strategy research', mode:'INSPIRED_ADAPTER', status:'INTERNAL', execution:false },
  { id:'ai-hedge-fund', name:'AI Hedge Fund', role:'portfolio thesis and analyst perspectives', mode:'INSPIRED_ADAPTER', status:'INTERNAL', execution:false },
  { id:'daily-stock-analysis', name:'Daily Stock Analysis', role:'daily market/company research', mode:'SOURCE_ADAPTER', status:'PLANNED', execution:false },
  { id:'anthropic-financial-services', name:'Anthropic Financial Services', role:'tool-use and financial research patterns', mode:'PATTERN_ADAPTER', status:'PLANNED', execution:false },
  { id:'freqtrade', name:'Freqtrade', role:'backtesting research reference', mode:'BACKTEST_ADAPTER', status:'PLANNED', execution:false },
  { id:'day-trader-skill', name:'Day Trader Skill', role:'trading workflow and risk checklist', mode:'SKILL_ADAPTER', status:'INTERNAL', execution:false },
  { id:'llm-trading-lab', name:'LLM Trading Lab', role:'LLM experiment and evaluation patterns', mode:'EVALUATION_ADAPTER', status:'PLANNED', execution:false }
]);

const safeText=(v,max=240)=>String(v??'').replace(/[\\u0000-\\u001f]/g,' ').slice(0,max);
export function listResearchAdapters(){
  return ADAPTERS.map(x=>({...x,readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false}));
}
export function normalizeResearchAdapterResult(adapterId,result={}){
  const adapter=ADAPTERS.find(x=>x.id===adapterId);
  if(!adapter)return {status:'REJECTED',reason:'Adapter non riconosciuto.',readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
  const items=Array.isArray(result.items)?result.items.slice(0,20).map(x=>({
    title:safeText(x?.title,160),summary:safeText(x?.summary,500),
    source:safeText(x?.source,120),url:safeText(x?.url,500),
    publishedAt:safeText(x?.publishedAt,40),confidence:Number.isFinite(Number(x?.confidence))?Math.max(0,Math.min(100,Number(x.confidence))):null
  })): [];
  return {adapterId,adapterName:adapter.name,status:result.status==='ok'?'ok':'NO_DATA',
    collectedAt:safeText(result.collectedAt||new Date().toISOString(),40),items,
    warnings:Array.isArray(result.warnings)?result.warnings.slice(0,5).map(x=>safeText(x,180)):[],
    readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
}

// Internal Vibe Trading-inspired read-only strategy lens over existing module outputs.
export function runVibeTradingAdapter(modules=[]){
  const byFamily=new Map((Array.isArray(modules)?modules:[]).map(x=>[x.family,x]));
  const pick=['market','technical','news','flow','macro'].map(id=>byFamily.get(id)).filter(x=>x&&x.dataAvailable!==false&&Number.isFinite(Number(x.direction)));
  if(pick.length<3)return {adapterId:'vibe-trading',status:'INSUFFICIENT_DATA',reason:'Servono almeno 3 famiglie di dati valide.',readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
  const bullish=pick.filter(x=>Number(x.direction)>0).length,bearish=pick.filter(x=>Number(x.direction)<0).length,neutral=pick.length-bullish-bearish;
  const spread=Math.abs(bullish-bearish)/pick.length;
  const stance=spread<.2?'MIXED':bullish>bearish?'BULLISH':'BEARISH';
  const sorted=[...pick].sort((a,b)=>Number(b.confidence||0)-Number(a.confidence||0));
  return {adapterId:'vibe-trading',adapterName:'Vibe Trading · internal strategy lens',status:'ok',stance,confidence:Math.round(spread*100),coverage:pick.length/5,summary:`Lettura ${stance.toLowerCase()}: ${bullish} famiglie positive, ${bearish} negative, ${neutral} neutrali su ${pick.length} disponibili.`,evidence:sorted.slice(0,5).map(x=>({family:safeText(x.family,40),direction:Number(x.direction),confidence:Math.max(0,Math.min(100,Number(x.confidence)||0))})),readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
}
/* AI Hedge Fund-inspired analyst synthesis. Existing modules only; no portfolio/order authority. */
export function runAIHedgeFundAdapter(modules=[],decision=null){
 const byFamily=new Map((Array.isArray(modules)?modules:[]).map(x=>[x.family,x]));
 const defs=[{id:'fundamental',label:'Macro & news analyst',families:['macro','news']},{id:'technical',label:'Technical analyst',families:['technical','market','historical']},{id:'flow',label:'Market flow analyst',families:['flow','crypto']},{id:'risk',label:'Risk reviewer',families:[]}];
 const analysts=defs.map(a=>{const ev=a.families.map(k=>byFamily.get(k)).filter(x=>x&&x.dataAvailable!==false);const dir=ev.filter(x=>Number(x.direction)!==0);const net=dir.reduce((s,x)=>s+Math.sign(Number(x.direction))*Math.max(.1,Number(x.confidence||50)/100),0);const stance=!dir.length?'NEUTRAL':net>0?'BULLISH':net<0?'BEARISH':'MIXED';return{id:a.id,label:a.label,stance,coverage:ev.length,summary:ev.length?dir.length+' segnali direzionali su '+ev.length+' evidenze disponibili.':'Evidenze insufficienti.',evidence:ev.map(x=>({family:safeText(x.family,40),direction:Number(x.direction)||0,confidence:Math.max(0,Math.min(100,Number(x.confidence)||0))}))};});
 const votes=analysts.filter(x=>x.id!=='risk'&&x.stance!=='NEUTRAL');const bull=votes.filter(x=>x.stance==='BULLISH').length,bear=votes.filter(x=>x.stance==='BEARISH').length;const consensus=bull===bear?'MIXED':bull>bear?'BULLISH':'BEARISH';
 const risk=decision?.portfolio?.approved===true?'RISK_GATE_APPROVED':decision?.portfolio?.approved===false?'RISK_GATE_BLOCKED':'RISK_GATE_UNKNOWN';analysts[3].stance=risk;analysts[3].summary='Riepilogo del risk gate già calcolato dal motore; nessun override.';
 return{adapterId:'ai-hedge-fund',adapterName:'AI Hedge Fund · analyst synthesis',status:votes.length>=2?'ok':'INSUFFICIENT_DATA',consensus,analysts,summary:'Sintesi consultiva: '+bull+' prospettive rialziste, '+bear+' ribassiste. Risk gate: '+risk+'.',readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
}

/* Daily Stock Analysis-inspired daily brief, strictly derived from current engine evidence. */
export function runDailyStockAnalysisAdapter(modules=[]){
 const relevant=(Array.isArray(modules)?modules:[]).filter(x=>['market','news','macro','technical'].includes(x.family)&&x.dataAvailable!==false);
 if(relevant.length<2)return{adapterId:'daily-stock-analysis',status:'INSUFFICIENT_DATA',reason:'Servono almeno due famiglie di evidenze valide.',readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
 const positives=relevant.filter(x=>Number(x.direction)>0),negatives=relevant.filter(x=>Number(x.direction)<0);
 const stance=positives.length===negatives.length?'MIXED':positives.length>negatives.length?'BULLISH':'BEARISH';
 return{adapterId:'daily-stock-analysis',adapterName:'Daily Stock Analysis · daily brief',status:'ok',stance,coverage:relevant.length/4,asOf:new Date().toISOString(),headline:'Quadro giornaliero '+(stance==='BULLISH'?'costruttivo':stance==='BEARISH'?'debole':'contrastato'),summary:'Sintesi delle evidenze già raccolte dal motore; non è un’analisi fondamentale societaria né una fonte dati indipendente.',positive:positives.map(x=>({family:safeText(x.family,40),summary:safeText(x.reason||x.evidence?.[0]||'Segnale positivo',180)})),negative:negatives.map(x=>({family:safeText(x.family,40),summary:safeText(x.reason||x.evidence?.[0]||'Segnale negativo',180)})),readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
}

/* Day Trader Skill-inspired pre-trade checklist; observes existing decision and risk outputs only. */
export function runDayTraderSkillAdapter(decision={},modules=[]){
 const checks=[
  {id:'signal',label:'Segnale operativo',ok:['LONG','SHORT'].includes(String(decision.action||decision.signal||'').toUpperCase()),detail:'Richiede una direzione LONG o SHORT esplicita.'},
  {id:'risk',label:'Risk gate',ok:decision?.risk?.approved===true||decision?.portfolio?.approved===true,detail:'Richiede approvazione del risk gate già calcolato.'},
  {id:'data',label:'Copertura dati',ok:(Array.isArray(modules)?modules:[]).filter(x=>x.dataAvailable!==false&&Number(x.coverage)>0).length>=3,detail:'Richiede almeno 3 moduli con copertura positiva.'},
  {id:'paper',label:'Ambiente',ok:true,detail:'L’integrazione è consultiva; l’esecuzione resta nel percorso PAPER esistente.'}
 ];
 const passed=checks.filter(x=>x.ok).length;
 return{adapterId:'day-trader-skill',adapterName:'Day Trader Skill · pre-trade checklist',status:passed===checks.length?'READY':passed===0?'BLOCKED':'REVIEW',checks,passed,total:checks.length,summary:passed===checks.length?'Checklist consultiva completa.':'Checklist non completa: verificare gli elementi non soddisfatti.',readOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
}
