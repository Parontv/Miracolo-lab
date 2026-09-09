/* Miracolo Lab V1 — runtime bridge for remaining secondary controls. */
(()=>{
  'use strict';
  if(typeof window.doScan==='function'){
    window.doScan=()=>window.ML?.data?.refresh?.().catch(()=>{});
  }
  if(typeof window.panelSettings==='function'){
    const legacy=window.panelSettings;
    window.panelSettings=()=>String(legacy())
      .replace(/Version<\/span><span class="stat-val">4\.0<\/span>/g,'Version</span><span class="stat-val">1.0</span>')
      .replace(/Gemini 1\.5 Flash \(gratis\)/g,'Gemini 3.8 Flash')
      .replace(/<span class="stat-val">15 feed<\/span>/g,'<span class="stat-val">45 feed</span>');
  }

  /*
   * Protected Market Sentiment mode:
   * the top sentiment is derived from the News Core articles only.
   * Market/index data is deliberately NOT sent to the AI prompt and cannot
   * determine the score or the wording shown in the Market Sentiment card.
   */
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const groups=['news','finance','crypto','macro','rates','central','commodities','fx','volatility','geopolitics','social','company'];
  const labels={news:'Notizie',finance:'Finanza',crypto:'Cripto',macro:'Macroeconomia',rates:'Tassi',central:'Banche centrali',commodities:'Commodities',fx:'Forex',volatility:'Volatilità',geopolitics:'Geopolitica',social:'Social',company:'Società'};
  const group=x=>{const t=String(x.cat||x.type||'').toLowerCase();return groups.includes(t)?t:'news';};
  const scoreOf=x=>{const n=Number(x?.score);return Number.isFinite(n)?n:0;};
  function newsSentiment(items){
    const valid=items.filter(x=>x?.title||x?.description);
    const pos=valid.filter(x=>scoreOf(x)>0).length,neg=valid.filter(x=>scoreOf(x)<0).length,classified=pos+neg;
    const score=classified?Math.round(50+50*(pos-neg)/classified):50;
    const label=score>=68?'Rialzista':score>=56?'Moderatamente rialzista':score<=32?'Ribassista':score<=44?'Moderatamente ribassista':'Neutrale / misto';
    const confidence=Math.max(55,Math.min(92,Math.round(55+Math.min(25,classified/20)+Math.min(12,Math.abs(pos-neg)/Math.max(1,classified)*20))));
    return {score,label,confidence,pos,neg,classified,total:valid.length};
  }
  function balancedNews(items){
    const buckets=Object.fromEntries(groups.map(g=>[g,[]]));
    items.filter(x=>x?.title||x?.description).forEach(x=>buckets[group(x)].push(x));
    Object.values(buckets).forEach(a=>a.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)));
    const out=[];
    for(const g of groups)out.push(...buckets[g].slice(0,15));
    return out.slice(0,180);
  }
  function fallback(s){
    const direction=s.label.toLowerCase();
    const flow=s.classified?`Il flusso informativo rilevato è ${s.pos>s.neg?'prevalentemente positivo':s.neg>s.pos?'prevalentemente negativo':'misto'}, con ${s.pos} segnali positivi e ${s.neg} negativi.`:'Il flusso informativo disponibile non è ancora sufficiente per una direzione netta.';
    return {headline:`Sentiment delle notizie: quadro ${direction}.`,thesis:`La lettura è costruita direttamente sulle notizie ricevute dal News Core, dando priorità ai temi che stanno mostrando maggiore impatto e convergenza.`,summary:`${flow} Il quadro viene interpretato attraverso i contenuti delle notizie: macroeconomia, banche centrali, tassi, finanza, cripto, commodities, valuta, volatilità, geopolitica, società e sentiment. L'obiettivo è capire quale narrativa prevale, quali rischi stanno emergendo e se le informazioni confermano o contraddicono il tono generale.`,bullish:s.pos>s.neg?'Le notizie favorevoli prevalgono nel campione analizzato.':'Non emerge una prevalenza informativa chiaramente favorevole.',bearish:s.neg>s.pos?'Le notizie negative prevalgono e aumentano il rischio di un quadro fragile.':'Non emerge una prevalenza informativa chiaramente negativa.',watch:'Monitorare i nuovi eventi che possono modificare rapidamente la narrativa prevalente.',source:'News Core · sentiment da notizie'};
  }
  async function analyzeNews(items,s){
    const fb=fallback(s),key=typeof CFG!=='undefined'?CFG.geminiKey:'';if(!key)return fb;
    const sample=balancedNews(items);
    const context=sample.map(x=>`[${x.source||'Fonte'}][${labels[group(x)]}] ${x.title||''}\n${String(x.description||'').slice(0,500)}`).join('\n');
    const prompt=`Sei il motore Market Sentiment di Miracolo Lab. Devi leggere le NOTIZIE ricevute dal News Core e ricavare da esse il sentiment del mercato.\n\nREGOLA FONDAMENTALE: il sentiment deve derivare dal contenuto informativo delle notizie. NON usare indici azionari, variazioni di prezzo, RSI, VIX, rendimenti, DXY o altri market data per calcolare o giustificare il sentiment. Non citarli e non elencarli. Non fare una panoramica tecnica dei mercati.\n\nLeggi titoli e contenuti, identifica le narrative dominanti, gli eventi realmente market-moving, i cambiamenti rispetto al quadro precedente, convergenze tra categorie, rischi, opportunità informative e segnali contraddittori. Dai più peso alle informazioni concrete e recenti rispetto a titoli ripetitivi o rumorosi. Considera la distribuzione tra finanza, cripto, macroeconomia, tassi, banche centrali, commodities, FX, volatilità, geopolitica, social e società.\n\nIl risultato deve rispondere soprattutto a: COSA CI STANNO DICENDO LE NOTIZIE? QUAL È IL TONO COMPLESSIVO? QUALI SONO I DRIVER? COSA POTREBBE CAMBIARE IL SENTIMENT?\n\nScrivi in italiano naturale, professionale e diretto. Non inventare eventi o causalità. Non dare target di prezzo né consigli personali di investimento. Non trasformare il commento in un elenco di indici.\n\nNOTIZIE RICEVUTE:\n${context}\n\nRestituisci SOLO JSON valido:\n{"headline":"una frase netta sul sentiment ricavato dalle notizie","thesis":"2-3 frasi sulla narrativa dominante e sui principali driver informativi","summary":"140-220 parole: interpreta le notizie, collega i temi tra categorie, evidenzia convergenze/divergenze e spiega perché il sentiment è quello indicato","bullish":"1-3 frasi sui temi informativi favorevoli","bearish":"1-3 frasi sui rischi o temi informativi contrari","watch":"1-3 frasi su quali nuove notizie potrebbero cambiare il sentiment"}`;
    try{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.2,maxOutputTokens:1100,responseMimeType:'application/json'}})});
      if(!r.ok)throw Error('Gemini HTTP '+r.status);
      const d=await r.json(),text=d.candidates?.[0]?.content?.parts?.[0]?.text||'',m=text.match(/\{[\s\S]*\}/);if(!m)throw Error('AI JSON non valido');
      const o=JSON.parse(m[0]);return{headline:o.headline||fb.headline,thesis:o.thesis||fb.thesis,summary:o.summary||fb.summary,bullish:o.bullish||fb.bullish,bearish:o.bearish||fb.bearish,watch:o.watch||fb.watch,source:'AI Gemini · lettura News Core'};
    }catch(e){console.warn('News-first Market Sentiment:',e.message);return fb;}
  }
  let last='';let busy=0;
  async function renderNewsFirst(detail){
    const data=detail||window.ML?.state||{},items=data.scan?.items||[];if(!items.length)return;
    const key=`${data.scan?.timestamp||''}|${items.length}`;if(key===last||busy)return;last=key;const id=++busy,s=newsSentiment(items);
    const scoreEl=document.querySelector('.v1-market-card .v1-card-head strong');if(scoreEl)scoreEl.textContent=`${s.score}/100`;
    const labelEl=document.querySelector('.v1-market-card .v1-market-label');if(labelEl)labelEl.textContent=`${s.label} · confidenza ${s.confidence}% · sentiment ricavato dalle notizie`;
    const box=document.getElementById('v1-market-content');if(!box){busy=0;return;}
    box.innerHTML='<div class="v1-ai-loading">L\'AI sta leggendo le notizie del News Core e costruendo il sentiment…</div>';
    const r=await analyzeNews(items,s);if(id!==busy)return;
    box.innerHTML=`<div class="v1-ai-headline">${esc(r.headline)}</div>${r.thesis?`<div class="v1-ai-thesis"><b>Lettura dalle notizie</b><span>${esc(r.thesis)}</span></div>`:''}<p class="v1-ai-summary">${esc(r.summary)}</p>${r.bullish?`<div class="v1-ai-block v1-ai-positive"><b>Temi favorevoli</b><span>${esc(r.bullish)}</span></div>`:''}${r.bearish?`<div class="v1-ai-block v1-ai-negative"><b>Temi contrari</b><span>${esc(r.bearish)}</span></div>`:''}${r.watch?`<div class="v1-ai-block v1-ai-watch"><b>Da monitorare</b><span>${esc(r.watch)}</span></div>`:''}<div class="v1-ai-foot">${esc(r.source)} · ${s.total} notizie ricevute · campione AI ${Math.min(180,s.total)}</div>`;
    busy=0;
  }
  if(window.ML?.on)window.ML.on('data',renderNewsFirst);
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>renderNewsFirst(window.ML?.state),1500);});

  /*
   * TODO SECURITY: CFG.geminiKey, CFG.tgToken and CFG.tgChatId are currently
   * stored/used in the browser (localStorage/client-side requests). Anyone who
   * can inspect the page or localStorage can access them. Move Gemini/Telegram
   * calls behind worker.js and store credentials as Cloudflare secrets instead.
   */
  async function getAiAnalysisEnriched(suggestion,signals){
    const key=typeof CFG!=='undefined'?CFG.geminiKey:'';
    if(!key)return null;
    const list=Array.isArray(signals)?signals:[];
    const topSignals=list
      .filter(s=>Math.abs(Number(s?.score||0))>=2)
      .slice(0,8)
      .map(s=>`• [${Number(s.score)||0}/6] ${s.title||'Senza titolo'} — ${(s.description||'').slice(0,150)} — Fonte: ${s.source||'Fonte non disponibile'}`)
      .join('\n');
    const price=typeof S!=='undefined'?S.cryptoPrices?.[suggestion.sym]:null;
    const cryptoInfo=typeof S!=='undefined'?S.cryptoList?.find(c=>c.symbol===suggestion.sym):null;
    const change24h=cryptoInfo?Number(cryptoInfo.change24h||0):0;
    const botContext=typeof window.ML_BOT_STRATEGY_CONTEXT==='function'?window.ML_BOT_STRATEGY_CONTEXT(suggestion.sym):null;
    const strategyText=botContext?JSON.stringify({rsi:botContext.rsi,momentum:botContext.momentum,trend:botContext.trend,newsBias:botContext.newsBias,strategyScore:botContext.strategyScore,action:botContext.action,confidence:botContext.confidence}):'(dati Bot Strategy non disponibili per questo asset)';
    const prompt=`Sei l'analista AI di Miracolo Lab. Analizza questo possibile trade crypto usando i dati disponibili, con priorità alle notizie specifiche e al contesto del Bot Strategy. Scrivi in italiano semplice, concreto e non generico.\n\nASSET: ${suggestion.sym}\nPREZZO: €${price?fmt(price,2):'N/D'}\nVARIAZIONE 24h: ${fmtPct(change24h)}\nIMPORTO SUGGERITO: €${fmt(suggestion.amount,2)}\nTIMEFRAME: 1-3 giorni (swing trading)\n\nNEWS E SEGNALI RILEVANTI:\n${topSignals||'(nessun segnale forte disponibile)'}\n\nCONTESTO BOT STRATEGY (se disponibile):\n${strategyText}\n\nISTRUZIONI: cita almeno una notizia specifica per nome/fonte nella spiegazione, evita frasi generiche che potrebbero applicarsi a qualsiasi asset. Usa descrizione e fonte delle notizie per spiegare il perché. Se il contesto Bot Strategy non è disponibile, non inventarlo. Distingui fatti da interpretazione e indica i principali rischi.\n\nRestituisci SOLO JSON valido:\n{"azione":"BUY","confidenza":72,"timeframe":"1-2 giorni","perche":"2-4 frasi con almeno una notizia specifica e la sua fonte","rischi":"1-3 frasi sui rischi specifici","impara":"1-2 frasi su un concetto di trading rilevante"}`;
    try{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.65,maxOutputTokens:600,responseMimeType:'application/json'}})});
      if(!r.ok)throw new Error('Gemini HTTP '+r.status);
      const d=await r.json(),text=d.candidates?.[0]?.content?.parts?.[0]?.text||'',m=text.match(/\{[\s\S]*\}/);
      if(!m)throw new Error('No JSON in response');
      return JSON.parse(m[0]);
    }catch(e){console.warn('Gemini enriched trade analysis:',e.message);return null;}
  }
  window.getAiAnalysis=getAiAnalysisEnriched;
})();
