/* Miracolo Lab — BOT Strategy Engine v1
   Jesse-inspired strategy layer. Native JavaScript implementation.
   The analysis is evidence-based: every sentence shown in the UI is derived
   from data actually returned by Miracolo APIs. No hidden/internal reasoning is exposed.
*/
(()=>{
  'use strict';
  const BOX_ID='miracoloBotStrategyBox';
  const REFRESH_MS=300000;
  let timer=null;
  let busy=false;
  const strategyContext={};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Number.isFinite(Number(v))?Number(v):null;
  const n=(v,d=1)=>num(v)!==null?num(v).toFixed(d):'—';
  const pct=v=>num(v)!==null?`${num(v)>=0?'+':''}${num(v).toFixed(1)}%`:'—';
  const actionClass=a=>String(a||'WAIT').toLowerCase();

  function newsBias(scan){
    const s=scan?.summary||{};
    const pos=Number(s.sentiment?.positive||0), neg=Number(s.sentiment?.negative||0), total=Math.max(1,Number(s.items||0));
    return Math.max(-8,Math.min(8,((pos-neg)/total)*16));
  }

  function scoreCandidate(c,news){
    const r=num(c.rsi), ch=num(c.changePct), base=num(c.score)??50;
    let score=50;
    if(r!==null){
      if(r<=30) score+=18;
      else if(r<40) score+=10;
      else if(r<=55) score+=3;
      else if(r<70) score+=10;
      else score-=8;
    }
    if(ch!==null){
      if(ch>=2) score+=12;
      else if(ch>=0.5) score+=6;
      else if(ch<=-2) score-=12;
      else if(ch<=-0.5) score-=6;
    }
    score+=Math.max(-8,Math.min(8,(base-50)*0.25));
    score+=Math.max(-8,Math.min(8,news));
    score=Math.max(0,Math.min(100,Math.round(score)));
    const action=score>=65?'BUY':score<=35?'SELL':'WAIT';
    return {...c,strategyScore:score,action};
  }

  function lens(c,news){
    const r=num(c.rsi), ch=num(c.changePct), base=num(c.score)??50;
    const rows=[];
    // These are deliberately named as analytical lenses. They do not claim to be
    // a full implementation of indicators for which the API does not provide data.
    let rsiScore=50, rsiSignal='WAIT';
    if(r!==null){
      if(r<=30){rsiScore=82;rsiSignal='BUY'}
      else if(r<40){rsiScore=68;rsiSignal='BUY'}
      else if(r<70){rsiScore=Math.round(55+(r-40)*0.55);rsiSignal=r>=55?'BUY':'WAIT'}
      else {rsiScore=38;rsiSignal='SELL'}
    }
    rows.push({name:'RSI / Mean Reversion',signal:rsiSignal,score:rsiScore,detail:r===null?'RSI non disponibile':r<=30?'oversold: possibile rimbalzo':r>=70?'overbought: rischio di eccesso':r>=55?'forza positiva senza eccesso':'zona neutrale'});

    let momScore=50,momSignal='WAIT';
    if(ch!==null){momScore=Math.max(0,Math.min(100,Math.round(50+ch*12)));momSignal=ch>=0.5?'BUY':ch<=-0.5?'SELL':'WAIT'}
    rows.push({name:'Momentum',signal:momSignal,score:momScore,detail:ch===null?'movimento non disponibile':ch>=0.5?'pressione rialzista':ch<=-0.5?'pressione ribassista':'movimento contenuto'});

    let trendScore=50,trendSignal='WAIT';
    if(ch!==null){trendScore=Math.max(0,Math.min(100,Math.round(50+ch*9)));trendSignal=ch>=1?'BUY':ch<=-1?'SELL':'WAIT'}
    rows.push({name:'Trend Proxy',signal:trendSignal,score:trendScore,detail:ch===null?'trend non determinabile':ch>=1?'direzione rialzista confermata dal movimento':ch<=-1?'direzione ribassista confermata dal movimento':'direzione non sufficientemente forte'});

    const serverScore=Math.max(0,Math.min(100,Math.round(base)));
    rows.push({name:'Market Screen',signal:serverScore>=65?'BUY':serverScore<=35?'SELL':'WAIT',score:serverScore,detail:'score del filtro di mercato server'});

    const newsScore=Math.max(0,Math.min(100,Math.round(50+news*6.25)));
    rows.push({name:'News / Sentiment',signal:news>1?'BUY':news<-1?'SELL':'WAIT',score:newsScore,detail:news>1?'bias informativo positivo':news<-1?'bias informativo negativo':'bias informativo neutrale'});
    return rows;
  }

  function reasoning(c,rows,news,overall){
    const r=num(c.rsi), ch=num(c.changePct);
    const buy=rows.filter(x=>x.signal==='BUY').length;
    const sell=rows.filter(x=>x.signal==='SELL').length;
    const wait=rows.length-buy-sell;
    const parts=[];
    if(ch!==null) parts.push(ch>=1?'Il prezzo mostra un movimento rialzista significativo.':ch<=-1?'Il prezzo mostra pressione ribassista significativa.':'Il movimento di prezzo è contenuto e non conferma una direzione forte.');
    if(r!==null) parts.push(r<=30?'L’RSI è in area di ipervenduto, quindi il motore considera possibile una reazione.':r>=70?'L’RSI è in area di ipercomprato e introduce cautela.':r>=55?'L’RSI sostiene il momentum senza mostrare ancora un eccesso.':'L’RSI resta in una zona neutrale/debole e non fornisce una conferma forte.');
    parts.push(news>1?'Il flusso news aggiunge un bias positivo.':news<-1?'Il flusso news aggiunge un bias negativo.':'Il flusso news non modifica in modo significativo il segnale.');
    parts.push(`${buy} prospettive sono favorevoli, ${sell} contrarie e ${wait} neutrali.`);
    if(overall.action==='BUY') parts.push('Il consenso supera la soglia operativa BUY, ma il segnale resta da validare con il Risk Engine.');
    else if(overall.action==='SELL') parts.push('Il consenso supera la soglia operativa SELL; il Risk Engine deve verificare il rischio prima di qualsiasi decisione.');
    else parts.push('Le conferme non sono sufficienti per una decisione direzionale forte: il motore resta in WAIT.');
    return parts;
  }

  function publishStrategyContext(c,rows,news){
    const key=String(c.symbol||'').toUpperCase();
    if(!key)return;
    strategyContext[key]={
      symbol:c.symbol,
      name:c.name,
      rsi:num(c.rsi),
      momentum:num(rows.find(x=>x.name==='Momentum')?.score),
      trend:num(rows.find(x=>x.name==='Trend Proxy')?.score),
      newsBias:Number(news),
      strategyScore:num(c.strategyScore),
      action:c.action,
      confidence:num(c.confidence),
      lenses:rows.map(x=>({name:x.name,signal:x.signal,score:x.score,detail:x.detail}))
    };
  }

  function box(){
    const p=document.getElementById('sidePanel');
    if(!p)return null;
    let b=document.getElementById(BOX_ID);
    if(!b){b=document.createElement('div');b.id=BOX_ID;b.className='panel-section';p.prepend(b)}
    return b;
  }

  function loading(){
    const b=box();if(!b)return;
    b.innerHTML='<div class="panel-section-label">BOT · STRATEGY ENGINE</div><div class="bot-strategy-card"><div class="bot-strategy-head"><div><b>Analisi Jesse-inspired</b><small>Multi-strategy · mercato + news + momentum</small></div><span class="bot-live-dot">LIVE</span></div><div class="bot-strategy-loading">Raccolta dati e costruzione del ragionamento…</div></div>';
  }

  function render(data,scan){
    const b=box();if(!b)return;
    const bias=newsBias(scan);
    const candidates=(data?.candidates||[]).map(c=>scoreCandidate(c,bias)).sort((a,z)=>z.strategyScore-a.strategyScore).slice(0,8);
    const buy=candidates.filter(x=>x.action==='BUY').length;
    const sell=candidates.filter(x=>x.action==='SELL').length;
    const wait=candidates.length-buy-sell;
    const stamp=data?.timestamp?new Date(data.timestamp).toLocaleTimeString('it-IT'):'—';
    const cards=candidates.length?candidates.map(c=>{
      const rows=lens(c,bias);
      publishStrategyContext(c,rows,bias);
      const buyN=rows.filter(x=>x.signal==='BUY').length;
      const sellN=rows.filter(x=>x.signal==='SELL').length;
      const analysis=reasoning(c,rows,bias,c);
      const matrix=rows.map(x=>`<div class="bot-strategy-row"><span>${esc(x.name)}</span><b class="bot-action ${actionClass(x.signal)}">${x.signal}</b><strong>${x.score}</strong></div>`).join('');
      const prose=analysis.map(x=>`<div>• ${esc(x)}</div>`).join('');
      return `<article class="bot-candidate">
        <div class="bot-candidate-main"><div><b>${esc(c.name||c.symbol)}</b><small>${esc(c.symbol||'')}</small></div><span class="bot-action ${actionClass(c.action)}">${c.action}</span></div>
        <div class="bot-score-line"><span>Strategy Score</span><strong>${c.strategyScore}/100</strong></div>
        <div class="bot-mini-grid"><span>RSI <b>${n(c.rsi)}</b></span><span>Move <b>${pct(c.changePct)}</b></span><span>Confidence <b>${n(c.confidence,0)}%</b></span></div>
        <div class="bot-consensus"><b>${buyN}/${rows.length}</b> prospettive favorevoli · ${sellN} contrarie</div>
        <details class="bot-analysis" open><summary>Analisi del motore</summary><div class="bot-analysis-text">${prose}</div></details>
        <details class="bot-matrix"><summary>Strategie analizzate</summary><div class="bot-strategy-matrix">${matrix}</div><small class="bot-analysis-note">MACD, Bollinger, ATR e Donchian verranno attivati quando i relativi dati saranno disponibili nel feed tecnico; non vengono simulati.</small></details>
      </article>`;
    }).join(''):'<div class="bot-strategy-empty">Nessun candidato disponibile nel lotto corrente.</div>';

    b.innerHTML=`<div class="panel-section-label">BOT · STRATEGY ENGINE</div>
      <div class="bot-strategy-card">
        <div class="bot-strategy-head"><div><b>Decision Engine</b><small>Jesse-inspired · nativo Miracolo</small></div><span class="bot-live-dot">${busy?'RUN':'LIVE'}</span></div>
        <div class="bot-summary-grid"><div><span>BUY</span><strong>${buy}</strong></div><div><span>WAIT</span><strong>${wait}</strong></div><div><span>SELL</span><strong>${sell}</strong></div><div><span>News bias</span><strong>${bias>1?'+':bias<-1?'':''}${bias.toFixed(1)}</strong></div></div>
        <div class="bot-strategy-meta">Universo monitorato ${data?.universeCount||'—'} · lotto ${data?.monitored||0} · aggiornato ${stamp}</div>
        <div class="bot-strategy-title">Migliori configurazioni · analisi completa</div>
        <div class="bot-analysis-intro">Il motore confronta prezzo, RSI, momentum, filtro di mercato e news/sentiment. Il testo sotto spiega il percorso decisionale usando esclusivamente i dati disponibili.</div>
        <div class="bot-candidates">${cards}</div>
        <div class="bot-strategy-foot">Paper trading soltanto · nessun ordine reale</div>
      </div>`;
  }

  async function run(){
    if(busy)return;
    if(document.body.dataset.activePanel!=='bot'&&window.__mlPanel!=='bot')return;
    busy=true;loading();
    try{
      const [bot,scan]=await Promise.all([
        fetch('/api/bot-monitor?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),
        fetch('/api/full-scan?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>({}))
      ]);
      render(bot,scan);
      window.ML_BOT_STRATEGY={bot,scan,updatedAt:new Date().toISOString()};
    }catch(e){
      const b=box();if(b)b.innerHTML='<div class="panel-section-label">BOT · STRATEGY ENGINE</div><div class="bot-strategy-card"><div class="bot-strategy-error">Impossibile aggiornare il motore strategie: '+esc(e.message||e)+'</div></div>';
    }finally{busy=false;}
  }

  function install(){
    if(window.__ML_BOT_STRATEGY_V1)return;
    window.__ML_BOT_STRATEGY_V1=true;
    const old=window.setPanel;
    if(typeof old==='function')window.setPanel=function(id){old(id);if(id==='bot')setTimeout(run,80)};
    document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.__mlPanel==='bot'||document.body.dataset.activePanel==='bot')run()},500));
    window.addEventListener('load',()=>setTimeout(()=>{if(window.__mlPanel==='bot'||document.body.dataset.activePanel==='bot')run()},800));
    timer=setInterval(run,REFRESH_MS);
    window.runMiracoloStrategyCycle=run;
    window.ML_BOT_STRATEGY_CONTEXT=(sym)=>strategyContext[String(sym||'').toUpperCase()]||null;
    window.ML_BOT_STRATEGY_CONTEXTS=strategyContext;
  }
  install();
})();
