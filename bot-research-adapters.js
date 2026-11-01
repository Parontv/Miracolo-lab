/* Miracolo Lab — external research adapter contracts.
 * Framework-inspired integrations are read-only and normalized before they reach
 * the existing decision engine. No adapter is allowed to submit or manage orders.
 */
const ADAPTERS = Object.freeze([
  { id:'tradingagents', name:'TradingAgents', role:'multi-agent research debate', mode:'INSPIRED_ADAPTER', status:'INTERNAL', execution:false },
  { id:'vibe-trading', name:'Vibe Trading', role:'signal and strategy research', mode:'INSPIRED_ADAPTER', status:'PLANNED', execution:false },
  { id:'ai-hedge-fund', name:'AI Hedge Fund', role:'portfolio thesis and analyst perspectives', mode:'INSPIRED_ADAPTER', status:'PLANNED', execution:false },
  { id:'daily-stock-analysis', name:'Daily Stock Analysis', role:'daily market/company research', mode:'SOURCE_ADAPTER', status:'PLANNED', execution:false },
  { id:'anthropic-financial-services', name:'Anthropic Financial Services', role:'tool-use and financial research patterns', mode:'PATTERN_ADAPTER', status:'PLANNED', execution:false },
  { id:'freqtrade', name:'Freqtrade', role:'backtesting research reference', mode:'BACKTEST_ADAPTER', status:'PLANNED', execution:false },
  { id:'day-trader-skill', name:'Day Trader Skill', role:'trading workflow and risk checklist', mode:'SKILL_ADAPTER', status:'PLANNED', execution:false },
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
