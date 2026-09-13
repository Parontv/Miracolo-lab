/* Miracolo Lab — News Feed bridge. Canonical News Contract -> visible Dashboard submenus. */
(() => {
  'use strict';
  const C=window.ML_NEWS_CONTRACT;
  if(!C||!window.ML)return;
  const LABELS={news:['Notizie','📰'],finance:['Finance','💹'],crypto:['Cripto','₿'],macro:['Macroeconomia','🌍'],rates:['Obbligazioni / Tassi','💶'],central:['Banche Centrali','🏦'],commodities:['Commodities','🛢️'],fx:['Forex','💱'],volatility:['Volatilità','📊'],geopolitics:['Geopolitica','🌐'],social:['Social / Sentiment','💬'],company:['Società / Earnings','🏢']};
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const article=x=>{const href=x.url||x.link||'';const title=esc(x.title||x.headline||'Articolo senza titolo');const source=esc(x.source||x.feed||x.publisher||'Fonte');const date=esc(x.date||x.published||x.publishedAt||x.timestamp||'');const body=`<span class="v1-article-title">${title}</span><span class="v1-article-meta">${[source,date].filter(Boolean).join(' · ')}</span>`;return href?`<a class="v1-article" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${body}</a>`:`<div class="v1-article">${body}</div>`};
  function renderNewsSubmenus(scan){
    const root=document.getElementById('results');if(!root||!scan)return;
    const normalized=C.normalize(scan),buckets=normalized.categories||{};
    const html=C.GROUPS.map(k=>{const a=Array.isArray(buckets[k])?buckets[k]:[];const [label,icon]=LABELS[k]||[k,'📰'];const sources=[...new Set(a.map(x=>x.source||x.feed||x.publisher).filter(Boolean))];const meta=`${a.length} ${a.length===1?'notizia':'notizie'}${sources.length?' · '+sources.length+' '+(sources.length===1?'fonte':'fonti'):''}`;return `<details class="v1-category" ${a.length?'':'class="v1-category-empty"'}><summary>${icon} ${label}<span>${a.length}</span><small>${meta}</small></summary><div>${a.slice(0,C.MAX_PER_CATEGORY).map(article).join('')||'<div class="v1-empty">Nessuna notizia disponibile.</div>'}</div></details>`}).join('');
    const existing=root.querySelector('.v1-news-categories');
    if(existing){existing.querySelector('.v1-source-groups').innerHTML=html;const b=existing.querySelector('summary b');if(b)b.textContent=`${normalized.items?.length||0} articoli`;}
    else root.insertAdjacentHTML('beforeend',`<section class="v1-card v1-news-categories"><details class="v1-section" open><summary>📰 NEWS FEED <b>${normalized.items?.length||0} articoli</b></summary><div class="v1-source-groups">${html}</div></details></section>`);
  }
  function sync(detail){const scan=detail?.scan||window.ML.state?.scan;if(!scan)return;const items=Array.isArray(scan.items)?scan.items:[];if(window.S&&Array.isArray(window.S.signals))window.S.signals=items.slice();renderNewsSubmenus(scan);}
  window.ML.on('state',sync);window.ML.on('data',sync);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>sync(window.ML.state),150));
  /* app.js still owns the legacy signal renderer; prevent it from overwriting the canonical category feed. */
  const protect=()=>{if(typeof window.renderFeed!=='function'||window.renderFeed.__mlNewsBridge)return;const legacy=window.renderFeed;const wrapped=function(){const scan=window.ML.state?.scan;if(scan&&Array.isArray(scan.items)&&scan.items.length){sync({scan});return;}return legacy.apply(this,arguments)};wrapped.__mlNewsBridge=true;window.renderFeed=wrapped;};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(protect,200),{once:true});else setTimeout(protect,50);
})();
