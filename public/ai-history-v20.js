/* Miracolo Lab V20 — persistent AI intelligence history */
(()=>{'use strict';
const KEY='ml_ai_history_v20'; const MAX=1000;
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function write(x){try{localStorage.setItem(KEY,JSON.stringify(x.slice(-MAX)))}catch{}}
function compactSignal(s){return {title:String(s?.title||'').slice(0,240),source:String(s?.source||'').slice(0,120),symbol:String(s?.symbol||s?.ticker||s?.cryptoAsset||'').slice(0,40),score:Number.isFinite(Number(s?.score))?Number(s.score):null,type:String(s?.type||'').slice(0,30),url:String(s?.url||s?.link||'').slice(0,500)}}
function snapshot(live){const now=new Date().toISOString(), signals=Array.isArray(live?.signals)?live.signals:[], indices=Array.isArray(live?.indices)?live.indices:[];return {timestamp:now,source:'live',market:{indices:indices.slice(0,30).map(x=>({name:x.name,symbol:x.symbol,price:x.price,changePct:x.changePct,rsi:x.rsi,ok:x.ok}))},signals:signals.slice(0,150).map(compactSignal),stats:{signals:signals.length,indices:indices.length,sources:Array.isArray(live?.sources)?live.sources.length:null,tickers:Number(live?.tickerCount||live?.tickersAnalyzed||0)||null}}}
function remember(live){const s=snapshot(live);const h=read();const last=h[h.length-1];if(last&&JSON.stringify(last.market)===JSON.stringify(s.market)&&JSON.stringify(last.signals)===JSON.stringify(s.signals)&&JSON.stringify(last.stats)===JSON.stringify(s.stats))return;h.push(s);write(h);window.ML_AI_HISTORY=h;window.dispatchEvent(new CustomEvent('ml:history-updated',{detail:s}))}
function hydrate(){window.ML_AI_HISTORY=read();}
function rememberCurrent(){if(window.ML_LIVE)remember(window.ML_LIVE);else if(window.S?.signals)remember({signals:window.S.signals,indices:[],sources:window.S.sources})}
window.ML_AI_HISTORY_LOAD=hydrate;window.ML_AI_REMEMBER=remember;window.ML_AI_HISTORY=read();
document.addEventListener('DOMContentLoaded',()=>{hydrate();setTimeout(rememberCurrent,1200)});
window.addEventListener('ml:live-updated',e=>remember(e.detail));
const oldFetch=window.fetch;window.fetch=async function(...args){const r=await oldFetch.apply(this,args);try{const u=String(args[0]||'');if(/\/api\/(live|market-monitor|prices|crypto|sources|signals)/.test(u)&&r.ok){const c=r.clone();c.json().then(d=>{if(/\/api\/live/.test(u))remember(d);else remember({signals:d.signals||[],indices:d.indices||[],sources:d.sources||[],tickerCount:d.tickerCount||d.tickersAnalyzed})}).catch(()=>{})}}catch{}return r};
})();