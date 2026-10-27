import assert from 'node:assert/strict';
import { refreshNewsAndMacro } from '../bot-context-enrichment.js';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('fred.stlouisfed.org')) {
    const id = new URL(u).searchParams.get('id');
    return new Response(`DATE,${id}\n2026-10-01,100\n2026-10-02,101\n`, {status:200});
  }
  if (u.includes('news.google.com')) return new Response('<rss><channel></channel></rss>', {status:200});
  if (u.includes('gdeltproject.org')) return new Response(JSON.stringify({articles:[]}), {status:200});
  if (u.includes('cnbc.com')) return new Response('<rss><channel></channel></rss>', {status:200});
  throw new Error(`unexpected fetch: ${u}`);
};
try {
  const r = await refreshNewsAndMacro();
  assert.equal(r.quantitative.groups.macro.length, 8);
  assert.equal(r.quantitative.coverage.available, 8);
  assert.equal(r.macro.length, 8);
  assert.equal(r.fetches, 11);
  console.log('PASS macro state wiring');
} finally { globalThis.fetch = originalFetch; }
