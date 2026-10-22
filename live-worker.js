/* Production entrypoint wrapper: live data + one server-side Bot brain. */
import aiWorker from './ai-worker.js';
import { runBot, getBotDecision } from './bot-server-engine-v9.js';

function slimLive(data){
  const out={...data};
  if(out.universe&&typeof out.universe==='object'){
    const {tickers,...universe}=out.universe;
    out.universe={...universe};
  }
  if(out.news&&typeof out.news==='object'){
    const news={...out.news};
    if(Array.isArray(news.items)) news.items=news.items.slice(0,120).map(x=>({title:x.title,date:x.date,url:x.url||x.link,source:x.source,type:x.type,cat:x.cat,score:x.score,description:String(x.description||x.summary||'').slice(0,500)}));
    delete news.categories;
    out.news=news;
  }
  if(out.ai&&typeof out.ai==='object') out.ai={...out.ai,commentary:String(out.ai.commentary||'').slice(0,3500),thesis:String(out.ai.thesis||'').slice(0,1800)};
  return out;
}

export default {
  async scheduled(event,env,ctx){
    await aiWorker.scheduled(event,env,ctx);
    ctx.waitUntil(runBot(env).catch(()=>null));
  },
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/bot/decision'){
      const decision=await getBotDecision(env);
      if(!decision)return Response.json({ok:false,mode:'PAPER',status:'NO_DATA',message:'Nessuna decisione server disponibile. Attendi la prima scansione.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
      return Response.json({ok:true,...decision},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
    }
    if(url.pathname==='/api/bot/run'){
      if(request.method!=='POST')return Response.json({ok:false,error:'POST richiesto'},{status:405});
      const result=await runBot(env);
      return Response.json({ok:true,...result},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
    }
    if(url.pathname==='/api/live'){
      const response=await aiWorker.fetch(request,env,ctx);
      const data=await response.json();
      return Response.json(slimLive(data),{status:response.status,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
    }
    return aiWorker.fetch(request,env,ctx);
  }
};
