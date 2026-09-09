/* Miracolo Lab — visual enhancement layer. DOM/CSS only; no data or business logic changes. */
(() => {
  'use strict';
  const ICONS={
    news:'newspaper',finance:'chart-candlestick',crypto:'bitcoin',macro:'globe-2',rates:'landmark',central:'building-2',commodities:'fuel',fx:'arrow-left-right',volatility:'chart-no-axes-combined',geopolitics:'globe',social:'message-circle',company:'briefcase-business'
  };
  const EMOJI_TO_KEY={'📰':'news','💹':'finance','₿':'crypto','🌍':'macro','💶':'rates','🏦':'central','🛢️':'commodities','💱':'fx','📊':'volatility','🌐':'geopolitics','💬':'social','🏢':'company'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scoreColor=s=>s>=68?'var(--ml-color-positive)':s<=44?'var(--ml-color-negative)':'var(--ml-color-warning)';

  function skeleton(el){
    if(!el||el.dataset.mlSkeleton==='1')return;
    el.dataset.mlSkeleton='1';
    el.setAttribute('aria-label','Caricamento in corso');
    el.innerHTML='<div class="ml-skeleton ml-skeleton-lg"></div><div class="ml-skeleton ml-skeleton-md"></div><div class="ml-skeleton ml-skeleton-sm"></div>';
  }

  function gauge(score){
    const n=Math.max(0,Math.min(100,Number(score)||0)),color=scoreColor(n),circ=301.59,arc=226.2,offset=arc*(1-n/100);
    return `<div class="ml-sentiment-gauge" role="img" aria-label="Market Sentiment ${n}/100" style="--ml-gauge-color:${color};--ml-gauge-offset:${offset.toFixed(2)}px">
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle class="ml-gauge-track" cx="60" cy="60" r="48" pathLength="100" />
        <circle class="ml-gauge-value" cx="60" cy="60" r="48" pathLength="100" />
      </svg>
      <div class="ml-gauge-center"><strong>${n}</strong><span>/100</span></div>
    </div>`;
  }

  function applyGauge(){
    const host=document.querySelector('.v1-market-card .v1-card-head strong');
    if(!host)return;
    const raw=host.textContent.match(/\d+/);if(!raw)return;
    const score=Number(raw[0]);
    const parent=host.parentElement;if(!parent)return;
    const old=parent.querySelector('.ml-sentiment-gauge');
    if(old){const current=old.querySelector('strong');if(current&&Number(current.textContent)===score)return;old.outerHTML=gauge(score);return;}
    host.outerHTML=gauge(score);
  }

  function applyIcons(){
    if(!window.lucide?.createIcons)return;
    document.querySelectorAll('.v1-category>summary').forEach(summary=>{
      if(summary.dataset.mlIconDone==='1')return;
      const text=summary.textContent;
      const emoji=Object.keys(EMOJI_TO_KEY).find(e=>text.includes(e));
      if(!emoji)return;
      const key=EMOJI_TO_KEY[emoji],name=ICONS[key];
      if(!name)return;
      const walker=document.createTreeWalker(summary,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        if(node.nodeValue.includes(emoji)){
          const parts=node.nodeValue.split(emoji),frag=document.createDocumentFragment();
          if(parts[0])frag.appendChild(document.createTextNode(parts[0]));
          const icon=document.createElement('i');icon.setAttribute('data-lucide',name);icon.className='ml-category-icon';frag.appendChild(icon);
          if(parts[1])frag.appendChild(document.createTextNode(parts[1]));
          node.parentNode.replaceChild(frag,node);break;
        }
      }
      summary.dataset.mlIconDone='1';
    });
    window.lucide.createIcons({attrs:{'stroke-width':1.8}});
  }

  function pointsFrom(item){
    const candidates=[item?.history,item?.historical,item?.series,item?.sparkline,item?.prices,item?.history?.prices];
    const source=candidates.find(Array.isArray);
    if(!source||source.length<2)return null;
    const out=source.map((p,i)=>{
      if(typeof p==='number')return{time:Math.floor(Date.now()/1000)-(source.length-1-i)*86400,value:p};
      const value=Number(p?.value??p?.price??p?.close??p?.y);
      if(!Number.isFinite(value))return null;
      let time=p?.time??p?.timestamp??p?.date;
      if(typeof time==='string'){const d=Date.parse(time);time=Number.isFinite(d)?Math.floor(d/1000):null;}
      if(Number(time)>1e12)time=Math.floor(Number(time)/1000);
      if(!Number.isFinite(Number(time)))time=Math.floor(Date.now()/1000)-(source.length-1-i)*86400;
      return{time:Number(time),value};
    }).filter(Boolean);
    return out.length>=2?out:null;
  }

  function chartFor(container,item){
    if(!container||container.dataset.mlChart==='1'||!window.LightweightCharts)return;
    const data=pointsFrom(item);if(!data)return;
    container.dataset.mlChart='1';
    try{
      const chart=LightweightCharts.createChart(container,{width:container.clientWidth||220,height:48,layout:{background:{type:'solid',color:'transparent'},textColor:'transparent',attributionLogo:true},grid:{vertLines:{visible:false},horzLines:{visible:false}},rightPriceScale:{visible:false},leftPriceScale:{visible:false},timeScale:{visible:false},crosshair:{mode:0},handleScroll:false,handleScale:false});
      const series=chart.addSeries(LightweightCharts.LineSeries,{color:'var(--ml-color-accent)',lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
      series.setData(data);chart.timeScale().fitContent();
      container._mlChart=chart;
      const resize=()=>chart.applyOptions({width:container.clientWidth||220});
      if('ResizeObserver' in window)container._mlRO=new ResizeObserver(resize),container._mlRO.observe(container);else window.addEventListener('resize',resize);
    }catch(e){container.dataset.mlChart='0';console.warn('Miracolo visual chart:',e.message);}
  }

  function applyCharts(){
    const market=window.ML?.state?.market||window.ML?.state?.data?.market||window.__ML_MARKET;
    const items=market?.indices||[];
    document.querySelectorAll('.v1-index').forEach(card=>{
      if(card.querySelector('.ml-sparkline'))return;
      const name=card.querySelector('.v1-index-main strong')?.textContent?.trim();if(!name)return;
      const item=items.find(x=>String(x.name)===name);if(!item)return;
      const points=pointsFrom(item);if(!points)return;
      const el=document.createElement('div');el.className='ml-sparkline';card.appendChild(el);chartFor(el,item);
    });
  }

  function enhance(){
    document.querySelectorAll('.v1-ai-loading').forEach(skeleton);
    applyGauge();applyIcons();applyCharts();
  }

  function install(){
    if(window.__ML_VISUAL_ENHANCEMENTS)return;
    window.__ML_VISUAL_ENHANCEMENTS=true;
    enhance();
    const observer=new MutationObserver(()=>enhance());
    observer.observe(document.getElementById('results')||document.body,{subtree:true,childList:true});
    window.addEventListener('resize',()=>applyCharts());
    window.addEventListener('miracolo:state',enhance);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
