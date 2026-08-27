/* Miracolo Lab — worker.js v3.0 */

const FEEDS = [
  { name: 'GDELT', type: 'news', cat: 'macro', url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=(stock%20OR%20markets%20OR%20finance%20OR%20crypto%20OR%20bitcoin%20OR%20economy%20OR%20recession%20OR%20inflation%20OR%20fed)&mode=artlist&maxrecords=30&format=json' },
  { name: 'Google News', type: 'news', cat: 'news', url: 'https://news.google.com/rss/search?q=stock+market+OR+finance+OR+economy+OR+crypto+OR+bitcoin+OR+inflation+OR+recession+OR+fed+OR+nasdaq&hl=en-US&gl=US&ceid=US:en' },
  { name: 'Yahoo Finance', type: 'news', cat: 'news', url: 'https://finance.yahoo.com/news/rssindex' },
  { name: 'Reddit Investing', type: 'social', cat: 'social', url: 'https://www.reddit.com/r/investing/.rss?limit=25' },
  { name: 'Reddit Stocks', type: 'social', cat: 'social', url: 'https://www.reddit.com/r/stocks/.rss?limit=25' },
  { name: 'Reddit WSB', type: 'social', cat: 'social', url: 'https://www.reddit.com/r/wallstreetbets/.rss?limit=25' },
  { name: 'Reddit Crypto', type: 'social', cat: 'crypto', url: 'https://www.reddit.com/r/CryptoCurrency/.rss?limit=25' },
  { name: 'Reddit Bitcoin', type: 'social', cat: 'crypto', url: 'https://www.reddit.com/r/Bitcoin/.rss?limit=20' },
  { name: 'Reddit Ethereum', type: 'social', cat: 'crypto', url: 'https://www.reddit.com/r/ethereum/.rss?limit=20' },
  { name: 'Macro Trends', type: 'news', cat: 'macro', url: 'https://news.google.com/rss/search?q=inflation+OR+%22interest+rate%22+OR+%22federal+reserve%22+OR+%22GDP%22+OR+%22unemployment%22+OR+%22CPI%22+OR+%22bond+yield%22&hl=en-US&gl=US&ceid=US:en' },
];

const FH = { 'User-Agent': 'Miracolo-Lab/3.0', 'Accept': 'application/json,application/rss+xml,application/xml,text/xml' };

const BLACK_SWAN_KW = [
  'market crash','circuit breaker','trading halt','emergency rate cut','financial crisis',
  'bank collapse','systemic risk','contagion','sovereign default','currency crisis',
  'flash crash','margin call crisis','black monday','black tuesday','lehman','bank run',
  'liquidity crisis','debt crisis','hyperinflation','default risk','credit crunch',
  'stock market crash','market meltdown','bear market crash','economic collapse'
];

const STRONG_KW = ['surge','rally','plunge','crash','record','warning','beat','miss','jumps','drops','soars','tumbles','skyrockets','collapses','explodes','crisis','panic','fear','meltdown','spike','tank'];

const TOPIC_KW = [
  'nvidia','nvda','bitcoin','btc','ethereum','eth','crypto','ai','semiconductor','tsmc','amd',
  'broadcom','crowdstrike','fed','federal reserve','inflation','earnings','guidance','upgrade',
  'downgrade','tariff','recession','gold','copper','oil','treasury','interest rate','apple',
  'aapl','meta','google','microsoft','amazon','tesla','tsla','sp500','nasdaq','dow jones','vix',
  'bonds','yield','solana','sol','bnb','xrp','cardano','ada','avalanche','avax','polygon','matic',
  'dogecoin','doge','shiba','pepe','defi','nft','blockchain','altcoin','bull run','bear market'
];

const CRYPTO_MAP = {
  bitcoin:'BTC',btc:'BTC',ethereum:'ETH',eth:'ETH',solana:'SOL',sol:'SOL',
  binance:'BNB',bnb:'BNB',xrp:'XRP',ripple:'XRP',cardano:'ADA',ada:'ADA',
  avalanche:'AVAX',avax:'AVAX',polygon:'MATIC',matic:'MATIC',dogecoin:'DOGE',
  doge:'DOGE','shiba inu':'SHIB',shib:'SHIB',chainlink:'LINK',link:'LINK',
  polkadot:'DOT',dot:'DOT','uniswap':'UNI',uni:'UNI'
};

function strip(s) {
  return (s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,' ')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}

function tag(x, n) {
  const m = x.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+n+'>','i'));
  return m ? strip(m[1]) : '';
}

function scoreSignal(item) {
  const t = (item.title+' '+item.description).toLowerCase();
  let s = 1;
  TOPIC_KW.forEach(k => { if (t.includes(k)) s += 0.35; });
  STRONG_KW.forEach(k => { if (t.includes(k)) s += 0.7; });
  return Math.min(6, Math.round(s));
}

function detectCryptoAsset(text) {
  const t = text.toLowerCase();
  for (const [kw, sym] of Object.entries(CRYPTO_MAP)) {
    if (t.includes(kw)) return sym;
  }
  return null;
}

function blackSwanScore(signals) {
  let score = 0;
  const triggers = [];
  for (const sig of signals) {
    const t = (sig.title+' '+sig.description).toLowerCase();
    for (const kw of BLACK_SWAN_KW) {
      if (t.includes(kw) && !triggers.includes(kw)) {
        triggers.push(kw);
        score += 2;
      }
    }
  }
  const highScoreNews = signals.filter(s => s.score >= 5 && s.cat !== 'crypto').length;
  score += highScoreNews * 0.5;
  const level = score >= 12 ? 'CRITICAL' : score >= 7 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW';
  return { score: Math.round(score*10)/10, level, triggers: triggers.slice(0,8), active: score >= 7 };
}

function parseXML(text, feed) {
  const out = [];
  const re = /<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const x = m[0];
    const title = tag(x,'title');
    const desc = tag(x,'description') || tag(x,'summary');
    const date = tag(x,'pubDate') || tag(x,'published') || tag(x,'updated');
    let link = tag(x,'link');
    if (!link) { const a = x.match(/<link[^>]+href=["']([^"']+)["']/i); if (a) link = a[1]; }
    if (title && link) out.push({ title, description: desc, date, link, source: feed.name, cat: feed.cat, kind: feed.type });
  }
  return out;
}

async function getFeed(feed) {
  const r = await fetch(feed.url, { headers: FH, redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP '+r.status);
  const text = await r.text();
  if (feed.name === 'GDELT') {
    let j; try { j = JSON.parse(text); } catch { throw new Error('GDELT non JSON'); }
    return (j.articles||j.results||[]).map(a => ({
      title: a.title||'', description: a.seendate||a.domain||'',
      date: a.seendate||'', link: a.url||a.link||'',
      source: feed.name, cat: feed.cat, kind: feed.type
    })).filter(x => x.title && x.link);
  }
  return parseXML(text, feed);
}

async function fullScan() {
  const settled = await Promise.all(FEEDS.map(async f => {
    try {
      const items = await getFeed(f);
      items.forEach(x => {
        x.score = scoreSignal(x);
        x.cryptoAsset = detectCryptoAsset(x.title+' '+x.description);
      });
      return { name: f.name, cat: f.cat, type: f.type, status: 'ok', count: items.length, error: null, items };
    } catch (e) {
      return { name: f.name, cat: f.cat, type: f.type, status: 'error', count: 0, error: String(e.message||e), items: [] };
    }
  }));
  const sources = settled.map(({ items, ...s }) => s);
  const all = settled.flatMap(x => x.items).sort((a,b) => b.score-a.score);
  const bsAnalysis = blackSwanScore(all);
  return {
    ok: true, timestamp: new Date().toISOString(),
    blackSwan: bsAnalysis,
    summary: {
      total: all.length,
      news: all.filter(x => x.kind === 'news').length,
      social: all.filter(x => x.kind === 'social').length,
      crypto: all.filter(x => x.cat === 'crypto').length,
      strong: all.filter(x => x.score >= 5).length,
      workingSources: sources.filter(x => x.status === 'ok').length,
      failedSources: sources.filter(x => x.status !== 'ok').length,
    },
    top_signals: all.slice(0, 80),
    sources
  };
}

async function getCrypto() {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=25&page=1&sparkline=false&price_change_percentage=24h',
      { headers: { 'Accept': 'application/json' } }
    );
    if (!r.ok) throw new Error('CoinGecko HTTP '+r.status);
    const data = await r.json();
    return {
      ok: true, timestamp: new Date().toISOString(),
      coins: data.map(c => ({
        id: c.id, symbol: c.symbol.toUpperCase(), name: c.name,
        price: c.current_price, change24h: c.price_change_percentage_24h,
        marketCap: c.market_cap, volume24h: c.total_volume,
        high24h: c.high_24h, low24h: c.low_24h, rank: c.market_cap_rank
      }))
    };
  } catch (e) {
    return { ok: false, error: e.message, coins: [] };
  }
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url), p = u.pathname;
    const cors = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
    if (p === '/api/health') return Response.json({ ok: true, service: 'Miracolo Lab v3.0', timestamp: new Date().toISOString() });
    if (p === '/api/full-scan') return Response.json(await fullScan(), { headers: cors });
    if (p === '/api/crypto') return Response.json(await getCrypto(), { headers: cors });
    if (p === '/api/news') return Response.redirect(new URL('/api/full-scan', request.url), 307);
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
};