import assert from 'node:assert/strict';
import { consensus, flowModule, aiModule } from '../bot-server-engine.js';

const m=(family,direction,weight,confidence=70,strength=.6,dataAvailable=true)=>({family,direction,weight,confidence,strength,dataAvailable,status:dataAvailable?(direction?'CONTRIBUISCE':'READY'):'NO_DATA',evidence:[family],coverage:dataAvailable?1:0});

// dataCoverage includes dataAvailable modules even when their direction is neutral.
{
  const modules=[m('market',1,.14),m('technical',1,.17),m('historical',1,.07),m('news',0,.13),m('macro',0,.13),m('flow',0,.07),m('crypto',0,.08),m('backtest',0,.06),m('learning',0,.04),m('memory',0,.03),m('ai',0,.08)];
  const d=consensus(modules);
  assert.equal(d.dataCoverage,1);
  assert.equal(d.agreement,1);
  assert.match(d.reason,/dataCoverage 100%/);
}

// market + technical + historical are one correlated vote, not three.
{
  const modules=[m('market',1,.14),m('technical',1,.17),m('historical',1,.07),m('news',1,.13),m('macro',0,.13)];
  const d=consensus(modules);
  assert.equal(d.families,2);
  assert.equal(d.direction,0);
  assert.match(d.reason,/almeno 3 voti/);
}

// Numeric WAIT -> LONG example: same 100% dataCoverage, adding an independent third vote crosses the rule.
{
  const base=[m('market',1,.14,80,.8),m('technical',1,.17,80,.8),m('historical',1,.07,80,.8),m('news',1,.13,75,.6),m('macro',0,.13,50,0),m('flow',0,.07,50,0),m('crypto',0,.08,50,0),m('backtest',0,.06,50,0),m('learning',0,.04,50,0),m('memory',0,.03,50,0),m('ai',0,.08,50,0)];
  const wait=consensus(base);
  assert.equal(wait.dataCoverage,1);
  assert.equal(wait.families,2);
  assert.equal(wait.direction,0);
  const long=consensus(base.map(x=>x.family==='macro'?m('macro',1,.13,75,.6):x));
  assert.equal(long.dataCoverage,1);
  assert.equal(long.families,3);
  assert.equal(long.direction,1);
  assert.ok(long.score>=.2);
}

// Flow requires at least three valid two-sided books and never treats one-sided liquidity as a signal.
{
  const ready=flowModule({market:{indices:[
    {ticker:'SPY',bidPrice:769.47,askPrice:769.56,bidSize:1800,askSize:1200},
    {ticker:'QQQ',bidPrice:600,askPrice:600.1,bidSize:900,askSize:600},
    {ticker:'IWM',bidPrice:220,askPrice:220.1,bidSize:800,askSize:400},
    {ticker:'XLY',bidPrice:100,askPrice:100.1,bidSize:100,askSize:0}
  ]}});
  assert.equal(ready.dataAvailable,true);
  assert.ok(ready.imbalance>0.15);
  assert.equal(ready.direction,1);
  assert.equal(ready.evidence.length,3);
  const oneSided=flowModule({market:{indices:[
    {ticker:'SPY',bidPrice:769.47,askPrice:769.56,bidSize:1800,askSize:0},
    {ticker:'QQQ',bidPrice:600,askPrice:600.1,bidSize:900,askSize:0}
  ]}});
  assert.equal(oneSided.status,'NO_DATA');
  assert.equal(oneSided.dataAvailable,false);
  const empty=flowModule({market:{indices:[{ticker:'SPY',bidPrice:769.47,askPrice:769.56}]}});
  assert.equal(empty.status,'NO_DATA');
}

// Deterministic fallback is not counted as AI evidence.
{
  const ai=aiModule({ai:{status:'READY',model:'Miracolo deterministic context',direction:'LONG',confidence:90}});
  assert.equal(ai.status,'NO_DATA');
  assert.equal(ai.dataAvailable,false);
  assert.equal(ai.weight,0);
  assert.match(ai.reason,/Gemini non gira/);
}

console.log('PASS bot consensus v3');
