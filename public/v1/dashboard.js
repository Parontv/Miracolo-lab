/* Miracolo Lab V1 — Dashboard intelligence. */
(() => {
  'use strict';
  const CONTRACT=window.ML_NEWS_CONTRACT;
  if(!CONTRACT) throw new Error('Miracolo Lab: News Contract missing');
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const hasNum=(o,...keys)=>keys.some(k=>Number.isFinite(Number(o?.[k])));
  const MAX_PER_CATEGORY=CONTRACT.MAX_PER_CATEGORY;
  const LABELS={news:['Notizie','📰'],finance:['Finance','💹'],crypto:['Cripto','₿'],macro:['Macroeconomia','🌍'],rates:['Obbligazioni / Tassi','💶'],central:['Banche Centrali','🏦'],commodities:['Commodities','🛢️'],fx:['Forex','💱'],volatility:['Volatilità','📊'],geopolitics:['Geopolitica','🌐'],social:['Social / Sentiment','💬'],company:['Società / Earnings','🏢']};
  const groups=CONTRACT.GROUPS.map(k=>[k,...(LABELS[k]||[k,'📰'])]);

  function article(x){
    const href=x.url||x.link||'';
    const title=esc(x.title||x.headline||'Articolo senza titolo');
    const source=esc(x.source||x.feed||x.publisher||'Fonte');
    const score=Number(x.score||0);
    const tone=score>0?'POSITIVO':score<0?'NEGATIVO':'NEUTRALE';
    const body=`<span class="v1-article-title">${title}</span><span class="v1-article-meta">${source} · ${tone}</span>`;
    return href?`<a class="v1-article" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${body}</a>`:`<div class="v1-article">${body}</div>`;
  }

  function regimeLabel(ai){
    const raw=String(ai?.bias||ai?.regime||'').toLowerCase();
    const labels={
      risk_on:'Risk-on',risk_off:'Risk-off',neutral:'Neutrale',mixed:'Misto',
      rialzista:'Rialzista',moderatamente_rialzista:'Moderatamente rialzista',
      ribassista:'Ribassista',moderatamente_ribassista:'Moderatamente ribassista'
    };
    return labels[raw]||ai?.bias||ai?.regime||'';
  }

  function unifiedComment(ai){
    if(!ai) return '';
    if(ai.commentary) return String(ai.commentary);
    const parts=[];
    if(ai.thesis) parts.push(String(ai.thesis));
    if(ai.summary) parts.push(String(ai.summary));
    if(ai.watch) parts.push(String(ai.watch));
    return parts.join(' ');
  }

  function renderMarketText(ai){
    if(!ai) return '<div class="v1-ai-loading">Analisi AI non ancora disponibile. Aggiorno il quadro di mercato…</div>';
    const headline=ai.headline||'Lettura del mercato';
    const label=regimeLabel(ai);
    const comment=unifiedComment(ai);
    return `<div class="v1-ai-headline">${esc(headline)}</div>${label?`<div class="v1-market-regime">${esc(label)}</div>`:''}<p class="v1-ai-summary">${esc(comment||'Analisi in aggiornamento…')}</p>`;
  }

  async function fetchAI(){
    try{
      const res=await fetch('/api/ai?ts='+Date.now(),{cache:'no-store'});
      if(!res.ok) throw new Error(`AI HTTP ${res.status}`);
      const payload=await res.json();
      return payload?.ai||null;
    }catch(e){
      console.warn('Market Sentiment AI:',e.message);
      return null;
    }
  }

  async function renderAI(){
    const box=document.getElementById('v1-market-content');
    if(!box)return;
    box.innerHTML='<div class="v1-ai-loading">Lettura di mercato, news e cross-asset in corso…</div>';
    const ai=await fetchAI();
    if(ai){box.innerHTML=renderMarketText(ai);return;}
    box.innerHTML='<div class="v1-ai-loading">Analisi AI in aggiornamento. Il quadro verrà mostrato appena disponibile.</div>';
  }

  async function manualNewsSearch(btn){
    if(!window.ML?.data?.forceNewsScan||btn?.disabled)return;
    if(btn){btn.disabled=true;btn.innerHTML='⟳ Ricerca notizie…';}
    const box=document.getElementById('v1-market-content');
    if(box)box.innerHTML='<div class="v1-ai-loading">Ricerca delle notizie in corso… analizzo le fonti e aggiorno il Market Sentiment.</div>';
    try{
      await window.ML.data.forceNewsScan();
      await renderAI();
    }catch(e){
      if(box)box.innerHTML=`<div class="v1-empty">Ricerca non riuscita: ${esc(e.message||e)}</div>`;
    }finally{
      if(btn){btn.disabled=false;btn.innerHTML='🔎 Cerca notizie';}
    }
  }
  window.ML.manualNewsSearch=manualNewsSearch;

  function technicalPulse(x){
    const parts=[];
    const rsi=hasNum(x,'rsi','RSI','rsi14')?Number(x.rsi??x.RSI??x.rsi14):null;
    if(rsi!==null){const warn=rsi>=70||rsi<=30?' ⚠':'';parts.push(`RSI ${rsi.toFixed(0)}${warn}`);}
    const sma20=hasNum(x,'sma20','SMA20','ma20')?Number(x.sma20??x.SMA20??x.ma20):null;
    const sma50=hasNum(x,'sma50','SMA50','ma50')?Number(x.sma50??x.SMA50??x.ma50):null;
    const sma200=hasNum(x,'sma200','SMA200','ma200')?Number(x.sma200??x.SMA200??x.ma200):null;
    const price=Number(x.price??x.value??x.close);
    const arrow=v=>Number.isFinite(price)&&Number.isFinite(v)?(price>v?'↑':price<v?'↓':'→'):null;
    if(sma20!==null&&arrow(sma20))parts.push(`SMA20 ${arrow(sma20)}`);
    if(sma50!==null&&arrow(sma50))parts.push(`SMA50 ${arrow(sma50)}`);
    if(sma200!==null&&arrow(sma200))parts.push(`SMA200 ${arrow(sma200)}`);
    const macd=Number(x.macd??x.MACD??x.macdHist);
    if(Number.isFinite(macd))parts.push(`MACD ${macd>0?'+':macd<0?'−':'0'}`);
    const mom=Number(x.momentum??x.mom??x.MOM??x.momentumPct);
    if(Number.isFinite(mom))parts.push(`MOM ${mom>0?'↑':mom<0?'↓':'→'}`);
    if(!Number.isFinite(macd)&&!Number.isFinite(mom)){const ch=num(x.changePct);if(ch!==0)parts.push(`MOM ${ch>0?'↑':'↓'}`);}
    return parts.join(' · ')+(parts.length?'':'Dati tecnici non disponibili');
  }

  function indexGroup(name){
    const n=String(name||'').toUpperCase();
    if(/VIX|VOL|VXN|VXD|VSTOXX/.test(n))return ['RISK / VOLATILITÀ','risk'];
    if(/GOLD|SILVER|BRENT|WTI|OIL|COPPER|NATGAS|NATURAL/.test(n))return ['COMMODITIES','commodities'];
    if(/DXY|EURUSD|GBPUSD|USDJPY|USDCHF|AUDUSD|USDCAD|USDCNY|FX/.test(n))return ['DOLLARO / FX','fx'];
    if(/3M|2Y|5Y|10Y|30Y|BUND|BTP|TREAS/.test(n))return ['TASSI','rates'];
    if(/DAX|EUROSTOXX|STOXX|CAC|FTSE|MIB|IBEX|AEX|SMI|BEL|OMX|PSI|ATX/.test(n))return ['EUROPA','europe'];
    if(/NIKKEI|TOPIX|HANG|SHANGHAI|SHENZHEN|CSI|KOSPI|KOSDAQ|ASX|NIFTY|SENSEX/.test(n))return ['ASIA / PACIFICO','asia'];
    if(/SP500|S&P|NASDAQ|DOW|RUSSELL|NYSE|MIDCAP|SMALLCAP|MSCI|EMERGING/.test(n))return ['USA / GLOBAL','usa'];
    return ['ALTRI MERCATI','other'];
  }

  function renderIndices(market){
    const all=(market?.indices||[]).filter(x=>x.ok);
    if(!all.length)return '<div class="v1-empty">Dati non disponibili.</div>';
    const sections=new Map();
    all.forEach(x=>{const [label,key]=indexGroup(x.name);if(!sections.has(key))sections.set(key,{label,items:[]});sections.get(key).items.push(x);});
    const order=['usa','europe','asia','risk','commodities','fx','rates','other'];
    let html='';
    order.forEach(key=>{
      const s=sections.get(key);if(!s)return;
      s.items.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
      html+=`<div class="v1-index-group"><div class="v1-index-group-title">${s.label}<span>${s.items.length}</span></div><div class="v1-index-grid">${s.items.map(x=>{const ch=Number(x.changePct),value=x.price??x.value??x.close;return`<div class="v1-index"><div class="v1-index-main"><strong>${esc(x.name)}</strong><span>${Number.isFinite(ch)?(ch>=0?'+':'')+ch.toFixed(2)+'%':'—'}</span><small>${Number.isFinite(Number(value))?Number(value).toLocaleString('it-IT',{maximumFractionDigits:2}):'—'}</small></div><div class="v1-index-tech">${esc(technicalPulse(x))}</div></div>`}).join('')}</div></div>`;
    });
    return html;
  }

  function render(data){
    const scan=data.scan||{};
    const sources=scan.sources||[];
    const summary=scan.summary||{};
    const root=document.getElementById('results');
    if(!root)return;
    const buckets=scan.categories&&typeof scan.categories==='object'?scan.categories:CONTRACT.normalize(scan).categories;
    const sourceHtml=groups.map(([k,label,icon])=>{
      const a=Array.isArray(buckets[k])?buckets[k]:[];
      const uniqueSources=[...new Set(a.map(x=>x.source||x.feed||x.publisher).filter(Boolean))];
      const count=a.length;
      const articles=a.slice(0,MAX_PER_CATEGORY).map(article).join('')||`<div class="v1-empty">Nessuna notizia ricevuta in questa categoria.</div>`;
      const meta=`${count} ${count===1?'notizia':'notizie'}${uniqueSources.length?` · ${uniqueSources.length} ${uniqueSources.length===1?'fonte':'fonti'}`:''}`;
      return `<details class="v1-category" ${k==='news'||k==='finance'?'open':''}><summary>${icon} ${label}<span>${count}</span><small>${meta}</small></summary><div>${articles}</div></details>`;
    }).join('');
    const okSources=sources.filter(x=>x.status==='ok').length;
    root.innerHTML=`<section class="v1-card v1-market-card"><div class="v1-card-head"><div><b>MARKET SENTIMENT</b><small>Analisi AI integrata di news, market data e sentiment globale</small></div><div><button type="button" class="v1-news-search-btn" onclick="window.ML.manualNewsSearch(this)">🔎 Cerca notizie</button></div></div><div id="v1-market-content" class="v1-market-content"><div class="v1-ai-loading">Preparazione del quadro AI…</div></div></section><section class="v1-card v1-indices-card"><details class="v1-section" open><summary>📈 INDICI DI BORSA <b>${(data.market?.indices||[]).filter(x=>x.ok).length} strumenti</b></summary><div class="v1-index-universe">${renderIndices(data.market)}</div></details></section><section class="v1-card"><details class="v1-section" open><summary>📚 FONTI RICEVUTE <b>${okSources} OK · ${sources.length} fonti</b></summary><div class="v1-source-groups">${sourceHtml}</div></details></section>`;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v??'—'};
    set('hNews',summary.news);set('hSocial',summary.social);set('hStrong',summary.strong);set('hTime',new Date().toLocaleTimeString('it-IT'));
    renderAI().catch(e=>console.warn('Market Sentiment render:',e.message));
  }
  window.ML.on('state',state=>render(state));
})();
