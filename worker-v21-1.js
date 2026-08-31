/* Miracolo Lab V21.1.1 — single deployment/version authority. */
import current from './worker-v21.js';

const VERSION = '21.1.1';

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

export default {
  async scheduled(event, env, ctx) {
    return current.scheduled ? current.scheduled(event, env, ctx) : undefined;
  },

  async fetch(req, env, ctx) {
    const u = new URL(req.url);

    if (u.pathname === '/api/version') {
      return json({
        version: VERSION,
        entrypoint: 'worker-v21-1.js',
        engine: 'worker-v20+v21.1',
        refresh: '5m',
        reddit: true,
        x: Boolean(env?.X_BEARER_TOKEN),
        aiHistory: true
      });
    }

    if (u.pathname === '/api/prices') {
      const symbols = (u.searchParams.get('symbols') || '').split(',').map(s => s.trim()).filter(Boolean);
      const hasGold = symbols.some(s => s.toUpperCase() === 'GOLD');
      if (hasGold) {
        const mapped = symbols.map(s => s.toUpperCase() === 'GOLD' ? 'AGOLD.MI' : s);
        u.searchParams.set('symbols', mapped.join(','));
        const upstream = await current.fetch(new Request(u.toString(), req), env, ctx);
        const text = await upstream.text();
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data.prices)) {
            data.prices = data.prices.map(p => String(p.symbol || '').toUpperCase() === 'AGOLD.MI' ? {...p, symbol:'GOLD', sourceTicker:'AGOLD.MI'} : p);
          }
          return json(data, upstream.status);
        } catch {
          return new Response(text, {status: upstream.status, headers: upstream.headers});
        }
      }
    }

    return current.fetch(req, env, ctx);
  }
};
