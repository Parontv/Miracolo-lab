import assert from 'node:assert/strict';
import { recordSignals, evaluateSignals, getEvalReport } from '../bot-evaluation.js';

class FakeKV {
  constructor(seed={}) { this.data=new Map(Object.entries(seed)); this.puts=0; }
  async get(k){ return this.data.has(k)?this.data.get(k):null; }
  async put(k,v){ this.puts++; this.data.set(k,v); }
}
const env=()=>({ML_KV:new FakeKV()});
const state=(spy=101,btc=110)=>({market:{indices:[{ticker:'SPY',price:spy},{ticker:'QQQ',price:spy},{ticker:'IWM',price:spy}],crypto:[{symbol:'BTC/USD',price:btc}]}});
const result=(time=Date.now(),mods=[{family:'market',direction:1,confidence:70,strength:.6},{family:'news',direction:0,confidence:50,strength:0},{family:'crypto',direction:-1,confidence:65,strength:.5}])=>({modules:mods,consensus:{direction:1,score:.4,dataCoverage:.8,families:['market','news','crypto']},botAction:'BUY',time});
const oldRecord=(time,price,modules)=>({id:`r-${time}`,time:new Date(time).toISOString(),bucket:Math.floor(time/(15*60*1000))*15*60*1000,prices:{SPY:price,QQQ:price,IWM:price,'BTC/USD':price},consensus:{direction:1,score:.4,dataCoverage:.8,families:['market']},modules,action:'BUY'});

// 1) one record per 15-minute window + cap at 600.
{
  const e=env(); const r=result();
  const a=await recordSignals(e,r,state(100,100)); const b=await recordSignals(e,r,state(101,101));
  assert.equal(a.recorded,true); assert.equal(b.recorded,false);
  const many=Array.from({length:600},(_,i)=>oldRecord(Date.now()-((i+2)*15*60*1000),100,[{family:'market',direction:1,confidence:70,strength:.5}]));
  e.ML_KV.data.set('bot/signals/v1',JSON.stringify(many));
  await recordSignals(e,r,state(100,100));
  const saved=JSON.parse(await e.ML_KV.get('bot/signals/v1'));
  assert.equal(saved.length,600);
}

// 2) 1h/24h/5d, hit/miss, neutral ignored, baseline and insufficient sample.
{
  const now=Date.now(); const e=env();
  const records=[
    oldRecord(now-61*60*1000,100,[{family:'market',direction:1,confidence:70,strength:.5},{family:'news',direction:0,confidence:50,strength:0}]),
    oldRecord(now-25*60*60*1000,100,[{family:'market',direction:-1,confidence:70,strength:.5}]),
    oldRecord(now-6*24*60*60*1000,100,[{family:'crypto',direction:1,confidence:70,strength:.5}])
  ];
  e.ML_KV.data.set('bot/signals/v1',JSON.stringify(records));
  const report=await evaluateSignals(e,state(102,98));
  assert.equal(report.horizons.h1.market.n,1);
  assert.equal(report.horizons.h1.news,undefined,'neutral modules must not count');
  assert.equal(report.h1?.market,undefined);
  assert.equal(report.horizons.h1.market.label,'Campione insufficiente');
  assert.equal(report.horizons.h24.market.n,1);
  assert.equal(report.horizons.h24.market.hits,1,'SHORT must hit when return is negative');
  assert.equal(report.horizons.h5d.crypto.n,1);
  assert.equal(report.horizons.h5d.crypto.hits,0,'LONG must miss when return is negative');
  assert.equal(report.horizons.h24.market.baseline,0,'always-LONG baseline on a negative return');
}

// 3) closed-market record is ignored; missing price is marked and not counted.
{
  const e=env(); const now=Date.now();
  const saturday=Date.parse('2026-10-24T14:00:00Z');
  const missing=oldRecord(now-61*60*1000,null,[{family:'market',direction:1,confidence:70,strength:.5}]);
  const closed=oldRecord(saturday,100,[{family:'market',direction:1,confidence:70,strength:.5}]);
  e.ML_KV.data.set('bot/signals/v1',JSON.stringify([missing,closed]));
  const report=await evaluateSignals(e,state(102,100));
  const saved=JSON.parse(await e.ML_KV.get('bot/signals/v1'));
  assert.equal(saved.some(r=>r.evaluated?.h1?.market?.status==='PRICE_MISSING'),true);
  assert.equal(saved.some(r=>r.evaluated?.h1?.market?.status==='MARKET_CLOSED_IGNORED'),true);
  assert.equal(report.horizons.h1.market?.n||0,0);
}

console.log('PASS bot evaluation: dedupe, cap, horizons, hits/misses, neutral, baseline, closed market, missing price');
