/* Miracolo Lab V1 — Dashboard. Single V1 renderer for market intelligence. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
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
  function marketAnalysis(market, items) {
    const indices=(market?.indices||[]).filter(x=>x.ok&&Number.isFinite(Number(x.changePct)));
    if(!indices.length)return null;
    let total=0,weight=0,up=0,down=0;
    indices.forEach(x=>{
      let w=['SP500','NASDAQ100','DOW','EUROSTOXX','DAX','FTSEMIB','NIKKEI','HANGSENG'].includes(String(x.name))?1.4:1;
      let s=clamp(50+num(x.changePct)*12,0,100), r=num(x.rsi);
      if(r){if(r>=55&&r<=70)s+=7;else if(r>75)s-=6;else if(r<35)s-=7;else if(r<45)s-=4}
      s=clamp(s,0,100); total+=s*w; weight+=w; if(s>=58)up++; if(s<=42)down++;
    });
    const base=clamp(Math.round(total/weight),0,100);
    const crypto=(market?.crypto||[]).filter(x=>x.ok&&num(x.change24h)!==0);
    const cryptoScore=crypto.length?Math.round(crypto.reduce((a,x)=>a+clamp(50+num(x.change24h)*5,0,100),0)/crypto.length):0;
    const score=clamp(Math.round(crypto.length?base*.82+cryptoScore*.18:base),0,100);
    const valid=[...indices].sort((a,b)=>num(b.changePct)-num(a.changePct));
    const leaders=valid.slice(0,3).filter(x=>num(x.changePct)>0).map(x=>`${x.name} +${num(x.changePct).toFixed(2)}%`);
    const laggards=valid.slice(-3).filter(x=>num(x.changePct)<0).reverse().map(x=>`${x.name} ${num(x.changePct).toFixed(2)}%`);
    const vix=indices.find(x=>x.name==='VIX'), gold=indices.find(x=>x.name==='GOLD'), us10=indices.find(x=>x.name==='US10Y');
    const risks=[];
    if(vix&&num(vix.changePct)>2)risks.push('la volatilità sta aumentando');
    if(gold&&num(gold.changePct)>1)risks.push('l’oro mostra una domanda difensiva');
    if(us10&&num(us10.changePct)>1)risks.push('i rendimenti USA stanno salendo');
    const newsCount=(items||[]).length;
    const positiveNews=(items||[]).filter(x=>num(x.score)>0).length;
    const negativeNews=(items||[]).filter(x=>num(x.score)<0).length;
    const positives=[];
    if(leaders.length)positives.push(`forza in ${leaders.join(', ')}`);
    if(up>down)positives.push(`prevalgono gli indici costruttivi (${up} contro ${down})`);
    if(cryptoScore>=58)positives.push('il comparto crypto conferma un tono favorevole al rischio');
    if(positiveNews>negativeNews&&newsCount)positives.push(`il flusso informativo è prevalentemente positivo (${positiveNews} segnali contro ${negativeNews})`);
    const negatives=[];
    if(laggards.length)negatives.push(`pressione su ${laggards.join(', ')}`);
    if(down>up)negatives.push(`prevalgono gli indici deboli (${down} contro ${up})`);
    if(cryptoScore&&cryptoScore<42)negatives.push('il comparto crypto non conferma il movimento');
    if(negativeNews>positiveNews&&newsCount)negatives.push(`il flusso informativo è prevalentemente negativo (${negativeNews} segnali contro ${positiveNews})`);
    let conclusion=score>=68?'Il quadro è favorevole al rischio, ma va verificata la qualità del movimento e la sua ampiezza.':score>=56?'Il quadro è costruttivo, ma non abbastanza uniforme per parlare di rialzo forte.':score<=32?'Il quadro è chiaramente difensivo: la pressione negativa prevale e il rischio di ulteriore deterioramento va monitorato.':score<=44?'Il quadro è debole e richiede conferme prima di assumere esposizione.':'Il quadro è misto: i segnali non convergono abbastanza per una direzione dominante.';
    if(risks.length)conclusion+=' '+risks.join('; ')+'.';
    const confidence=clamp(Math.round(58+Math.abs(score-50)*.75+(Math.abs(up-down)/Math.max(1,indices.length))*10),58,94);
    const label=score>=68?'Rialzista':score>=56?'Moderatamente rialzista':score<=32?'Ribassista':score<=44?'Moderatamente ribassista':'Neutrale / misto';
    return {score,label,confidence,text:conclusion,positives,negatives,risks,cryptoScore,newsCount};
  }
  function render(data) {
    const scan=data.scan||{}, items=scan.items||scan.signals||scan.results||[], sources=scan.sources||[], summary=scan.summary||{};
    const root=document.getElementById('results'); if(!root)return;
    const ma=marketAnalysis(data.market,items);
    const buckets=Object.fromEntries(groups.map(([k])=>[k,[]]));
    items.forEach(x=>buckets[group(x)].push(x));
    const sourceHtml=groups.map(([k,label,icon])=>{const a=buckets[k];if(!a.length)return '';return `<details class="v1-category" ${k==='news'||k==='finance'?'open':''}><summary>${icon} ${label}<span>${a.length}</span></summary><div>${a.slice(0,20).map(article).join('')}</div></details>`;}).join('');
    const okSources=sources.filter(x=>x.status==='ok').length;
    root.innerHTML=`
      <section class="v1-card v1-market-card"><div class="v1-card-head"><div><b>MARKET SENTIMENT</b><small>Sintesi integrata di mercato, flussi informativi e segnali</small></div><strong>${ma?ma.score+'/100':'—'}</strong></div>${ma?`<div class="v1-market-label">${esc(ma.label)} · confidenza ${ma.confidence}%</div><div class="v1-ai-comment"><div class="v1-ai-title">COMMENTO AI</div><p>${esc(ma.text)}</p>${ma.positives.length?`<div class="v1-ai-block"><b>Segnali favorevoli</b><span>${esc(ma.positives.join(' · '))}</span></div>`:''}${ma.negatives.length?`<div class="v1-ai-block"><b>Segnali contrari</b><span>${esc(ma.negatives.join(' · '))}</span></div>`:''}${ma.risks.length?`<div class="v1-ai-block"><b>Rischi da monitorare</b><span>${esc(ma.risks.join(' · '))}</span></div>`:''}<div class="v1-ai-foot">Lettura automatica di indici, crypto e flusso informativo · ${ma.newsCount} elementi analizzati</div></div>`:'<div class="v1-empty">Dati di mercato non disponibili.</div>'}</section>
      <section class="v1-card"><details class="v1-section" open><summary>📈 SENTIMENT INDICI DI BORSA <b>${ma?ma.score+'/100':'—'}</b></summary><div class="v1-index-grid">${(data.market?.indices||[]).filter(x=>x.ok).slice(0,12).map(x=>{const ch=Number(x.changePct);return `<div class="v1-index"><strong>${esc(x.name)}</strong><span>${Number.isFinite(ch)?(ch>=0?'+':'')+ch.toFixed(2)+'%':'—'}</span></div>`}).join('')||'<div class="v1-empty">Dati non disponibili.</div>'}</div></details></section>
      <section class="v1-card"><details class="v1-section" open><summary>📚 FONTI RICEVUTE <b>${okSources} OK · ${sources.length} fonti</b></summary><div class="v1-source-groups">${sourceHtml||'<div class="v1-empty">Nessun articolo disponibile.</div>'}</div></details></section>`;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v??'—'};
    set('hNews',summary.news);set('hSocial',summary.social);set('hStrong',summary.strong);set('hTime',new Date().toLocaleTimeString('it-IT'));
  }
  window.ML.on('state', state=>render(state));
  document.addEventListener('DOMContentLoaded',()=>{if(window.ML?.state)render(window.ML.state);});
})();
