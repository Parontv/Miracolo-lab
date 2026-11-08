import fs from 'node:fs';
import assert from 'node:assert/strict';
const seed=fs.readFileSync('bot-market-seed.js','utf8');
const router=fs.readFileSync('bot-live-router.js','utf8');
const evalEngine=fs.readFileSync('bot-evaluation.js','utf8');
const paperAuto=fs.readFileSync('bot-paper-auto.js','utf8');
assert.equal((seed.match(/fetch\(/g)||[]).length,1,'Yahoo fallback must use one fetch');
assert.match(router,/status=all&nested=true&limit=500&direction=desc/,'Journal sync must fetch Alpaca orders once, including nested bracket fills and terminal orders');
assert.match(router,/reconcileFilledOrders\(orders/,'Journal must calculate realized P&L from verified fills');
assert.match(router,/realizedBasis:exit\?'GROSS_BEFORE_FEES'/,'Journal must label P&L as gross before fees');
assert.match(router,/fetches:2,alpaca/,'market-test must report exactly two market fetches');
assert.match(router,/name:'market',fetches:0/,'Decision phase must not fetch');
assert.match(router,/name:'crypto',fetches:3/,'Crypto phase budget must remain three fetches');
assert.match(router,/name:'position',fetches:0/,'Position phase starts with zero actual fetches');
assert.match(router,/p\.fetches=2/,'Position risk reconciliation must fetch both positions and active nested orders');
assert.match(router,/assessPositionRisk\(raw,orders\)/,'Position risk must be derived from verified Alpaca stop orders');
assert.match(router,/name:'journal'/,'Journal phase must be explicit');
assert.match(router,/evaluationPhase/,'Evaluation phase must be explicit');
assert.match(router,/fetches:0,errors:\[\],durationMs:0/,'Evaluation phase adds no external fetches');
const beforeLive=router.split("if(u.pathname==='/api/live')")[0];
assert.equal((beforeLive.match(/aiWorker\.fetch/g)||[]).length,0,'Bot routes before /api/live must not call aiWorker.fetch');
assert.equal((router.match(/await refreshAlpacaEquities/g)||[]).length,2,'Alpaca market refresh is called only in cron and market-test');
assert.match(router,/await recordSignals\(env,result,state\)/,'Bot run must record signals');
assert.match(router,/await evaluateSignals\(env,state/,'Bot run/cron must evaluate signals');
assert.match(router,/await journalOrder\(/,'Orders must be linked to a signal record');
assert.match(evalEngine,/slice\(-600\)/,'Signal history is capped at 600');
assert.match(evalEngine,/15\*60\*1000/,'Signal dedupe window is 15 minutes');
assert.match(evalEngine,/h1:60\*60\*1000/,'1h horizon present');
assert.match(evalEngine,/h24:24\*60\*60\*1000/,'24h horizon present');
assert.match(evalEngine,/h5d:5\*24\*60\*60\*1000/,'5d horizon present');
console.log('PASS bot subrequest/evaluation contract');

assert.match(router,/function decisionFresh\(data\)/,'cached decisions must validate input freshness');
assert.match(router,/macroUntil>now&&aiAt>now-60\*60\*1000&&aiAt<=now\+60000&&flow&&flowUntil>now/,'cached decision must expire when macro, AI or order-flow evidence expires');
assert.match(router,/u\.pathname===['"]\/api\/bot\/order-flow['"]/,'read-only order flow diagnostic route missing');
assert.match(router,/refreshBinanceOrderFlow\(\)/,'context phase must refresh live order flow');

assert.match(paperAuto,/if\(!Array\.isArray\(positions\)\|\|!Array\.isArray\(orders\)\)/,'PAPER buy preflight must fail closed on invalid Alpaca response shapes');
assert.match(paperAuto,/if\(!Array\.isArray\(rows\)\)return\{ok:false,position:null,positions:\[\]\}/,'PAPER position sync must fail closed on invalid Alpaca positions');

assert.match(router,/async function refreshRiskState\(env\)/,'execution routes must refresh live positions and orders before decisions');
assert.match(router,/const riskState=await refreshRiskState\(env\);if\(!riskState\.ok\)/,'manual plan/run routes must fail closed on reconciliation errors');
assert.match(paperAuto,/assessPositionRisk\(positions,orders\)/,'PAPER preflight must verify stop coverage for all existing positions');
assert.match(paperAuto,/pendingEntries/,'PAPER preflight must count pending entry orders against the position cap');

assert.ok(paperAuto.indexOf("if(action==='BUY'){const gate=await preflightBuy")<paperAuto.indexOf('if(!shouldExecute){const why=!executionEnabled?'),'Dry-run plans must pass the same live buy preflight before showing an executable plan');
assert.match(paperAuto,/PAPER_AUTO_EXECUTION/,'automatic paper execution must require an explicit enable switch');
assert.match(paperAuto,/BOT_MODE\?\?'PAPER'\)\.toUpperCase\(\)==='PAPER'/,'automatic execution must be impossible outside PAPER mode');

assert.match(router,/flattenAlpacaOrders\(orders\)/,'Journal must import nested Alpaca bracket child orders');

assert.match(router,/groupRole:o\.group_role\|\|prev\.groupRole/,'Journal must preserve Alpaca bracket group roles for daily trade counting');

assert.match(router,/orderFlow\},ai:/,'order flow snapshot must be stored in market state before AI/decision analysis');

const engine=fs.readFileSync('bot-server-engine.js','utf8');
const workspace=fs.readFileSync('public/bot-workspace.js','utf8');
assert.match(engine,/function researchSidecars\(state,modules,decision,journal,evalReport\)/,'Research sidecars must be generated by the server engine');
assert.match(engine,/researchCouncil:\{aiResearch\}/,'AI Research Council must be included in server payload');
assert.match(engine,/researchAdapters:registry/,'Research registry must be included in server payload');
assert.match(engine,/vibeTradingResearch:vibe/,'Strategy Lens must be included in server payload');
assert.match(engine,/dayTraderSkill:/,'Pre-trade checklist must be included in server payload');
assert.match(engine,/freqtradeBacktest:freqtrade/,'Freqtrade status must be explicit in server payload');
assert.match(engine,/llmTradingLab:llm/,'Forecast evaluation must be included in server payload');
assert.match(engine,/aiHedgeFundResearch:hedge/,'Analyst synthesis must be included in server payload');
assert.match(engine,/never vote or execute/i,'Research sidecars must remain read-only');
for (const id of ['botAIResearchStatus','botAdaptersStatus','botVibeStatus','botFreqtradeStatus','botLLMLabStatus','botDayTraderStatus','botDailyStockStatus','botHedgeFundStatus']) assert.ok(workspace.includes('id="'+id+'"'),'Missing research status badge '+id);
console.log('PASS research sidecar payload contract');

const controller=fs.readFileSync('public/bot-controller.js','utf8');
assert.match(router,/researchPayloadReady=data=>Boolean\(data\?\.researchCouncil\?\.aiResearch/,'Cached decisions must be rebuilt when research payloads are missing');
assert.match(router,/decisionFresh\(data\)&&researchPayloadReady\(data\)/,'Edge cache must not serve stale decisions without research sidecars');
assert.match(workspace,/window\.MiracoloBot\?\.load\?\./,'Opening the Bot workspace must request the current server decision');
assert.match(controller,/async function load\(\)/,'Bot controller must expose a read-only decision loader');
console.log('PASS research refresh and cache invalidation contract');

const indexHtml=fs.readFileSync('public/index.html','utf8');
assert.ok(indexHtml.includes('/bot-workspace.js?v=2.0.2'),'Bot workspace asset cache version must be bumped after UI changes');
console.log('PASS Bot workspace cache-busting contract');

const engineSource=fs.readFileSync('bot-server-engine.js','utf8');
const workspaceSource=fs.readFileSync('public/bot-workspace.js','utf8');
assert.match(engineSource,/weightedHitRate=samples\?validEval\.reduce/,'Signal hit rate must be weighted by valid sample count');
assert.match(engineSource,/hitRatePct/,'Signal evaluation must expose the weighted hit rate');
assert.doesNotMatch(engineSource,/accuracyPct/,'Internal signal hit rate must not be labelled LLM accuracy');
assert.match(engineSource,/Order Flow · \$\{by\.flow\?\.source/,'Research registry must identify the actual order-flow provider');
assert.match(workspaceSource,/Hit rate ponderato|Hit rate ponderato/,'UI must label internal signal performance as hit rate');
assert.match(workspaceSource,/Analisi AI consultiva/,'Single AI output must not be presented as a multi-model council');
assert.match(workspaceSource,/Valutazione previsioni · Segnali interni/,'Local signal evaluation must not be presented as an LLM lab');
assert.match(h,/bot-workspace\.js\?v=2\.0\.2/,'Bot workspace cache version must be bumped');
console.log('PASS research provenance and weighted signal evaluation contract');
