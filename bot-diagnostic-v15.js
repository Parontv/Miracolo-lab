/* Miracolo Lab Bot V15 diagnostics: explicit stage tracing and no silent module failures. */
export function buildBotDiagnostics(result){
  const modules=Array.isArray(result?.modules)?result.modules:[];
  const by=Object.fromEntries(modules.map(m=>[m.family,m]));
  return {
    version:'BOT-DIAGNOSTIC-V15',
    generatedAt:new Date().toISOString(),
    stages:[
      {stage:'STATE',status:result?.ok?'OK':'ERROR',detail:result?.ok?'Base state disponibile':'Base state assente'},
      {stage:'MARKET',status:by.market?.dataAvailable?'OK':'NO_DATA',detail:by.market?.evidence?.[0]||'Nessun output Market'},
      {stage:'NEWS',status:by.news?.dataAvailable?'OK':'NO_DATA',detail:by.news?.evidence?.[0]||'Nessun output News'},
      {stage:'MACRO',status:by.macro?.dataAvailable?'OK':'NO_DATA',detail:by.macro?.evidence?.[0]||'FRED non disponibile'},
      {stage:'TECHNICAL',status:by.technical?.dataAvailable?'OK':'NO_DATA',detail:by.technical?.evidence?.[0]||'Nessun output Technical'},
      {stage:'AI',status:by.ai?.status||'NO_DATA',detail:by.ai?.evidence?.[0]||'AI non disponibile'},
      {stage:'HISTORICAL',status:by.historical?.dataAvailable?'OK':'NO_DATA',detail:by.historical?.evidence?.[0]||'Nessun output Historical'},
      {stage:'BACKTEST',status:by.backtest?.dataAvailable?'OK':'NO_DATA',detail:by.backtest?.evidence?.[0]||'Nessun output Backtest'},
      {stage:'LEARNING',status:by.learning?.dataAvailable?'OK':'NO_DATA',detail:by.learning?.evidence?.[0]||'Learning in raccolta'},
      {stage:'MEMORY',status:by.memory?.dataAvailable?'OK':'NO_DATA',detail:by.memory?.evidence?.[0]||'Memory non disponibile'},
      {stage:'CONSENSUS',status:result?.decision?'OK':'ERROR',detail:result?.decision?.reason||'Consensus non prodotto'},
      {stage:'RISK',status:result?.risk?'OK':'ERROR',detail:result?.risk?.reason||result?.risk?.status||'Risk engine non disponibile'},
      {stage:'PAPER',status:result?.mode==='PAPER'?'OK':'ERROR',detail:'PAPER only'}
    ]
  };
}
