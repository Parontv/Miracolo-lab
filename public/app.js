/* ============================
   MIRACOLO LAB — app.js v3.0
   Investment Intelligence Platform
   ============================ */

/* ===== STATE ===== */
const S = {
  signals: [],
  filter: 'all',
  activePanel: 'radar',
  cryptoList: [],
  cryptoPrices: {},
  blackSwan: { score: 0, level: 'LOW', triggers: [], active: false },
  sources: [],
  summary: {},
  autoTimer: null,
  countdown: 300,
  countdownInterval: null,
  lastBsAlerted: false,
};

/* ===== SETTINGS (localStorage) ===== */
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('ml_settings') || '{}'); } catch { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem('ml_settings', JSON.stringify(s)); } catch {}
}
let CFG = Object.assign({ bsThreshold: 7, botBudget: 2000, autoRefresh: false }, loadSettings());

/* ===== ETF LIST ===== */
const DEFAULT_ETF = [
  { symbol: 'VWCE', name: 'Vanguard All-World ETF', price: null },
  { symbol: 'CSPX', name: 'iShares Core S&P 500 ETF', price: null },
  { symbol: 'EQQQ', name: 'Invesco NASDAQ-100 ETF', price: null },
];
function loadEtf() {
  try { return JSON.parse(localStorage.getItem('ml_etf') || 'null') || DEFAULT_ETF; } catch { return DEFAULT_ETF; }
}
function saveEtf(list) { try { localStorage.setItem('ml_etf', JSON.stringify(list)); } catch {} }
let ETF_LIST = loadEtf();

/* ===== TRADING BOT ===== */
class TradingBot {
  constructor(budget) {
    this.initialBudget = budget;
    this.cash = budget;
    this.positions = {};
    this.trades = [];
    this.status = 'ACTIVE';
    this.maxPosPct = 0.22;
    this.stopLoss = 0.15;
    this.takeProfit = 0.30;
    this.maxDrawdown = 0.35;
    this.lastCycle = null;
  }

  portfolioValue(prices) {
    let total = this.cash;
    for (const [sym, pos] of Object.entries(this.positions)) {
      if (prices[sym]) total += pos.qty * prices[sym];
    }
    return total;
  }

  drawdown(prices) {
    return (this.initialBudget - this.portfolioValue(prices)) / this.initialBudget;
  }

  buy(sym, price, amount, reason) {
    if (amount < 5) return null;
    const qty = amount / price;
    this.cash -= amount;
    if (this.positions[sym]) {
      const old = this.positions[sym];
      const totalQty = old.qty + qty;
      this.positions[sym] = { qty: totalQty, entryPrice: (old.entryPrice * old.qty + price * qty) / totalQty, invested: old.invested + amount };
    } else {
      this.positions[sym] = { qty, entryPrice: price, invested: amount };
    }
    const trade = { type: 'BUY', sym, price, amount, qty, reason: reason.slice(0, 100), time: new Date().toISOString() };
    this.trades.unshift(trade);
    if (this.trades.length > 50) this.trades.pop();
    this.save();
    return trade;
  }

  sell(sym, price, reason) {
    const pos = this.positions[sym];
    if (!pos) return null;
    const value = pos.qty * price;
    const pnl = value - pos.invested;
    this.cash += value;
    delete this.positions[sym];
    const trade = { type: 'SELL', sym, price, amount: value, pnl, reason, time: new Date().toISOString() };
    this.trades.unshift(trade);
    if (this.trades.length > 50) this.trades.pop();
    this.save();
    return trade;
  }

  sellAll(prices, reason) {
    const trades = [];
    for (const sym of Object.keys(this.positions)) {
      const p = prices[sym];
      if (p) { const t = this.sell(sym, p, reason); if (t) trades.push(t); }
    }
    return trades;
  }

  runCycle(signals, prices) {
    if (!prices || !Object.keys(prices).length) return [];
    this.lastCycle = new Date().toISOString();
    const actions = [];

    // Check drawdown first
    const dd = this.drawdown(prices);
    if (dd >= this.maxDrawdown && this.status !== 'SURVIVAL') {
      this.status = 'SURVIVAL';
      const closed = this.sellAll(prices, '🆘 SURVIVAL MODE — Max drawdown');
      actions.push(...closed);
      this.save();
      return actions;
    }

    // Check existing positions for SL/TP
    for (const [sym, pos] of Object.entries(this.positions)) {
      if (!prices[sym]) continue;
      const pnlPct = (prices[sym] - pos.entryPrice) / pos.entryPrice;
      if (pnlPct <= -this.stopLoss) {
        const t = this.sell(sym, prices[sym], '🛑 STOP LOSS');
        if (t) actions.push(t);
      } else if (pnlPct >= this.takeProfit) {
        const t = this.sell(sym, prices[sym], '🎯 TAKE PROFIT');
        if (t) actions.push(t);
      }
    }

    // Update status
    if (dd >= 0.20) this.status = 'CAUTION';
    else if (this.status !== 'SURVIVAL') this.status = 'ACTIVE';

    // Look for BUY opportunities (only if not in SURVIVAL)
    if (this.status !== 'SURVIVAL') {
      const hotSignals = signals
        .filter(s => s.score >= 5 && s.cryptoAsset && prices[s.cryptoAsset] && !this.positions[s.cryptoAsset])
        .slice(0, 2);

      for (const sig of hotSignals) {
        const sym = sig.cryptoAsset;
        const pv = this.portfolioValue(prices);
        const maxInvest = Math.min(this.cash * this.maxPosPct, pv * this.maxPosPct);
        if (maxInvest < 15) continue;
        const t = this.buy(sym, prices[sym], maxInvest, sig.title);
        if (t) actions.push(t);
      }
    }

    this.save();
    return actions;
  }

  save() {
    try {
      localStorage.setItem('ml_bot', JSON.stringify({
        initialBudget: this.initialBudget, cash: this.cash,
        positions: this.positions, trades: this.trades.slice(0, 30),
        status: this.status, lastCycle: this.lastCycle
      }));
    } catch {}
  }

  static load(budget) {
    const bot = new TradingBot(budget);
    try {
      const d = JSON.parse(localStorage.getItem('ml_bot') || 'null');
      if (d) {
        if (Math.abs(d.initialBudget - budget) < 0.01) {
          bot.cash = d.cash;
          bot.positions = d.positions || {};
          bot.trades = d.trades || [];
          bot.status = d.status || 'ACTIVE';
          bot.lastCycle = d.lastCycle;
        }
      }
    } catch {}
    return bot;
  }

  reset(budget) {
    this.initialBudget = budget;
    this.cash = budget;
    this.positions = {};
    this.trades = [];
    this.status = 'ACTIVE';
    this.lastCycle = null;
    this.save();
  }
}

let BOT = TradingBot.load(CFG.botBudget);

/* ===== HELPERS ===== */
const $ = id => document.getElementById(id);
function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function fmt(n, dec = 2) { return Number(n).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function fmtEur(n) { return fmt(n) + '€'; }
function fmtPct(n) { return (n >= 0 ? '+' : '') + fmt(n, 1) + '%'; }
function kind(x) { return String(x.source || '').toLowerCase().includes('reddit') ? 'social' : 'news'; }

/* ===== TOAST ===== */
function toast(msg, type = 'info', icon = null) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icon || icons[type] || icons.info}</span><span>${esc(msg)}</span>`;
  $('toastContainer').appendChild(el);
  setTimeout(() => { el.classList.add('hiding'); setTimeout(() => el.remove(), 300); }, 4000);
}

/* ===== SKELETON ===== */
function showSkeleton(n = 6) {
  $('results').innerHTML = Array.from({ length: n }, () => `
    <div class="skel-signal">
      <div class="skel-row"><span class="skeleton sk-badge"></span><span class="skeleton sk-score"></span></div>
      <span class="skeleton sk-t" style="width:85%"></span>
      <span class="skeleton sk-d1"></span>
      <span class="skeleton sk-d2"></span>
      <span class="skeleton sk-date"></span>
    </div>`).join('');
}

/* ===== RENDER SOURCES ===== */
function renderSources(sources = []) {
  $('sourceGrid').innerHTML = sources.map(s => {
    const ok = s.status === 'ok';
    const catMap = { macro: '🌍', social: '💬', crypto: '₿', news: '📰' };
    return `<div class="src-card">
      <div class="src-name">${catMap[s.cat]||'📡'} ${esc(s.name)}</div>
      <div class="src-status">
        <span class="${ok ? 'src-ok' : 'src-err'}">${ok ? '● OK' : '● ERR'}</span>
        <span style="color:#334155;font-size:9px">${s.count || 0} segnali</span>
      </div>
    </div>`;
  }).join('');
}

/* ===== RENDER FEED ===== */
function renderFeed() {
  let list = S.signals.slice();
  if (S.filter === 'news')   list = list.filter(x => x.kind === 'news' && x.cat !== 'crypto');
  if (S.filter === 'social') list = list.filter(x => x.kind === 'social');
  if (S.filter === 'macro')  list = list.filter(x => x.cat === 'macro');
  if (S.filter === 'crypto') list = list.filter(x => x.cat === 'crypto');
  if (S.filter === 'strong') list = list.filter(x => Number(x.score || 0) >= 5);

  if (!list.length) {
    $('results').innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Nessun segnale per questo filtro</div></div>`;
    return;
  }

  // In modalita "Tutti": raggruppa per categoria con intestazioni
  if (S.filter === 'all') {
    const groups = [
      { icon: '🔥', label: 'Segnali Forti',    items: list.filter(x => Number(x.score||0) >= 5) },
      { icon: '🌍', label: 'Macro & Economia', items: list.filter(x => x.cat === 'macro'  && Number(x.score||0) < 5) },
      { icon: '📰', label: 'Mercati & Finance', items: list.filter(x => x.cat === 'news' && x.kind === 'news' && Number(x.score||0) < 5) },
      { icon: '₿',  label: 'Crypto News',      items: list.filter(x => x.cat === 'crypto' && Number(x.score||0) < 5) },
      { icon: '💬', label: 'Social & Reddit',  items: list.filter(x => x.kind === 'social' && Number(x.score||0) < 5) },
    ].filter(g => g.items.length > 0);

    let html = '';
    let delay = 0;
    for (const g of groups) {
      html += `<div class="cat-header">
        <span class="cat-icon">${g.icon}</span>
        <span class="cat-label">${g.label}</span>
        <span class="cat-count">${g.items.length}</span>
      </div>`;
      html += g.items.slice(0, 15).map(x => signalCard(x, delay++)).join('');
    }
    $('results').innerHTML = html;
    return;
  }

  $('results').innerHTML = list.map((x, i) => signalCard(x, i)).join('');
}

function signalCard(x, i) {
  const sc = Number(x.score || 0);
  const scoreCls = sc >= 5 ? 'score-green' : sc >= 3 ? 'score-yellow' : 'score-dim';
  const scoreIcon = sc >= 5 ? '🔥' : sc >= 3 ? '⚡' : '·';
  const catBadge = x.cat === 'crypto' ? 'badge-crypto' : x.cat === 'macro' ? 'badge-macro' : x.kind === 'social' ? 'badge-social' : 'badge-news';
  const catLabel = x.cat === 'crypto' ? '₿ Crypto' : x.cat === 'macro' ? '🌍 Macro' : x.kind === 'social' ? '💬 Social' : '📰 News';
  return `<article class="signal" style="animation-delay:${i * 20}ms">
    <div class="sig-meta">
      <span class="badge">${esc(x.source || 'Fonte')}</span>
      <span class="badge ${catBadge}">${catLabel}</span>
      ${x.cryptoAsset ? `<span class="badge badge-crypto">${x.cryptoAsset}</span>` : ''}
      <span class="score-badge ${scoreCls}">${scoreIcon} ${sc}/6</span>
    </div>
    <a class="sig-title" href="${esc(x.link || '#')}" target="_blank" rel="noopener">${esc(x.title || 'Senza titolo')}</a>
    ${x.description ? `<div class="sig-desc">${esc(x.description)}</div>` : ''}
    ${x.date ? `<div class="sig-date">🕐 ${esc(x.date)}</div>` : ''}
  </article>`;
}

/* ===== FILTER ===== */
function setFilter(btn) {
  S.filter = btn.dataset.filter;
  document.querySelectorAll('.ff-btn').forEach(b => b.classList.toggle('active', b === btn));
  renderFeed();
}

/* ===== BLACK SWAN ===== */
function updateBlackSwan(bs) {
  S.blackSwan = bs;
  const banner = $('bsBanner');
  const levelMap = { LOW: 'level-low', MEDIUM: 'level-medium', HIGH: 'level-high', CRITICAL: 'level-critical' };

  if (bs.active || bs.score >= 4) {
    banner.classList.remove('hidden');
    $('bsBannerLevel').textContent = bs.level;
    $('bsBannerLevel').className = levelMap[bs.level] || '';
    $('bsBannerSub').textContent = bs.triggers.length ? `Trigger: ${bs.triggers.slice(0,3).join(', ')}` : 'Monitoraggio ETF attivo';
  } else {
    banner.classList.add('hidden');
  }

  if (bs.active && !S.lastBsAlerted) {
    S.lastBsAlerted = true;
    showBsOverlay(bs);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 Miracolo Lab — BLACK SWAN ALERT', {
        body: `Livello: ${bs.level} · Score: ${bs.score}\nTrigger: ${bs.triggers.slice(0,3).join(', ')}`,
        icon: ''
      });
    }
  }
  if (!bs.active) S.lastBsAlerted = false;

  if (S.activePanel === 'blackswan') renderPanel();
}

function showBsOverlay(bs) {
  const levelMap = { LOW: 'level-low', MEDIUM: 'level-medium', HIGH: 'level-high', CRITICAL: 'level-critical' };
  $('bsOverlayLevel').textContent = `LIVELLO: ${bs.level} · SCORE: ${bs.score}`;
  $('bsTriggersList').innerHTML = (bs.triggers || []).map(t => `<span class="trigger-tag">${esc(t)}</span>`).join('');
  $('bsOverlay').classList.remove('hidden');
}

function dismissBsOverlay() { $('bsOverlay').classList.add('hidden'); }

/* ===== BOT STATUS BAR ===== */
function updateBotBar() {
  const pv = BOT.portfolioValue(S.cryptoPrices);
  const pnl = pv - BOT.initialBudget;
  $('botBar').classList.remove('hidden');
  $('botBarStatus').textContent = BOT.status;
  $('botBarValue').textContent = fmtEur(pv);
  $('botBarPnl').textContent = (pnl >= 0 ? '+' : '') + fmtEur(pnl);
  $('botBarPnl').className = pnl >= 0 ? 'pos' : 'neg';
}

/* ===== HEADER STATUS ===== */
function setStatus(label, state) {
  const dot = $('statusDot');
  $('statusLabel').textContent = label;
  dot.className = 'status-dot ' + state;
}

/* ===== SCAN ===== */
async function doScan() {
  const btn = $('scanBtn');
  btn.disabled = true;
  btn.classList.add('scanning');
  $('scanIcon').textContent = '🔄';
  setStatus('SCANSIONE', 'warn');
  showSkeleton(8);

  try {
    const r = await fetch('/api/full-scan?ts=' + Date.now(), { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || 'HTTP ' + r.status);

    S.signals = d.top_signals || [];
    S.sources = d.sources || [];
    S.summary = d.summary || {};

    // Update header stats
    $('hNews').textContent = d.summary?.news ?? 0;
    $('hSocial').textContent = d.summary?.social ?? 0;
    $('hStrong').textContent = d.summary?.strong ?? 0;
    $('hTime').textContent = new Date().toLocaleTimeString('it-IT');

    $('feedInfo').textContent = `${d.summary?.workingSources ?? 0} fonti attive · ${d.summary?.failedSources ?? 0} non disponibili · ${d.summary?.total ?? 0} segnali`;

    renderSources(S.sources);
    renderFeed();
    setStatus('ONLINE', 'ok');

    // Black swan
    if (d.blackSwan) updateBlackSwan(d.blackSwan);

    // Bot cycle
    if (Object.keys(S.cryptoPrices).length) {
      const actions = BOT.runCycle(S.signals, S.cryptoPrices);
      if (actions.length) {
        updateBotBar();
        const buys = actions.filter(t => t.type === 'BUY').length;
        const sells = actions.filter(t => t.type !== 'BUY').length;
        if (buys) toast(`Bot: ${buys} BUY eseguito/i`, 'success', '🤖');
        if (sells) {
          const pnl = actions.filter(t => t.pnl != null).reduce((s, t) => s + t.pnl, 0);
          toast(`Bot: ${sells} posizione/i chiuse · P&L ${pnl >= 0 ? '+' : ''}${fmtEur(pnl)}`, pnl >= 0 ? 'success' : 'warn', '🤖');
        }
        if (S.activePanel === 'bot') renderPanel();
      }
    }

    const strong = S.signals.filter(s => s.score >= 5).length;
    if (strong > 0) toast(`${strong} segnale/i forte/i rilevato/i`, 'success', '🔥');
    else toast(`Scansione completata · ${S.summary?.total ?? 0} segnali`, 'success');

    try { localStorage.setItem('ml_last_scan', new Date().toISOString()); } catch {}

  } catch (e) {
    setStatus('ERRORE', 'bad');
    $('results').innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">Scansione fallita</div><div class="empty-sub">${esc(e.message)}</div></div>`;
    toast('Scansione fallita: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('scanning');
    $('scanIcon').textContent = '🔎';
  }
}

/* ===== CRYPTO FETCH ===== */
async function fetchCrypto() {
  try {
    const r = await fetch('/api/crypto?ts=' + Date.now(), { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok || !d.coins) return;
    S.cryptoList = d.coins;
    S.cryptoPrices = {};
    d.coins.forEach(c => { S.cryptoPrices[c.symbol] = c.price; });

    // Trigger bot cycle with updated prices
    const actions = BOT.runCycle(S.signals, S.cryptoPrices);
    if (actions.length) {
      updateBotBar();
      if (S.activePanel === 'bot') renderPanel();
    } else {
      updateBotBar();
    }

    if (S.activePanel === 'crypto') renderPanel();
  } catch (e) {
    console.warn('Crypto fetch failed:', e.message);
  }
}

/* ===== PANEL ROUTING ===== */
function setPanel(id) {
  S.activePanel = id;
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === id));
  renderPanel();
}

function renderPanel() {
  const el = $('sidePanel');
  switch (S.activePanel) {
    case 'radar':     el.innerHTML = panelRadar(); break;
    case 'etf':       el.innerHTML = panelEtf(); break;
    case 'crypto':    el.innerHTML = panelCrypto(); break;
    case 'bot':       el.innerHTML = panelBot(); break;
    case 'blackswan': el.innerHTML = panelBlackSwan(); break;
    case 'settings':  el.innerHTML = panelSettings(); break;
    default:          el.innerHTML = '<div class="panel-placeholder"><div class="pp-icon">📡</div><div>Seleziona una sezione</div></div>';
  }
}

/* ===== PANEL: RADAR ===== */
function panelRadar() {
  const bs = S.blackSwan;
  const levelMap = { LOW: 'level-low', MEDIUM: 'level-medium', HIGH: 'level-high', CRITICAL: 'level-critical' };
  const sm = S.summary;
  return `
  <div class="panel-header">
    <div class="panel-title">📡 Radar — Info & Stato</div>
    <div class="panel-sub">Panoramica del monitoraggio attivo</div>
  </div>
  <div class="panel-body">
    <div class="radar-stat-grid">
      <div class="radar-stat"><div class="rs-val">${sm.total ?? '—'}</div><div class="rs-key">Totale</div></div>
      <div class="radar-stat"><div class="rs-val" style="color:#22d3ee">${sm.strong ?? '—'}</div><div class="rs-key">Forti ≥5</div></div>
      <div class="radar-stat"><div class="rs-val">${sm.news ?? '—'}</div><div class="rs-key">News</div></div>
      <div class="radar-stat"><div class="rs-val">${sm.social ?? '—'}</div><div class="rs-key">Social</div></div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Rischio Black Swan</div>
      <div class="p-card" style="text-align:center">
        <div class="bs-level-text ${levelMap[bs.level] || 'level-low'}">${bs.level}</div>
        <div class="bs-score-text">Score: ${bs.score} · ${bs.active ? '⚠️ Alert attivo' : '✅ Normale'}</div>
        ${bs.triggers.length ? `<div style="margin-top:8px">${bs.triggers.map(t => `<span class="trigger-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Fonti attive</div>
      ${S.sources.map(s => `
        <div class="stat-row">
          <span class="stat-key">${esc(s.name)}</span>
          <span class="stat-val ${s.status === 'ok' ? 'up' : 'down'}">${s.status === 'ok' ? '● ' + s.count : '● ERR'}</span>
        </div>`).join('') || '<div style="color:#334155;font-size:11px;padding:8px 0">Nessuna scansione effettuata</div>'}
    </div>
  </div>`;
}

/* ===== PANEL: ETF ===== */
function panelEtf() {
  return `
  <div class="panel-header">
    <div class="panel-title">📈 Portfolio ETF</div>
    <div class="panel-sub">Consultazione · Black Swan monitor attivo</div>
  </div>
  <div class="panel-body">
    <div class="panel-section">
      <div class="panel-section-label">I tuoi ETF</div>
      ${ETF_LIST.length ? ETF_LIST.map(etf => `
        <div class="etf-card">
          <div>
            <div class="etf-sym">${esc(etf.symbol)}</div>
            <div class="etf-name">${esc(etf.name)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="etf-price">${etf.price ? fmtEur(etf.price) : '—'}</div>
            <button class="etf-del" onclick="removeEtf('${esc(etf.symbol)}')" title="Rimuovi">✕</button>
          </div>
        </div>`).join('') : '<div style="color:#334155;font-size:11px;padding:8px 0">Nessun ETF aggiunto</div>'}
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Aggiungi ETF</div>
      <div class="add-etf-form">
        <input class="add-etf-input" id="etfSymInput" placeholder="Simbolo (es. VWCE)" maxlength="10">
        <input class="add-etf-input" id="etfNameInput" placeholder="Nome" maxlength="40">
        <button class="add-etf-btn" onclick="addEtf()">+</button>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Protezione Black Swan</div>
      <div class="p-card">
        <div class="stat-row">
          <span class="stat-key">Stato monitor</span>
          <span class="stat-val ${S.blackSwan.active ? 'down' : 'up'}">${S.blackSwan.active ? '🚨 ALERT' : '✅ Normale'}</span>
        </div>
        <div class="stat-row">
          <span class="stat-key">Livello rischio</span>
          <span class="stat-val">${S.blackSwan.level}</span>
        </div>
        <div class="stat-row">
          <span class="stat-key">Soglia alert</span>
          <span class="stat-val">${CFG.bsThreshold} / 12</span>
        </div>
        <div style="font-size:10px;color:#334155;margin-top:8px;line-height:1.5">
          ⚠️ In caso di Black Swan ricevi alert visivo e notifica browser (no azione automatica sugli ETF)
        </div>
      </div>
    </div>
  </div>`;
}

/* ===== PANEL: CRYPTO ===== */
function panelCrypto() {
  return `
  <div class="panel-header">
    <div class="panel-title">₿ Crypto Monitor</div>
    <div class="panel-sub">Prezzi live · Nessun Black Swan (volatilità normale)</div>
  </div>
  <div class="panel-body">
    ${S.cryptoList.length === 0 ? `
      <div class="empty-state" style="margin-top:0">
        <div class="empty-icon">₿</div>
        <div class="empty-title">Caricamento prezzi...</div>
        <div class="empty-sub">I prezzi si aggiornano ogni 2 minuti</div>
      </div>` : `
      <div class="panel-section">
        <div class="panel-section-label">Top 20 Crypto · EUR</div>
        ${S.cryptoList.slice(0, 20).map(c => {
          const chg = c.change24h;
          const chgCls = chg >= 0 ? 'pos' : 'neg';
          const chgIcon = chg >= 0 ? '▲' : '▼';
          return `<div class="crypto-card">
            <div class="crypto-rank">#${c.rank}</div>
            <div class="crypto-name-wrap">
              <div class="crypto-sym">${esc(c.symbol)}</div>
              <div class="crypto-name">${esc(c.name)}</div>
            </div>
            <div>
              <div class="crypto-price">€${c.price >= 1 ? fmt(c.price) : fmt(c.price, 4)}</div>
              <div class="crypto-change ${chgCls}">${chgIcon} ${fmtPct(chg)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
  </div>`;
}

/* ===== PANEL: BOT ===== */
function panelBot() {
  const pv = BOT.portfolioValue(S.cryptoPrices);
  const pnl = pv - BOT.initialBudget;
  const pnlPct = (pnl / BOT.initialBudget) * 100;
  const pnlCls = pnl >= 0 ? 'pos' : 'neg';
  const statusMap = {
    ACTIVE: { cls: 'bsb-active', icon: '🟢', label: 'ATTIVO' },
    CAUTION: { cls: 'bsb-caution', icon: '🟡', label: 'CAUTELA' },
    SURVIVAL: { cls: 'bsb-survival', icon: '🔴', label: 'SOPRAVVIVENZA' },
    PAUSED: { cls: 'bsb-paused', icon: '⚫', label: 'IN PAUSA' },
  };
  const stInfo = statusMap[BOT.status] || statusMap.ACTIVE;
  const posEntries = Object.entries(BOT.positions);

  return `
  <div class="panel-header">
    <div class="panel-title">🤖 Trading Bot</div>
    <div class="panel-sub">Simulazione su crypto ad alto rischio/rendimento</div>
  </div>
  <div class="panel-body">
    <div class="bot-portfolio-value">
      <div class="bpv-label">Valore Portfolio</div>
      <div class="bpv-val">${fmtEur(pv)}</div>
      <div class="bpv-pnl ${pnlCls}">${pnl >= 0 ? '+' : ''}${fmtEur(pnl)} (${fmtPct(pnlPct)})</div>
      <div class="bot-status-badge ${stInfo.cls}">${stInfo.icon} ${stInfo.label}</div>
    </div>

    <div class="panel-section">
      <div class="panel-section-label">Metriche</div>
      <div class="p-card">
        <div class="stat-row"><span class="stat-key">Budget iniziale</span><span class="stat-val">${fmtEur(BOT.initialBudget)}</span></div>
        <div class="stat-row"><span class="stat-key">Cash disponibile</span><span class="stat-val up">${fmtEur(BOT.cash)}</span></div>
        <div class="stat-row"><span class="stat-key">Posizioni aperte</span><span class="stat-val">${posEntries.length}</span></div>
        <div class="stat-row"><span class="stat-key">Stop Loss</span><span class="stat-val">-15%</span></div>
        <div class="stat-row"><span class="stat-key">Take Profit</span><span class="stat-val">+30%</span></div>
        <div class="stat-row"><span class="stat-key">Max drawdown</span><span class="stat-val">-35%</span></div>
        <div class="stat-row"><span class="stat-key">Ultimo ciclo</span><span class="stat-val">${BOT.lastCycle ? new Date(BOT.lastCycle).toLocaleTimeString('it-IT') : '—'}</span></div>
      </div>
    </div>

    ${posEntries.length ? `
    <div class="panel-section">
      <div class="panel-section-label">Posizioni aperte</div>
      ${posEntries.map(([sym, pos]) => {
        const price = S.cryptoPrices[sym];
        const currentValue = price ? pos.qty * price : pos.invested;
        const positionPnl = currentValue - pos.invested;
        const positionPct = (positionPnl / pos.invested) * 100;
        const pnlCls2 = positionPnl >= 0 ? 'pos' : 'neg';
        return `<div class="position-card">
          <div class="pos-header">
            <span class="pos-sym">${esc(sym)}</span>
            <span class="pos-pnl ${pnlCls2}">${positionPnl >= 0 ? '+' : ''}${fmtEur(positionPnl)} (${fmtPct(positionPct)})</span>
          </div>
          <div class="pos-detail">
            <span>Invest: ${fmtEur(pos.invested)}</span>
            <span>Val: ${fmtEur(currentValue)}</span>
            <span>Entry: €${fmt(pos.entryPrice, 2)}</span>
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <div class="panel-section">
      <div class="panel-section-label">Controlli</div>
      <div class="bot-controls">
        <button class="bot-btn" onclick="forceBotCycle()">▶ Esegui ciclo ora</button>
        <button class="bot-btn danger" onclick="resetBot()">↺ Reset bot</button>
      </div>
    </div>

    ${BOT.trades.length ? `
    <div class="panel-section">
      <div class="panel-section-label">Storico operazioni (${BOT.trades.length})</div>
      ${BOT.trades.slice(0, 15).map(t => {
        const isBuy = t.type === 'BUY';
        const isSL = t.reason.includes('STOP');
        const typeClass = isBuy ? 'tt-buy' : isSL ? 'tt-stop' : 'tt-sell';
        const typeLabel = isBuy ? '▲ BUY' : isSL ? '🛑 STOP' : '🎯 SELL';
        return `<div class="trade-item">
          <div class="trade-left">
            <div><span class="trade-type ${typeClass}">${typeLabel}</span> <span class="trade-sym">${esc(t.sym)}</span></div>
            <div class="trade-reason">${esc(t.reason || '')}</div>
            <div class="sig-date">${new Date(t.time).toLocaleString('it-IT')}</div>
          </div>
          <div class="trade-right">
            <div class="trade-amount">${fmtEur(t.amount)}</div>
            ${t.pnl != null ? `<div class="trade-pnl ${t.pnl >= 0 ? 'pos' : 'neg'}">${t.pnl >= 0 ? '+' : ''}${fmtEur(t.pnl)}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>` : '<div style="color:#334155;font-size:11px;padding:8px 0">Nessuna operazione ancora</div>'}

    <div style="font-size:9px;color:#1e293b;margin-top:12px;line-height:1.5">
      ⚠️ Questa è una simulazione. Nessuna operazione reale viene eseguita.
    </div>
  </div>`;
}

/* ===== PANEL: BLACK SWAN ===== */
function panelBlackSwan() {
  const bs = S.blackSwan;
  const levelMap = { LOW: 'level-low', MEDIUM: 'level-medium', HIGH: 'level-high', CRITICAL: 'level-critical' };
  const levelIcon = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴' };
  return `
  <div class="panel-header">
    <div class="panel-title">🚨 Black Swan Monitor</div>
    <div class="panel-sub">Solo ETF · Crypto escluse (volatilità normale)</div>
  </div>
  <div class="panel-body">
    <div class="bs-level-display">
      <div class="bs-level-icon">${levelIcon[bs.level] || '🟢'}</div>
      <div class="bs-level-text ${levelMap[bs.level] || 'level-low'}">${bs.level}</div>
      <div class="bs-score-text">Score aggregato: ${bs.score} / 12</div>
    </div>

    <div class="panel-section">
      <div class="panel-section-label">Trigger rilevati</div>
      ${bs.triggers.length ? `<div>${bs.triggers.map(t => `<span class="trigger-tag">${esc(t)}</span>`).join('')}</div>` :
        '<div style="color:#334155;font-size:11px;padding:8px 0">✅ Nessun trigger anomalo rilevato</div>'}
    </div>

    <div class="panel-section">
      <div class="panel-section-label">Cosa monitorare</div>
      <div class="p-card">
        <div class="stat-row"><span class="stat-key">Market crash keywords</span><span class="stat-val">✓ Attivo</span></div>
        <div class="stat-row"><span class="stat-key">Circuit breaker / Halt</span><span class="stat-val">✓ Attivo</span></div>
        <div class="stat-row"><span class="stat-key">Bank collapse / Run</span><span class="stat-val">✓ Attivo</span></div>
        <div class="stat-row"><span class="stat-key">Emergency Fed rate cut</span><span class="stat-val">✓ Attivo</span></div>
        <div class="stat-row"><span class="stat-key">Flash crash</span><span class="stat-val">✓ Attivo</span></div>
        <div class="stat-row"><span class="stat-key">Sovereign default</span><span class="stat-val">✓ Attivo</span></div>
        <div class="stat-row"><span class="stat-key">Alert per Crypto</span><span class="stat-val">✗ Escluso</span></div>
      </div>
    </div>

    <div class="panel-section">
      <div class="panel-section-label">Cosa fare in caso di alert</div>
      <div class="p-card">
        <div style="font-size:11px;color:#64748b;line-height:1.7">
          1. 📊 Controlla il VIX (Fear &amp; Greed Index)<br>
          2. 🛑 Considera stop-loss sui tuoi ETF<br>
          3. 💵 Mantieni liquidità disponibile<br>
          4. 📰 Verifica le fonti delle notizie<br>
          5. 🤖 Il bot entra in modalità SURVIVAL automaticamente
        </div>
      </div>
    </div>

    <div class="panel-section">
      <div class="panel-section-label">Soglia attuale</div>
      <div class="p-card">
        <div class="stat-row">
          <span class="stat-key">Alert sopra score</span>
          <span class="stat-val">${CFG.bsThreshold} / 12</span>
        </div>
        <div class="stat-row">
          <span class="stat-key">Notifiche browser</span>
          <span class="stat-val" id="notifStatus">—</span>
        </div>
        <button class="bot-btn" style="margin-top:10px;width:100%" onclick="requestNotifPerm()">🔔 Attiva notifiche browser</button>
      </div>
    </div>
  </div>`;
}

/* ===== PANEL: SETTINGS ===== */
function panelSettings() {
  return `
  <div class="panel-header">
    <div class="panel-title">⚙️ Impostazioni</div>
    <div class="panel-sub">Configurazione piattaforma</div>
  </div>
  <div class="panel-body">
    <div class="panel-section">
      <div class="panel-section-label">Trading Bot</div>
      <div class="p-card">
        <div class="setting-row">
          <div>
            <div class="setting-label">Budget iniziale (€)</div>
            <div class="setting-desc">Modifica e resetta il bot</div>
          </div>
          <input class="setting-input" type="number" id="budgetInput" value="${CFG.botBudget}" min="100" step="100">
        </div>
        <button class="bot-btn" style="margin-top:10px;width:100%" onclick="applyBotBudget()">Applica e resetta bot</button>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Black Swan Alert</div>
      <div class="p-card">
        <div class="setting-row">
          <div>
            <div class="setting-label">Soglia alert (0-12)</div>
            <div class="setting-desc">Score minimo per attivare l'alert ETF</div>
          </div>
          <input class="setting-input" type="number" id="bsThreshInput" value="${CFG.bsThreshold}" min="1" max="12" step="1">
        </div>
        <button class="bot-btn" style="margin-top:10px;width:100%" onclick="applyBsThresh()">Salva soglia</button>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Reset</div>
      <div class="p-card">
        <button class="bot-btn danger" style="width:100%" onclick="if(confirm('Reset ETF list?')) resetEtf()">↺ Reset lista ETF</button>
        <button class="bot-btn danger" style="width:100%;margin-top:7px" onclick="if(confirm('Reset tutto?')) fullReset()">💥 Reset tutto</button>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Info</div>
      <div class="p-card">
        <div class="stat-row"><span class="stat-key">Versione</span><span class="stat-val">3.0</span></div>
        <div class="stat-row"><span class="stat-key">Fonti monitorate</span><span class="stat-val">10</span></div>
        <div class="stat-row"><span class="stat-key">Crypto tracked</span><span class="stat-val">Top 25 EUR</span></div>
      </div>
    </div>
  </div>`;
}

/* ===== ETF ACTIONS ===== */
function addEtf() {
  const sym = ($('etfSymInput')?.value || '').trim().toUpperCase();
  const name = ($('etfNameInput')?.value || '').trim();
  if (!sym) return;
  if (ETF_LIST.some(e => e.symbol === sym)) { toast('ETF già presente', 'warn'); return; }
  ETF_LIST.push({ symbol: sym, name: name || sym, price: null });
  saveEtf(ETF_LIST);
  renderPanel();
  toast(`ETF ${sym} aggiunto`, 'success', '📈');
}

function removeEtf(sym) {
  ETF_LIST = ETF_LIST.filter(e => e.symbol !== sym);
  saveEtf(ETF_LIST);
  renderPanel();
}

function resetEtf() {
  ETF_LIST = [...DEFAULT_ETF];
  saveEtf(ETF_LIST);
  renderPanel();
}

/* ===== BOT ACTIONS ===== */
function forceBotCycle() {
  if (!Object.keys(S.cryptoPrices).length) { toast('Prezzi crypto non disponibili. Premi Scansiona prima.', 'warn'); return; }
  const actions = BOT.runCycle(S.signals, S.cryptoPrices);
  updateBotBar();
  renderPanel();
  toast(`Ciclo bot eseguito · ${actions.length} azioni`, 'success', '🤖');
}

function resetBot() {
  if (!confirm('Resettare il bot? Perderai tutto lo storico.')) return;
  BOT.reset(CFG.botBudget);
  updateBotBar();
  renderPanel();
  toast('Bot resettato a €' + fmtEur(CFG.botBudget), 'info', '🤖');
}

function applyBotBudget() {
  const val = parseFloat($('budgetInput')?.value || '2000');
  if (isNaN(val) || val < 100) { toast('Budget non valido', 'error'); return; }
  CFG.botBudget = val;
  saveSettings(CFG);
  BOT.reset(val);
  updateBotBar();
  renderPanel();
  toast(`Budget impostato: ${fmtEur(val)} · Bot resettato`, 'success');
}

function applyBsThresh() {
  const val = parseInt($('bsThreshInput')?.value || '7');
  if (isNaN(val) || val < 1 || val > 12) { toast('Soglia non valida (1-12)', 'error'); return; }
  CFG.bsThreshold = val;
  saveSettings(CFG);
  renderPanel();
  toast(`Soglia Black Swan: ${val}`, 'success');
}

function fullReset() {
  resetEtf();
  BOT.reset(CFG.botBudget);
  updateBotBar();
  renderPanel();
  toast('Reset completo eseguito', 'warn');
}

/* ===== NOTIFICATIONS ===== */
function requestNotifPerm() {
  if (!('Notification' in window)) { toast('Browser non supporta notifiche', 'warn'); return; }
  Notification.requestPermission().then(p => {
    if (p === 'granted') toast('Notifiche attivate! Riceverai alert Black Swan.', 'success', '🔔');
    else toast('Notifiche non autorizzate.', 'warn');
    if (S.activePanel === 'blackswan') renderPanel();
  });
}

/* ===== AUTO-REFRESH ===== */
function startAutoRefresh() {
  stopAutoRefresh();
  S.countdown = 300;
  const badge = $('countdownBadge');
  S.countdownInterval = setInterval(() => {
    S.countdown--;
    const m = Math.floor(S.countdown / 60);
    const sec = String(S.countdown % 60).padStart(2, '0');
    if (badge) badge.textContent = `${m}:${sec}`;
    if (S.countdown <= 0) { S.countdown = 300; doScan(); }
  }, 1000);
  if (badge) badge.style.opacity = '1';
}

function stopAutoRefresh() {
  clearInterval(S.countdownInterval);
  S.countdownInterval = null;
  const badge = $('countdownBadge');
  if (badge) { badge.textContent = ''; badge.style.opacity = '0'; }
}

/* ===== INIT ===== */
function init() {
  // Auto-refresh toggle
  const autoToggle = $('autoToggle');
  if (autoToggle) {
    autoToggle.addEventListener('change', function () {
      if (this.checked) { startAutoRefresh(); toast('Auto-refresh ogni 5 min', 'info', '⏱️'); }
      else { stopAutoRefresh(); toast('Auto-refresh disattivato', 'info'); }
    });
  }

  // Restore last scan time
  try {
    const last = localStorage.getItem('ml_last_scan');
    if (last) $('hTime').textContent = new Date(last).toLocaleTimeString('it-IT');
  } catch {}

  // Initial panel
  setPanel('radar');
  updateBotBar();

  // Fetch crypto in background
  fetchCrypto();
  setInterval(fetchCrypto, 120000); // every 2 minutes

  // Notification status
  if ('Notification' in window) {
    const ns = document.getElementById('notifStatus');
    if (ns) ns.textContent = Notification.permission === 'granted' ? '✅ Attive' : '⬜ Non attive';
  }
}

document.addEventListener('DOMContentLoaded', init);