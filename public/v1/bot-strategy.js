/* Miracolo Lab — BOT Strategy Engine v1
   Jesse-inspired strategy layer. The implementation is native JavaScript;
   Jesse is used as an open-source reference for strategy concepts, not as a runtime dependency.
*/
(()=>{
  'use strict';
  const BOX_ID='miracoloBotStrategyBox';
  const REFRESH_MS=300000;
  let timer=null;
  let busy=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
  const pct=v=>Number.isFinite(Number(v))?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'—';
  const actionClass=a=>String(a||'WAIT').toLowerCase();

  function scoreCandidate(c,news){
    const r=Number(c.rsi), ch=Number(c.changePct), base=Number(c.score||50);
    let score=50;
    // RSI mean-reversion component, based on Jesse-style RSI strategy concepts.
    if(Number.isFinite(r)){
      if(r<=30) score+=18;
      else if(r<40) score+=10;
      else if(r<=55) score+=3;
      else if(r<70) score+=10;
      else score-=8;
    }
    // Short-term momentum component.
    if(Number.isFinite(ch)){
      if(ch>=2) score+=12;
      else if(ch>=0.5) score+=6;
      else if(ch<=-2) score-=12;
      else if(ch<=-0.5) score-=6;
    }
    // Preserve the server's screened score as a stabilizer, not as a replacement.
    score += Math.max(-8,Math.min(8,(base-50)*0.25));
    const ns=Number(news||0);
    score += Math.max(-8,Math.min(8,ns));
    score=Math.max(0,Math.min(100,Math.round(score)));
    const action=score>=65?'BUY':score<=35?'SELL':'WAIT';
    const reasons=[];
    if(Number.isFinite(r)) reasons.push(r<=30?'RSI in oversold zone':r>=70?'RSI in overbought zone':r>=55?'RSI supports momentum':'RSI neutral');
    if(Number.isFinite(ch)) reasons.push(ch>=0.5?'positive momentum':ch<=-0.5?'negative momentum':'price momentum neutral');
    if(ns>2) reasons.push('news sentiment supportive');
    if(ns<-2) reasons.push('news sentiment negative');
    if(!reasons.length) reasons.push('insufficient confirmation');
    return {...c,strategyScore:score,action,strategyReasons:reasons};
  }

  function newsBias(scan){
    const s=scan?.summary||{};
    const pos=Number(s.sentiment?.positive||0), neg=Number(s.sentiment?.negative||0), total=Math.max(1,Number(s.items||0));
    return Math.max(-8,Math.min(8,((pos-neg)/total)*16));
  }

  function box(){
    const p=document.getElementById('sidePanel');
    if(!p) return null;
    let b=document.getElementById(BOX_ID);
    if(!b){ b=document.createElement('div'); b.id=BOX_ID; b.className='panel-section'; p.prepend(b); }
    return b;
  }

  function loading(){const b=box();if(!b)return;b.innerHTML='<div class="panel-section-label">BOT · STRATEGY ENGINE</div><div class="bot-strategy-card"><div class="bot-strategy-head"><div><b>Analisi Jesse-inspired</b><small>Mercato + strategie + news</small></div><span class="bot-live-dot">LIVE</span></div><div class="bot-strategy-loading">Analisi in corso…</div></div>';}

  function render(data,scan){
    const b=box();if(!b)return;
    const candidates=(data?.candidates||[]).map(c=>scoreCandidate(c,newsBias(scan))).sort((a,z)=>z.strategyScore-a.strategyScore).slice(0,8);
    const buy=candidates.filter(x=>x.action==='BUY').length;
    const sell=candidates.filter(x=>x.action==='SELL').length;
    const wait=candidates.length-buy-sell;
    const stamp=data?.timestamp?new Date(data.timestamp).toLocaleTimeString('it-IT'):'—';
    const cards=candidates.length?candidates.map(c=>`<div class="bot-candidate">
      <div class="bot-candidate-main"><div><b>${esc(c.name||c.symbol)}</b><small>${esc(c.symbol||'')}</small></div><span class="bot-action ${actionClass(c.action)}">${c.action}</span></div>
      <div class="bot-score-line"><span>Strategy Score</span><strong>${c.strategyScore}/100</strong></div>
      <div class="bot-mini-grid"><span>RSI <b>${n(c.rsi)}</b></span><span>Move <b>${pct(c.changePct)}</b></span><span>Confidence <b>${n(c.confidence,0)}%</b></span></div>
      <div class="bot-reasons">${c.strategyReasons.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
    </div>`).join(''):'<div class="bot-strategy-empty">Nessun candidato sufficientemente confermato nel lotto corrente.</div>';
    const bias=newsBias(scan);
    b.innerHTML=`<div class="panel-section-label">BOT · STRATEGY ENGINE</div>
      <div class="bot-strategy-card">
        <div class="bot-strategy-head"><div><b>Decision Engine</b><small>Jesse-inspired · nativo Miracolo</small></div><span class="bot-live-dot">${busy?'RUN':'LIVE'}</span></div>
        <div class="bot-summary-grid"><div><span>BUY</span><strong>${buy}</strong></div><div><span>WAIT</span><strong>${wait}</strong></div><div><span>SELL</span><strong>${sell}</strong></div><div><span>News bias</span><strong>${bias>1?'+':bias<-1?'':''}${bias.toFixed(1)}</strong></div></div>
        <div class="bot-strategy-meta">Universo monitorato ${data?.universeCount||'—'} · lotto ${data?.monitored||0} · aggiornato ${stamp}</div>
        <div class="bot-strategy-title">Migliori configurazioni</div>
        <div class="bot-candidates">${cards}</div>
        <div class="bot-strategy-foot">Paper trading soltanto · nessun ordine reale</div>
      </div>`;
  }

  async function run(){
    if(busy)return;
    if(document.body.dataset.activePanel!=='bot'&&window.__mlPanel!=='bot')return;
    busy=true; loading();
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
    if(typeof old==='function') window.setPanel=function(id){old(id);if(id==='bot')setTimeout(run,80);};
    document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.__mlPanel==='bot'||document.body.dataset.activePanel==='bot')run();},500));
    window.addEventListener('load',()=>setTimeout(()=>{if(window.__mlPanel==='bot'||document.body.dataset.activePanel==='bot')run();},800));
    timer=setInterval(run,REFRESH_MS);
    window.runMiracoloStrategyCycle=run;
  }
  install();
})();
