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
