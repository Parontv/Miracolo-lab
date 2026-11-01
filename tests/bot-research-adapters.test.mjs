import test from 'node:test';
import assert from 'node:assert/strict';
import {listResearchAdapters,normalizeResearchAdapterResult,runVibeTradingAdapter,runAIHedgeFundAdapter,runDailyStockAnalysisAdapter,runDayTraderSkillAdapter,runFinancialToolUsePlanner,runFreqtradeBacktestAdapter,runLLMTradingLabAdapter} from '../bot-research-adapters.js';

test('research adapters are registered read-only and cannot affect execution',()=>{
  const adapters=listResearchAdapters();
  assert.ok(adapters.some(x=>x.id==='tradingagents'));
  assert.ok(adapters.some(x=>x.id==='vibe-trading'));
  assert.ok(adapters.some(x=>x.id==='ai-hedge-fund'));
  assert.ok(adapters.every(x=>x.readOnly&&x.affectsConsensus===false&&x.affectsRiskGate===false&&x.affectsOrders===false&&x.execution===false));
});

test('adapter output is normalized, bounded and advisory',()=>{
  const result=normalizeResearchAdapterResult('tradingagents',{status:'ok',items:[{title:'A'.repeat(300),summary:'evidence',source:'feed',url:'https://example.com',confidence:150}]});
  assert.equal(result.status,'ok');
  assert.equal(result.items[0].title.length,160);
  assert.equal(result.items[0].confidence,100);
  assert.equal(result.affectsOrders,false);
});

test('unknown adapters are rejected safely',()=>{
  const result=normalizeResearchAdapterResult('unknown',{status:'ok',items:[{title:'should not pass'}]});
  assert.equal(result.status,'REJECTED');
  assert.equal(result.affectsOrders,false);
});

test('Vibe Trading internal lens summarizes existing modules without changing controls',()=>{
  const modules=[
    {family:'market',direction:1,confidence:70,dataAvailable:true},
    {family:'technical',direction:1,confidence:65,dataAvailable:true},
    {family:'news',direction:-1,confidence:60,dataAvailable:true},
    {family:'flow',direction:0,confidence:50,dataAvailable:true}
  ];
  const result=runVibeTradingAdapter(modules);
  assert.equal(result.adapterId,'vibe-trading');
  assert.equal(result.status,'ok');
  assert.equal(result.stance,'BULLISH');
  assert.equal(result.readOnly,true);
  assert.equal(result.affectsConsensus,false);
  assert.equal(result.affectsRiskGate,false);
  assert.equal(result.affectsOrders,false);
  assert.equal(runVibeTradingAdapter([]).status,'INSUFFICIENT_DATA');
});

test('AI Hedge Fund analyst synthesis remains advisory and reports risk gate only',()=>{
 const modules=[{family:'macro',direction:1,confidence:70,dataAvailable:true},{family:'news',direction:1,confidence:60,dataAvailable:true},{family:'technical',direction:-1,confidence:65,dataAvailable:true},{family:'flow',direction:1,confidence:55,dataAvailable:true}];
 const result=runAIHedgeFundAdapter(modules,{portfolio:{approved:false}});
 assert.equal(result.status,'ok');assert.equal(result.analysts.length,4);
 assert.equal(result.analysts.find(x=>x.id==='risk').stance,'RISK_GATE_BLOCKED');
 assert.equal(result.affectsConsensus,false);assert.equal(result.affectsRiskGate,false);assert.equal(result.affectsOrders,false);
});

test('Daily Stock Analysis brief requires evidence and stays advisory',()=>{
 const result=runDailyStockAnalysisAdapter([{family:'market',direction:1,dataAvailable:true,evidence:['Breadth positive']},{family:'news',direction:-1,dataAvailable:true,evidence:['News mixed']}]);
 assert.equal(result.status,'ok');assert.equal(result.stance,'MIXED');assert.equal(result.affectsConsensus,false);assert.equal(result.affectsRiskGate,false);assert.equal(result.affectsOrders,false);
 assert.equal(runDailyStockAnalysisAdapter([]).status,'INSUFFICIENT_DATA');
});

test('Day Trader Skill checklist is observational and reports incomplete controls',()=>{
 const result=runDayTraderSkillAdapter({action:'LONG',risk:{approved:true}},[{family:'market',coverage:.8,dataAvailable:true},{family:'news',coverage:.5,dataAvailable:true},{family:'technical',coverage:.6,dataAvailable:true}]);
 assert.equal(result.status,'READY');assert.equal(result.passed,result.total);assert.equal(result.affectsConsensus,false);assert.equal(result.affectsRiskGate,false);assert.equal(result.affectsOrders,false);
 const blocked=runDayTraderSkillAdapter({},[]);
 assert.equal(blocked.status,'REVIEW');
});

test('financial tool-use planner creates bounded read-only plan without executing tools',()=>{
 const result=runFinancialToolUsePlanner([{family:'market',dataAvailable:true}],{risk:{approved:false}});
 assert.equal(result.status,'PLAN_ONLY');assert.ok(result.tasks.length<=6);
 assert.ok(result.tasks.every(x=>x.readOnly));assert.equal(result.executesTools,false);
 assert.equal(result.riskGate,'BLOCKED');assert.equal(result.affectsOrders,false);
});

test('Freqtrade-inspired evaluator computes historical metrics and remains backtest-only',()=>{
 const result=runFreqtradeBacktestAdapter([{returnPct:2},{returnPct:-1},{returnPct:1},{returnPct:0.5},{returnPct:-.5}],{costPct:.1});
 assert.equal(result.status,'ok');assert.equal(result.trades,5);assert.equal(result.winRatePct,60);
 assert.equal(result.netAfterCostsPct,1.5);assert.equal(result.backtestOnly,true);assert.equal(result.affectsOrders,false);
 assert.equal(runFreqtradeBacktestAdapter([]).status,'INSUFFICIENT_DATA');
});

test('LLM Trading Lab scores realized forecasts without operational effects',()=>{
 const rows=[['UP','UP',.8],['DOWN','DOWN',.7],['UP','DOWN',.6],['FLAT','FLAT',null],['DOWN','UP',.4]].map(([predicted,actual,probability])=>({model:'test-model',predicted,actual,probability}));
 const result=runLLMTradingLabAdapter(rows);
 assert.equal(result.status,'ok');assert.equal(result.samples,5);assert.equal(result.accuracyPct,60);
 assert.equal(result.evaluationOnly,true);assert.equal(result.affectsConsensus,false);assert.equal(result.affectsOrders,false);
 assert.equal(runLLMTradingLabAdapter([]).status,'INSUFFICIENT_DATA');
});
