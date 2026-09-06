/* Miracolo Lab V1 — Dashboard intelligence. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const groups=[
    ['news','Notizie','📰'],['finance','Finance','💹'],['crypto','Cripto','₿'],['macro','Macroeconomia','🌍'],
    ['rates','Obbligazioni / Tassi','💶'],['central','Banche Centrali','🏦'],['commodities','Commodities','🛢️'],
    ['fx','Forex','💱'],['volatility','Volatilità','📊'],['geopolitics','Geopolitica','🌐'],
    ['social','Social / Sentiment','💬'],['company','Società / Earnings','🏢']
  ];
  function group(x){
    const raw=`${x.cat||x.type||''} ${x.source||''} ${x.title||''} ${x.description||''}`.toLowerCase();
    const t=String(x.cat||x.type||'').toLowerCase();
    if(t==='crypto'||/crypto|bitcoin|ethereum|solana|xrp|coindesk/.test(raw))return'crypto';
    if(t==='macro'||/inflation|cpi|pce|gdp|payroll|pmi|fred|bls|bea|eurostat|liquidity/.test(raw))return'macro';
    if(t==='rates'||/treasury|bond|yield|bund|btp|gilt|credit spread|high yield|cds/.test(raw))return'rates';
    if(t==='central'||/fed|ecb|boe|boj|snb|rba|central bank/.test(raw))return'central';
    if(t==='commodities'||/gold|silver|oil|brent|wti|copper|opec|gas/.test(raw))return'commodities';
    if(t==='fx'||/forex|eurusd|eur\/usd|dxy|usd[jy]|gbp|sterling|dollar|yen/.test(raw))return'fx';
    if(t==='volatility'||/vix|volatility|options|gamma|put.?call|open interest/.test(raw))return'volatility';
    if(t==='geopolitics'||/geopolitic|sanction|tariff|war|conflict|ukraine|russia|iran|israel/.test(raw))return'geopolitics';
    if(t==='social'||/reddit|social|sentiment|wallstreetbets/.test(raw))return'social';
    if(t==='company'||/earnings|company|corporate|sec filing|revenue|guidance|buyback|jpmorgan|goldman|banking/.test(raw))return'company';
    if(/finance|market|stock|equity|etf|nasdaq|s&p|dow|dax|nikkei|ftse|msci/.test(raw))return'finance';
    return'news';
  }
  function article(x){
    const href=x.url||x.link||'',title=esc(x.title||x.headline||'Articolo senza titolo'),source=esc(x.source||x.feed||x.publisher||'Fonte'),score=Number(x.score||0),tone=score>0?'POSITIVO':score<0?'NEGATIVO':'NEUTRALE';
    const body=`<span class="v1-article-title">${title}</span><span class="v1-article-meta">${source} · ${tone}</span>`;
    return href?`<a class="v1-article" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${body}</a>`:`<div class="v1-article">${body}</div>`;
  }
  function marketAnalysis(market,items){
    const indices=(market?.indices||[]).filter(x=>x.ok&&Number.isFinite(Number(x.changePct)));
    if(!indices.length)return null;
    let total=0,weight=0,up=0,down=0;
    indices.forEach(x=>{
      const w=['SP500','NASDAQ100','DOW','EUROSTOXX','DAX','FTSEMIB','NIKKEI','HANGSENG'].includes(String(x.name))?1.4:1;
      let s=clamp(50+num(x.changePct)*12,0,100),r=num(x.rsi);
      if(r){if(r>=55&&r<=70)s+=7;else if(r>75)s-=6;else if(r<35)s-=7;else if(r<45)s-=4;}
      s=clamp(s,0,100);total+=s*w;weight+=w;if(s>=58)up++;if(s<=42)down++;
    });
    const base=clamp(Math.round(total/weight),0,100),crypto=(market?.crypto||[]).filter(x=>x.ok&&num(x.change24h)!==0);
    const cryptoScore=crypto.length?Math.round(crypto.reduce((a,x)=>a+clamp(50+num(x.change24h)*5,0,100),0)/crypto.length):0;
    const score=clamp(Math.round(crypto.length?base*.82+cryptoScore*.18:base),0,100);
    const valid=[...indices].sort((a,b)=>num(b.changePct)-num(a.changePct));
    const leaders=valid.slice(0,3).filter(x=>num(x.changePct)>0).map(x=>`${x.name} +${num(x.changePct).toFixed(2)}%`);
    const laggards=valid.slice(-3).filter(x=>num(x.changePct)<0).reverse().map(x=>`${x.name} ${num(x.changePct).toFixed(2)}%`);
    const vix=indices.find(x=>x.name==='VIX'),gold=indices.find(x=>x.name==='GOLD'),us10=indices.find(x=>x.name==='US10Y'),risks=[];
    if(vix&&num(vix.changePct)>2)risks.push('la volatilità sta aumentando');
    if(gold&&num(gold.changePct)>1)risks.push('l’oro mostra una domanda difensiva');
    if(us10&&num(us10.changePct)>1)risks.push('i rendimenti USA stanno salendo');
    const positiveNews=items.filter(x=>num(x.score)>0).length,negativeNews=items.filter(x=>num(x.score)<0).length,newsCount=items.length,positives=[],negatives=[];
    if(leaders.length)positives.push(`forza in ${leaders.join(', ')}`);
    if(up>down)positives.push(`prevalgono gli indici costruttivi (${up} contro ${down})`);
    if(cryptoScore>=58)positives.push('crypto favorevole al rischio');
    if(positiveNews>negativeNews&&newsCount)positives.push(`flusso informativo positivo (${positiveNews} contro ${negativeNews})`);
    if(laggards.length)negatives.push(`pressione su ${laggards.join(', ')}`);
    if(down>up)negatives.push(`prevalgono gli indici deboli (${down} contro ${up})`);
    if(cryptoScore&&cryptoScore<42)negatives.push('crypto non conferma il movimento');
    if(negativeNews>positiveNews&&newsCount)negatives.push(`flusso informativo negativo (${negativeNews} contro ${positiveNews})`);
    const label=score>=68?'Rialzista':score>=56?'Moderatamente rialzista':score<=32?'Ribassista':score<=44?'Moderatamente ribassista':'Neutrale / misto';
    const confidence=clamp(Math.round(58+Math.abs(score-50)*.75+(Math.abs(up-down)/Math.max(1,indices.length))*10),58,94);
    return{score,label,confidence,positives,negatives,risks,cryptoScore,newsCount,leaders,laggards};
  }
  function fallback(ma){return{headline:`Quadro ${ma.label.toLowerCase()}: il mercato non mostra una direzione dominante.`,summary:`Gli indici monitorati restituiscono un punteggio di ${ma.score}/100. ${ma.positives.join('. ')}${ma.negatives.length?' '+ma.negatives.join('. ')+'.':''} Il quadro va letto insieme al flusso di notizie e ai temi macro, tassi, banche centrali, commodities, forex, volatilità, geopolitica, crypto e social.`,bullish:ma.positives.join(' · '),bearish:ma.negatives.join(' · '),watch:ma.risks.join(' · ')||'Monitorare la convergenza tra indici, volatilità e nuove informazioni macro.',source:'Sintesi automatica V1'};}
  async function aiRecap(data,ma){
    const fb=fallback(ma),key=typeof CFG!=='undefined'?CFG.geminiKey:'';
    if(!key)return fb;
    const items=(data.scan?.items||[]).slice(0,150),indices=(data.market?.indices||[]).filter(x=>x.ok).map(x=>({name:x.name,changePct:Number(x.changePct),rsi:x.rsi})),crypto=(data.market?.crypto||[]).filter(x=>x.ok).map(x=>({symbol:x.symbol,change24h:x.change24h})),headlines=items.map(x=>`[${x.source||'Fonte'}][${group(x)}] ${x.title||''}`).join('\n');
    const prompt=`Sei l'analista AI di Miracolo Lab. Devi produrre il recap operativo del mercato sulla base delle informazioni ricevute. Considera congiuntamente indici, news, finance, crypto, macroeconomia, obbligazioni/tassi, banche centrali, commodities, forex, volatilità, geopolitica, social/sentiment e società/earnings. Dai priorità a eventi ricorrenti, informazioni market-moving e convergenze/divergenze. Non inventare dati. Scrivi in italiano semplice ma professionale.\n\nINDICI:\n${JSON.stringify(indices)}\nCRYPTO:\n${JSON.stringify(crypto)}\nFONTI/HEADLINES:\n${headlines}\n\nRestituisci SOLO JSON valido: {"headline":"una frase di sintesi","summary":"80-140 parole sul quadro e sui principali driver","bullish":"massimo 2 frasi sui fattori favorevoli","bearish":"massimo 2 frasi sui rischi/fattori contrari","watch":"massimo 2 frasi su cosa monitorare"}`;
    try{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.2,maxOutputTokens:600}})});
      if(!r.ok)throw Error('Gemini HTTP '+r.status);
      const d=await r.json(),text=d.candidates?.[0]?.content?.parts?.[0]?.text||'',m=text.match(/\{[\s\S]*\}/);if(!m)throw Error('AI JSON non valido');
      const o=JSON.parse(m[0]);return{headline:o.headline||fb.headline,summary:o.summary||fb.summary,bullish:o.bullish||fb.bullish,bearish:o.bearish||fb.bearish,watch:o.watch||fb.watch,source:'AI Gemini'};
    }catch(e){console.warn('V1 Market Sentiment AI:',e.message);return fb;}
  }
  let lastKey='',requestId=0;
  async function renderAI(data,ma){
    const box=document.getElementById('v1-market-content');if(!box||!ma)return;
    const key=(data.scan?.timestamp||data.market?.timestamp||'')+'|'+(data.scan?.items?.length||0)+'|'+ma.score;if(key===lastKey)return;lastKey=key;
    const id=++requestId;box.innerHTML='<div class="v1-ai-loading">Analisi AI del flusso ricevuto in corso…</div>';
    const r=await aiRecap(data,ma);if(id!==requestId)return;
    box.innerHTML=`<div class="v1-ai-headline">${esc(r.headline)}</div><p class="v1-ai-summary">${esc(r.summary)}</p>${r.bullish?`<div class="v1-ai-block"><b>Fattori favorevoli</b><span>${esc(r.bullish)}</span></div>`:''}${r.bearish?`<div class="v1-ai-block"><b>Rischi / fattori contrari</b><span>${esc(r.bearish)}</span></div>`:''}${r.watch?`<div class="v1-ai-block"><b>Da monitorare</b><span>${esc(r.watch)}</span></div>`:''}<div class="v1-ai-foot">${esc(r.source)} · ${ma.newsCount} elementi informativi nel dataset</div>`;
  }
  function render(data){
    const scan=data.scan||{},items=scan.items||scan.signals||scan.results||[],sources=scan.sources||[],summary=scan.summary||{},root=document.getElementById('results');if(!root)return;
    const ma=marketAnalysis(data.market,items),buckets=Object.fromEntries(groups.map(([k])=>[k,[]]));items.forEach(x=>buckets[group(x)].push(x));
    const sourceHtml=groups.map(([k,label,icon])=>{
      const a=buckets[k],uniqueSources=[...new Set(a.map(x=>x.source||x.feed||x.publisher).filter(Boolean))],count=a.length;
      const articles=a.length?a.slice(0,50).map(article).join(''):`<div class="v1-empty">Nessuna notizia ricevuta in questa categoria.</div>`;
      const meta=`${count} ${count===1?'notizia':'notizie'}${uniqueSources.length?` · ${uniqueSources.length} ${uniqueSources.length===1?'fonte':'fonti'}`:''}`;
      return `<details class="v1-category" ${k==='news'||k==='finance'?'open':''}><summary>${icon} ${label}<span>${count}</span><small>${meta}</small></summary><div>${articles}</div></details>`;
    }).join('');
    const okSources=sources.filter(x=>x.status==='ok').length;
    root.innerHTML=`<section class="v1-card v1-market-card"><div class="v1-card-head"><div><b>MARKET SENTIMENT</b><small>Recap AI integrato di tutte le fonti ricevute</small></div><strong>${ma?ma.score+'/100':'—'}</strong></div>${ma?`<div class="v1-market-label">${esc(ma.label)} · confidenza ${ma.confidence}%</div><div id="v1-market-content" class="v1-market-content"><div class="v1-ai-loading">Preparazione del recap AI…</div></div>`:'<div class="v1-empty">Dati di mercato non disponibili.</div>'}</section><section class="v1-card"><details class="v1-section" open><summary>📈 SENTIMENT INDICI DI BORSA <b>${ma?ma.score+'/100':'—'}</b></summary><div class="v1-index-grid">${(data.market?.indices||[]).filter(x=>x.ok).slice(0,12).map(x=>{const ch=Number(x.changePct);return`<div class="v1-index"><strong>${esc(x.name)}</strong><span>${Number.isFinite(ch)?(ch>=0?'+':'')+ch.toFixed(2)+'%':'—'}</span></div>`}).join('')||'<div class="v1-empty">Dati non disponibili.</div>'}</div></details></section><section class="v1-card"><details class="v1-section" open><summary>📚 FONTI RICEVUTE <b>${okSources} OK · ${sources.length} fonti</b></summary><div class="v1-source-groups">${sourceHtml}</div></details></section>`;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v??'—'};set('hNews',summary.news);set('hSocial',summary.social);set('hStrong',summary.strong);set('hTime',new Date().toLocaleTimeString('it-IT'));renderAI(data,ma).catch(()=>{});
  }
  window.ML.on('state',state=>render(state));
  document.addEventListener('DOMContentLoaded',()=>{if(window.ML?.state)render(window.ML.state);});
})();
