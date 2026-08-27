/* ============================
   MIRACOLO LAB — app.js v4.0
   AI-driven Investment Intelligence
   ============================ */

/* ===== TRACKED SYMBOLS ===== */
const WATCHLIST_DEFAULT = [
  // Indices
  { sym: '^GSPC',  label: 'S&P 500',  group: 'indices' },
  { sym: '^NDX',   label: 'Nasdaq 100', group: 'indices' },
  { sym: '^DJI',   label: 'Dow Jones', group: 'indices' },
  { sym: '^VIX',   label: 'VIX Fear', group: 'indices' },
  { sym: '^FTSE',  label: 'FTSE 100', group: 'indices' },
  // Commodities
  { sym: 'GC=F',   label: 'Gold', group: 'commodities' },
  { sym: 'CL=F',   label: 'Oil WTI', group: 'commodities' },
  { sym: 'SI=F',   label: 'Silver', group: 'commodities' },
  // Major stocks
  { sym: 'NVDA',   label: 'NVIDIA', group: 'stocks' },
  { sym: 'AAPL',   label: 'Apple', group: 'stocks' },
  { sym: 'TSLA',   label: 'Tesla', group: 'stocks' },
  { sym: 'META',   label: 'Meta', group: 'stocks' },
  { sym: 'MSFT',   label: 'Microsoft', group: 'stocks' },
  { sym: 'AMZN',   label: 'Amazon', group: 'stocks' },
  // Forex
  { sym: 'EURUSD=X', label: 'EUR/USD', group: 'forex' },
  { sym: 'GBPUSD=X', label: 'GBP/USD', group: 'forex' },
];

/* ===== STATE ===== */
const S = {
  signals: [],
  filter: 'all',
  activePanel: 'radar',
  cryptoList: [],
  cryptoPrices: {},
  allPrices: {},
  watchlist: [],
  blackSwan: { score: 0, level: 'LOW', triggers: [], active: false },
  sources: [],
  summary: {},
  autoTimer: null,
  countdown: 300,
  countdownInterval: null,
  lastBsAlerted: false,
  currentSuggestion: null,
};

/* ===== CONFIG ===== */
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('ml_cfg') || '{}'); } catch { return {}; }
}
function saveSettings(s) { try { localStorage.setItem('ml_cfg', JSON.stringify(s)); } catch {} }
let CFG = Object.assign({
  botBudget: 2000, bsThreshold: 7, autoRefresh: false,
  geminiKey: '', tgToken: '', tgChatId: '',
  scoreThreshold: 5,
}, loadSettings());

/* ===== ETF ===== */
const DEFAULT_ETF = [
  { symbol: 'VWCE.AS', name: 'Vanguard All-World', price: null, change: null },
  { symbol: 'CSPX.L',  name: 'iShares Core S&P 500', price: null, change: null },
  { symbol: 'EQQQ.L',  name: 'Invesco NASDAQ-100', price: null, change: null },
];
function loadEtf() { try { return JSON.parse(localStorage.getItem('ml_etf') || 'null') || DEFAULT_ETF; } catch { return DEFAULT_ETF; } }
function saveEtf(l) { try { localStorage.setItem('ml_etf', JSON.stringify(l)); } catch {} }
let ETF_LIST = loadEtf();

function loadWatchlist() {
  try { return JSON.parse(localStorage.getItem('ml_wl') || 'null') || WATCHLIST_DEFAULT; } catch { return WATCHLIST_DEFAULT; }
}
function saveWatchlist(l) { try { localStorage.setItem('ml_wl', JSON.stringify(l)); } catch {} }

/* ===== LEARNING BOT CLASS ===== */
class LearningBot {
  constructor(budget) {
    this.initialBudget = budget;
    this.cash = budget;
    this.positions = {};
    this.trades = [];
    this.suggestions = [];    // All suggestions generated
    this.status = 'ACTIVE';
    this.params = { scoreThreshold: CFG.scoreThreshold || 5, stopLoss: 0.15, takeProfit: 0.30, maxPosPct: 0.22, maxPositions: 3 };
    this.accuracy = { total: 0, approved: 0, profitable: 0, skippedWin: 0, skippedLose: 0, rate: 0 };
    this.lastCycle = null;
  }

  portfolioValue(prices) {
    let total = this.cash;
    for (const [sym, pos] of Object.entries(this.positions)) {
      const p = prices[sym]; if (p) total += pos.qty * p;
    }
    return total;
  }

  drawdown(prices) {
    return (this.initialBudget - this.portfolioValue(prices)) / this.initialBudget;
  }

  makeSuggestion(signal, price) {
    const pv = this.portfolioValue(S.cryptoPrices);
    const maxInvest = Math.min(this.cash * this.params.maxPosPct, pv * this.params.maxPosPct);
    if (maxInvest < 15 || this.cash < 15) return null;
    if (!signal.cryptoAsset || !price) return null;
    if (this.positions[signal.cryptoAsset]) return null; // already holding
    if (Object.keys(this.positions).length >= this.params.maxPositions) return null;

    const sug = {
      id: Date.now() + Math.random(),
      type: 'BUY',
      sym: signal.cryptoAsset,
      price,
      amount: Math.round(maxInvest * 10) / 10,
      score: signal.score,
      reason: signal.title.slice(0, 120),
      source: signal.source,
      timestamp: new Date().toISOString(),
      status: 'PENDING', // PENDING | APPROVED | SKIPPED | WAITING
      outcome: null,
      aiAnalysis: null,
    };
    this.suggestions.unshift(sug);
    if (this.suggestions.length > 100) this.suggestions.pop();
    this.save();
    return sug;
  }

  approveSuggestion(id) {
    const s = this.suggestions.find(x => x.id === id);
    if (!s || s.status !== 'PENDING') return null;
    s.status = 'APPROVED';
    // Execute buy
    const qty = s.amount / s.price;
    this.cash -= s.amount;
    this.positions[s.sym] = { qty, entryPrice: s.price, invested: s.amount, sugId: id };
    const trade = { type: 'BUY', sym: s.sym, price: s.price, amount: s.amount, reason: s.reason, time: new Date().toISOString() };
    this.trades.unshift(trade); if (this.trades.length > 50) this.trades.pop();
    this.accuracy.approved++;
    this.save();
    return s;
  }

  skipSuggestion(id) {
    const s = this.suggestions.find(x => x.id === id);
    if (!s || s.status !== 'PENDING') return null;
    s.status = 'SKIPPED';
    this.save();
    return s;
  }

  waitSuggestion(id) {
    const s = this.suggestions.find(x => x.id === id);
    if (!s || s.status !== 'PENDING') return null;
    s.status = 'WAITING';
    this.save();
    return s;
  }

  checkPositions(prices) {
    const actions = [];
    for (const [sym, pos] of Object.entries(this.positions)) {
      const p = prices[sym]; if (!p) continue;
      const pnlPct = (p - pos.entryPrice) / pos.entryPrice;
      let reason = null;
      if (pnlPct <= -this.params.stopLoss) reason = '🛑 STOP LOSS';
      else if (pnlPct >= this.params.takeProfit) reason = '🎯 TAKE PROFIT';
      // 3-day expiry
      if (!reason && pos.openedAt) {
        const age = (Date.now() - new Date(pos.openedAt)) / 86400000;
        if (age >= 3) reason = '📅 SCADENZA 3 GIORNI';
      }
      if (reason) {
        const value = pos.qty * p, pnl = value - pos.invested;
        this.cash += value;
        // Evaluate accuracy
        const sug = this.suggestions.find(x => x.id === pos.sugId);
        if (sug) {
          sug.outcome = { pnl, pnlPct, closeReason: reason, closedAt: new Date().toISOString() };
          this.accuracy.total++;
          if (pnl >= 0) this.accuracy.profitable++;
        }
        delete this.positions[sym];
        const trade = { type: 'SELL', sym, price: p, amount: value, pnl, reason, time: new Date().toISOString() };
        this.trades.unshift(trade); if (this.trades.length > 50) this.trades.pop();
        actions.push(trade);
      }
    }
    this.updateAccuracy();
    if (actions.length) this.save();
    return actions;
  }

  evaluateSkipped(prices) {
    // Check if skipped suggestions would have been profitable
    for (const s of this.suggestions.filter(x => x.status === 'SKIPPED' && !x.outcome)) {
      const p = prices[s.sym]; if (!p) continue;
      const pnlPct = (p - s.price) / s.price;
      const age = (Date.now() - new Date(s.timestamp)) / 86400000;
      if (Math.abs(pnlPct) >= this.params.takeProfit || age >= 3) {
        s.outcome = { pnl: s.amount * pnlPct, pnlPct, closeReason: 'Hypothetical', closedAt: new Date().toISOString() };
        if (pnlPct >= 0) this.accuracy.skippedWin++; else this.accuracy.skippedLose++;
        this.save();
      }
    }
  }

  updateAccuracy() {
    const total = this.accuracy.total;
    this.accuracy.rate = total > 0 ? Math.round((this.accuracy.profitable / total) * 100) : 0;
    // Auto-adjust params if enough data
    if (total >= 5) {
      const rate = this.accuracy.profitable / total;
      if (rate < 0.4) this.params.scoreThreshold = Math.min(6, this.params.scoreThreshold + 0.5);
      else if (rate > 0.7) this.params.scoreThreshold = Math.max(3, this.params.scoreThreshold - 0.25);
      this.params.scoreThreshold = Math.round(this.params.scoreThreshold * 10) / 10;
    }
  }

  checkDrawdown(prices) {
    const dd = this.drawdown(prices);
    if (dd >= 0.35 && this.status !== 'SURVIVAL') {
      this.status = 'SURVIVAL';
      // Close all positions
      const closed = [];
      for (const [sym, pos] of Object.entries(this.positions)) {
        const p = prices[sym]; if (!p) continue;
        const value = pos.qty * p, pnl = value - pos.invested;
        this.cash += value;
        delete this.positions[sym];
        closed.push({ type: 'SELL', sym, price: p, amount: value, pnl, reason: '🆘 SURVIVAL MODE', time: new Date().toISOString() });
      }
      this.trades.unshift(...closed);
      this.save();
      return closed;
    }
    if (dd >= 0.20) this.status = 'CAUTION';
    else if (this.status !== 'SURVIVAL') this.status = 'ACTIVE';
    return [];
  }

  generateSuggestions(signals, prices) {
    if (this.status === 'SURVIVAL') return [];
    const candidates = signals.filter(s =>
      s.score >= this.params.scoreThreshold &&
      s.cryptoAsset &&
      prices[s.cryptoAsset] &&
      !this.positions[s.cryptoAsset] &&
      !this.suggestions.find(x => x.sym === s.cryptoAsset && x.status === 'PENDING')
    ).slice(0, 2);

    return candidates.map(sig => this.makeSuggestion(sig, prices[sig.cryptoAsset])).filter(Boolean);
  }

  reset(budget) {
    this.initialBudget = budget; this.cash = budget;
    this.positions = {}; this.trades = []; this.suggestions = [];
    this.status = 'ACTIVE';
    this.accuracy = { total:0, approved:0, profitable:0, skippedWin:0, skippedLose:0, rate:0 };
    this.params.scoreThreshold = CFG.scoreThreshold || 5;
    this.lastCycle = null;
    this.save();
  }

  save() {
    try {
      localStorage.setItem('ml_bot', JSON.stringify({
        initialBudget: this.initialBudget, cash: this.cash,
        positions: this.positions, trades: this.trades.slice(0,30),
        suggestions: this.suggestions.slice(0,50),
        status: this.status, accuracy: this.accuracy, params: this.params, lastCycle: this.lastCycle
      }));
    } catch {}
  }

  static load(budget) {
    const bot = new LearningBot(budget);
    try {
      const d = JSON.parse(localStorage.getItem('ml_bot') || 'null');
      if (d && Math.abs((d.initialBudget||0) - budget) < 0.01) {
        bot.cash = d.cash ?? budget;
        bot.positions = d.positions || {};
        bot.trades = d.trades || [];
        bot.suggestions = d.suggestions || [];
        bot.status = d.status || 'ACTIVE';
        bot.accuracy = d.accuracy || bot.accuracy;
        bot.params = Object.assign(bot.params, d.params || {});
        bot.lastCycle = d.lastCycle;
      }
    } catch {}
    return bot;
  }
}

let BOT = LearningBot.load(CFG.botBudget);

/* ===== HELPERS ===== */
const $ = id => document.getElementById(id);
function esc(v) { return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n, dec=2) { return Number(n||0).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function fmtEur(n) { return fmt(n)+'€'; }
function fmtPct(n) { return (n>=0?'+':'')+fmt(n,1)+'%'; }

/* ===== TOAST ===== */
function toast(msg, type='info', icon=null) {
  const icons = { success:'✅', error:'❌', info:'ℹ️', warn:'⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icon||icons[type]}</span><span>${esc(msg)}</span>`;
  $('toastContainer').appendChild(el);
  setTimeout(() => { el.classList.add('hiding'); setTimeout(() => el.remove(), 300); }, 4500);
}

/* ===== SKELETON ===== */
function showSkeleton(n=7) {
  $('results').innerHTML = Array.from({length:n}, () => `
    <div class="skel-signal">
      <div class="skel-row"><span class="skeleton sk-badge"></span><span class="skeleton sk-score"></span></div>
      <span class="skeleton sk-t" style="width:88%"></span>
      <span class="skeleton sk-d1"></span><span class="skeleton sk-d2"></span>
      <span class="skeleton sk-date"></span>
    </div>`).join('');
}

/* ===== PRICE TICKER ===== */
async function fetchAllPrices() {
  const wl = S.watchlist;
  const etfSyms = ETF_LIST.map(e => e.symbol);
  const allSyms = [...new Set([...wl.map(w => w.sym), ...etfSyms])];
  if (!allSyms.length) return;
  try {
    const r = await fetch('/api/prices?symbols=' + allSyms.map(encodeURIComponent).join(','));
    const d = await r.json();
    if (!d.ok) return;
    d.prices.forEach(p => { S.allPrices[p.symbol] = p; });
    // Update ETF prices
    ETF_LIST.forEach(e => {
      if (S.allPrices[e.symbol]) {
        e.price = S.allPrices[e.symbol].price;
        e.change = S.allPrices[e.symbol].changePct;
      }
    });
    renderTicker();
    if (S.activePanel === 'prices' || S.activePanel === 'etf') renderPanel();
  } catch (e) { console.warn('Price fetch failed:', e.message); }
}

function renderTicker() {
  const wl = S.watchlist;
  const items = wl.map(w => {
    const p = S.allPrices[w.sym];
    if (!p) return '';
    const chgCls = p.changePct >= 0 ? 'ticker-up' : 'ticker-dn';
    const chgIcon = p.changePct >= 0 ? '▲' : '▼';
    const priceFmt = p.price >= 100 ? fmt(p.price, 1) : p.price >= 1 ? fmt(p.price) : fmt(p.price, 4);
    return `<span class="ticker-item">
      <span class="ticker-sym">${esc(w.sym.replace('=X','').replace('=F',''))}</span>
      <span class="ticker-price">${p.currency==='EUR'?'€':'$'}${priceFmt}</span>
      <span class="ticker-chg ${chgCls}">${chgIcon}${fmt(Math.abs(p.changePct),1)}%</span>
    </span>`;
  }).filter(Boolean);

  // Also add crypto from CoinGecko
  S.cryptoList.slice(0,5).forEach(c => {
    const chgCls = c.change24h >= 0 ? 'ticker-up' : 'ticker-dn';
    const chgIcon = c.change24h >= 0 ? '▲' : '▼';
    items.push(`<span class="ticker-item">
      <span class="ticker-sym">${esc(c.symbol)}</span>
      <span class="ticker-price">€${c.price >= 1 ? fmt(c.price,0) : fmt(c.price,4)}</span>
      <span class="ticker-chg ${chgCls}">${chgIcon}${fmt(Math.abs(c.change24h),1)}%</span>
    </span>`);
  });

  if (!items.length) return;
  // Duplicate for infinite scroll
  const html = items.join('') + items.join('');
  $('priceTicker').innerHTML = html;
  $('priceTicker').style.animation = 'none';
  setTimeout(() => { $('priceTicker').style.animation = ''; }, 10);
}

/* ===== RENDER SOURCES ===== */
function renderSources(sources=[]) {
  const catMap = { macro:'🌍', social:'💬', crypto:'₿', news:'📰' };
  $('sourceGrid').innerHTML = sources.map(s => `<div class="src-card">
    <div class="src-name">${catMap[s.cat]||'📡'} ${esc(s.name)}</div>
    <div class="src-status">
      <span class="${s.status==='ok'?'src-ok':'src-err'}">${s.status==='ok'?'● OK':'● ERR'}</span>
      <span style="color:#334155;font-size:9px;margin-left:4px">${s.count||0}</span>
    </div>
  </div>`).join('');
}

/* ===== RENDER FEED ===== */
function renderFeed() {
  let list = S.signals.slice();
  if (S.filter === 'news')   list = list.filter(x => x.kind === 'news' && x.cat !== 'crypto');
  if (S.filter === 'social') list = list.filter(x => x.kind === 'social');
  if (S.filter === 'macro')  list = list.filter(x => x.cat === 'macro');
  if (S.filter === 'crypto') list = list.filter(x => x.cat === 'crypto');
  if (S.filter === 'strong') list = list.filter(x => Number(x.score||0) >= 5);

  if (!list.length) {
    $('results').innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Nessun segnale</div></div>`;
    return;
  }

  if (S.filter === 'all') {
    const groups = [
      { icon:'🔥', label:'Segnali Forti',    items: list.filter(x => Number(x.score||0) >= 5) },
      { icon:'🌍', label:'Macro & Economia', items: list.filter(x => x.cat === 'macro' && Number(x.score||0) < 5) },
      { icon:'📰', label:'Mercati & Finance', items: list.filter(x => x.cat === 'news' && x.kind === 'news' && Number(x.score||0) < 5) },
      { icon:'₿',  label:'Crypto News',      items: list.filter(x => x.cat === 'crypto' && Number(x.score||0) < 5) },
      { icon:'💬', label:'Social & Reddit',  items: list.filter(x => x.kind === 'social' && Number(x.score||0) < 5) },
    ].filter(g => g.items.length > 0);
    let html = '', delay = 0;
    for (const g of groups) {
      html += `<div class="cat-header"><span class="cat-icon">${g.icon}</span><span class="cat-label">${g.label}</span><span class="cat-count">${g.items.length}</span></div>`;
      html += g.items.slice(0, 15).map(x => signalCard(x, delay++)).join('');
    }
    $('results').innerHTML = html;
    return;
  }
  $('results').innerHTML = list.map((x, i) => signalCard(x, i)).join('');
}

function signalCard(x, i) {
  const sc = Number(x.score||0);
  const scoreCls = sc>=5?'score-green':sc>=3?'score-yellow':'score-dim';
  const scoreIcon = sc>=5?'🔥':sc>=3?'⚡':'·';
  const catBadge = x.cat==='crypto'?'badge-crypto':x.cat==='macro'?'badge-macro':x.kind==='social'?'badge-social':'badge-news';
  const catLabel = x.cat==='crypto'?'₿ Crypto':x.cat==='macro'?'🌍 Macro':x.kind==='social'?'💬 Social':'📰 News';
  return `<article class="signal" style="animation-delay:${i*18}ms">
    <div class="sig-meta">
      <span class="badge">${esc(x.source||'Fonte')}</span>
      <span class="badge ${catBadge}">${catLabel}</span>
      ${x.cryptoAsset?`<span class="badge badge-crypto">${x.cryptoAsset}</span>`:''}
      <span class="score-badge ${scoreCls}">${scoreIcon} ${sc}/6</span>
    </div>
    <a class="sig-title" href="${esc(x.link||'#')}" target="_blank" rel="noopener">${esc(x.title||'Senza titolo')}</a>
    ${x.description?`<div class="sig-desc">${esc(x.description)}</div>`:''}
    ${x.date?`<div class="sig-date">🕐 ${esc(x.date)}</div>`:''}
  </article>`;
}

/* ===== FILTER ===== */
function setFilter(btn) {
  S.filter = btn.dataset.filter;
  document.querySelectorAll('.ff-btn').forEach(b => b.classList.toggle('active', b===btn));
  renderFeed();
}

/* ===== BLACK SWAN ===== */
function updateBlackSwan(bs) {
  S.blackSwan = bs;
  const levelMap = { LOW:'level-low', MEDIUM:'level-medium', HIGH:'level-high', CRITICAL:'level-critical' };
  $('bsBanner').classList.toggle('hidden', !(bs.active || bs.score >= 4));
  if (bs.active || bs.score >= 4) {
    $('bsBannerLevel').textContent = bs.level;
    $('bsBannerLevel').className = levelMap[bs.level]||'';
    $('bsBannerSub').textContent = bs.triggers.length ? 'Trigger: '+bs.triggers.slice(0,3).join(', ') : 'Monitoraggio ETF attivo';
  }
  if (bs.active && !S.lastBsAlerted) {
    S.lastBsAlerted = true;
    showBsOverlay(bs);
    sendTelegram(`🚨 BLACK SWAN ALERT\nLivello: ${bs.level} · Score: ${bs.score}\nTrigger: ${bs.triggers.slice(0,3).join(', ')}\n\n⚠️ Monitora i tuoi ETF!`);
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('🚨 BLACK SWAN ALERT', { body: `Livello: ${bs.level}` });
  }
  if (!bs.active) S.lastBsAlerted = false;
}

function showBsOverlay(bs) {
  $('bsOverlayLevel').textContent = `LIVELLO: ${bs.level} · SCORE: ${bs.score}`;
  $('bsTriggersList').innerHTML = (bs.triggers||[]).map(t => `<span class="trigger-tag">${esc(t)}</span>`).join('');
  $('bsOverlay').classList.remove('hidden');
}
function dismissBsOverlay() { $('bsOverlay').classList.add('hidden'); }

/* ===== BOT STATUS BAR ===== */
function updateBotBar() {
  const pv = BOT.portfolioValue(S.cryptoPrices);
  const pnl = pv - BOT.initialBudget;
  const pending = BOT.suggestions.filter(s => s.status === 'PENDING').length;
  $('botBar').classList.remove('hidden');
  $('botBarStatus').textContent = BOT.status;
  $('botBarValue').textContent = fmtEur(pv);
  $('botBarPnl').textContent = (pnl>=0?'+':'')+fmtEur(pnl);
  $('botBarPnl').className = pnl>=0 ? 'pos' : 'neg';
  $('botBarAcc').textContent = BOT.accuracy.rate+'%';
  $('botBarPending').textContent = pending > 0 ? `${pending} suggerim. in attesa` : 'Nessun suggerimento';
  if (pending > 0) $('botBarPending').style.color = '#fbbf24';
  else $('botBarPending').style.color = '';
}

/* ===== STATUS ===== */
function setStatus(label, state) {
  $('statusLabel').textContent = label;
  $('statusDot').className = 'status-dot '+state;
}

/* ===== GEMINI AI ===== */
async function getAiAnalysis(suggestion, signals) {
  if (!CFG.geminiKey) return null;
  const topSignals = signals.filter(s => s.score >= 4).slice(0, 8).map(s => `• [${s.score}/6] ${s.title}`).join('\n');
  const price = S.cryptoPrices[suggestion.sym];
  const cryptoInfo = S.cryptoList.find(c => c.symbol === suggestion.sym);
  const change24h = cryptoInfo ? cryptoInfo.change24h : 0;

  const prompt = `Sei un esperto di trading crypto e mercati finanziari. Analizza questa situazione e spiega in italiano semplice (max 150 parole totali).

ASSET: ${suggestion.sym}
PREZZO: €${price ? fmt(price, 2) : 'N/D'}
VARIAZIONE 24h: ${fmtPct(change24h)}
IMPORTO SUGGERITO: €${fmt(suggestion.amount, 2)}
TIMEFRAME: 1-3 giorni (swing trading)

NEWS E SEGNALI RILEVANTI (ultimi rilevati):
${topSignals || '(nessun segnale forte)'}

Rispondi con questo formato JSON esatto:
{
  "azione": "BUY",
  "confidenza": 72,
  "timeframe": "1-2 giorni",
  "perche": "Spiegazione breve del motivo in 2-3 frasi",
  "rischi": "Principali rischi in 1-2 frasi",
  "impara": "Un concetto di trading spiegato semplicemente in 1-2 frasi"
}`;

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CFG.geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 400 } })
    });
    if (!r.ok) throw new Error('Gemini HTTP ' + r.status);
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return JSON.parse(match[0]);
  } catch (e) {
    console.warn('Gemini error:', e.message);
    return null;
  }
}

/* ===== TRADE MODAL ===== */
function showTradeModal(sug) {
  S.currentSuggestion = sug;
  const price = S.cryptoPrices[sug.sym];

  $('tmAsset').textContent = sug.sym;
  $('tmActionBadge').textContent = sug.type;
  $('tmActionBadge').className = 'tm-action-badge' + (sug.type === 'SELL' ? ' sell' : '');
  $('tmPrice').textContent = price ? '€'+fmt(price, 2) : '—';
  $('tmAmount').textContent = fmtEur(sug.amount);
  $('tmTimeframe').textContent = '1-3 giorni';
  $('tmSL').textContent = '-'+fmt(BOT.params.stopLoss*100, 0)+'%';
  $('tmTP').textContent = '+'+fmt(BOT.params.takeProfit*100, 0)+'%';
  $('tmScore').textContent = sug.score+'/6';
  $('tmConfidence').textContent = '—%';

  $('tmAiLoading').classList.remove('hidden');
  $('tmAiContent').classList.add('hidden');
  $('tmAiError').classList.add('hidden');

  $('tradeModal').classList.remove('hidden');

  // Fetch AI analysis async
  getAiAnalysis(sug, S.signals).then(ai => {
    $('tmAiLoading').classList.add('hidden');
    if (ai) {
      sug.aiAnalysis = ai;
      $('tmConfidence').textContent = (ai.confidenza || '—') + '%';
      $('tmTimeframe').textContent = ai.timeframe || '1-3 giorni';
      $('tmWhy').textContent = ai.perche || '';
      $('tmRisks').textContent = ai.rischi || '';
      $('tmLearn').textContent = ai.impara || '';
      $('tmAiContent').classList.remove('hidden');
    } else {
      $('tmAiError').classList.remove('hidden');
    }
  });
}

function handleTradeDecision(action) {
  $('tradeModal').classList.add('hidden');
  const sug = S.currentSuggestion;
  if (!sug) return;

  if (action === 'approve') {
    BOT.approveSuggestion(sug.id);
    const ai = sug.aiAnalysis;
    const msg = `✅ OPERAZIONE APPROVATA\n🪄 Miracolo Lab Bot\n\nAsset: ${sug.sym}\nTipo: BUY\nImporto: €${fmt(sug.amount,2)}\nPrezzo: €${fmt(sug.price,2)}\nTimeframe: ${ai?.timeframe||'1-3 giorni'}\n\n${ai?.perche||sug.reason}\n\n🛑 Stop: -${fmt(BOT.params.stopLoss*100,0)}% | 🎯 Target: +${fmt(BOT.params.takeProfit*100,0)}%`;
    sendTelegram(msg);
    toast(`BUY ${sug.sym} approvato · €${fmt(sug.amount,2)}`, 'success', '🤖');
  } else if (action === 'skip') {
    BOT.skipSuggestion(sug.id);
    toast(`${sug.sym} saltato — il bot registra la decisione`, 'info', '⏭');
  } else if (action === 'wait') {
    BOT.waitSuggestion(sug.id);
    toast(`${sug.sym} in attesa — puoi approvarlo in seguito`, 'warn', '⏸');
  }
  updateBotBar();
  if (S.activePanel === 'bot' || S.activePanel === 'learning') renderPanel();
}

/* ===== TELEGRAM ===== */
async function sendTelegram(text) {
  if (!CFG.tgToken || !CFG.tgChatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${CFG.tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CFG.tgChatId, text, parse_mode: 'HTML' })
    });
  } catch (e) { console.warn('Telegram error:', e.message); }
}

/* ===== SCAN ===== */
async function doScan() {
  const btn = $('scanBtn');
  btn.disabled = true; btn.classList.add('scanning');
  $('scanIcon').textContent = '🔄';
  setStatus('SCANSIONE', 'warn');
  showSkeleton(8);

  try {
    const r = await fetch('/api/full-scan?ts='+Date.now(), { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || 'HTTP '+r.status);

    S.signals = d.top_signals || [];
    S.sources = d.sources || [];
    S.summary = d.summary || {};

    $('hNews').textContent = d.summary?.news ?? 0;
    $('hSocial').textContent = d.summary?.social ?? 0;
    $('hStrong').textContent = d.summary?.strong ?? 0;
    $('hTime').textContent = new Date().toLocaleTimeString('it-IT');
    $('feedInfo').textContent = `${d.summary?.workingSources??0} fonti · ${d.summary?.total??0} segnali`;

    renderSources(S.sources);
    renderFeed();
    setStatus('ONLINE', 'ok');
    if (d.blackSwan) updateBlackSwan(d.blackSwan);

    // Check positions for SL/TP
    const closed = BOT.checkPositions(S.cryptoPrices);
    if (closed.length) {
      const totalPnl = closed.reduce((s,t) => s+(t.pnl||0), 0);
      toast(`Bot: ${closed.length} posizione/i chiuse · P&L ${totalPnl>=0?'+':''}${fmtEur(totalPnl)}`, totalPnl>=0?'success':'warn', '🤖');
      sendTelegram(`📊 POSIZIONI CHIUSE\n${closed.map(t=>`${t.sym}: ${t.reason} · P&L ${t.pnl>=0?'+':''}€${fmt(Math.abs(t.pnl),2)}`).join('\n')}`);
    }

    // Check drawdown
    const surv = BOT.checkDrawdown(S.cryptoPrices);
    if (surv.length) {
      toast('⚠️ SURVIVAL MODE attivato! Tutte le posizioni chiuse.', 'error', '🆘');
      sendTelegram('🆘 SURVIVAL MODE ATTIVATO\nMax drawdown -35% raggiunto. Tutte le posizioni chiuse.');
    }

    // Generate new suggestions
    const newSugs = BOT.generateSuggestions(S.signals, S.cryptoPrices);
    if (newSugs.length > 0) {
      const sug = newSugs[0];
      toast(`Bot: suggerisce BUY ${sug.sym} · €${fmt(sug.amount,2)}`, 'success', '🤖');
      setTimeout(() => showTradeModal(sug), 800);
    }

    // Evaluate skipped suggestions
    BOT.evaluateSkipped(S.cryptoPrices);
    updateBotBar();

    const strong = S.signals.filter(s => s.score >= 5).length;
    if (strong > 0) toast(`${strong} segnale/i forte/i rilevato/i`, 'success', '🔥');
    try { localStorage.setItem('ml_last_scan', new Date().toISOString()); } catch {}

  } catch (e) {
    setStatus('ERRORE', 'bad');
    $('results').innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">Scansione fallita</div><div class="empty-sub">${esc(e.message)}</div></div>`;
    toast('Scansione fallita: '+e.message, 'error');
  } finally {
    btn.disabled = false; btn.classList.remove('scanning');
    $('scanIcon').textContent = '🔎';
  }
}

/* ===== CRYPTO FETCH ===== */
async function fetchCrypto() {
  try {
    const r = await fetch('/api/crypto?ts='+Date.now(), { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok || !d.coins) return;
    S.cryptoList = d.coins;
    S.cryptoPrices = {};
    d.coins.forEach(c => { S.cryptoPrices[c.symbol] = c.price; });
    BOT.checkPositions(S.cryptoPrices);
    BOT.evaluateSkipped(S.cryptoPrices);
    updateBotBar();
    renderTicker();
    if (S.activePanel === 'crypto') renderPanel();
  } catch (e) { console.warn('Crypto fetch failed:', e.message); }
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
    case 'prices':    el.innerHTML = panelPrices(); break;
    case 'etf':       el.innerHTML = panelEtf(); break;
    case 'crypto':    el.innerHTML = panelCrypto(); break;
    case 'bot':       el.innerHTML = panelBot(); break;
    case 'learning':  el.innerHTML = panelLearning(); break;
    case 'blackswan': el.innerHTML = panelBlackSwan(); break;
    case 'settings':  el.innerHTML = panelSettings(); break;
    default:          el.innerHTML = '<div class="panel-placeholder"><div class="pp-icon">📡</div></div>';
  }
}

/* ===== PANEL: RADAR ===== */
function panelRadar() {
  const sm = S.summary, bs = S.blackSwan;
  const lvMap = { LOW:'level-low', MEDIUM:'level-medium', HIGH:'level-high', CRITICAL:'level-critical' };
  return `<div class="panel-header"><div class="panel-title">📡 Radar</div><div class="panel-sub">Panoramica del monitoraggio</div></div>
  <div class="panel-body">
    <div class="radar-stat-grid">
      <div class="radar-stat"><div class="rs-val">${sm.total??'—'}</div><div class="rs-key">Totale</div></div>
      <div class="radar-stat"><div class="rs-val" style="color:#22d3ee">${sm.strong??'—'}</div><div class="rs-key">Forti ≥5</div></div>
      <div class="radar-stat"><div class="rs-val">${sm.news??'—'}</div><div class="rs-key">News</div></div>
      <div class="radar-stat"><div class="rs-val">${sm.social??'—'}</div><div class="rs-key">Social</div></div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Black Swan</div>
      <div class="p-card" style="text-align:center">
        <div class="bs-level-text ${lvMap[bs.level]||'level-low'}">${bs.level}</div>
        <div class="bs-score-text">Score ${bs.score} · ${bs.active?'⚠️ Alert':'✅ OK'}</div>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Fonti (${S.sources.length})</div>
      ${S.sources.map(s=>`<div class="stat-row"><span class="stat-key">${esc(s.name)}</span>
        <span class="stat-val ${s.status==='ok'?'up':'down'}">${s.status==='ok'?'OK '+s.count:'ERR'}</span></div>`).join('')||'<div style="color:#334155;font-size:11px;padding:5px 0">Nessuna scansione</div>'}
    </div>
  </div>`;
}

/* ===== PANEL: PRICES ===== */
function panelPrices() {
  const groups = ['indices', 'commodities', 'stocks', 'forex'];
  const groupLabels = { indices:'📈 Indici', commodities:'🏭 Materie Prime', stocks:'💼 Azioni', forex:'💱 Forex' };
  const wl = S.watchlist;

  let html = `<div class="panel-header"><div class="panel-title">📊 Prezzi Live</div><div class="panel-sub">Yahoo Finance · aggiornamento ogni 3 min</div></div>
  <div class="panel-body">`;

  for (const g of groups) {
    const items = wl.filter(w => w.group === g);
    if (!items.length) continue;
    html += `<div class="price-group-header">${groupLabels[g]}</div>`;
    for (const w of items) {
      const p = S.allPrices[w.sym];
      if (!p) { html += `<div class="price-row"><div><div class="price-sym">${esc(w.sym)}</div><div class="price-name">${esc(w.label)}</div></div><div class="p-nc">—</div></div>`; continue; }
      const chgCls = p.changePct >= 0 ? 'p-up' : 'p-dn';
      const chgIcon = p.changePct >= 0 ? '▲' : '▼';
      const priceFmt = p.price >= 100 ? fmt(p.price, 1) : p.price >= 1 ? fmt(p.price) : fmt(p.price, 4);
      html += `<div class="price-row">
        <div><div class="price-sym">${esc(w.sym.replace('=X','').replace('=F',''))}</div><div class="price-name">${esc(p.name||w.label)}</div></div>
        <div style="text-align:right">
          <div class="price-val">${p.currency==='EUR'?'€':'$'}${priceFmt}</div>
          <div class="price-chg ${chgCls}">${chgIcon}${fmt(Math.abs(p.changePct),2)}%</div>
        </div>
      </div>`;
    }
  }

  // Custom add
  html += `<div class="price-group-header">➕ Aggiungi Simbolo</div>
    <div class="price-input-wrap">
      <input class="price-input" id="priceSymInput" placeholder="Es: NVDA, GC=F, EURUSD=X" maxlength="15">
      <button class="price-add-btn" onclick="addWatchlistItem()">+</button>
    </div>
    <div style="font-size:10px;color:#4a6080;margin-top:6px">Usa simboli Yahoo Finance: NVDA, GC=F, EURUSD=X, ^VIX</div>
  </div>`;
  return html;
}

/* ===== PANEL: ETF ===== */
function panelEtf() {
  return `<div class="panel-header"><div class="panel-title">📈 Portfolio ETF</div><div class="panel-sub">Consultazione · Black Swan monitor attivo</div></div>
  <div class="panel-body">
    <div class="panel-section">
      <div class="panel-section-label">I tuoi ETF</div>
      ${ETF_LIST.map(etf => {
        const chgCls = (etf.change||0) >= 0 ? 'pos' : 'neg';
        return `<div class="etf-card">
          <div><div class="etf-sym">${esc(etf.symbol)}</div><div class="etf-name">${esc(etf.name)}</div></div>
          <div style="display:flex;align-items:center;gap:8px">
            <div>
              <div class="etf-price">${etf.price ? '$'+fmt(etf.price) : '—'}</div>
              ${etf.change != null ? `<div class="etf-chg ${chgCls}">${fmtPct(etf.change)}</div>` : ''}
            </div>
            <button class="etf-del" onclick="removeEtf('${esc(etf.symbol)}')" title="Rimuovi">✕</button>
          </div>
        </div>`;
      }).join('')}
      <div class="add-etf-form">
        <input class="add-etf-input" id="etfSymInput" placeholder="Simbolo (es. QQQ)" maxlength="12">
        <input class="add-etf-input" id="etfNameInput" placeholder="Nome" maxlength="30">
        <button class="add-etf-btn" onclick="addEtf()">+</button>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Stato Black Swan</div>
      <div class="p-card">
        <div class="stat-row"><span class="stat-key">Monitor</span><span class="stat-val ${S.blackSwan.active?'down':'up'}">${S.blackSwan.active?'🚨 ALERT':'✅ OK'}</span></div>
        <div class="stat-row"><span class="stat-key">Livello</span><span class="stat-val">${S.blackSwan.level}</span></div>
        <div style="font-size:10px;color:#4a6080;margin-top:7px">Il bot NON opera automaticamente sugli ETF. Alert solo visivo + Telegram.</div>
      </div>
    </div>
  </div>`;
}

/* ===== PANEL: CRYPTO ===== */
function panelCrypto() {
  return `<div class="panel-header"><div class="panel-title">₿ Crypto Monitor</div><div class="panel-sub">CoinGecko · Top 25 EUR · Live</div></div>
  <div class="panel-body">
    ${!S.cryptoList.length ? `<div class="empty-state" style="margin-top:0"><div class="empty-icon">₿</div><div class="empty-title">Caricamento...</div></div>` :
    S.cryptoList.slice(0,25).map(c => `<div class="crypto-card">
      <div class="crypto-rank">#${c.rank}</div>
      <div style="flex:1"><div class="crypto-sym">${esc(c.symbol)}</div><div class="crypto-name">${esc(c.name)}</div></div>
      <div style="text-align:right">
        <div class="crypto-price">€${c.price>=1?fmt(c.price,0):fmt(c.price,4)}</div>
        <div class="crypto-change ${c.change24h>=0?'pos':'neg'}">${c.change24h>=0?'▲':'▼'}${fmt(Math.abs(c.change24h),1)}%</div>
      </div>
    </div>`).join('')}
  </div>`;
}

/* ===== PANEL: BOT ===== */
function panelBot() {
  const pv = BOT.portfolioValue(S.cryptoPrices), pnl = pv - BOT.initialBudget;
  const pnlPct = (pnl/BOT.initialBudget)*100;
  const stMap = { ACTIVE:{cls:'bsb-active',icon:'🟢',l:'ATTIVO'}, CAUTION:{cls:'bsb-caution',icon:'🟡',l:'CAUTELA'}, SURVIVAL:{cls:'bsb-survival',icon:'🔴',l:'SOPRAVVIVENZA'}, PAUSED:{cls:'bsb-paused',icon:'⚫',l:'PAUSA'} };
  const st = stMap[BOT.status]||stMap.ACTIVE;
  const pending = BOT.suggestions.filter(s => s.status === 'PENDING');
  const waiting = BOT.suggestions.filter(s => s.status === 'WAITING');

  let html = `<div class="panel-header"><div class="panel-title">🤖 Trading Bot</div><div class="panel-sub">Swing 1-3 giorni · Max 3 posizioni · Tu approvi</div></div>
  <div class="panel-body">
    <div class="bot-portfolio-value">
      <div class="bpv-label">PORTFOLIO</div>
      <div class="bpv-val">${fmtEur(pv)}</div>
      <div class="bpv-pnl ${pnl>=0?'pos':'neg'}">${pnl>=0?'+':''}${fmtEur(pnl)} (${fmtPct(pnlPct)})</div>
      <div class="bot-status-badge ${st.cls}">${st.icon} ${st.l}</div>
    </div>`;

  // Pending suggestions
  if (pending.length) {
    html += `<div class="panel-section"><div class="panel-section-label">⏰ In attesa di approvazione (${pending.length})</div>`;
    html += pending.map(sug => `<div class="suggestion-card">
      <div class="sug-header"><span class="sug-sym">${esc(sug.sym)}</span><span class="sug-type sug-buy">${sug.type}</span></div>
      <div class="sug-detail"><span>€${fmt(sug.price,2)}</span><span>€${fmt(sug.amount,2)}</span><span>Score ${sug.score}/6</span></div>
      <div class="sug-reason">${esc(sug.reason)}</div>
      <div class="sug-actions">
        <button class="sug-btn sug-skip" onclick="quickDecision('${sug.id}','skip')">⏭ Salta</button>
        <button class="sug-btn sug-approve" onclick="showTradeModalById('${sug.id}')">📋 Dettagli + AI</button>
        <button class="sug-btn sug-approve" onclick="quickDecision('${sug.id}','approve')" style="background:rgba(34,211,238,.2)">✅ Approva</button>
      </div>
    </div>`).join('');
    html += '</div>';
  }

  // Open positions
  const positions = Object.entries(BOT.positions);
  if (positions.length) {
    html += `<div class="panel-section"><div class="panel-section-label">📍 Posizioni aperte (${positions.length})</div>`;
    html += positions.map(([sym, pos]) => {
      const p = S.cryptoPrices[sym], cur = p ? pos.qty*p : pos.invested, pnl2 = cur-pos.invested;
      const pnlPct2 = (pnl2/pos.invested)*100;
      return `<div class="position-card">
        <div class="pos-header"><span class="pos-sym">${esc(sym)}</span><span class="pos-pnl ${pnl2>=0?'pos':'neg'}">${pnl2>=0?'+':''}${fmtEur(pnl2)} (${fmtPct(pnlPct2)})</span></div>
        <div class="pos-detail"><span>Invest: ${fmtEur(pos.invested)}</span><span>Val: ${fmtEur(cur)}</span><span>Entry: €${fmt(pos.entryPrice,2)}</span></div>
      </div>`;
    }).join('');
    html += '</div>';
  }

  // Metrics
  html += `<div class="panel-section"><div class="panel-section-label">Metriche</div><div class="p-card">
    <div class="stat-row"><span class="stat-key">Cash disponibile</span><span class="stat-val up">${fmtEur(BOT.cash)}</span></div>
    <div class="stat-row"><span class="stat-key">Score soglia</span><span class="stat-val">${BOT.params.scoreThreshold}/6</span></div>
    <div class="stat-row"><span class="stat-key">Stop Loss</span><span class="stat-val">-${fmt(BOT.params.stopLoss*100,0)}%</span></div>
    <div class="stat-row"><span class="stat-key">Take Profit</span><span class="stat-val">+${fmt(BOT.params.takeProfit*100,0)}%</span></div>
  </div></div>`;

  // Controls
  html += `<div class="panel-section"><div class="bot-controls">
    <button class="bot-btn" onclick="doScan()">🔎 Nuova scansione</button>
    <button class="bot-btn danger" onclick="resetBot()">↺ Reset bot</button>
  </div></div>`;

  // Trade history
  if (BOT.trades.length) {
    html += `<div class="panel-section"><div class="panel-section-label">Storico (${BOT.trades.length})</div>`;
    html += BOT.trades.slice(0,12).map(t => {
      const isBuy = t.type==='BUY', isSL = (t.reason||'').includes('STOP');
      const tc = isBuy?'tt-buy':isSL?'tt-stop':'tt-sell';
      const tl = isBuy?'▲ BUY':isSL?'🛑 STOP':'🎯 SELL';
      return `<div class="trade-item">
        <div class="trade-left"><span class="trade-type ${tc}">${tl}</span> <span class="trade-sym">${esc(t.sym)}</span>
          <div class="trade-reason">${esc((t.reason||'').slice(0,60))}</div>
          <div class="sig-date">${new Date(t.time).toLocaleString('it-IT')}</div>
        </div>
        <div class="trade-right">
          <div class="trade-amount">${fmtEur(t.amount)}</div>
          ${t.pnl!=null?`<div class="trade-pnl ${t.pnl>=0?'pos':'neg'}">${t.pnl>=0?'+':''}${fmtEur(t.pnl)}</div>`:''}
        </div>
      </div>`;
    }).join('');
    html += '</div>';
  }

  html += `<div style="font-size:9px;color:#334155;margin-top:10px">⚠️ Simulazione — nessuna operazione reale</div></div>`;
  return html;
}

/* ===== PANEL: LEARNING ===== */
function panelLearning() {
  const acc = BOT.accuracy;
  const resolved = BOT.suggestions.filter(s => s.outcome);
  const approved = BOT.suggestions.filter(s => s.status === 'APPROVED' && s.outcome);
  const skipped = BOT.suggestions.filter(s => s.status === 'SKIPPED' && s.outcome);
  const params = BOT.params;

  return `<div class="panel-header"><div class="panel-title">🧠 Il Bot Impara</div><div class="panel-sub">Analisi decisioni · Ottimizzazione parametri</div></div>
  <div class="panel-body">
    <div class="accuracy-display">
      <div class="acc-pct">${acc.rate}%</div>
      <div class="acc-label">ACCURATEZZA BOT</div>
      <div class="acc-sub">${acc.profitable} profitti su ${acc.total} operazioni valutate</div>
    </div>

    <div class="learn-stat-grid">
      <div class="learn-stat"><div class="ls-val">${BOT.suggestions.filter(s=>s.status==='APPROVED').length}</div><div class="ls-key">Approvate</div></div>
      <div class="learn-stat"><div class="ls-val">${BOT.suggestions.filter(s=>s.status==='SKIPPED').length}</div><div class="ls-key">Saltate</div></div>
      <div class="learn-stat"><div class="ls-val" style="color:#22d3ee">${acc.skippedWin}</div><div class="ls-key">Salta Giuste</div></div>
      <div class="learn-stat"><div class="ls-val" style="color:#f87171">${acc.skippedLose}</div><div class="ls-key">Salta Sbagliate</div></div>
    </div>

    <div class="panel-section">
      <div class="panel-section-label">Parametri auto-adattati</div>
      <div class="p-card">
        <div class="param-row"><span class="param-key">Soglia score minimo</span><span class="param-val">${params.scoreThreshold}/6</span></div>
        <div class="param-row"><span class="param-key">Stop Loss</span><span class="param-val">-${fmt(params.stopLoss*100,0)}%</span></div>
        <div class="param-row"><span class="param-key">Take Profit</span><span class="param-val">+${fmt(params.takeProfit*100,0)}%</span></div>
        <div class="param-row"><span class="param-key">Max posizioni</span><span class="param-val">${params.maxPositions}</span></div>
      </div>
      <div style="font-size:10px;color:#4a6080;margin-top:5px;line-height:1.5">
        Il bot aumenta la soglia score se sbaglia spesso (diventa più selettivo), la abbassa se ha successo.
        Dopo 5+ operazioni valutate i parametri si auto-regolano.
      </div>
    </div>

    ${skipped.length ? `<div class="panel-section">
      <div class="panel-section-label">Operazioni che hai saltato — Risultato ipotetico</div>
      ${skipped.map(s => `<div class="skip-outcome">
        <div class="skip-sym">${esc(s.sym)} <span style="color:#4a6080;font-weight:400">€${fmt(s.amount,0)} · Score ${s.score}/6</span></div>
        <div class="skip-verdict ${s.outcome.pnlPct>=0?'skip-win':'skip-lose'}">
          ${s.outcome.pnlPct>=0?'✅ Avresti guadagnato':'❌ Avresti perso'} ${fmtPct(s.outcome.pnlPct*100)} (€${fmt(Math.abs(s.outcome.pnl),2)})
        </div>
        <div style="font-size:10px;color:#334155;margin-top:2px">${esc(s.reason.slice(0,60))}</div>
      </div>`).join('')}
    </div>` : ''}

    ${approved.length ? `<div class="panel-section">
      <div class="panel-section-label">Operazioni approvate — Risultato</div>
      ${approved.map(s => `<div class="skip-outcome">
        <div class="skip-sym">${esc(s.sym)} · ${esc(s.outcome.closeReason||'')}</div>
        <div class="skip-verdict ${s.outcome.pnl>=0?'skip-win':'skip-lose'}">
          ${s.outcome.pnl>=0?'✅':' ❌'} ${fmtPct(s.outcome.pnlPct*100)} · ${s.outcome.pnl>=0?'+':''}€${fmt(Math.abs(s.outcome.pnl),2)}
        </div>
      </div>`).join('')}
    </div>` : ''}

    ${!resolved.length ? `<div class="empty-state" style="margin-top:0">
      <div class="empty-icon">🧠</div>
      <div class="empty-title">Nessuna operazione valutata ancora</div>
      <div class="empty-sub">Approva o salta i suggerimenti del bot per iniziare ad accumulare dati di apprendimento</div>
    </div>` : ''}
  </div>`;
}

/* ===== PANEL: BLACK SWAN ===== */
function panelBlackSwan() {
  const bs = S.blackSwan;
  const lvMap = { LOW:'level-low', MEDIUM:'level-medium', HIGH:'level-high', CRITICAL:'level-critical' };
  const lvIcon = { LOW:'🟢', MEDIUM:'🟡', HIGH:'🟠', CRITICAL:'🔴' };
  return `<div class="panel-header"><div class="panel-title">🚨 Black Swan</div><div class="panel-sub">Solo ETF · Crypto escluse</div></div>
  <div class="panel-body">
    <div class="bs-level-display">
      <div class="bs-level-icon">${lvIcon[bs.level]||'🟢'}</div>
      <div class="bs-level-text ${lvMap[bs.level]||'level-low'}">${bs.level}</div>
      <div class="bs-score-text">Score: ${bs.score} / 12</div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Trigger rilevati</div>
      ${bs.triggers.length ? `<div>${bs.triggers.map(t=>`<span class="trigger-tag">${esc(t)}</span>`).join('')}</div>` : '<div style="color:#334155;font-size:11px;padding:5px 0">✅ Nessun trigger anomalo</div>'}
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Cosa fa il sistema</div>
      <div class="p-card">
        <div class="stat-row"><span class="stat-key">Alert popup</span><span class="stat-val up">✓ Attivo</span></div>
        <div class="stat-row"><span class="stat-key">Telegram alert</span><span class="stat-val ${CFG.tgToken?'up':'down'}">${CFG.tgToken?'✓ Attivo':'✗ Configura'}</span></div>
        <div class="stat-row"><span class="stat-key">Bot SURVIVAL mode</span><span class="stat-val up">✓ Auto</span></div>
        <div class="stat-row"><span class="stat-key">Azione sugli ETF</span><span class="stat-val">Solo alert</span></div>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Notifiche browser</div>
      <button class="bot-btn" style="width:100%" onclick="requestNotifPerm()">🔔 Attiva notifiche browser</button>
    </div>
  </div>`;
}

/* ===== PANEL: SETTINGS ===== */
function panelSettings() {
  return `<div class="panel-header"><div class="panel-title">⚙️ Impostazioni</div><div class="panel-sub">AI, Telegram, Bot</div></div>
  <div class="panel-body">
    <div class="panel-section">
      <div class="panel-section-label">🤖 Gemini AI (GRATIS)</div>
      <div class="p-card">
        <div class="setting-row">
          <div><div class="setting-label">API Key</div><div class="setting-desc"><a class="setting-link" href="https://aistudio.google.com/app/apikey" target="_blank">Ottieni gratis su ai.google.dev →</a></div></div>
        </div>
        <input class="setting-input full" type="password" id="geminiKeyInput" placeholder="AIza..." value="${CFG.geminiKey}">
        <button class="bot-btn" style="width:100%;margin-top:7px" onclick="saveSetting('geminiKey','geminiKeyInput')">Salva chiave Gemini</button>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">📱 Telegram Bot</div>
      <div class="p-card">
        <div class="setting-row">
          <div><div class="setting-label">Bot Token</div><div class="setting-desc"><a class="setting-link" href="https://t.me/BotFather" target="_blank">Crea su @BotFather →</a></div></div>
        </div>
        <input class="setting-input full" type="password" id="tgTokenInput" placeholder="1234567890:AAF..." value="${CFG.tgToken}">
        <div class="setting-row" style="margin-top:8px">
          <div><div class="setting-label">Chat ID</div><div class="setting-desc"><a class="setting-link" href="https://t.me/userinfobot" target="_blank">Scrivi /start a @userinfobot →</a></div></div>
        </div>
        <input class="setting-input full" id="tgChatInput" placeholder="123456789" value="${CFG.tgChatId}">
        <div style="display:flex;gap:6px;margin-top:7px">
          <button class="bot-btn" style="flex:1" onclick="saveTelegram()">Salva Telegram</button>
          <button class="bot-btn" style="flex:1" onclick="testTelegram()">📤 Test</button>
        </div>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Trading Bot</div>
      <div class="p-card">
        <div class="setting-row">
          <div><div class="setting-label">Budget (€)</div></div>
          <input class="setting-input" type="number" id="budgetInput" value="${CFG.botBudget}" min="100" step="100">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">Score minimo BUY</div><div class="setting-desc">Da 3 (aggressivo) a 6 (conservativo)</div></div>
          <input class="setting-input" type="number" id="scoreInput" value="${CFG.scoreThreshold||5}" min="3" max="6" step="0.5">
        </div>
        <button class="bot-btn" style="width:100%;margin-top:7px" onclick="applyBotSettings()">Applica e resetta bot</button>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Reset</div>
      <div class="p-card">
        <button class="bot-btn danger" style="width:100%" onclick="if(confirm('Reset tutto?'))fullReset()">💥 Reset completo</button>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-label">Info</div>
      <div class="p-card">
        <div class="stat-row"><span class="stat-key">Versione</span><span class="stat-val">4.0</span></div>
        <div class="stat-row"><span class="stat-key">Fonti attive</span><span class="stat-val">${FEEDS_COUNT} feed</span></div>
        <div class="stat-row"><span class="stat-key">Prezzi live</span><span class="stat-val">Yahoo Finance + CoinGecko</span></div>
        <div class="stat-row"><span class="stat-key">AI</span><span class="stat-val">Gemini 1.5 Flash (gratis)</span></div>
      </div>
    </div>
  </div>`;
}
const FEEDS_COUNT = 15;

/* ===== ACTIONS ===== */
function addEtf() {
  const sym = ($('etfSymInput')?.value||'').trim().toUpperCase();
  const name = ($('etfNameInput')?.value||'').trim();
  if (!sym) return;
  if (ETF_LIST.some(e => e.symbol === sym)) { toast('ETF già presente', 'warn'); return; }
  ETF_LIST.push({ symbol:sym, name:name||sym, price:null, change:null });
  saveEtf(ETF_LIST); renderPanel();
  fetchAllPrices();
  toast(`ETF ${sym} aggiunto`, 'success', '📈');
}
function removeEtf(sym) { ETF_LIST = ETF_LIST.filter(e => e.symbol !== sym); saveEtf(ETF_LIST); renderPanel(); }

function addWatchlistItem() {
  const sym = ($('priceSymInput')?.value||'').trim().toUpperCase();
  if (!sym) return;
  if (S.watchlist.some(w => w.sym === sym)) { toast('Già in watchlist', 'warn'); return; }
  S.watchlist.push({ sym, label: sym, group: 'stocks' });
  saveWatchlist(S.watchlist);
  fetchAllPrices();
  toast(`${sym} aggiunto alla watchlist`, 'success', '📊');
}

function showTradeModalById(id) {
  const sug = BOT.suggestions.find(s => s.id == id);
  if (sug) showTradeModal(sug);
}

function quickDecision(id, action) {
  const sug = BOT.suggestions.find(s => s.id == id);
  if (!sug) return;
  S.currentSuggestion = sug;
  handleTradeDecision(action);
}

function saveSetting(key, inputId) {
  const val = $(inputId)?.value || '';
  CFG[key] = val; saveSettings(CFG);
  toast('Salvato', 'success');
}
function saveTelegram() {
  CFG.tgToken = $('tgTokenInput')?.value||'';
  CFG.tgChatId = $('tgChatInput')?.value||'';
  saveSettings(CFG); toast('Telegram salvato', 'success', '📱');
}
async function testTelegram() {
  await sendTelegram('✅ Test da Miracolo Lab!\n🪄 La connessione Telegram funziona correttamente.\n\nRiceverai qui: alert Black Swan, suggerimenti bot, report operazioni.');
  toast('Messaggio di test inviato su Telegram!', 'success', '📱');
}
function applyBotSettings() {
  const budget = parseFloat($('budgetInput')?.value||'2000');
  const score = parseFloat($('scoreInput')?.value||'5');
  if (isNaN(budget)||budget<100) { toast('Budget non valido', 'error'); return; }
  CFG.botBudget = budget; CFG.scoreThreshold = score; saveSettings(CFG);
  BOT.reset(budget); BOT.params.scoreThreshold = score;
  updateBotBar(); renderPanel();
  toast(`Budget: ${fmtEur(budget)} · Score: ${score}/6 · Bot resettato`, 'success');
}
function resetBot() { if (!confirm('Resettare il bot?')) return; BOT.reset(CFG.botBudget); updateBotBar(); renderPanel(); toast('Bot resettato', 'info', '🤖'); }
function fullReset() { ETF_LIST = [...DEFAULT_ETF]; saveEtf(ETF_LIST); BOT.reset(CFG.botBudget); updateBotBar(); renderPanel(); toast('Reset completo', 'warn'); }
function requestNotifPerm() {
  if (!('Notification' in window)) { toast('Browser non supporta notifiche', 'warn'); return; }
  Notification.requestPermission().then(p => {
    if (p==='granted') toast('Notifiche attivate!', 'success', '🔔');
    else toast('Notifiche non autorizzate', 'warn');
  });
}

/* ===== AUTO-REFRESH ===== */
function startAutoRefresh() {
  stopAutoRefresh(); S.countdown = 300;
  S.countdownInterval = setInterval(() => {
    S.countdown--;
    const badge = $('countdownBadge');
    if (badge) badge.textContent = `${Math.floor(S.countdown/60)}:${String(S.countdown%60).padStart(2,'0')}`;
    if (S.countdown <= 0) { S.countdown = 300; doScan(); }
  }, 1000);
  const badge = $('countdownBadge'); if (badge) badge.style.opacity='1';
}
function stopAutoRefresh() {
  clearInterval(S.countdownInterval); S.countdownInterval = null;
  const badge = $('countdownBadge'); if (badge) { badge.textContent=''; badge.style.opacity='0'; }
}

/* ===== INIT ===== */
function init() {
  S.watchlist = loadWatchlist();

  $('autoToggle').addEventListener('change', function() {
    if (this.checked) { startAutoRefresh(); toast('Auto-refresh ogni 5 min', 'info', '⏱️'); }
    else stopAutoRefresh();
  });

  try {
    const last = localStorage.getItem('ml_last_scan');
    if (last) $('hTime').textContent = new Date(last).toLocaleTimeString('it-IT');
  } catch {}

  setPanel('radar');
  updateBotBar();

  // Background fetches
  fetchCrypto();
  fetchAllPrices();
  setInterval(fetchCrypto, 120000);    // crypto every 2 min
  setInterval(fetchAllPrices, 180000); // prices every 3 min
}

document.addEventListener('DOMContentLoaded', init);