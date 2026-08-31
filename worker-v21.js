/* Miracolo Lab V21.1 — Worker entrypoint.
   Uses the existing V20 intelligence engine as the data provider, while adding
   a single cached full-scan boundary so the frontend does not re-run the entire
   multi-source scan on every request within the 5-minute refresh window. */
import base from './worker-v20.js';

const VERSION = '21.1.0';
const SCAN_CACHE_KEY = new Request('https://miracolo-lab.local/v21/full-scan');
const CACHE_TTL_MS = 4 * 60 * 1000;

async function readScanCache() {
  try {
    const r = await caches.default.match(SCAN_CACHE_KEY);
    if (!r) return null;
    const ts = Number(r.headers.get('x-ml-scan-ts') || 0);
    if (!ts || Date.now() - ts > CACHE_TTL_MS) return null;
    return await r.json();
  } catch { return null; }
}

async function writeScanCache(data) {
  try {
    const body = JSON.stringify(data);
    await caches.default.put(SCAN_CACHE_KEY, new Response(body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-ml-scan-ts': String(Date.now())
      }
    }));
  } catch {}
}

function response(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

export default {
  async scheduled(event, env, ctx) {
    if (base.scheduled) ctx.waitUntil(base.scheduled(event, env, ctx));
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (url.pathname === '/api/version') {
      return response({ version: VERSION, engine: 'worker-v20', entrypoint: 'worker-v21.js', refresh: '5m' });
    }

    if (url.pathname === '/api/full-scan') {
      const cached = await readScanCache();
      if (cached) return response({ ...cached, version: VERSION, cached: true });

      const upstream = await base.fetch(new Request(url, req), env, ctx);
      const text = await upstream.text();
      let data;
      try { data = JSON.parse(text); }
      catch { return new Response(text, { status: upstream.status, headers: upstream.headers }); }

      if (upstream.ok && data && data.ok !== false) {
        data.version = VERSION;
        data.cached = false;
        ctx.waitUntil(writeScanCache(data));
      }
      return response(data);
    }

    return base.fetch(req, env, ctx);
  }
};
