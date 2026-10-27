import assert from 'node:assert/strict';
import { refreshNewsAndMacro } from '../bot-context-enrichment.js';

// Contract: FRED is one batch fetch and produces numeric macro observations.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('fred.stlouisfed.org')) {
    const header = 'observation_date,CPIAUCSL,CPILFESL,UNRATE,PAYEMS,GDPC1,INDPRO,M2SL,EFFR';
    const row1 = '2026-10-01,100,99,4,100000,20000,100,21000,4';
    const row2 = '2026-10-02,101,100,3.9,100100,20100,101,21100,3.9';
    return new Response(`${header}\n${row1}\n${row2}`, {status:200});
  }
  if (u.includes('news.google.com')) return new Response('<rss><channel></channel></rss>', {status:200});
  if (u.includes('gdeltproject.org')) return new Response(JSON.stringify({articles:[]}), {status:200});
  if (u.includes('cnbc.com')) return new Response('<rss><channel></channel></rss>', {status:200});
  throw new Error(`unexpected fetch: ${u}`);
};

try {
  const result = await refreshNewsAndMacro();
  assert.equal(result.fetches, 4);
  assert.equal(result.quantitative.source, 'FRED batch');
  assert.equal(result.quantitative.groups.macro.length, 8);
  assert.equal(result.macro.length, 8);
  assert.ok(result.macro.every(x => x.status === 'ok' && Number.isFinite(x.value)));
  assert.equal(result.macro.find(x => x.series === 'CPIAUCSL')?.label, 'CPI inflation');
  console.log('PASS bot macro context');
} finally {
  globalThis.fetch = originalFetch;
}
