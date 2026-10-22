/* Miracolo Lab — Bot data bridge v3.0
 * Data adapter only. The canonical Bot UI owns all rendering.
 * No standalone Technical Strategy Engine is ever mounted here.
 */
(()=>{
  'use strict';
  let loading=false;
  const active=()=>document.body.dataset.activePanel==='bot'||window.__mlPanel==='bot';
  async function refresh(){
    if(!active()||loading)return;
    loading=true;
    try{
      const r=await fetch('/api/bot-monitor?ts='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const data=await r.json();
      window.ML_BOT_TAB_BRIDGE={data,updatedAt:new Date().toISOString()};
      window.dispatchEvent(new CustomEvent('miracolo:botmonitor',{detail:data}));
    }catch(error){
      window.ML_BOT_TAB_BRIDGE={data:null,error:String(error.message||error),updatedAt:new Date().toISOString()};
      window.dispatchEvent(new CustomEvent('miracolo:botmonitor',{detail:{error:String(error.message||error)}}));
    }finally{loading=false}
  }
  function boot(){
    window.addEventListener('miracolo:botui',()=>setTimeout(refresh,40));
    window.addEventListener('miracolo:panelchange',e=>{if(e.detail?.panel==='bot')setTimeout(refresh,60)});
    if(active())setTimeout(refresh,80);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.refreshMiracoloBotMonitor=refresh;
})();
