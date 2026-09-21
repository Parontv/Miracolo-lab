/* Miracolo Lab — Investment-only charts
   Uses the portfolio valuation history recorded by investments.js.
   It never substitutes Market technical data for portfolio history.
*/
(()=>{'use strict';
const KEY='ml_portfolio_v7.history';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const eur=v=>Number(v||0).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2});
const load=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
const clean=(arr,key)=>arr.map(x=>({time:Math.floor(new Date(x.time).getTime()/1000),value:Number(x[key]||0)})).filter(x=>Number.isFinite(x.time)&&Number.isFinite(x.value)&&x.time>0).sort((a,b)=>a.time-b.time).filter((x,i,a)=>i===0||x.time>a[i-1].time);
const positionSeries=(history,type,symbol)=>history.map(h=>{const p=(h.positions||[]).find(x=>x.type===type&&x.symbol===symbol);return p?{time:Math.floor(new Date(h.time).getTime()/1000),value:Number(p.value||0)}:null}).filter(Boolean).filter(x=>Number.isFinite(x.time)&&Number.isFinite(x.value)).sort((a,b)=>a.time-b.time).filter((x,i,a)=>i===0||x.time>a[i-1].time);
function base(el){const LC=window.LightweightCharts;return LC.createChart(el,{width:el.clientWidth||600,height:230,layout:{textColor:'#94a3b8',background:{type:'solid',color:'transparent'}},grid:{vertLines:{color:'rgba(148,163,184,.07)'},horzLines:{color:'rgba(148,163,184,.07)'}},rightPriceScale:{borderColor:'rgba(148,163,184,.12)'},timeScale:{borderColor:'rgba(148,163,184,.12)',timeVisible:true,secondsVisible:false},crosshair:{mode:1}})}
function draw(el,data,title){if(!el||data.length<2||!window.LightweightCharts)return null;const LC=window.LightweightCharts,chart=base(el),series=chart.addSeries(LC.AreaSeries,{lineColor:'#38bdf8',topColor:'rgba(56,189,248,.20)',bottomColor:'rgba(56,189,248,.02)',lineWidth:2,priceFormat:{type:'price',precision:2,minMove:.01},title});series.setData(data);chart.timeScale().fitContent();const ro=new ResizeObserver(()=>{if(el.clientWidth)chart.applyOptions({width:el.clientWidth})});ro.observe(el);return{chart,ro}}
function block(title,subtitle,data){const id='iv-chart-'+Math.random().toString(36).slice(2,9);return '<article class="iv-chart-card"><header><div><h4>'+esc(title)+'</h4><small>'+esc(subtitle)+'</small></div><span class="iv-chart-last">'+(data.length?eur(data[data.length-1].value):'—')+'</span></header><div class="iv-chart-canvas" id="'+id+'"></div></article>'}
function mount(){if(window.__mlPanel!=='investimenti')return;const root=document.querySelector('.iv13-wrap');if(!root)return;root.querySelector('.iv-chart-section')?.remove();const history=load().filter(x=>x&&x.time);const section=document.createElement('section');section.className='iv-chart-section';section.innerHTML='<div class="iv-chart-title"><div><h3>Grafici investimenti</h3><small>Andamento del valore del tuo portafoglio registrato da Miracolo Lab</small></div><span>STORICO</span></div>';root.appendChild(section);
if(!history.length){section.insertAdjacentHTML('beforeend','<div class="iv-chart-empty">Lo storico inizierà a popolarsi con le prossime valorizzazioni del portafoglio.</div>');return}
const total=clean(history,'value'),etf=clean(history,'etf'),crypto=clean(history,'crypto');
if(total.length>=2)section.insertAdjacentHTML('beforeend',block('Portafoglio totale','Valore complessivo degli investimenti',total));
if(etf.length>=2)section.insertAdjacentHTML('beforeend',block('ETF','Valore complessivo delle posizioni ETF',etf));
if(crypto.length>=2)section.insertAdjacentHTML('beforeend',block('Crypto','Valore complessivo delle posizioni crypto',crypto));
const latest=history.at(-1),positions=latest?.positions||[],seen=new Set();
for(const p of positions){if(!p||!p.symbol||!p.quantity||seen.has(p.type+':'+p.symbol))continue;seen.add(p.type+':'+p.symbol);const data=positionSeries(history,p.type,p.symbol);if(data.length>=2)section.insertAdjacentHTML('beforeend',block(p.symbol,p.type==='ETF'?'Posizione ETF':'Posizione crypto',data))}
const canvases=[...section.querySelectorAll('.iv-chart-canvas')];const cards=[...section.querySelectorAll('.iv-chart-card')];let ci=0;for(const card of cards){const dataTitle=card.querySelector('h4')?.textContent||'';let data=total;if(dataTitle==='ETF')data=etf;else if(dataTitle==='Crypto')data=crypto;else if(dataTitle!=='Portafoglio totale'){const pos=positions.find(p=>p.symbol===dataTitle);if(pos)data=positionSeries(history,pos.type,pos.symbol)}draw(canvases[ci++],data,dataTitle)}
if(!section.querySelector('.iv-chart-card'))section.insertAdjacentHTML('beforeend','<div class="iv-chart-empty">Servono almeno due valorizzazioni per visualizzare l\'andamento storico.</div>');
}
window.addEventListener('miracolo:investments-rendered',()=>setTimeout(mount,0));
window.addEventListener('miracolo:panelchange',e=>{if(e.detail?.panel==='investimenti')setTimeout(mount,0)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0));else setTimeout(mount,0);
})();