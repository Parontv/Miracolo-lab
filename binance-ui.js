/* Miracolo Lab — live Binance crypto dashboard */
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:v>=100?0:2}).format(v):'—';
  const pct=v=>Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(2)}%`:'—';
  function chart(candles){
    if(!candles?.length)return '<div class="crypto-empty">Nessun dato storico disponibile.</div>';
    const vals=candles.map(x=>Number(x.close)).filter(Number.isFinite), min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
    const W=760,H=250,L=12,R=12,T=16,B=28, pw=W-L-R,ph=H-T-B;
    const pts=vals.map((v,i)=>`${(L+i*Math.max(1,pw/Math.max(1,vals.length-1))).toFixed(1)},${(T+ph-(v-min)/range*ph).toFixed(1)}`).join(' ');
    const area=`${L},${H-B} ${pts} ${L+(vals.length-1)*Math.max(1,pw/Math.max(1,vals.length-1))},${H-B}`;
    return `<svg class="crypto-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafico prezzo Binance"><polyline points="${area}" class="crypto-area"/><polyline points="${pts}" class="crypto-line"/><text x="${W-8}" y="20" text-anchor="end" class="crypto-max">${money(max)}</text><text x="${W-8}" y="${H-8}" text-anchor="end" class="crypto-min">${money(min)}</text></svg>`;
  }
  function card(a){
    const positive=a.change24h>=0;
    return `<article class="crypto-card"><div class="crypto-card-head"><div><b>${esc(a.symbol.replace('USDT',''))}</b><span>/USDT · Binance</span></div><strong class="${positive?'up':'down'}">${pct(a.change24h)}</strong></div><div class="crypto-price">${money(a.price)}</div><div class="crypto-meta"><span>Volume 24h: ${new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(a.volume24h||0)}</span><span>RSI: ${Number.isFinite(a.rsi)?a.rsi:'—'}</span><span>Trend: ${esc(a.trend||'—')}</span><span>Book: ${Number.isFinite(a.orderBookImbalance)?(a.orderBookImbalance>=0?'+':'')+a.orderBookImbalance:'—'}</span></div>${chart(a.candles)}</article>`;
  }
  async function loadBinance(){
    const host=document.getElementById('binance-live'); if(!host)return;
    host.innerHTML='<div class="market-loading">Recupero BTC ed ETH direttamente da Binance…</div>';
    try{
      const r=await fetch('/api/binance?ts='+Date.now(),{cache:'no-store'}),d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);
      const assets=(d.assets||[]).filter(x=>x.symbol==='BTCUSDT'||x.symbol==='ETHUSDT');
      if(!assets.length)throw new Error('Binance non ha restituito BTC/ETH');
      host.innerHTML=`<div class="crypto-head"><div><h3>₿ Crypto live — Binance</h3><p>Prezzi e candele recuperati online dalla Binance Public API. Nessuna API privata utilizzata.</p></div><button id="refreshBinance" class="primary">↻ Aggiorna crypto</button></div><div class="crypto-grid">${assets.map(card).join('')}</div><div class="crypto-updated">Aggiornato: ${new Date(d.timestamp).toLocaleTimeString('it-IT')} · ${assets.length} asset ricevuti</div>`;
      document.getElementById('refreshBinance')?.addEventListener('click',loadBinance);
    }catch(e){host.innerHTML=`<div class="error"><b>Binance non disponibile</b><br>${esc(e.message)}</div>`}
  }
  const original=window.loadMarket;
  window.loadMarket=async function(){
    await original?.();
    const market=document.getElementById('market');
    if(!market)return;
    let host=document.getElementById('binance-live');
    if(!host){host=document.createElement('section');host.id='binance-live';host.className='market-section';market.appendChild(host);}
    await loadBinance();
  };
})();
