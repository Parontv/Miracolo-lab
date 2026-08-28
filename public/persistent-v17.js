/* V17.0 persistent-data client: never reset to empty on app open */
(()=>{'use strict';
const KEY='ml_live_snapshot_v17';
function save(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');return s&&s.timestamp?s:null}catch{return null}}
async function hydrate(){const cached=load();if(cached){window.ML_LIVE=cached;document.documentElement.dataset.liveCached='1';}
 try{const r=await fetch('/api/live?ts='+Date.now(),{cache:'no-store'});if(r.ok){const s=await r.json();if(s&&s.timestamp){window.ML_LIVE=s;save(s);document.documentElement.dataset.liveCached=s.cached?'1':'0';if(typeof window.refreshDashboardFromLive==='function')window.refreshDashboardFromLive(s)}}}catch(e){console.warn('Live backend unavailable; cached snapshot retained',e)}}
window.ML_LIVE_LOAD=hydrate;document.addEventListener('DOMContentLoaded',()=>setTimeout(hydrate,150));
setInterval(hydrate,300000);
})();