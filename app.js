/* ============================
   MIRACOLO LAB — app.js v3.0
   Radar + Analytics Charts
   ============================ */

let signals = [];
let filter = 'all';
let autoRefreshInterval = null;
let countdown = 300;
let countdownTimer = null;

const $ = id => document.getElementById(id);

function esc(v) {
  return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

function kind(x) {
  return String(x.source || '').toLowerCase().includes('reddit') ? 'social' : 'news';
}

function toast(message, type = 'info', icon = null) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', fire: '🔥' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon || icons[type] || icons.info}</span><span>${esc(message)}</span>`;
  $('toast-container').appendChild(el);
  setTimeout(() => { el.classList.add('hiding'); setTimeout(() => el.remove(), 300); }, 3500);
}

function showSkeleton(count = 6) {
  $('results').innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-signal"><div class="sk-meta"><span class="skeleton sk-badge"></span><span class="skeleton sk-score"></span></div><span class="skeleton sk-title"></span><span class="skeleton sk-desc1"></span><span class="skeleton sk-desc2"></span><span class="skeleton sk-date"></span></div>
  `).join('');
}

function renderSources(list = []) {
  $('sources').innerHTML = '<div class="sourceGrid">' + list.map(s => {
    const ok = s.status === 'ok';
    return `<div class="source"><strong>${esc(s.name)}</strong><span class="${ok ? 'sok' : 'serr'}">${ok ? '● OK' : '● ERRORE'} · ${Number(s.count || 0)} elementi</span>${!ok && s.error ? `<div class="date">${esc(s.error)}</div>` : ''}</div>`;
  }).join('') + '</div>';
}

/* ===== CHART ENGINE ===== */
function chartShell(title, subtitle, body, extraClass = '') {
  return `<div class="chart-card ${extraClass}"><div class="chart-title">${esc(title)}</div><div class="chart-subtitle">${esc(subtitle)}</div>${body}</div>`;
}

function scoreBarChart(list) {
  const counts = [0,0,0,0,0,0,0];
  list.forEach(x => { const s = Math.max(0, Math.min(6, Number(x.score || 0))); counts[s]++; });
  const max = Math.max(1, ...counts);
  const W = 620, H = 210, left = 42, right = 12, top = 12, bottom = 36;
  const plotW = W-left-right, plotH = H-top-bottom, bw = plotW/7*.62, gap = plotW/7;
  let bars = '';
  counts.forEach((v,i) => {
    const h = v/max*plotH, x = left + i*gap + (gap-bw)/2, y = top+plotH-h;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2,h).toFixed(1)}" rx="5" fill="#60a5fa"/><text x="${(x+bw/2).toFixed(1)}" y="${Math.max(12,y-7).toFixed(1)}" text-anchor="middle" class="chart-value">${v}</text><text x="${(x+bw/2).toFixed(1)}" y="${H-12}" text-anchor="middle" class="chart-label">${i}/6</text>`;
  });
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribuzione dei punteggi">${bars}<line x1="${left}" y1="${top+plotH}" x2="${W-right}" y2="${top+plotH}" class="chart-axis"/></svg>`;
}

function sourceChart(list) {
  const map = {};
  list.forEach(x => { const k = String(x.source || 'Fonte'); map[k] = (map[k] || 0) + 1; });
  const rows = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,8);
  if (!rows.length) return '<div class="chart-empty">Nessun dato disponibile.</div>';
  const max = Math.max(1, ...rows.map(x => x[1]));
  const W=620,H=Math.max(210,rows.length*29+24), left=165, barW=400;
  let svg=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Segnali per fonte">`;
  rows.forEach(([name,value],i)=>{const y=18+i*29;const w=value/max*barW;svg+=`<text x="0" y="${y+13}" class="chart-label">${esc(name).slice(0,24)}</text><rect x="${left}" y="${y}" width="${Math.max(3,w)}" height="18" rx="5" fill="#38bdf8"/><text x="${Math.min(W-8,left+w+8)}" y="${y+14}" class="chart-value">${value}</text>`;});
  svg+='</svg>'; return svg;
}

function typeChart(list) {
  const news = list.filter(x => kind(x)==='news').length;
  const social = list.filter(x => kind(x)==='social').length;
  const total = news + social || 1;
  const nw = news/total*100, sw = social/total*100;
  return `<div style="padding:22px 4px 8px"><div style="height:34px;border-radius:17px;overflow:hidden;background:#26344a;display:flex"><div style="width:${nw}%;background:#60a5fa;display:flex;align-items:center;justify-content:center;color:#07111f;font-weight:900;font-size:13px">${news ? Math.round(nw)+'%' : ''}</div><div style="width:${sw}%;background:#a78bfa;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px">${social ? Math.round(sw)+'%' : ''}</div></div><div class="chart-legend"><span><i class="chart-dot" style="background:#60a5fa"></i>News: ${news}</span><span><i class="chart-dot" style="background:#a78bfa"></i>Social: ${social}</span></div></div>`;
}

function renderAnalytics(list, mode='all') {
  const title = mode === 'news' ? 'Analisi News' : mode === 'social' ? 'Analisi Social' : mode === 'strong' ? 'Analisi segnali forti' : 'Analisi del radar';
  const subtitle = `${list.length} segnali analizzati sulla scansione corrente`;
  const note = mode === 'strong' ? 'I segnali forti sono quelli con punteggio ≥ 5/6.' : 'Questi grafici analizzano i segnali raccolti dal radar. I dati di prezzo e gli indicatori tecnici verranno aggiunti con il modulo market-data.';
  $('analysis').innerHTML = `<div class="chart-area">
    ${chartShell('Distribuzione dei punteggi', 'Quanti segnali ricadono in ogni livello 0–6.', scoreBarChart(list))}
    ${chartShell('Fonti principali', 'Numero di segnali per fonte, ordinate per frequenza.', sourceChart(list))}
    ${chartShell('News vs Social', 'Composizione del flusso disponibile nella vista corrente.', typeChart(list), 'full')}
  </div><div class="analysis-note"><b>${esc(title)}</b> · ${esc(note)}</div>`;
}

function render() {
  let list = signals.slice();
  if (filter === 'news') list = list.filter(x => kind(x) === 'news');
  if (filter === 'social') list = list.filter(x => kind(x) === 'social');
  if (filter === 'strong') list = list.filter(x => Number(x.score || 0) >= 5);

  const isAnalysis = filter === 'analysis';
  $('analysis').hidden = !isAnalysis;
  $('sources').style.display = isAnalysis ? 'none' : '';
  $('results').style.display = isAnalysis ? 'none' : '';
  $('panelTitle').textContent = isAnalysis ? '📊 Analisi del radar' : filter === 'news' ? '📰 News rilevate' : filter === 'social' ? '💬 Segnali Social' : filter === 'strong' ? '🔥 Segnali forti' : '📡 Segnali rilevati';

  if (isAnalysis) {
    renderAnalytics(signals, 'all');
    return;
  }

  renderAnalytics(list, filter);
  $('analysis').hidden = true;

  if (!list.length) {
    $('results').innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div>Nessun segnale disponibile per questo filtro.</div></div>`;
    return;
  }

  $('results').innerHTML = list.map((x, i) => {
    const sc = Number(x.score || 0);
    const cls = sc >= 5 ? 'green' : sc >= 3 ? 'yellow' : 'normal';
    const itemKind = kind(x);
    const badgeClass = itemKind === 'social' ? 'badge-social' : 'badge-news';
    const kindLabel = itemKind === 'social' ? '💬 SOCIAL' : '📰 NEWS';
    const scoreIcon = sc >= 5 ? '🔥' : sc >= 3 ? '⚡' : '·';
    return `<article class="signal" style="animation-delay:${i * 30}ms"><div class="signal-meta"><span class="badge">${esc(x.source || 'Fonte')}</span><span class="badge ${badgeClass}">${kindLabel}</span><span class="score ${cls}">${scoreIcon} ${sc}/6</span></div><a class="signal-title" href="${esc(x.link || '#')}" target="_blank" rel="noopener noreferrer">${esc(x.title || 'Senza titolo')}</a>${x.description ? `<div class="desc">${esc(x.description)}</div>` : ''}${x.date ? `<div class="date">🕐 ${esc(x.date)}</div>` : ''}</article>`;
  }).join('');
}

async function scan() {
  const btn = $('scan');
  btn.disabled = true; btn.classList.add('scanning'); btn.querySelector('.btn-icon').textContent = '🔄';
  $('status').textContent = 'SCANSIONE'; $('status').className = 'warn'; showSkeleton(8);
  try {
    const r = await fetch('/api/full-scan?ts=' + Date.now(), { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || 'HTTP ' + r.status);
    const prevStrong = signals.filter(x => Number(x.score || 0) >= 5).length;
    signals = (d.top_signals || []).map(x => ({ ...x, kind: kind(x) }));
    const newStrong = signals.filter(x => Number(x.score || 0) >= 5).length;
    const total = d.summary?.total ?? signals.length;
    const newsCount = d.summary?.news ?? 0;
    const socialCount = d.summary?.social ?? 0;
    $('newsCount').textContent = newsCount; $('socialCount').textContent = socialCount;
    $('lastScan').textContent = new Date().toLocaleTimeString('it-IT');
    $('sourceInfo').textContent = `${d.summary?.workingSources ?? 0} fonti operative · ${d.summary?.failedSources ?? 0} non disponibili · ${total} elementi`;
    renderSources(d.sources || []);
    $('status').textContent = 'ONLINE'; $('status').className = 'ok'; filter = 'all';
    document.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('active', b.dataset.filter === 'all'); b.setAttribute('aria-selected', b.dataset.filter === 'all' ? 'true' : 'false'); });
    render();
    if (newStrong > 0 && newStrong > prevStrong) toast(`${newStrong} segnale${newStrong > 1 ? 'i' : ''} forte${newStrong > 1 ? 'i' : ''} rilevato${newStrong > 1 ? 'i' : ''}!`, 'success', '🔥');
    else toast(`Scansione completata · ${total} segnali trovati`, 'success');
    try { localStorage.setItem('ml_last_scan', new Date().toISOString()); localStorage.setItem('ml_last_total', total); } catch (_) {}
  } catch (e) {
    $('status').textContent = 'ERRORE'; $('status').className = 'bad'; $('results').innerHTML = `<div class="error"><b>Scansione non riuscita</b><br>${esc(e.message)}</div>`; toast('Scansione fallita: ' + e.message, 'error');
  } finally { btn.disabled = false; btn.classList.remove('scanning'); btn.querySelector('.btn-icon').textContent = '🔎'; }
}

function startAutoRefresh() {
  const display = $('countdownDisplay'); countdown = 300;
  function tick(){ countdown--; const m=Math.floor(countdown/60); const s=String(countdown%60).padStart(2,'0'); display.textContent=`${m}:${s}`; if(countdown<=0){countdown=300;scan();} }
  tick(); countdownTimer=setInterval(tick,1000); display.classList.add('visible');
}
function stopAutoRefresh(){ clearInterval(countdownTimer); countdownTimer=null; const display=$('countdownDisplay'); display.textContent=''; display.classList.remove('visible'); }

document.querySelectorAll('.tabs button').forEach(b => {
  b.onclick = () => {
    filter = b.dataset.filter;
    document.querySelectorAll('.tabs button').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
    render();
  };
});

$('scan').onclick = scan;
$('autoRefresh').addEventListener('change', function(){ if(this.checked){startAutoRefresh();toast('Auto-refresh attivato (ogni 5 min)','info','⏱️');}else{stopAutoRefresh();toast('Auto-refresh disattivato','info');} });
try { const last=localStorage.getItem('ml_last_scan'); if(last) $('lastScan').textContent=new Date(last).toLocaleTimeString('it-IT'); } catch (_) {}
