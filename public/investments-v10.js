/* Miracolo Lab — Investimenti V11
   Portafoglio personale: ETF + Bitcoin/Crypto.
   Compatibile con i dati legacy ml_portfolio_v6.
*/
(() => {
  'use strict';
  const ROOT='ml_portfolio_v6';
  const EKEY=ROOT+'.etf', CKEY=ROOT+'.crypto';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)&&x>=0?x:0};
  const eur=v=>(Number(v)||0).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2});
  const pct=v=>(Number(v)||0).toFixed(2)+'%';
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}

  const defaultEtfs=[
    {symbol:'SGLD.MI',name:'Gold',qty:0,avg:0},
    {symbol:'SWDA.MI',name:'World',qty:0,avg:0},
    {symbol:'EIMI.MI',name:'Emerging Markets',qty:0,avg:0}
  ];
  let etfs=load(EKEY,defaultEtfs);
  let crypto=load(CKEY,{BTC:{qty:0},ETH:{qty:0}});
  if(!Array.isArray(etfs)) etfs=defaultEtfs;
  etfs=etfs.map(e=>({symbol:String(e.symbol||'').toUpperCase(),name:e.name||e.symbol,qty:num(e.qty),avg:num(e.avg)}));
  if(!Array.isArray(crypto)) crypto=Object.entries(crypto||{}).map(([symbol,v])=>({symbol,name:symbol==='BTC'?'Bitcoin':symbol==='ETH'?'Ethereum':symbol,qty:num(v?.qty)}));
  if(!crypto.length) crypto=[{symbol:'BTC',name:'Bitcoin',qty:0},{symbol:'ETH',name:'Ethereum',qty:0}];
  crypto=crypto.map(c=>({symbol:String(c.symbol||'').toUpperCase(),name:c.name||c.symbol,qty:num(c.qty)}));
  save(EKEY,etfs);save(CKEY,crypto);

  const ep=s=>Number(window.__mlPrices?.[s]?.price||0);
  const cp=s=>Number(window.__mlCryptoPrices?.[s]?.price||0);
  let fetching=false;
  function syncPrices(){
    window.__mlPrices=window.__mlPrices||{};
    window.__mlCryptoPrices=window.__mlCryptoPrices||{};
    if(!fetching){
      fetching=true;
      const symbols=etfs.map(e=>e.symbol).filter(Boolean).join(',');
      const jobs=[];
      if(symbols) jobs.push(fetch('/api/prices?symbols='+encodeURIComponent(symbols)+'&t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(d=>(d.prices||[]).forEach(x=>window.__mlPrices[x.symbol]=x)).catch(()=>{}));
      jobs.push(fetch('/api/crypto?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(d=>(d.coins||[]).forEach(x=>window.__mlCryptoPrices[x.symbol]=x)).catch(()=>{}));
      Promise.all(jobs).finally(()=>{fetching=false;render()});
    }
  }

  function editEtf(i){
    const e=etfs[i]; const q=prompt('Quantità posseduta — '+e.name,String(e.qty||0)); if(q===null)return;
    const a=prompt('Prezzo medio di acquisto — '+e.name,String(e.avg||0)); if(a===null)return;
    etfs[i]={...e,qty:num(q),avg:num(a)};save(EKEY,etfs);render();
  }
  function editCrypto(i){
    const c=crypto[i]; const q=prompt('Quantità posseduta — '+c.name,String(c.qty||0)); if(q===null)return;
    crypto[i]={...c,qty:num(q)};save(CKEY,crypto);render();
  }
  function addEtf(){
    const name=prompt('Nome ETF');if(!name)return;
    const symbol=prompt('Ticker quotato (es. SWDA.MI)');if(!symbol)return;
    const qty=prompt('Quantità posseduta','0');if(qty===null)return;
    const avg=prompt('Prezzo medio di acquisto','0');if(avg===null)return;
    etfs.push({symbol:symbol.trim().toUpperCase(),name:name.trim(),qty:num(qty),avg:num(avg)});save(EKEY,etfs);syncPrices();render();
  }
  function addCrypto(){
    const name=prompt('Nome crypto');if(!name)return;
    const symbol=prompt('Simbolo (es. BTC)');if(!symbol)return;
    const qty=prompt('Quantità posseduta','0');if(qty===null)return;
    crypto.push({symbol:symbol.trim().toUpperCase(),name:name.trim(),qty:num(qty)});save(CKEY,crypto);syncPrices();render();
  }
  function delEtf(i){if(confirm('Eliminare '+etfs[i].name+' dal portafoglio?')){etfs.splice(i,1);save(EKEY,etfs);render()}}
  function delCrypto(i){if(confirm('Eliminare '+crypto[i].name+' dal portafoglio?')){crypto.splice(i,1);save(CKEY,crypto);render()}}

  function cardEtf(e,i){
    const p=ep(e.symbol),inv=e.qty*e.avg,val=e.qty*p,pnl=val-inv,pp=inv?pnl/inv*100:0;
    return `<article class="iv11-card"><div class="iv11-name"><strong>${esc(e.name)}</strong><small>${esc(e.symbol)} · ETF</small></div><div class="iv11-fields"><div><small>Quantità</small><b>${e.qty}</b></div><div><small>Prezzo medio</small><b>${eur(e.avg)}</b></div><div><small>Prezzo attuale</small><b>${p?eur(p):'—'}</b></div></div><div class="iv11-kpi"><span>Investito <b>${eur(inv)}</b></span><span>Valore <b>${eur(val)}</b></span><span>P/L <b class="${pnl>=0?'up':'down'}">${inv?(pnl>=0?'+':'')+eur(pnl)+' ('+pct(pp)+')':'—'}</b></span></div><div class="iv11-actions"><button data-a="ee" data-i="${i}">Modifica</button><button class="danger" data-a="de" data-i="${i}">Elimina</button></div></article>`;
  }
  function cardCrypto(c,i){
    const p=cp(c.symbol),val=c.qty*p;
    return `<article class="iv11-card"><div class="iv11-name"><strong>${esc(c.name)}</strong><small>${esc(c.symbol)} · Crypto</small></div><div class="iv11-fields"><div><small>Quantità posseduta</small><b>${c.qty}</b></div><div><small>Prezzo attuale</small><b>${p?eur(p):'—'}</b></div><div><small>Valore attuale</small><b>${eur(val)}</b></div></div><div class="iv11-actions"><button data-a="ec" data-i="${i}">Modifica</button><button class="danger" data-a="dc" data-i="${i}">Elimina</button></div></article>`;
  }
  function chart(){
    const rows=[...etfs.map(e=>({name:e.name,value:e.qty*ep(e.symbol)})),...crypto.map(c=>({name:c.name,value:c.qty*cp(c.symbol)}))].filter(x=>x.value>0);
    if(!rows.length)return '<div class="iv11-empty">Inserisci le quantità del portafoglio per visualizzare il riepilogo.</div>';
    const max=Math.max(...rows.map(x=>x.value),1);
    return `<div class="iv11-chart"><h4>Valore attuale per investimento</h4>${rows.map(x=>`<div class="iv11-row"><span>${esc(x.name)}</span><div><i style="width:${Math.max(3,x.value/max*100)}%"></i></div><b>${eur(x.value)}</b></div>`).join('')}</div>`;
  }
  function panel(){
    const etfValue=etfs.reduce((s,e)=>s+e.qty*ep(e.symbol),0), cryptoValue=crypto.reduce((s,c)=>s+c.qty*cp(c.symbol),0), invested=etfs.reduce((s,e)=>s+e.qty*e.avg,0), pnl=etfValue-invested;
    return `<div class="iv11-wrap"><header class="iv11-head"><div><h2>Investimenti</h2><span>Il mio portafoglio</span></div><div class="iv11-total"><small>Valore totale</small><strong>${eur(etfValue+cryptoValue)}</strong></div></header><div class="iv11-summary"><div><small>ETF</small><b>${eur(etfValue)}</b></div><div><small>Bitcoin & Crypto</small><b>${eur(cryptoValue)}</b></div><div><small>P/L ETF</small><b class="${pnl>=0?'up':'down'}">${invested?(pnl>=0?'+':'')+eur(pnl):'—'}</b></div></div><section><div class="iv11-section-head"><h3>ETF</h3><button data-a="addetf">+ Aggiungi ETF</button></div>${etfs.length?etfs.map(cardEtf).join(''):'<p class="iv11-empty">Nessun ETF inserito.</p>'}</section><section><div class="iv11-section-head"><h3>Bitcoin & Crypto</h3><button data-a="addcrypto">+ Aggiungi crypto</button></div>${crypto.length?crypto.map(cardCrypto).join(''):'<p class="iv11-empty">Nessuna crypto inserita.</p>'}</section>${chart()}</div>`;
  }
  function render(){if(window.__mlPanel!=='investimenti')return;const el=document.getElementById('sidePanel');if(!el)return;el.innerHTML=panel();el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset;if(a.a==='ee')editEtf(+a.i);else if(a.a==='de')delEtf(+a.i);else if(a.a==='ec')editCrypto(+a.i);else if(a.a==='dc')delCrypto(+a.i);else if(a.a==='addetf')addEtf();else if(a.a==='addcrypto')addCrypto()}));}

  function install(){
    if(typeof window.setPanel!=='function'||window.setPanel.__iv11)return;
    const old=window.setPanel;
    window.setPanel=function(id){
      if(id==='etf'||id==='crypto')id='investimenti';
      window.__mlPanel=id;
      old(id);
      if(id==='investimenti'){syncPrices();render()}
    };
    window.setPanel.__iv11=true;
    document.querySelectorAll('.top-tab').forEach(b=>{if(b.dataset.panel==='investimenti'){b.onclick=()=>window.setPanel('investimenti')}});
    const rail=document.querySelector('.tab-rail');
    if(rail){rail.querySelectorAll('[data-panel="etf"],[data-panel="crypto"]').forEach(b=>b.remove());let b=rail.querySelector('[data-panel="investimenti"]');if(!b){b=document.createElement('button');b.className='rail-btn';b.dataset.panel='investimenti';b.innerHTML='<span class="rail-icon">📊</span><span class="rail-lbl">Investimenti</span>';rail.insertBefore(b,rail.querySelector('[data-panel="bot"]'))}b.onclick=()=>window.setPanel('investimenti')}
  }
  const st=document.createElement('style');st.textContent=`
    .iv11-wrap{padding:14px;color:#e2e8f0}.iv11-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:12px}.iv11-head h2{margin:0;font-size:19px}.iv11-head span,.iv11-head small,.iv11-card small,.iv11-summary small{color:#64748b;font-size:10px}.iv11-total{text-align:right}.iv11-total strong{display:block;font-size:18px;margin-top:3px}.iv11-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.iv11-summary>div{padding:10px;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(15,23,42,.7)}.iv11-summary b{display:block;margin-top:4px}.iv11-wrap section{margin:14px 0}.iv11-section-head{display:flex;justify-content:space-between;align-items:center}.iv11-section-head h3{font-size:13px;margin:8px 0}.iv11-section-head button,.iv11-actions button{border:1px solid #334155;background:#172033;color:#e2e8f0;border-radius:7px;padding:7px 10px;font-size:10px}.iv11-card{padding:12px;margin:8px 0;border:1px solid #263247;border-radius:10px;background:rgba(15,23,42,.55)}.iv11-name strong{display:block}.iv11-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.iv11-fields>div{background:rgba(15,23,42,.7);border-radius:7px;padding:8px}.iv11-fields small{display:block}.iv11-fields b{display:block;margin-top:3px;font-size:12px;color:#e2e8f0}.iv11-kpi{display:flex;gap:14px;flex-wrap:wrap;color:#64748b;font-size:10px}.iv11-kpi b{color:#e2e8f0}.iv11-actions{display:flex;gap:7px;margin-top:10px}.iv11-actions .danger{color:#fca5a5;border-color:#7f1d1d}.iv11-chart{margin-top:16px;padding:12px;border:1px solid #263247;border-radius:10px}.iv11-chart h4{font-size:12px;margin:0 0 10px}.iv11-row{display:grid;grid-template-columns:100px 1fr 80px;gap:8px;align-items:center;margin:8px 0;font-size:10px}.iv11-row>div{height:8px;background:#1e293b;border-radius:99px;overflow:hidden}.iv11-row i{display:block;height:100%;background:#60a5fa;border-radius:99px}.iv11-empty{padding:10px;color:#64748b;font-size:11px}@media(max-width:600px){.iv11-summary{grid-template-columns:1fr 1fr}.iv11-summary>div:last-child{grid-column:1/-1}.iv11-fields{grid-template-columns:1fr 1fr}.iv11-fields>div:last-child{grid-column:1/-1}.iv11-row{grid-template-columns:75px 1fr 70px}}
  `;document.head.appendChild(st);
  const timer=setInterval(()=>{if(document.body&&typeof window.setPanel==='function'){install();clearInterval(timer)}},100);
  setInterval(()=>{if(window.__mlPanel==='investimenti'){syncPrices();render()}},30000);
})();