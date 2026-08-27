/* Miracolo Lab — Manual Portfolio / V3 */
(function(){
 const KEY='miracolo_lab_portfolio_v1';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(v)||0);
 const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
 const save=x=>localStorage.setItem(KEY,JSON.stringify(x));
 function render(){const items=load(),host=document.getElementById('portfolioRows');if(!host)return;const total=items.reduce((a,x)=>a+(Number(x.value)||0),0);document.getElementById('portfolioTotal').textContent=money(total);host.innerHTML=items.length?items.map((x,i)=>`<div class="holding"><div><b>${esc(x.symbol)}</b><span>${esc(x.name||x.type||'Asset')}</span></div><div><b>${money(x.value)}</b></div><button class="holding-del" data-i="${i}" title="Rimuovi">×</button></div>`).join(''):'<div class="portfolio-empty">Nessun asset inserito. Aggiungi manualmente BTC, ETF o altri strumenti.</div>';host.querySelectorAll('.holding-del').forEach(b=>b.onclick=()=>{const a=load();a.splice(Number(b.dataset.i),1);save(a);render()})}
 function open(){document.getElementById('portfolioModal').classList.add('open');document.getElementById('assetSymbol').focus()}
 function close(){document.getElementById('portfolioModal').classList.remove('open')}
 function add(){const symbol=document.getElementById('assetSymbol').value.trim().toUpperCase(),name=document.getElementById('assetName').value.trim(),type=document.getElementById('assetType').value,value=Number(document.getElementById('assetValue').value);if(!symbol||!Number.isFinite(value)||value<0){alert('Inserisci ticker e valore corrente.');return}const a=load();a.push({symbol,name,type,value});save(a);['assetSymbol','assetName','assetValue'].forEach(id=>document.getElementById(id).value='');close();render()}
 window.getManualPortfolio=load;
 document.addEventListener('DOMContentLoaded',()=>{document.getElementById('portfolioAdd')?.addEventListener('click',open);document.getElementById('portfolioClose')?.addEventListener('click',close);document.getElementById('portfolioSave')?.addEventListener('click',add);document.getElementById('portfolioModal')?.addEventListener('click',e=>{if(e.target.id==='portfolioModal')close()});render()});
})();
