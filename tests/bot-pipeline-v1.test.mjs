import test from 'node:test';
import assert from 'node:assert/strict';
import { marketVote, newsVote, macroVote, buildConsensus } from '../public/v1/bot-pipeline-v1.js';

test('market excludes VIX and non-equity instruments from equity average',()=>{
  const r=marketVote([
    {name:'S&P 500',changePct:1},
    {name:'NASDAQ 100',changePct:1},
    {name:'DAX',changePct:1},
    {name:'VIX',changePct:20},
    {name:'Gold',changePct:10},
    {name:'DXY',changePct:10}
  ]);
  assert.equal(r.direction,1);
  assert.ok(r.evidence.some(x=>x.includes('VIX')));
});

test('news uses recency decay and returns NO DATA without recent items',()=>{
  const old=[{title:'rally strong growth',date:new Date(Date.now()-7*86400000).toISOString()}];
  const r=newsVote(old);
  assert.equal(r.coverage,0);
  assert.equal(r.direction,0);
});

test('high-yield spread rising is risk-off',()=>{
  const r=macroVote({credit:[{label:'Spread high yield USA',value:4,trendPct:1,period:new Date().toISOString()}]});
  assert.equal(r.direction,-1);
});

test('consensus waits with fewer than three independent families',()=>{
  const r=buildConsensus({market:{indices:[{name:'S&P 500',changePct:1},{name:'NASDAQ',changePct:1},{name:'DAX',changePct:1}]},news:{items:[]},quantitative:{groups:{}}});
  assert.equal(r.direction,0);
  assert.match(r.reason,/WAIT/);
});
