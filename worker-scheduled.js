import base from './worker.js';
export default {
  fetch(request, env, ctx) { return base.fetch(request, env, ctx); },
  async scheduled(event, env, ctx) {
    const baseUrl = new URL('https://miracolo-lab.listaconcerti.workers.dev');
    const run = async (path) => {
      try {
        const url = new URL(path, baseUrl);
        url.searchParams.set('cron', String(Date.now()));
        return await fetch(url.toString(), { cache: 'no-store', headers: { 'Accept': 'application/json' } });
      } catch (e) {
        console.error('scheduled task failed', path, e);
        return null;
      }
    };
    ctx.waitUntil((async () => {
      await Promise.allSettled([
        run('/api/full-scan'),
        run('/api/prices?symbols=^GSPC,^NDX,^DJI,^RUT,^FTSE,^GDAXI,^FCHI,^STOXX50E,GC=F,AGOLD.MI,SWDA.MI,XMME.MI'),
        run('/api/crypto')
      ]);
    })());
  }
};
