/* Miracolo Lab V1 — Dashboard. No V6/V19/V20/V21 renderer dependencies. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const groups = [['news','Notizie','📰'],['finance','Finance','💹'],['crypto','Cripto','₿'],['macro','Macroeconomia','🌍'],['rates','Obbligazioni / Tassi','💶'],['central','Banche Centrali','🏦'],['commodities','Commodities','🛢️'],['fx','Forex','💱'],['volatility','Volatilità','📊'],['geopolitics','Geopolitica','🌐'],['social','Social / Sentiment','💬'],['company','Società / Earnings','🏢']];
  function group(x) {
    const raw = `${x.cat||x.type||''} ${x.source||''} ${x.title||''} ${x.description||''}`.toLowerCase();
    const t = String(x.cat||x.type||'').toLowerCase();
    if (t==='crypto'||/crypto|bitcoin|ethereum|solana|xrp|coindesk/.test(raw)) return 'crypto';
    if (t==='macro'||/inflation|cpi|pce|gdp|payroll|pmi|fred|bls|bea|eurostat|liquidity/.test(raw)) return 'macro';
    if (t==='rates'||/treasury|bond|yield|bund|btp|gilt|credit spread|high yield|cds/.test(raw)) return 'rates';
    if (t==='central'||/fed|ecb|boe|boj|snb|rba|central bank/.test(raw)) return 'central';
    if (t==='commodities'||/gold|silver|oil|brent|wti|copper|opec|gas/.test(raw)) return 'commodities';
    if (t==='fx'||/forex|eurusd|eur\/usd|dxy|usd[jy]|gbp|sterling|dollar|yen/.test(raw)) return 'fx';
    if (t==='volatility'||/vix|volatility|options|gamma|put.?call|open interest/.test(raw)) return 'volatility';
    if (t==='geopolitics'||/geopolitic|sanction|tariff|war|conflict|ukraine|russia|iran|israel/.test(raw)) return 'geopolitics';
    if (t==='social'||/reddit|social|sentiment|wallstreetbets/.test(raw)) return 'social';
    if (t==='company'||/earnings|company|corporate|sec filing|revenue|guidance|buyback|jpmorgan|goldman|banking/.test(raw)) return 'company';
    if (/finance|market|stock|equity|etf|nasdaq|s&p|dow|dax|nikkei|ftse|msci/.test(raw)) return 'finance';
    return 'news';
  }
  function article(x) {
    const href=x.url||x.link||'';
    const title=esc(x.title||x.headline||'Articolo senza titolo');
    const source=esc(x.source||x.feed||x.publisher||'Fonte');
    const score=Number(x.score||0), tone=score>0?'POSITIVO':score<0?'NEGATIVO':'NEUTRALE';
    const body=`<span class="v1-article-title">${title}</span><span class="v1-article-meta">${source} · ${tone}</span>`;
    return href ? `<a class="v1-article" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${body}</a>` : `<div class="v1-article">${body}</div>`;
  }
  function marketScore(market) {
    const xs=(market?.indices||[]).filter(x=>x.ok&&Number.isFinite(Number(x.changePct)));
    if(!xs.length)return null;
    const avg=xs.reduce((a,x)=>a+Number(x.changePct),0)/xs.length;
    const score=Math.max(0,Math.min(100,Math.round(50+avg*12)));
    const label=score>=68?'Rialzista':score>=56?'Moderatamente rialzista':score<=32?'Ribassista':score<=44?'Moderatamente ribassista':'Neutrale / misto';
    return {score,label,avg};
  }
  function render(data) {
    const scan=data.scan||{}, items=scan.items||scan.signals||scan.results||[], sources=scan.sources||[], summary=scan.summary||{};
    const root=document.getElementById('results'); if(!root)return;
    const ms=marketScore(data.market);
    const buckets=Object.fromEntries(groups.map(([k])=>[k,[]]));
    items.forEach(x=>buckets[group(x)].push(x));
    const sourceHtml=groups.map(([k,label,icon])=>{const a=buckets[k];if(!a.length)return '';return `<details class="v1-category" ${k==='news'||k==='finance'?'open':''}><summary>${icon} ${label}<span>${a.length}</span></summary><div>${a.slice(0,20).map(article).join('')}</div></details>`;}).join('');
    const okSources=sources.filter(x=>x.status==='ok').length;
    root.innerHTML=`
      <section class="v1-card v1-market-card"><div class="v1-card-head"><div><b>MARKET SENTIMENT</b><small>Quadro sintetico degli indici monitorati</small></div><strong>${ms?ms.score+'/100':'—'}</strong></div>${ms?`<div class="v1-market-label">${esc(ms.label)} · variazione media ${ms.avg>=0?'+':''}${ms.avg.toFixed(2)}%</div>`:'<div class="v1-empty">Dati di mercato non disponibili.</div>'}</section>
      <section class="v1-card"><details class="v1-section" open><summary>📈 SENTIMENT INDICI DI BORSA <b>${ms?ms.score+'/100':'—'}</b></summary><div class="v1-index-grid">${(data.market?.indices||[]).filter(x=>x.ok).slice(0,12).map(x=>{const ch=Number(x.changePct);return `<div class="v1-index"><strong>${esc(x.name)}</strong><span>${Number.isFinite(ch)?(ch>=0?'+':'')+ch.toFixed(2)+'%':'—'}</span></div>`}).join('')||'<div class="v1-empty">Dati non disponibili.</div>'}</div></details></section>
      <section class="v1-card"><details class="v1-section" open><summary>📚 FONTI RICEVUTE <b>${okSources} OK · ${sources.length} fonti</b></summary><div class="v1-source-groups">${sourceHtml||'<div class="v1-empty">Nessun articolo disponibile.</div>'}</div></details></section>`;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v??'—'};
    set('hNews',summary.news);set('hSocial',summary.social);set('hStrong',summary.strong);set('hTime',new Date().toLocaleTimeString('it-IT'));
  }
  window.ML.on('state', state=>render(state));
  document.addEventListener('DOMContentLoaded',()=>{if(window.ML?.state)render(window.ML.state);});
})();
