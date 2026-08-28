import base from './worker.js';
export default {
  fetch(request, env, ctx) { return base.fetch(request, env, ctx); },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async()=>{
      const baseUrl='https://miracolo-lab.listaconcerti.workers.dev';
      await Promise.allSettled([
        fetch(baseUrl+'/api/full-scan?cron='+Date.now(),{cache:'no-store'}),
        fetch(baseUrl+'/api/prices?symbols='+encodeURIComponent('^GSPC,^NDX,^DJI,^RUT,^FTSE,^GDAXI,^FCHI,^STOXX50E,GC=F,AGOLD.MI,SWDA.MI,EIMI.MI')+'&cron='+Date.now(),{cache:'no-store'}),
        fetch(baseUrl+'/api/crypto?cron='+Date.now(),{cache:'no-store'})
      ]);
    })());
  }
};