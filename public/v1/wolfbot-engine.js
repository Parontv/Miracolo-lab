/* Miracolo Lab — WolfBot-inspired technical engine
 * Conceptual inspiration: Ekliptor/WolfBot (AGPL-3.0).
 * No WolfBot source code is copied here. This module is a clean-room JS implementation
 * of the relevant concepts: streaming-style indicators, composable signals and
 * multi-indicator strategy evaluation for paper analysis.
 */
(()=>{
  'use strict';

  const REFRESH_MS=300000;
  const BOX_ID='miracoloWolfBotEngineBox';
  let busy=false;
  let timer=null;
  const ctx={};

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const finite=v=>Number.isFinite(Number(v));
  const num=v=>finite(v)?Number(v):null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;

  function cleanSeries(v){
    if(!Array.isArray(v))return [];
    return v.map(Number).filter(Number.isFinite);
  }

  function sma(a,p){
    if(a.length<p)return null;
    return avg(a.slice(-p));
  }

  function emaSeries(a,p){
    if(a.length<p)return [];
    const k=2/(p+1), out=[];
    let e=avg(a.slice(0,p));
    out.push(e);
    for(let i=p;i<a.length;i++){e=a[i]*k+e*(1-k);out.push(e)}
    return out;
  }

  function ema(a,p){const s=emaSeries(a,p);return s.length?s.at(-1):null}

  function rsiSeries(a,p=14){
    if(a.length<p+1)return [];
    let gain=0,loss=0;
    for(let i=1;i<=p;i++){const d=a[i]-a[i-1];if(d>0)gain+=d;else loss-=d}
    let ag=gain/p,al=loss/p;
    const out=[];
    const calc=()=>al===0?100:100-(100/(1+ag/al));
    out.push(calc());
    for(let i=p+1;i<a.length;i++){
      const d=a[i]-a[i-1],g=Math.max(0,d),l=Math.max(0,-d);
      ag=((ag*(p-1))+g)/p;al=((al*(p-1))+l)/p;out.push(calc());
    }
    return out;
  }
  function rsi(a,p=14){const s=rsiSeries(a,p);return s.length?s.at(-1):null}

  function macd(a,fast=12,slow=26,signal=9){
    const ef=emaSeries(a,fast),es=emaSeries(a,slow);
    if(!ef.length||!es.length)return null;
    const offset=slow-fast, line=[];
    for(let i=0;i<es.length;i++){const f=ef[i+offset];if(Number.isFinite(f))line.push(f-es[i])}
    const sig=ema(line,signal);
    if(sig===null||!line.length)return null;
    return {macd:line.at(-1),signal:sig,histogram:line.at(-1)-sig};
  }

  function bollinger(a,p=20,mult=2){
    if(a.length<p)return null;
    const x=a.slice(-p),mid=avg(x);
    const variance=avg(x.map(v=>(v-mid)**2));
    const sd=Math.sqrt(variance||0),upper=mid+mult*sd,lower=mid-mult*sd;
    const price=a.at(-1),width=mid?((upper-lower)/Math.abs(mid))*100:null;
    const position=(upper-lower)!==0?(price-lower)/(upper-lower):0.5;
    return {middle:mid,upper,lower,width,position};
  }

  function donchian(a,p=20){
    if(a.length<p)return null;
    const x=a.slice(-p),high=Math.max(...x),low=Math.min(...x),price=a.at(-1);
    return {high,low,middle:(high+low)/2,position:(high-low)?(price-low)/(high-low):0.5};
  }

  function atrFromCloses(a,p=14){
    if(a.length<p+1)return null;
    const tr=[];
    for(let i=1;i<a.length;i++)tr.push(Math.abs(a[i]-a[i-1]));
    return avg(tr.slice(-p));
  }

  function momentum(a,p=10){
    if(a.length<=p)return null;
    const old=a[a.length-1-p],now=a.at(-1);
    return old?((now-old)/Math.abs(old))*100:null;
  }

  function historyOf(c){
    const candidates=[c.closes,c.closeHistory,c.history,c.prices,c.priceHistory,c.candles?.map(x=>x.close)];
    for(const x of candidates){const a=cleanSeries(x);if(a.length>=5)return a}
    return [];
  }

  function signal(name,score,detail){
    const s=clamp(Math.round(score),-100,100);
    return {name,score:s,signal:s>=20?'BUY':s<=-20?'SELL':'WAIT',detail};
  }

  function evaluate(c){
    const closes=historyOf(c), price=num(c.price), move=num(c.changePct), base=num(c.score);
    const rows=[];
    if(closes.length>=15){
      const rv=rsi(closes,14), r2=rsi(closes,2), mm=momentum(closes,10), e12=ema(closes,12),e26=ema(closes,26),mc=macd(closes),bb=bollinger(closes,20,2),dc=donchian(closes,20),atr=atrFromCloses(closes,14);

      if(rv!==null){let s=0;if(rv<30)s=65;else if(rv<40)s=30;else if(rv>75)s=-65;else if(rv>65)s=-30;else s=(rv-50)*0.6;rows.push(signal('RSI',s,rv<30?'ipervenduto':rv>70?'ipercomprato':'zona neutrale'))}
      if(r2!==null){let s=r2<10?55:r2>90?-55:(50-r2)*0.9;rows.push(signal('RSI2',s,r2<10?'eccesso ribassista di brevissimo periodo':r2>90?'eccesso rialzista di brevissimo periodo':'nessun eccesso estremo'))}
      if(mc){let s=mc.histogram>0?35:-35;if(mc.macd>mc.signal)s+=20;else s-=20;rows.push(signal('MACD',s,mc.histogram>0?'istogramma positivo':'istogramma negativo'))}
      if(e12!==null&&e26!==null){const s=e12>e26?45:-45;rows.push(signal('EMA 12/26',s,e12>e26?'EMA veloce sopra EMA lenta':'EMA veloce sotto EMA lenta'))}
      if(bb){let s=bb.position<0.05?50:bb.position>0.95?-50:0;rows.push(signal('Bollinger',s,bb.position<0.05?'prezzo vicino alla banda inferiore':bb.position>0.95?'prezzo vicino alla banda superiore':'prezzo dentro le bande'))}
      if(dc){let s=0;if(price!==null&&price>=dc.high)s=70;else if(price!==null&&price<=dc.low)s=-70;else if(dc.position>0.8)s=20;else if(dc.position<0.2)s=-20;rows.push(signal('Donchian',s,s>=50?'breakout rialzista':s<=-50?'breakout ribassista':'nessun breakout'))}
      if(mm!==null)rows.push(signal('Momentum',clamp(mm*10,-60,60),mm>0?'momentum positivo':mm<0?'momentum negativo':'momentum neutro'));
      if(atr!==null&&price!==null)rows.push({name:'ATR / Volatilità',score:0,signal:'INFO',detail:`ATR ${atr.toPrecision(4)} · stop tecnico 1.5×ATR`});
    } else {
      const rv=num(c.rsi), mv=move;
      if(rv!==null)rows.push(signal('RSI',rv<30?55:rv>70?-55:0,rv<30?'ipervenduto':rv>70?'ipercomprato':'zona neutrale'));
      if(mv!==null)rows.push(signal('Momentum proxy',clamp(mv*12,-60,60),mv>0?'movimento positivo':mv<0?'movimento negativo':'movimento neutro'));
    }

    if(base!==null)rows.push(signal('Market Screen',clamp((base-50)*1.2,-50,50),'filtro di mercato server'));

    const active=rows.filter(x=>x.signal!=='INFO');
    const total=active.reduce((s,x)=>s+x.score,0), denom=Math.max(1,active.length);
    const fused=clamp(total/denom,-100,100);
    const action=fused>=25?'BUY':fused<=-25?'SELL':'WAIT';
    const confidence=Math.round(clamp(50+Math.abs(fused)*0.42,50,92));
    const buy=active.filter(x=>x.signal==='BUY').length,sell=active.filter(x=>x.signal==='SELL').length;
    const contradictions=buy&&sell;
    return {symbol:c.symbol,name:c.name,price,move,closes:closes.length,rows,fused,action,confidence,buy,sell,contradictions,indicators:{rsi:closes.length>=15?rsi(closes,14):num(c.rsi),rsi2:closes.length>=15?rsi(closes,2):null,macd:closes.length>=26?macd(closes):null,bollinger:closes.length>=20?bollinger(closes):null,donchian:closes.length>=20?donchian(closes):null,atr:closes.length>=15?atrFromCloses(closes):null}};
  }

  function narrative(x){
    const p=[];
    if(x.closes>=26)p.push(`Analisi tecnica costruita su ${x.closes} prezzi storici disponibili.`);
    else p.push('La storia tecnica completa non è disponibile per questo candidato; il motore non inventa indicatori mancanti.');
    const buys=x.rows.filter(r=>r.signal==='BUY').map(r=>r.name), sells=x.rows.filter(r=>r.signal==='SELL').map(r=>r.name);
    if(buys.length)p.push(`Conferme rialziste: ${buys.slice(0,4).join(', ')}.`);
    if(sells.length)p.push(`Pressioni ribassiste: ${sells.slice(0,4).join(', ')}.`);
    if(x.contradictions)p.push('Sono presenti segnali contrastanti: la decisione viene ridotta a WAIT se la confluence non è sufficientemente forte.');
    if(x.action==='BUY')p.push('La confluence tecnica supera la soglia BUY.');
    else if(x.action==='SELL')p.push('La confluence tecnica supera la soglia SELL.');
    else p.push('La confluence non raggiunge una soglia direzionale sufficiente.');
    if(x.indicators.atr&&x.price)p.push(`Riferimento rischio: 1,5×ATR ≈ ${x.indicators.atr.toPrecision(4)} di distanza dal prezzo.`);
    return p;
  }

  function box(){
    const p=document.getElementById('sidePanel');if(!p)return null;
    let b=document.getElementById(BOX_ID);if(!b){b=document.createElement('div');b.id=BOX_ID;b.className='panel-section';p.prepend(b)}return b;
  }

  function render(data,scan){
    const b=box();if(!b)return;
    const candidates=(data?.candidates||[]).map(evaluate).sort((a,z)=>z.fused-a.fused).slice(0,8);
    const buy=candidates.filter(x=>x.action==='BUY').length,sell=candidates.filter(x=>x.action==='SELL').length,wait=candidates.length-buy-sell;
    const cards=candidates.length?candidates.map(x=>{
      ctx[String(x.symbol||'').toUpperCase()]=x;
      const matrix=x.rows.map(r=>`<div class="bot-strategy-row"><span>${esc(r.name)}</span><b class="bot-action ${String(r.signal).toLowerCase()}">${esc(r.signal)}</b><strong>${r.signal==='INFO'?'·':r.score}</strong></div>`).join('');
      const prose=narrative(x).map(t=>`<div>• ${esc(t)}</div>`).join('');
      const bb=x.indicators.bollinger;
      return `<article class="bot-candidate"><div class="bot-candidate-main"><div><b>${esc(x.name||x.symbol)}</b><small>${esc(x.symbol||'')}</small></div><span class="bot-action ${x.action.toLowerCase()}">${x.action}</span></div><div class="bot-score-line"><span>WolfBot-style confluence</span><strong>${Math.round(50+x.fused/2)}/100</strong></div><div class="bot-mini-grid"><span>RSI <b>${x.indicators.rsi==null?'—':x.indicators.rsi.toFixed(1)}</b></span><span>Storico <b>${x.closes}</b></span><span>Confidence <b>${x.confidence}%</b></span></div><div class="bot-consensus"><b>${x.buy}</b> conferme BUY · <b>${x.sell}</b> SELL${bb?` · BB width ${bb.width.toFixed(1)}%`:''}</div><details class="bot-analysis" open><summary>Analisi del motore</summary><div class="bot-analysis-text">${prose}</div></details><details class="bot-matrix"><summary>Indicatori / strategie</summary><div class="bot-strategy-matrix">${matrix}</div></details></article>`;
    }).join(''):'<div class="bot-strategy-empty">Nessun candidato disponibile.</div>';
    const stamp=data?.timestamp?new Date(data.timestamp).toLocaleTimeString('it-IT'):'—';
    b.innerHTML=`<div class="panel-section-label">BOT · WOLFBOT ENGINE</div><div class="bot-strategy-card"><div class="bot-strategy-head"><div><b>Technical Strategy Engine</b><small>Indicatori composabili · confluence · paper only</small></div><span class="bot-live-dot">${busy?'RUN':'LIVE'}</span></div><div class="bot-summary-grid"><div><span>BUY</span><strong>${buy}</strong></div><div><span>WAIT</span><strong>${wait}</strong></div><div><span>SELL</span><strong>${sell}</strong></div><div><span>Storico</span><strong>5d/1h</strong></div></div><div class="bot-strategy-meta">Lotto ${data?.monitored||0} · aggiornato ${stamp}</div><div class="bot-strategy-title">Confluence tecnica</div><div class="bot-analysis-intro">Implementazione nativa dei concetti tecnici di WolfBot: indicatori indipendenti, segnali composabili e decisione aggregata. Nessun ordine reale.</div><div class="bot-candidates">${cards}</div><div class="bot-strategy-foot">Paper trading soltanto · nessuna esecuzione reale</div></div>`;
  }

  async function run(){
    if(busy)return;
    if(document.body.dataset.activePanel!=='bot'&&window.__mlPanel!=='bot')return;
    busy=true;
    try{
      const [bot,scan]=await Promise.all([
        fetch('/api/bot-monitor?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),
        fetch('/api/full-scan?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>({}))
      ]);
      render(bot,scan);
      window.ML_WOLFBOT_ENGINE={bot,scan,contexts:ctx,updatedAt:new Date().toISOString()};
    }catch(e){
      const b=box();if(b)b.innerHTML='<div class="panel-section-label">BOT · WOLFBOT ENGINE</div><div class="bot-strategy-card"><div class="bot-strategy-error">Impossibile aggiornare il motore: '+esc(e.message||e)+'</div></div>';
    }finally{busy=false;}
  }

  function install(){
    if(window.__ML_WOLFBOT_ENGINE)return;
    window.__ML_WOLFBOT_ENGINE=true;
    const old=window.setPanel;
    if(typeof old==='function')window.setPanel=function(id){old(id);if(id==='bot')setTimeout(run,80)};
    window.runMiracoloWolfBotCycle=run;
    window.ML_WOLFBOT_CONTEXT=(symbol)=>ctx[String(symbol||'').toUpperCase()]||null;
    timer=setInterval(run,REFRESH_MS);
    document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.__mlPanel==='bot'||document.body.dataset.activePanel==='bot')run()},500));
    window.addEventListener('load',()=>setTimeout(()=>{if(window.__mlPanel==='bot'||document.body.dataset.activePanel==='bot')run()},800));
  }
  install();
})();
