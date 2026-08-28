/* Miracolo Lab v6 — personal portfolio + focused markets + learning bot */
(() => {
  const KEY = 'ml_portfolio_v6';
  const BOTKEY = 'ml_bot_learning_v6';
  const MARKET = [
    {sym:'^GSPC',label:'S&P 500',group:'USA'},
    {sym:'^NDX',label:'Nasdaq 100',group:'USA'},
    {sym:'^DJI',label:'Dow Jones',group:'USA'},
    {sym:'^RUT',label:'Russell 2000',group:'USA'},
    {sym:'^FTSE',label:'FTSE 100',group:'Europa'},
    {sym:'^GDAXI',label:'DAX',group:'Europa'},
    {sym:'^FCHI',label:'CAC 40',group:'Europa'},
    {sym:'^STOXX50E',label:'Euro Stoxx 50',group:'Europa'},
    {sym:'GC=F',label:'Oro',group:'Oro'}
  ];
  const ETF_DEFAULT = [
    {symbol:'SGLD.MI',name:'Gold',qty:0,avg:0},
    {symbol:'SWDA.MI',name:'World',qty:0,avg:0},
    {symbol:'EIMI.MI',name:'Emerging Markets',qty:0,avg:0}
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:0};
  const eur=n=>(Number(n)||0).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2});
  const pct=n=>`${n>=0?'+':''}${(Number(n)||0).toFixed(2)}%`;
  function load(k,f){try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
  let etfs=load(KEY+'.etf',ETF_DEFAULT);
  let crypto=load(KEY+'.crypto',{BTC:{qty:0,avg:0},ETH:{qty:0,avg:0}});
  let prices={}; let cryptoPrices={}; let newsSummary={};
  let botLog=load(BOTKEY,[]);

  function marketSymbols(){return MARKET.map(x=>x.sym).concat(etfs.map(x=>x.symbol)).join(',')}
  async function refreshData(){
    try{const r=await fetch('/api/prices?symbols='+encodeURIComponent(marketSymbols())+'&t='+Date.now(),{cache:'no-store'});const d=await r.json();if(d.ok)(d.prices||[]).forEach(p=>prices[p.symbol]=p)}catch(e){console.warn(e)}
    try{const r=await fetch('/api/crypto?ts='+Date.now(),{cache:'no-store'});const d=await r.json();if(d.ok)(d.coins||[]).forEach(c=>cryptoPrices[c.symbol]=c)}catch(e){console.warn(e)}
    try{const r=await fetch('/api/full-scan?ts='+Date.now(),{cache:'no-store'});const d=await r.json();if(d.ok)newsSummary=d.summary||{}}catch(e){console.warn(e)}
    renderPanel(); runBotTest();
  }
  function p(sym){return Number(prices[sym]?.price||0)}
  function positionValue(q,avg,current){const invested=q*avg;const value=q*current;return {invested,value,pnl:value-invested,pct:invested?(value-invested)/invested*100:0}}
  function chart(rows){
    const max=Math.max(1,...rows.map(r=>Math.abs(r.pnl))); 
    return `<div class="ml-chart">${rows.map(r=>{const w=Math.min(100,Math.max(2,Math.abs(r.pnl)/max*100));return `<div class="ml-chart-row"><span>${esc(r.name)}</span><div class="ml-bar"><i style="width:${w}%;${r.pnl<0?'background:#ef4444':''}"></i></div><b>${r.pnl>=0?'+':''}${eur(r.pnl)}</b></div>`}).join('')}</div>`;
  }
  function marketMini(){
    const groups=['USA','Europa','Oro'];let h='<div class="ml-market"><div class="ml-section-title">Mercati</div>';
    for(const g of groups){h+=`<div class="ml-group"><span>${g}</span>`;for(const x of MARKET.filter(m=>m.group===g)){const q=prices[x.sym],ch=q?.changePct??0;h+=`<div class="ml-market-row"><span>${esc(x.label)}</span><strong>${q?.price!=null?(q.currency==='EUR'?'€':'$')+Number(q.price).toLocaleString('it-IT',{maximumFractionDigits:2}):'—'}</strong><em class="${ch>=0?'up':'down'}">${q?.changePct!=null?pct(ch):'—'}</em></div>`}h+='</div>'}return h+'</div>';
  }
  function panelDashboard(){
    const vals=etfs.map(e=>{const z=positionValue(e.qty,e.avg,p(e.symbol));return {...z,name:e.name}}).concat(Object.entries(crypto).map(([s,v])=>{const c=cryptoPrices[s];const z=positionValue(v.qty,v.avg,c?.price||0);return {...z,name:s}}));
    const invested=vals.reduce((a,x)=>a+x.invested,0),value=vals.reduce((a,x)=>a+x.value,0),pnl=value-invested;
    return `<div class="ml-wrap"><div class="ml-head"><h2>Dashboard</h2><span>Aggiornamento automatico ogni 5 minuti</span></div><div class="ml-summary"><div><small>Investito</small><b>${eur(invested)}</b></div><div><small>Valore attuale</small><b>${eur(value)}</b></div><div><small>Guadagno / perdita</small><b class="${pnl>=0?'up':'down'}">${pnl>=0?'+':''}${eur(pnl)}</b></div></div>${marketMini()}<div class="ml-card"><div class="ml-section-title">Portafoglio</div>${vals.map(x=>`<div class="ml-port-row"><span>${esc(x.name)}</span><strong>${eur(x.value)}</strong><em class="${x.pnl>=0?'up':'down'}">${x.invested?pct(x.pct):'Inserisci quantità'}</em></div>`).join('')}</div></div>`;
  }
  function inputRow(prefix,obj,label,symbol){return `<div class="ml-input-row"><div><strong>${esc(label)}</strong><small>${esc(symbol)}</small></div><label>Quantità<input id="${prefix}Qty" inputmode="decimal" type="number" min="0" step="any" value="${obj.qty||''}"></label><label>Prezzo medio €<input id="${prefix}Avg" inputmode="decimal" type="number" min="0" step="any" value="${obj.avg||''}"></label></div>`}
  function panelEtf(){
    const rows=etfs.map(e=>{const z=positionValue(e.qty,e.avg,p(e.symbol));return {...z,name:e.name,symbol:e.symbol}});
    return `<div class="ml-wrap"><div class="ml-head"><h2>ETF — Il mio portafoglio</h2><span>Inserisci quantità e prezzo medio di acquisto</span></div><div class="ml-card">${rows.map((e,i)=>`<div class="ml-invest"><div class="ml-invest-title"><strong>${esc(e.name)}</strong><small>${esc(e.symbol)} · Milano</small></div><label>Quantità<input id="etfQty${i}" type="number" min="0" step="any" value="${e.qty||''}"></label><label>Prezzo medio €<input id="etfAvg${i}" type="number" min="0" step="any" value="${e.avg||''}"></label><div class="ml-kpis"><span>Prezzo attuale <b>${p(e.symbol)?eur(p(e.symbol)):'—'}</b></span><span>Valore <b>${eur(e.value)}</b></span><span>P/L <b class="${e.pnl>=0?'up':'down'}">${e.invested?`${e.pnl>=0?'+':''}${eur(e.pnl)} (${pct(e.pct)})`:'—'}</b></span></div></div>`).join('')}<button class="ml-btn" id="saveEtf">Salva portafoglio ETF</button></div>${chart(rows)}</div>`;
  }
  function panelCrypto(){
    const rows=Object.entries(crypto).map(([s,v])=>{const z=positionValue(v.qty,v.avg,cryptoPrices[s]?.price||0);return {...z,name:s}});const invested=rows.reduce((a,x)=>a+x.invested,0);return `<div class="ml-wrap"><div class="ml-head"><h2>Crypto — Le mie posizioni</h2><span>BTC e ETH</span></div><div class="ml-card">${rows.map((r,i)=>`<div class="ml-invest"><div class="ml-invest-title"><strong>${r.name}</strong><small>Prezzo aggiornato automaticamente</small></div><label>Quantità ${r.name}<input id="crQty${r.name}" type="number" min="0" step="any" value="${crypto[r.name].qty||''}"></label><label>Prezzo medio €<input id="crAvg${r.name}" type="number" min="0" step="any" value="${crypto[r.name].avg||''}"></label><div class="ml-kpis"><span>Prezzo attuale <b>${cryptoPrices[r.name]?.price?eur(cryptoPrices[r.name].price):'—'}</b></span><span>Valore <b>${eur(r.value)}</b></span><span>P/L <b class="${r.pnl>=0?'up':'down'}">${r.invested?`${r.pnl>=0?'+':''}${eur(r.pnl)} (${pct(r.pct)})`:'—'}</b></span></div></div>`).join('')}<button class="ml-btn" id="saveCrypto">Salva posizioni crypto</button></div>${chart(rows)}<div class="ml-note">Capitale investito: ${eur(invested)}. I dati inseriti da te restano salvati sul dispositivo.</div></div>`;
  }
  function runBotTest(){
    const btc=cryptoPrices.BTC,eth=cryptoPrices.ETH;const signals=[];
    for(const [sym,c] of [['BTC',btc],['ETH',eth]])if(c){const ch=Number(c.change24h||0);signals.push({asset:sym,score:Math.max(1,Math.min(6,Math.round(3+ch))),direction:ch>=0?'RIALZISTA':'RIBASSISTA',change:ch})}
    if(!signals.length)return;
    const now=Date.now();
    for(const old of botLog.filter(x=>!x.evaluated)){
      const c=cryptoPrices[old.asset];if(c && now-old.time>=5*60*1000){const move=Number(c.price)-old.price;old.result=move>=0?'POSITIVA':'NEGATIVA';old.movePct=old.price?move/old.price*100:0;old.evaluated=true;}}
    signals.forEach(s=>{const last=botLog.find(x=>x.asset===s.asset&&!x.evaluated);if(!last)botLog.unshift({time:now,asset:s.asset,price:cryptoPrices[s.asset].price,prediction:s.direction,score:s.score,news:Number(newsSummary.crypto||0),evaluated:false})});
    botLog=botLog.slice(0,100);save(BOTKEY,botLog);if(document.querySelector('[data-bot-log]'))renderPanel();
  }
  function panelBot(){
    const done=botLog.filter(x=>x.evaluated),wins=done.filter(x=>(x.prediction==='RIALZISTA'&&x.movePct>=0)||(x.prediction==='RIBASSISTA'&&x.movePct<0)).length;const acc=done.length?wins/done.length*100:0;const pending=botLog.filter(x=>!x.evaluated).length;
    return `<div class="ml-wrap" data-bot-log><div class="ml-head"><h2>Bot — Laboratorio di apprendimento</h2><span>Test automatici, nessun ordine reale</span></div><div class="ml-summary"><div><small>Test completati</small><b>${done.length}</b></div><div><small>Accuratezza</small><b>${acc.toFixed(1)}%</b></div><div><small>In osservazione</small><b>${pending}</b></div></div><div class="ml-card"><div class="ml-section-title">Ultimi ragionamenti</div>${botLog.slice(0,12).map(x=>`<div class="ml-bot-row"><div><strong>${x.asset}</strong> · ${x.prediction} · score ${x.score}/6</div><small>Prezzo ${eur(x.price)} · ${x.evaluated?`Esito ${x.result} (${pct(x.movePct)})`:'in osservazione'}</small></div>`).join('')||'<div class="ml-note">Il Bot inizierà il primo test al prossimo aggiornamento.</div>'}</div><div class="ml-note">Il Bot confronta la previsione con il movimento successivo. Non esegue acquisti o vendite.</div></div>`;
  }
  function panel(id){if(id==='radar')return panelDashboard();if(id==='etf')return panelEtf();if(id==='crypto')return panelCrypto();if(id==='bot')return panelBot();return panelDashboard()}
  function route(id){if(id==='prices')id='radar';window.__mlPanel=id;document.querySelectorAll('.rail-btn').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));const el=document.getElementById('sidePanel');if(el)el.innerHTML=panel(id);bind(id)}
  function bind(id){
    if(id==='etf')document.getElementById('saveEtf')?.addEventListener('click',()=>{etfs=etfs.map((e,i)=>({...e,qty:num(document.getElementById('etfQty'+i)?.value),avg:num(document.getElementById('etfAvg'+i)?.value)}));save(KEY+'.etf',etfs);toast('Portafoglio ETF salvato','success');renderPanel()});
    if(id==='crypto')document.getElementById('saveCrypto')?.addEventListener('click',()=>{for(const s of ['BTC','ETH'])crypto[s]={qty:num(document.getElementById('crQty'+s)?.value),avg:num(document.getElementById('crAvg'+s)?.value)};save(KEY+'.crypto',crypto);toast('Posizioni crypto salvate','success');renderPanel()});
  }
  function renderPanel(){const id=window.__mlPanel||'radar';const el=document.getElementById('sidePanel');if(el)el.innerHTML=panel(id);bind(id)}
  const css=document.createElement('style');css.textContent=`
    .ml-wrap{font-family:Inter,system-ui,sans-serif;color:#e2e8f0}.ml-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:14px}.ml-head h2{margin:0;font-size:18px}.ml-head span,.ml-note,.ml-invest-title small,.ml-bot-row small{color:#64748b;font-size:11px}.ml-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.ml-summary>div,.ml-card,.ml-market{background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:12px}.ml-summary small{display:block;color:#64748b;font-size:10px}.ml-summary b{display:block;margin-top:5px;font-size:16px}.ml-section-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:8px}.ml-group{margin-bottom:10px}.ml-group>span{display:block;font-size:10px;color:#64748b;margin:8px 0 4px}.ml-market-row,.ml-port-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(148,163,184,.08);font-size:12px}.ml-market-row:last-child,.ml-port-row:last-child{border:0}.ml-market-row strong,.ml-port-row strong{font-size:12px}.up{color:#22c55e!important}.down{color:#ef4444!important}.ml-invest{border-bottom:1px solid rgba(148,163,184,.1);padding:12px 0}.ml-invest:last-of-type{border:0}.ml-invest-title{display:flex;justify-content:space-between;margin-bottom:10px}.ml-invest label{display:inline-flex;flex-direction:column;gap:4px;font-size:10px;color:#64748b;margin-right:8px;width:145px}.ml-invest input,.ml-input-row input{background:#020617;border:1px solid #334155;border-radius:7px;color:#e2e8f0;padding:9px;font-size:14px;width:100%;box-sizing:border-box}.ml-kpis{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:10px;color:#64748b}.ml-kpis b{display:block;color:#e2e8f0;margin-top:3px}.ml-btn{margin-top:12px;border:0;border-radius:8px;padding:10px 14px;background:#22d3ee;color:#042f3b;font-weight:700}.ml-chart{margin-top:12px;padding:10px 0}.ml-chart-row{display:grid;grid-template-columns:100px 1fr auto;gap:8px;align-items:center;margin:8px 0;font-size:10px}.ml-bar{height:8px;background:#1e293b;border-radius:10px;overflow:hidden}.ml-bar i{display:block;height:100%;background:#22c55e;border-radius:10px}.ml-bot-row{padding:9px 0;border-bottom:1px solid rgba(148,163,184,.08);font-size:11px}.ml-bot-row:last-child{border:0}@media(max-width:600px){.ml-summary{grid-template-columns:1fr 1fr}.ml-invest label{width:calc(50% - 8px);margin-top:5px}.ml-head{display:block}.ml-head span{display:block;margin-top:4px}}
  `;document.head.appendChild(css);
  const oldSet=window.setPanel;
  window.setPanel=function(id){route(id)};
  const oldRender=window.renderPanel;
  window.renderPanel=function(){renderPanel()};
  function hideMarketTab(){const b=document.querySelector('.rail-btn[data-panel="prices"]');if(b)b.remove();}
  hideMarketTab();
  const observer=new MutationObserver(hideMarketTab);observer.observe(document.body,{childList:true,subtree:true});
  window.__mlPanel='radar';renderPanel();refreshData();
  setInterval(refreshData,5*60*1000);
})();
