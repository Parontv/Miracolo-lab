/* ============================
   MIRACOLO LAB — app.js v2.0
   ============================ */

let signals = [];
let filter = 'all';
let autoRefreshInterval = null;
let countdown = 300; // 5 minuti
let countdownTimer = null;
let previousStrongCount = 0;

const $ = id => document.getElementById(id);

/* ===== UTILITIES ===== */
function esc(v) {
  return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

function kind(x) {
  return String(x.source || '').toLowerCase().includes('reddit') ? 'social' : 'news';
}

/* ===== TOAST NOTIFICATIONS ===== */
function toast(message, type = 'info', icon = null) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', fire: '🔥' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon || icons[type] || icons.info}</span><span>${esc(message)}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/* ===== SKELETON LOADING ===== */
function showSkeleton(count = 6) {
  const skels = Array.from({ length: count }, () => `
    <div class="skeleton-signal">
      <div class="sk-meta">
        <span class="skeleton sk-badge"></span>
        <span class="skeleton sk-score"></span>
      </div>
      <span class="skeleton sk-title"></span>
      <span class="skeleton sk-desc1"></span>
      <span class="skeleton sk-desc2"></span>
      <span class="skeleton sk-date"></span>
    </div>
  `).join('');
  $('results').innerHTML = skels;
}

/* ===== RENDER SOURCES ===== */
function renderSources(list = []) {
  $('sources').innerHTML = '<div class="sourceGrid">' + list.map(s => {
    const ok = s.status === 'ok';
    return `<div class="source">
      <strong>${esc(s.name)}</strong>
      <span class="${ok ? 'sok' : 'serr'}">${ok ? '● OK' : '● ERRORE'} · ${Number(s.count || 0)} elementi</span>
      ${!ok && s.error ? `<div class="date">${esc(s.error)}</div>` : ''}
    </div>`;
  }).join('') + '</div>';
}

/* ===== RENDER SIGNALS ===== */
function render() {
  let list = signals.slice();
  if (filter === 'news')   list = list.filter(x => kind(x) === 'news');
  if (filter === 'social') list = list.filter(x => kind(x) === 'social');
  if (filter === 'strong') list = list.filter(x => Number(x.score || 0) >= 5);

  if (!list.length) {
    $('results').innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div>Nessun segnale disponibile per questo filtro.</div></div>`;
    return;
  }

  $('results').innerHTML = list.map((x, i) => {
    const sc  = Number(x.score || 0);
    const cls = sc >= 5 ? 'green' : sc >= 3 ? 'yellow' : 'normal';
    const isStrong = sc >= 5;
    const itemKind = kind(x);
    const badgeClass = itemKind === 'social' ? 'badge-social' : 'badge-news';
    const kindLabel = itemKind === 'social' ? '💬 SOCIAL' : '📰 NEWS';
    const scoreIcon = sc >= 5 ? '🔥' : sc >= 3 ? '⚡' : '·';

    return `<article class="signal" style="animation-delay:${i * 30}ms">
      <div class="signal-meta">
        <span class="badge">${esc(x.source || 'Fonte')}</span>
        <span class="badge ${badgeClass}">${kindLabel}</span>
        <span class="score ${cls}">${scoreIcon} ${sc}/6</span>
      </div>
      <a class="signal-title" href="${esc(x.link || '#')}" target="_blank" rel="noopener noreferrer">${esc(x.title || 'Senza titolo')}</a>
      ${x.description ? `<div class="desc">${esc(x.description)}</div>` : ''}
      ${x.date ? `<div class="date">🕐 ${esc(x.date)}</div>` : ''}
    </article>`;
  }).join('');
}

/* ===== SCAN ===== */
async function scan() {
  const btn = $('scan');
  btn.disabled = true;
  btn.classList.add('scanning');
  btn.querySelector('.btn-icon').textContent = '🔄';

  $('status').textContent = 'SCANSIONE';
  $('status').className = 'warn';
  showSkeleton(8);

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

    $('newsCount').textContent   = newsCount;
    $('socialCount').textContent = socialCount;
    $('lastScan').textContent    = new Date().toLocaleTimeString('it-IT');
    $('sourceInfo').textContent  = `${d.summary?.workingSources ?? 0} fonti operative · ${d.summary?.failedSources ?? 0} non disponibili · ${total} elementi`;

    renderSources(d.sources || []);
    $('status').textContent = 'ONLINE';
    $('status').className = 'ok';
    filter = 'all';

    document.querySelectorAll('.tabs button').forEach(b =>
      b.classList.toggle('active', b.dataset.filter === 'all')
    );

    render();

    // Toast notifications
    if (newStrong > 0 && newStrong > prevStrong) {
      toast(`${newStrong} segnale${newStrong > 1 ? 'i' : ''} forte${newStrong > 1 ? 'i' : ''} rilevato${newStrong > 1 ? 'i' : ''}!`, 'success', '🔥');
    } else {
      toast(`Scansione completata · ${total} segnali trovati`, 'success');
    }

    // Save to localStorage
    try {
      localStorage.setItem('ml_last_scan', new Date().toISOString());
      localStorage.setItem('ml_last_total', total);
    } catch (_) {}

  } catch (e) {
    $('status').textContent = 'ERRORE';
    $('status').className = 'bad';
    $('results').innerHTML = `<div class="error"><b>Scansione non riuscita</b><br>${esc(e.message)}</div>`;
    toast('Scansione fallita: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('scanning');
    btn.querySelector('.btn-icon').textContent = '🔎';
  }
}

/* ===== AUTO-REFRESH ===== */
function startAutoRefresh() {
  const display = $('countdownDisplay');
  countdown = 300;

  function tick() {
    countdown--;
    const m = Math.floor(countdown / 60);
    const s = String(countdown % 60).padStart(2, '0');
    display.textContent = `${m}:${s}`;
    if (countdown <= 0) {
      countdown = 300;
      scan();
    }
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
  display.classList.add('visible');
}

function stopAutoRefresh() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  const display = $('countdownDisplay');
  display.textContent = '';
  display.classList.remove('visible');
}

/* ===== INIT ===== */
document.querySelectorAll('.tabs button').forEach(b => {
  b.onclick = () => {
    filter = b.dataset.filter;
    document.querySelectorAll('.tabs button').forEach(x => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-selected', x === b ? 'true' : 'false');
    });
    render();
  };
});

$('scan').onclick = scan;

$('autoRefresh').addEventListener('change', function () {
  if (this.checked) {
    startAutoRefresh();
    toast('Auto-refresh attivato (ogni 5 min)', 'info', '⏱️');
  } else {
    stopAutoRefresh();
    toast('Auto-refresh disattivato', 'info');
  }
});

// Restore last scan info
try {
  const last = localStorage.getItem('ml_last_scan');
  if (last) {
    $('lastScan').textContent = new Date(last).toLocaleTimeString('it-IT');
  }
} catch (_) {}