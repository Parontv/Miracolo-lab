/* Miracolo Lab — current situation recap v3 */
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=v=>Number.isFinite(Number(v))?`${Number(v)>=0?'+':''}${Number(v).toFixed(2)}%`:'—';
 const sourceWeight={GDELT:1,'Google News':1,'Yahoo Finance':.9,'Macro Trends':1,'Reddit Investing':.55,'Reddit Stocks':.55,'Reddit WSB':.35,'Reddit Crypto':.55,'Reddit Bitcoin':.55,'Reddit Ethereum':.55};
 function popup(title,body){
  let m=document.getElementById('recapExplainModal');
  if(!m){m=document.createElement('div');m.id='recapExplainModal';m.className='recap-modal';m.innerHTML='<div class="recap-modal-box" role="dialog" aria-modal="true"><button class="recap-modal-close" aria-label="Chiudi">×</button><h3 id="recapExplainTitle"></h3><div id="recapExplainBody"></div></div>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.classList.contains('recap-modal-close'))m.classList.remove('open')})}
  document.getElementById('recapExplainTitle').textContent=title;document.getElementById('recapExplainBody').innerHTML=body;m.classList.add('open');
 }
 function whySignal(x,regime){
  const t=(x.title+' '+(x.description||'')).toLowerCase();
  const reasons=[];
  if(x.cryptoAsset)reasons.push(`<b>${esc(x.cryptoAsset)}</b> è direttamente coinvolto.`);
  if(/surge|rally|soar|jumps|record|beat/.test(t))reasons.push('Il tono della notizia è positivo o indica forza.');
  if(/plunge|crash|warning|miss|drops|tumbles|crisis|panic|meltdown|tank/.test(t))reasons.push('Il contenuto contiene un elemento di rischio o pressione.');
  if(x.kind==='social')reasons.push('È un segnale sociale: viene pesato meno delle fonti finanziarie e macro.');
  if(regime?.riskOn===false)reasons.push('Il regime generale è difensivo, quindi il segnale viene trattato con maggiore cautela.');
  if(!reasons.length)reasons.push('È stato selezionato perché combina rilevanza del tema e forza del segnale.');
  return reasons.join('<br>');
 }
 async function loadRecap(){
  const host=document.getElementById('recap-live');if(!host)return;
  host.innerHTML='<div class="market-loading">Aggiorno il quadro del mercato…</div>';
  try{
   const [sr,mr,br]=await Promise.allSettled([
    fetch('/api/full-scan?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),
    fetch('/api/market?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),
    fetch('/api/binance?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json())
   ]);
   const scan=sr.status==='fulfilled'?sr.value:null,market=mr.status==='fulfilled'?mr.value:null,binance=br.status==='fulfilled'?br.value:null;
   if(!scan?.ok)throw new Error(scan?.error||'Radar non disponibile');
   const sources=scan.sources||[],working=sources.filter(s=>s.status==='ok'),failed=sources.filter(s=>s.status!=='ok');
   const weighted=working.reduce((a,s)=>a+(s.count||0)*(sourceWeight[s.name]??.5),0),total=working.reduce((a,s)=>a+(s.count||0),0);
   const quality=total?Math.round(weighted/total*100):0,bs=scan.blackSwan||{},regime=market?.marketRegime;
   const crypto=(binance?.assets||[]).filter(x=>['BTCUSDT','ETHUSDT'].includes(x.symbol));
   const btc=crypto.find(x=>x.symbol==='BTCUSDT'),eth=crypto.find(x=>x.symbol==='ETHUSDT');
   const tone=bs.level==='CRITICAL'||bs.level==='HIGH'||regime?.riskOn===false?'CAUTELA':(regime?.riskOn?'POSITIVO':'NEUTRALE');
   const marketText=regime?`${regime.riskOn?'Risk ON':'Risk OFF'}${Number.isFinite(regime.vix)?` · VIX ${regime.vix.toFixed(1)}`:''}`:'Dati mercato parziali';
   const cryptoText=[btc,eth].filter(Boolean).map(x=>`${x.symbol.replace('USDT','')} ${x.price?.toLocaleString('it-IT',{maximumFractionDigits:2})} (${pct(x.change24h)})`).join(' · ')||'Dati crypto non disponibili';
   const top=(scan.top_signals||[]).slice(0,4);
   const recommendation=bs.level==='CRITICAL'||bs.level==='HIGH'||regime?.riskOn===false?'ATTENDERE / RIDURRE RISCHIO':(top.length?'MONITORARE SETUP':'NESSUN SETUP PRIORITARIO');
   host.innerHTML=`<div class="recap-head"><div><h3>🧭 Situazione attuale</h3><p>Una lettura sintetica di mercato, crypto, news e rischio.</p></div><b class="recap-tone">${esc(tone)}</b></div><div class="recap-simple-grid"><div class="recap-simple-card"><small>MERCATO</small><b>${esc(marketText)}</b></div><div class="recap-simple-card"><small>BTC / ETH</small><b>${esc(cryptoText)}</b></div><div class="recap-simple-card"><small>FONTI</small><b>${working.length}/${sources.length} attive</b></div><div class="recap-simple-card"><small>RISCHIO</small><b>${esc(bs.level||'LOW')}</b></div></div><div class="recap-recommendation"><div><small>INDICAZIONE DEL SISTEMA</small><strong>${esc(recommendation)}</strong></div><button class="why-btn" id="whyRecommendation">Perché?</button></div><div class="recap-signals"><div class="recap-section-title"><h4>Segnali da seguire</h4><span>max 4</span></div>${top.map((x,i)=>`<div class="recap-signal"><div><span class="recap-signal-rank">${i+1}</span><b>${esc(x.title)}</b><small>${esc(x.source||'Fonte')} · ${x.cryptoAsset?esc(x.cryptoAsset):'Mercato'}</small></div><button class="why-btn why-signal" data-i="${i}">Perché?</button></div>`).join('')||'<div class="recap-empty">Nessun segnale prioritario.</div>'}</div><div class="recap-footer"><span>Qualità dati ${quality}/100</span><span>${failed.length?failed.length+' fonti non disponibili':'Tutte le fonti operative'}</span></div>`;
   document.getElementById('whyRecommendation')?.addEventListener('click',()=>popup('Perché questa indicazione?',`<p><b>${esc(recommendation)}</b></p><p>La decisione sintetizza il regime di mercato, il livello di rischio, la presenza di segnali forti e la qualità delle fonti.</p><p>${regime?.riskOn===false?'Il mercato risulta in modalità Risk OFF, quindi il sistema privilegia la prudenza.':'Non è presente un segnale di rischio elevato sufficiente a bloccare l'osservazione dei setup.'}</p><p>Il dato è un supporto decisionale, non una garanzia di risultato.</p>`));
   host.querySelectorAll('.why-signal').forEach(btn=>btn.addEventListener('click',()=>{const x=top[Number(btn.dataset.i)];popup('Perché lo sto segnalando?',whySignal(x,regime)+`<br><br><small>Punteggio interno: ${esc(x.score??'—')}/6. Il punteggio serve a ordinare i segnali, non rappresenta una probabilità di profitto.</small>`)}));
  }catch(e){host.innerHTML=`<div class="error"><b>Recap non disponibile</b><br>${esc(e.message)}</div>`}
 }
 function inject(){const market=document.getElementById('market');if(!market)return;let host=document.getElementById('recap-live');if(!host){host=document.createElement('section');host.id='recap-live';host.className='market-section';market.prepend(host)}loadRecap()}
 const old=window.loadMarket;window.loadMarket=async function(){await old?.();inject()};
 document.getElementById('scan')?.addEventListener('click',()=>setTimeout(loadRecap,1200));
 window.refreshRecap=loadRecap;
})();