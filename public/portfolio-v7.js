/* Miracolo Lab v7 — editable personal holdings */
(() => {
  const KEY='ml_portfolio_v6';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)&&x>=0?x:0};
  const eur=x=>(Number(x)||0).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2});
  const pct=x=>(Number(x)||0).toFixed(2)+'%';
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  let etfs=load(KEY+'.etf',[{symbol:'SGLD.MI',name:'Gold',qty:0,avg:0},{symbol:'SWDA.MI',name:'World',qty:0,avg:0},{symbol:'EIMI.MI',name:'Emerging Markets',qty:0,avg:0}]);
  let crypto=load(KEY+'.crypto',{BTC:{qty:0,avg:0},ETH:{qty:0,avg:0}});
  const price=s=>Number(window.__mlPrices?.[s]?.price||0);
  const cprice=s=>Number(window.__mlCryptoPrices?.[s]?.price||0);
  const pos=(q,a,p)=>({invested:q*a,value:q*p,pnl:q*p-q*a,pct:q*a?(q*p-q*a)/(q*a)*100:0});
  function pricesReady(){window.__mlPrices=window.__mlPrices||{};window.__mlCryptoPrices=window.__mlCryptoPrices||{}}
  function editEtf(i){
    const e=etfs[i]; const q=prompt(`Quantità ${e.name}`,String(e.qty||'')); if(q===null)return; const a=prompt(`Prezzo medio di acquisto € — ${e.name}`,String(e.avg||'')); if(a===null)return;
    etfs[i]={...e,qty:n(q),avg:n(a)};save(KEY+'.etf',etfs);render();
  }
  function deleteEtf(i){if(!confirm(`Eliminare i dati di ${etfs[i].name}?`))return;etfs[i]={...etfs[i],qty:0,avg:0};save(KEY+'.etf',etfs);render()}
  function editCrypto(s){
    const q=prompt(`Quantità ${s}`,String(crypto[s]?.qty||'')); if(q===null)return; const a=prompt(`Prezzo medio di acquisto € — ${s} (necessario per il guadagno)`,String(crypto[s]?.avg||'')); if(a===null)return;
    crypto[s]={qty:n(q),avg:n(a)};save(KEY+'.crypto',crypto);render();
  }
  function deleteCrypto(s){if(!confirm(`Eliminare la posizione ${s}?`))return;crypto[s]={qty:0,avg:0};save(KEY+'.crypto',crypto);render()}
  function panelEtf(){pricesReady();return `<div class="ml-wrap"><div class="ml-head"><h2>ETF — Il mio portafoglio</h2><span>Modifica o cancella le tue posizioni</span></div><div class="ml-card">${etfs.map((e,i)=>{const z=pos(e.qty,e.avg,price(e.symbol));return `<div class="ml-invest"><div class="ml-invest-title"><strong>${esc(e.name)}</strong><small>${esc(e.symbol)} · Milano</small></div><div class="v7-fields"><div><small>Quantità</small><b>${e.qty||0}</b></div><div><small>Prezzo medio</small><b>${eur(e.avg)}</b></div><div><small>Prezzo attuale</small><b>${price(e.symbol)?eur(price(e.symbol)):'—'}</b></div></div><div class="ml-kpis"><span>Investito <b>${eur(z.invested)}</b></span><span>Valore <b>${eur(z.value)}</b></span><span>P/L <b class="${z.pnl>=0?'up':'down'}">${z.invested?(z.pnl>=0?'+':'')+eur(z.pnl)+' ('+pct(z.pct)+')':'—'}</b></span></div><div class="v7-actions"><button onclick="window.__v7.editEtf(${i})">Modifica</button><button class="danger" onclick="window.__v7.deleteEtf(${i})">Elimina</button></div></div>`}).join('')}</div><div class="ml-note">Puoi correggere in qualsiasi momento quantità e prezzo medio. I dati restano salvati sul dispositivo.</div></div>`}
  function panelCrypto(){pricesReady();return `<div class="ml-wrap"><div class="ml-head"><h2>Crypto — Le mie posizioni</h2><span>BTC e ETH</span></div><div class="ml-card">${['BTC','ETH'].map(s=>{const v=crypto[s]||{qty:0,avg:0},z=pos(v.qty,v.avg,cprice(s));return `<div class="ml-invest"><div class="ml-invest-title"><strong>${s}</strong><small>Prezzo aggiornato automaticamente</small></div><div class="v7-fields"><div><small>Quantità posseduta</small><b>${v.qty||0}</b></div><div><small>Prezzo medio</small><b>${v.avg?eur(v.avg):'—'}</b></div><div><small>Prezzo attuale</small><b>${cprice(s)?eur(cprice(s)):'—'}</b></div></div><div class="ml-kpis"><span>Investito <b>${eur(z.invested)}</b></span><span>Valore <b>${eur(z.value)}</b></span><span>P/L <b class="${z.pnl>=0?'up':'down'}">${z.invested?(z.pnl>=0?'+':'')+eur(z.pnl)+' ('+pct(z.pct)+')':'—'}</b></span></div><div class="v7-actions"><button onclick="window.__v7.editCrypto('${s}')">Modifica</button><button class="danger" onclick="window.__v7.deleteCrypto('${s}')">Elimina</button></div></div>`}).join('')}</div><div class="ml-note">Per calcolare il guadagno serve anche il prezzo medio di acquisto. La quantità resta sempre modificabile.</div></div>`}
  function render(){const id=window.__mlPanel||'radar';if(id==='etf')document.getElementById('sidePanel').innerHTML=panelEtf();else if(id==='crypto')document.getElementById('sidePanel').innerHTML=panelCrypto()}
  window.__v7={editEtf,deleteEtf,editCrypto,deleteCrypto,render};
  window.__mlPrices=window.__mlPrices||{};window.__mlCryptoPrices=window.__mlCryptoPrices||{};
  const oldRender=window.renderPanel;
  window.renderPanel=()=>{if(window.__v7)window.__v7.render();else if(oldRender)oldRender()};
  setInterval(()=>{pricesReady();if(window.__mlPanel==='etf'||window.__mlPanel==='crypto')render()},30000);
  const style=document.createElement('style');style.textContent='.v7-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.v7-fields>div{background:rgba(15,23,42,.6);border-radius:8px;padding:8px}.v7-fields small{display:block;color:#64748b;font-size:10px}.v7-fields b{display:block;margin-top:3px;font-size:12px}.v7-actions{display:flex;gap:8px;margin-top:10px}.v7-actions button{border:1px solid #334155;background:#172033;color:#e2e8f0;border-radius:7px;padding:7px 12px;font-size:11px}.v7-actions .danger{color:#fca5a5;border-color:#7f1d1d}@media(max-width:600px){.v7-fields{grid-template-columns:1fr 1fr}.v7-fields>div:last-child{grid-column:1/-1}}';document.head.appendChild(style);
  setTimeout(()=>{const orig=window.fetch;window.fetch=(...args)=>orig(...args).then(async r=>{try{const u=String(args[0]);const d=await r.clone().json();if(u.includes('/api/prices')&&d.prices)d.prices.forEach(x=>window.__mlPrices[x.symbol]=x);if(u.includes('/api/crypto')&&d.coins)d.coins.forEach(x=>window.__mlCryptoPrices[x.symbol]=x)}catch{}return r})},0);
})();
