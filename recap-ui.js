/* Miracolo Lab — automated current situation recap */
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function loadRecap(){
  let host=document.getElementById('recap-live'); if(!host)return;
  host.innerHTML='<div class="market-loading">Valuto fonti, segnali e mercato attuale…</div>';
  try{const r=await fetch('/api/recap?ts='+Date.now(),{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);
   host.innerHTML=`<div class="recap-head"><div><h3>🧭 Recap situazione attuale</h3><p>Il sistema confronta le fonti disponibili, pesa la qualità dei segnali e incrocia il quadro crypto.</p></div><b class="recap-tone">${esc(d.marketTone)}</b></div><div class="recap-summary">${esc(d.summary)}</div><div class="recap-crypto"><b>Crypto live</b><span>${esc(d.crypto)}</span></div><div class="recap-grid"><div><h4>Qualità fonti</h4>${(d.sourceQuality||[]).map(s=>`<div class="source-row"><span>${esc(s.name)}</span><b>● ${esc(s.status)} · ${s.items} segnali</b></div>`).join('')}${(d.failedSources||[]).map(s=>`<div class="source-row failed"><span>${esc(s.name)}</span><b>● NON DISPONIBILE</b></div>`).join('')}</div><div><h4>Segnali da tenere d'occhio</h4><ul>${(d.topSignals||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Nessun segnale forte.</li>'}</ul><div class="black-swan"><b>Rischio evento:</b> ${esc(d.blackSwan?.level||'LOW')} ${d.blackSwan?.triggers?.length?`· ${esc(d.blackSwan.triggers.join(', '))}`:''}</div></div></div><div class="recap-note">${(d.limitations||[]).map(x=>`<span>• ${esc(x)}</span>`).join(' ')}</div>`;
  }catch(e){host.innerHTML=`<div class="error"><b>Recap non disponibile</b><br>${esc(e.message)}</div>`}
 }
 function inject(){const market=document.getElementById('market');if(!market)return;let host=document.getElementById('recap-live');if(!host){host=document.createElement('section');host.id='recap-live';host.className='market-section';market.prepend(host)}loadRecap()}
 const old=window.loadMarket;window.loadMarket=async function(){await old?.();inject()};
 document.getElementById('scan')?.addEventListener('click',()=>setTimeout(loadRecap,2500));
})();
