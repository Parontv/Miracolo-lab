/* Miracolo Lab — automated current situation recap v2 */
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=v=>Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(2)}%`:'—';
 const sourceWeight={GDELT:1.0,'Google News':1.0,'Yahoo Finance':0.9,'Macro Trends':1.0,'Reddit Investing':0.55,'Reddit Stocks':0.55,'Reddit WSB':0.35,'Reddit Crypto':0.55,'Reddit Bitcoin':0.55,'Reddit Ethereum':0.55};
 async function loadRecap(){
  let host=document.getElementById('recap-live'); if(!host)return;
  host.innerHTML='<div class="market-loading">Analizzo fonti, segnali, mercato e crypto…</div>';
  try{
   const [sr,mr,br]=await Promise.allSettled([
    fetch('/api/full-scan?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),
    fetch('/api/market?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),
    fetch('/api/binance?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json())
   ]);
   const scan=sr.status==='fulfilled'?sr.value:null, market=mr.status==='fulfilled'?mr.value:null, binance=br.status==='fulfilled'?br.value:null;
   if(!scan?.ok)throw new Error(scan?.error||'Radar non disponibile');
   const sources=scan.sources||[], working=sources.filter(s=>s.status==='ok'), failed=sources.filter(s=>s.status!=='ok');
   const weighted=working.reduce((a,s)=>a+(s.count||0)*(sourceWeight[s.name]??0.5),0);
   const total=working.reduce((a,s)=>a+(s.count||0),0);
   const quality=total?Math.round(weighted/total*100):0;
   const bull=(scan.top_signals||[]).filter(x=>Number(x.score||0)>=5).length;
   const bs=scan.blackSwan||{}; const regime=market?.marketRegime;
   const crypto=(binance?.assets||[]).filter(x=>['BTCUSDT','ETHUSDT'].includes(x.symbol));
   const btc=crypto.find(x=>x.symbol==='BTCUSDT'),eth=crypto.find(x=>x.symbol==='ETHUSDT');
   const tone=bs.level==='CRITICAL'||bs.level==='HIGH'||regime?.riskOn===false?'DIFENSIVO':(regime?.riskOn?'RISK ON':'NEUTRALE');
   const marketText=regime?`${regime.riskOn?'RISK ON':'RISK OFF'} · ${regime.breadth??0}/${regime.total??0} indici positivi${Number.isFinite(regime.vix)?` · VIX ${regime.vix.toFixed(2)}`:''}`:'Mercato non disponibile';
   const cryptoText=[btc,eth].filter(Boolean).map(x=>`${x.symbol.replace('USDT','')} ${x.price?.toLocaleString('it-IT',{maximumFractionDigits:2})} · ${pct(x.change24h)}`).join(' · ')||'Crypto non disponibile';
   const top=(scan.top_signals||[]).slice(0,5).map(x=>x.title).filter(Boolean);
   const limitations=[];
   if(failed.length)limitations.push(`${failed.length} fonti non disponibili: i segnali vengono trattati con cautela.`);
   if(market?.errors?.length)limitations.push(`${market.errors.length} strumenti di mercato non hanno restituito dati.`);
   limitations.push('Le fonti social hanno peso inferiore alle fonti finanziarie e macro.');
   host.innerHTML=`<div class="recap-head"><div><h3>🧭 Recap situazione attuale</h3><p>Quadro automatico ottenuto incrociando fonti finanziarie, macro, social, indici e crypto.</p></div><b class="recap-tone">${esc(tone)}</b></div><div class="recap-summary"><b>Qualità informativa: ${quality}/100</b> · ${scan.summary?.workingSources||0}/${sources.length} fonti operative · ${scan.summary?.total||0} segnali. ${esc(marketText)}.</div><div class="recap-crypto"><b>Crypto live Binance</b><span>${esc(cryptoText)}</span></div><div class="recap-grid"><div><h4>Qualità fonti</h4>${working.map(s=>`<div class="source-row"><span>${esc(s.name)}</span><b>● OK · ${s.count||0} · peso ${Math.round((sourceWeight[s.name]??0.5)*100)}%</b></div>`).join('')}${failed.map(s=>`<div class="source-row failed"><span>${esc(s.name)}</span><b>● NON DISPONIBILE</b></div>`).join('')}</div><div><h4>Segnali da tenere d'occhio</h4><ul>${top.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Nessun segnale prioritario.</li>'}</ul><div class="black-swan"><b>Rischio evento:</b> ${esc(bs.level||'LOW')}${bs.triggers?.length?` · ${esc(bs.triggers.join(', '))}`:''} · segnali forti ${bull}</div></div></div><div class="recap-note">${limitations.map(x=>`<span>• ${esc(x)}</span>`).join(' ')}</div>`;
  }catch(e){host.innerHTML=`<div class="error"><b>Recap non disponibile</b><br>${esc(e.message)}</div>`}
 }
 function inject(){const market=document.getElementById('market');if(!market)return;let host=document.getElementById('recap-live');if(!host){host=document.createElement('section');host.id='recap-live';host.className='market-section';market.prepend(host)}loadRecap()}
 const old=window.loadMarket;window.loadMarket=async function(){await old?.();inject()};
 document.getElementById('scan')?.addEventListener('click',()=>setTimeout(loadRecap,1200));
 window.refreshRecap=loadRecap;
})();