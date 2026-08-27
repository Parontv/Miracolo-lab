/* Miracolo Lab — live market charts */
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v)=>Number.isFinite(v)?new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(v):'—';
function chartSvg(rows,label){
 if(!rows?.length)return '<div class="chart-empty">Dati grafico non disponibili.</div>';
 const w=920,h=300,p=42, vals=rows.map(x=>x.close).filter(Number.isFinite); const min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
 const pts=rows.map((x,i)=>{const xx=p+(i/Math.max(1,rows.length-1))*(w-p*2);const yy=h-p-((x.close-min)/span)*(h-p*2);return [xx,yy,x.close,x.time]});
 const path=pts.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
 const grid=[0,.25,.5,.75,1].map(t=>{const y=p+t*(h-p*2);return `<line x1="${p}" y1="${y}" x2="${w-p}" y2="${y}" class="chart-grid"/><text x="4" y="${y+4}" class="chart-axis">${fmt(max-(max-min)*t)}</text>`}).join('');
 return `<div class="chart-wrap"><div class="chart-title"><b>${esc(label)}</b><span>${fmt(vals.at(-1))}</span></div><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)} chart">${grid}<path d="${path}" class="chart-line" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${pts.length?`<circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="5" class="chart-dot"/>`:''}</svg><div class="chart-range"><span>${new Date(pts[0][3]*1000).toLocaleDateString('it-IT')}</span><span>${new Date(pts.at(-1)[3]*1000).toLocaleDateString('it-IT')}</span></div></div>`;
}
async function loadLiveCharts(container){
 container.innerHTML='<div class="market-loading">Recupero grafici live…</div>';
 const symbols=[['BTC-USD','Bitcoin'],['ETH-USD','Ethereum'],['^GSPC','S&P 500'],['^IXIC','Nasdaq'],['^VIX','VIX'],['^GDAXI','DAX']];
 const blocks=await Promise.all(symbols.map(async([s,n])=>{try{const r=await fetch('/api/chart?symbol='+encodeURIComponent(s)+'&range=1mo&interval=1d&ts='+Date.now(),{cache:'no-store'});const d=await r.json();return chartSvg(d.rows,n)}catch{return `<div class="chart-wrap"><div class="chart-title"><b>${esc(n)}</b></div><div class="chart-empty">Feed non disponibile.</div></div>`}}));
 container.innerHTML=`<div class="live-charts-head"><h2>📈 Grafici di mercato</h2><p>Dati aggiornati online. I grafici sono utilizzati anche per la lettura del trend.</p></div><div class="charts-grid">${blocks.join('')}</div>`;
}
window.loadLiveCharts=loadLiveCharts;
