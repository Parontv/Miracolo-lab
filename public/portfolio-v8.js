/* Miracolo Lab v8 — editable ETF + quantity-only crypto portfolio */
(() => {
  const ETF_KEY='ml_portfolio_v8_etf';
  const CRYPTO_KEY='ml_portfolio_v8_crypto';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)&&x>=0?x:0};
  const eur=x=>(Number(x)||0).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2});
  const pct=x=>(Number(x)||0).toFixed(2)+'%';
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  let etfs=load(ETF_KEY,[
    {symbol:'SGLD.MI',name:'Gold',qty:0,avg:0},
    {symbol:'SWDA.MI',name:'World',qty:0,avg:0},
    {symbol:'EIMI.MI',name:'Emerging Markets',qty:0,avg:0}
  ]);
  let crypto=load(CRYPTO_KEY,{BTC:{qty:0},ETH:{qty:0}});
  const price=s=>Number(window.__mlPrices?.[s]?.price||0);
  const cprice=s=>Number(window.__mlCryptoPrices?.[s]?.price||0);
  const position=(q,a,p)=>({invested:q*a,value:q*p,pnl:q*p-q*a,pct:q*a?((q*p-q*a)/(q*a))*100:0});
  function syncPrices(){window.__mlPrices=window.__mlPrices||{};window.__mlCryptoPrices=window.__mlCryptoPrices||{}}
  function updateEtf(i,field,value){etfs[i][field]=field==='symbol'||field==='name'?String(value):num(value);save(ETF_KEY,etfs);render();}
  function deleteEtf(i){if(!confirm(`Eliminare ${etfs[i].name}?`))return;etfs.splice(i,1);save(ETF_KEY,etfs);render();}
  function addEtf(){
    const name=prompt('Nome ETF');if(!name)return;
    const symbol=prompt('Ticker quotato (es. SWDA.MI)');if(!symbol)return;
    etfs.push({name:name.trim(),symbol:symbol.trim().toUpperCase(),qty:0,avg:0});save(ETF_KEY,etfs);render();
  }
  function updateCrypto(s,value){crypto[s]={qty:num(value)};save(CRYPTO_KEY,crypto);render();}
  function deleteCrypto(s){if(!confirm(`Eliminare la quantità di ${s}?`))return;crypto[s]={qty:0};save(CRYPTO_KEY,crypto);render();}
  function panelEtf(){
    syncPrices();
    return `<div class="v8-wrap"><div class="v8-title"><h2>ETF — Il mio portafoglio</h2><button class="v8-add" onclick="window.__v8.addEtf()">＋ Aggiungi ETF</button></div>
      <div class="v8-grid">${etfs.map((e,i)=>{const p=price(e.symbol),z=position(e.qty,e.avg,p);return `<div class="v8-card">
      <div class="v8-head"><div><strong>${esc(e.name)}</strong><small>${esc(e.symbol)} · Milano</small></div><button class="v8-danger" onclick="window.__v8.deleteEtf(${i})">Elimina</button></div>
      <label>Quantità<input type="number" min="0" step="any" value="${e.qty||0}" onchange="window.__v8.updateEtf(${i},'qty',this.value)"></label>
      <label>Prezzo medio €<input type="number" min="0" step="any" value="${e.avg||0}" onchange="window.__v8.updateEtf(${i},'avg',this.value)"></label>
      <div class="v8-stats"><span>Prezzo attuale<b>${p?eur(p):'—'}</b></span><span>Investito<b>${eur(z.invested)}</b></span><span>Valore<b>${p?eur(z.value):'—'}</b></span><span>P/L<b class="${z.pnl>=0?'up':'down'}">${z.invested?(z.pnl>=0?'+':'')+eur(z.pnl)+' ('+pct(z.pct)+')':'—'}</b></span></div>
      </div>`}).join('')}</div></div>`;
  }
  function panelCrypto(){
    syncPrices();
    return `<div class="v8-wrap"><div class="v8-title"><h2>Crypto — Il mio portafoglio</h2><span>Inserisci solamente la quantità posseduta</span></div><div class="v8-grid">${['BTC','ETH'].map(s=>{const q=crypto[s]?.qty||0,p=cprice(s),value=q*p;return `<div class="v8-card">
      <div class="v8-head"><div><strong>${s}</strong><small>Prezzo aggiornato automaticamente</small></div><button class="v8-danger" onclick="window.__v8.deleteCrypto('${s}')">Elimina</button></div>
      <label>Quantità posseduta<input type="number" min="0" step="any" value="${q}" onchange="window.__v8.updateCrypto('${s}',this.value)"></label>
      <div class="v8-stats"><span>Prezzo attuale<b>${p?eur(p):'—'}</b></span><span>Valore attuale<b>${p?eur(value):'—'}</b></span></div>
      </div>`}).join('')}</div><div class="v8-note">Per BTC ed ETH non viene richiesto né calcolato alcun P/L.</div></div>`;
  }
  function render(){
    const id=window.__mlPanel||window.S?.activePanel||'radar';
    const side=document.getElementById('sidePanel');if(!side)return;
    if(id==='etf')side.innerHTML=panelEtf();
    else if(id==='crypto')side.innerHTML=panelCrypto();
  }
  function install(){
    if(window.__v8Installed)return;window.__v8Installed=true;
    window.__v8={updateEtf,deleteEtf,addEtf,updateCrypto,deleteCrypto,render};
    const style=document.createElement('style');style.textContent=`
      .v8-wrap{padding:14px}.v8-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.v8-title h2{margin:0;font-size:18px}.v8-title span{font-size:11px;color:#94a3b8}.v8-grid{display:grid;gap:12px}.v8-card{background:rgba(15,23,42,.72);border:1px solid #253047;border-radius:12px;padding:12px}.v8-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.v8-head strong{display:block;font-size:15px}.v8-head small{display:block;color:#64748b;margin-top:2px}.v8-card label{display:block;font-size:11px;color:#94a3b8;margin:8px 0}.v8-card input{display:block;width:100%;box-sizing:border-box;margin-top:5px;background:#0b1220;color:#e2e8f0;border:1px solid #334155;border-radius:7px;padding:9px}.v8-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:12px}.v8-stats span{background:#0b1220;border-radius:7px;padding:8px;font-size:10px;color:#64748b}.v8-stats b{display:block;color:#e2e8f0;font-size:12px;margin-top:3px}.v8-stats .up{color:#4ade80}.v8-stats .down{color:#f87171}.v8-add,.v8-danger{border:1px solid #334155;background:#172033;color:#e2e8f0;border-radius:7px;padding:7px 10px;font-size:11px}.v8-danger{color:#fca5a5;border-color:#7f1d1d}.v8-note{margin-top:10px;font-size:11px;color:#64748b}@media(max-width:600px){.v8-title{align-items:flex-start}.v8-stats{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(style);
    const oldSet=window.setPanel;
    if(typeof oldSet==='function'&&!oldSet.__v8){const wrapped=function(panel){window.__mlPanel=panel;const r=oldSet.apply(this,arguments);if(panel==='etf'||panel==='crypto')setTimeout(render,0);return r};wrapped.__v8=true;window.setPanel=wrapped;}
    const oldRender=window.renderPanel;
    window.renderPanel=function(){const id=window.__mlPanel||window.S?.activePanel||'radar';if(id==='etf'||id==='crypto')return render();return oldRender?.apply(this,arguments)};
    render();
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(document.getElementById('sidePanel')&&(typeof window.setPanel==='function'||tries>100)){clearInterval(timer);install()}},50);
  setInterval(()=>{syncPrices();const id=window.__mlPanel||window.S?.activePanel;if(id==='etf'||id==='crypto')render()},30000);
})();
