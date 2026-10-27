import assert from 'node:assert/strict';
import { recordSignals, evaluateSignals } from '../bot-evaluation.js';
class FakeKV {
  constructor(seed={}) { this.data=new Map(Object.entries(seed)); this.puts=0; this.gets=0; }
  async get(k,type){ this.gets++; const decode=v=>type==='json'&&typeof v==='string'?JSON.parse(v):v; if(Array.isArray(k)) return new Map(k.map(key=>[key,this.data.has(key)?decode(this.data.get(key)):null])); return this.data.has(k)?decode(this.data.get(k)):null; }
  async put(k,v){ this.puts++; this.data.set(k,v); }
}
const env=()=>({ML_KV:new FakeKV()});
const state=(spy=101,btc=110)=>({market:{indices:[{ticker:'SPY',price:spy},{ticker:'QQQ',price:spy},{ticker:'IWM',price:spy}],crypto:[{symbol:'BTC/USD',price:btc}]}});
const result=(mods=[{family:'market',direction:1,confidence:70,strength:.6},{family:'news',direction:0,confidence:50,strength:0},{family:'crypto',direction:-1,confidence:65,strength:.5}])=>({modules:mods,consensus:{direction:1,score:.4,dataCoverage:.8,families:['market','news','crypto']},botAction:'BUY'});
const oldRecord=(time,price,modules)=>({id:`r-${time}`,time:new Date(time).toISOString(),bucket:Math.floor(time/(15*60*1000))*15*60*1000,prices:{SPY:price,QQQ:price,IWM:price,'BTC/USD':price},consensus:{direction:1,score:.4,dataCoverage:.8,families:['market']},modules,action:'BUY'});
const openWeekdayTimes=(base,count)=>{const out=[];let t=base;while(out.length<count){const wd=new Date(t).getUTCDay();if(wd>=1&&wd<=5)out.push(t);t-=24*60*60*1000}return out};

// 1) Dedupe at 15 minutes and cap at 600 records.
{
  const e=env(); const a=await recordSignals(e,result(),state(100,100)); const b=await recordSignals(e,result(),state(101,101));
  assert.equal(a.recorded,true); assert.equal(b.recorded,false); assert.equal(b.recordId,a.recordId); assert.equal(e.ML_KV.gets,2); assert.equal(e.ML_KV.puts,1);
  const many=Array.from({length:600},(_,i)=>oldRecord(Date.now()-((i+2)*15*60*1000),100,[{family:'market',direction:1,confidence:70,strength:.5}]));
  e.ML_KV.data.set('bot/signals/v1',JSON.stringify(many)); await recordSignals(e,result(),state(100,100)); assert.equal(JSON.parse(e.ML_KV.data.get('bot/signals/v1')).length,600);
}

// 2) 1h/24h/5d, hit/miss, neutral ignored, baseline and insufficient sample.
{
  const savedNow=Date.now; Date.now=()=>Date.parse('2026-10-28T15:00:00Z');
  try {
    const now=Date.now(),e=env(),records=[oldRecord(now-61*60*1000,100,[{family:'market',direction:1,confidence:70,strength:.5},{family:'news',direction:0,confidence:50,strength:0}]),oldRecord(now-25*60*60*1000,104,[{family:'market',direction:-1,confidence:70,strength:.5}]),oldRecord(now-6*24*60*60*1000,100,[{family:'crypto',direction:1,confidence:70,strength:.5}])];
    e.ML_KV.data.set('bot/signals/v1',JSON.stringify(records)); const report=await evaluateSignals(e,state(102,98));
    assert.equal(report.horizons.h1.market.n,2); assert.equal(report.horizons.h1.news,undefined,'neutral modules must not count'); assert.equal(report.horizons.h1.market.label,'Campione insufficiente');
    assert.equal(report.horizons.h24.market.n,1); assert.equal(report.horizons.h24.market.hits,1,'SHORT must hit when return is negative'); assert.equal(report.horizons.h5d.crypto.n,1); assert.equal(report.horizons.h5d.crypto.hits,0,'LONG must miss when return is negative'); assert.equal(report.horizons.h24.market.baseline,0); assert.equal(report.horizons.h24.market.edge,null,'insufficient samples never present edge');
  } finally { Date.now=savedNow; }
}

// 3) Closed-market record is ignored; missing price is marked and not counted.
{
  const e=env(),now=Date.now(),saturday=Date.parse('2026-10-24T14:00:00Z');
  const missing=oldRecord(now-61*60*1000,null,[{family:'market',direction:1,confidence:70,strength:.5}]); const closed=oldRecord(saturday,100,[{family:'market',direction:1,confidence:70,strength:.5}]); e.ML_KV.data.set('bot/signals/v1',JSON.stringify([missing,closed]));
  const report=await evaluateSignals(e,state(102,100)); assert.equal(report.horizons.h1.market?.n||0,0); assert.equal(Object.values(report.evaluated).some(x=>x.status==='PRICE_MISSING'),true); assert.equal(Object.values(report.evaluated).some(x=>x.status==='MARKET_CLOSED_IGNORED'),true);
}

// 4) Thirty weekday samples become measurable and expose hit rate + edge.
{
  const savedNow=Date.now; Date.now=()=>Date.parse('2026-10-28T15:00:00Z');
  try { const e=env(),now=Date.now(),times=openWeekdayTimes(now-61*60*1000,30),records=times.map((t,i)=>oldRecord(t,100,[{family:'market',direction:i%2?1:-1,confidence:70,strength:.5}])); e.ML_KV.data.set('bot/signals/v1',JSON.stringify(records)); const report=await evaluateSignals(e,state(102,100)); assert.equal(report.horizons.h1.market.n,30); assert.equal(report.horizons.h1.market.label,'Campione sufficiente'); assert.notEqual(report.horizons.h1.market.hitRate,null); assert.notEqual(report.horizons.h1.market.edge,null); } finally { Date.now=savedNow; }
}
console.log('PASS bot evaluation: dedupe, 600 cap, 1h/24h/5d, hit/miss, neutral, baseline, insufficient sample, closed market, missing price');
