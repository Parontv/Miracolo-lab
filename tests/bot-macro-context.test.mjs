import assert from 'node:assert/strict';
import { refreshNewsAndMacro } from '../bot-context-enrichment.js';

// Contract: 3 news fetches max + 8 independent FRED series fetches = 11, below Worker limit.
const originalFetch = globalThis.fetch;
const seen = [];
globalThis.fetch = async (url) => {
  const u = String(url);
  seen.push(u);
  if (u.includes('fred.stlouisfed.org')) {
    const id = new URL(u).searchParams.get('id');
    assert.ok(id);
    return new Response(`DATE,${id}\n2026-10-01,100\n2026-10-02,101\n`, {status:200});
  }
  if (u.includes('news.google.com')) return new Response('<rss><channel></channel></rss>', {status:200});
  if (u.includes('gdeltproject.org')) return new Response(JSON.stringify({articles:[]}), {status:200});
  if (u.includes('cnbc.com')) return new Response('<rss><channel></channel></rss>', {status:200});
  throw new Error(`unexpected fetch: ${u}`);
};

try {
  const result = await refreshNewsAndMacro();
  assert.equal(result.fetches, 11);
  assert.equal(result.quantitative.source, 'FRED');
  assert.equal(result.quantitative.groups.macro.length, 8);
  assert.equal(result.quantitative.coverage.available, 8);
  assert.equal(result.macro.length, 8);
  assert.ok(result.macro.every(x => x.status === 'ok' && Number.isFinite(x.value)));
  assert.equal(result.macro.find(x => x.series === 'CPIAUCSL')?.label, 'CPI inflation');
  assert.equal(seen.filter(x => x.includes('fred.stlouisfed.org')).length, 8);
  console.log('PASS bot macro context');
} finally {
  globalThis.fetch = originalFetch;
}

const mirrorRows = [
  ['CPIAUCSL','CPI inflation'],['CPILFESL','Core CPI inflation'],['UNRATE','Unemployment'],
  ['PAYEMS','Nonfarm payrolls'],['GDPC1','Real GDP'],['INDPRO','Industrial production'],
  ['M2SL','M2 money supply'],['EFFR','Fed Funds effective rate']
].map(([series,label],i)=>({category:'macro',series,label,value:100+i,previous:99+i,change:1,changePct:1,status:'ok',asOf:'2026-10-01',source:'FRED'}));
const mirrorPayload={timestamp:'2026-10-29T20:00:00.000Z',source:'FRED',provider:'GitHub Actions mirror',groups:{macro:mirrorRows},coverage:{available:8,total:8},errors:[],seriesResults:mirrorRows};
const mirrorSeen=[];
globalThis.fetch=async url=>{
  const u=String(url);mirrorSeen.push(u);
  if(u.includes('raw.githubusercontent.com/Parontv/Miracolo-lab/main/public/fred-macro.json'))return new Response(JSON.stringify(mirrorPayload),{status:200});
  if(u.includes('news.google.com'))return new Response('<rss><channel></channel></rss>',{status:200});
  if(u.includes('gdeltproject.org'))return new Response(JSON.stringify({articles:[]}),{status:200});
  if(u.includes('cnbc.com'))return new Response('<rss><channel></channel></rss>',{status:200});
  throw new Error('FRED direct should not be called when mirror is available: '+u);
};
try {
  const result=await refreshNewsAndMacro();
  assert.equal(result.quantitative.provider,'GitHub Actions mirror');
  assert.equal(result.quantitative.coverage.available,8);
  assert.equal(result.macro.length,8);
  assert.equal(mirrorSeen.filter(x=>x.includes('fred.stlouisfed.org')).length,0);
  console.log('PASS GitHub FRED mirror fallback');
} finally {
  globalThis.fetch=originalFetch;
}
