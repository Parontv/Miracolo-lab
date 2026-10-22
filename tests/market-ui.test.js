const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('public/index.html','utf8');
const nav=fs.readFileSync('public/v1/tab-navigation.js','utf8');
const market=fs.readFileSync('public/v1/market.js','utf8');
const css=fs.readFileSync('public/v1/market.css','utf8');
const investments=fs.readFileSync('public/v1/investments.js','utf8');
const investmentCharts=fs.readFileSync('public/v1/investment-charts.js','utf8');
const investmentCss=fs.readFileSync('public/v1/investment-charts.css','utf8');
const data=fs.readFileSync('public/v1/data.js','utf8');
const bridge=fs.readFileSync('public/v1/news-feed-bridge.js','utf8');
const bot=fs.readFileSync('public/v1/bot-workspace-v1.js','utf8');
const botEngine=fs.readFileSync('public/v1/bot-engine.js','utf8');
const server=fs.readFileSync('bot-server-engine-v4.js','utf8');
function has(re,text,msg){assert.match(text,re,msg)}

// Navigation: Strategy Lab is internal, not a user-facing tab.
has(/data-panel="bot"/,html);assert.doesNotMatch(html,/data-panel="strategy"/);assert.doesNotMatch(nav,/['"]strategy['"]/);assert.doesNotMatch(html,/trading-desk\.(js|css)/);

// Market UI.
has(/data-panel="market"/,html);has(/lightweight-charts@5\.2\.1/,html);has(/\/v1\/market\.js\?v=1\.0\.0/,html);
has(/\/api\/chart/,market);has(/\/api\/market-monitor/,market);has(/CandlestickSeries/,market);has(/HistogramSeries/,market);has(/LineSeries/,market);has(/\.market-chart/,css);

// Investments.
has(/investment-charts\.js\?v=1\.0\.1/,html);has(/investment-charts\.css\?v=1\.0\.1/,html);has(/const ROOT='ml_portfolio_v7'/,investments);has(/HK=ROOT\+'\.history'/,investments);has(/positions:t\.rows\.map/,investments);has(/Grafici investimenti/,investmentCharts);has(/ml_portfolio_v7\.history/,investmentCharts);has(/AreaSeries/,investmentCharts);has(/\.iv-chart-section/,investmentCss);

// News pipeline.
has(/ML_NEWS_CONTRACT/,data);has(/\/api\/live/,data);has(/\/api\/full-scan/,data);has(/window\.ML\.on\('data'/,bridge);

// Single Bot surface: UI + one client controller + one server brain.
has(/bot-workspace-v1\.js/,html);has(/bot-engine\.js/,html);has(/bot-engine-v4|bot-server-engine-v4/,html+server);
has(/Avvia tutto/,bot);has(/PAPER ONLY/,bot);has(/Fonti utilizzate/,bot);has(/Analisi del Bot/,bot);has(/Operazioni PAPER/,bot);has(/Journal/,bot);
for(const name of ['Jesse','WolfBot','Multi-Agent','Historical','Backtest','Learning','Memory','Macro\/FRED'])has(new RegExp(name),bot);

// Client must call the server and emit one decision event.
has(/\/api\/bot\/run/,botEngine);has(/miracolo:botdecision/,botEngine);has(/window\.MiracoloBot/,botEngine);assert.doesNotMatch(botEngine,/stopImmediatePropagation/);assert.doesNotMatch(botEngine,/capture\s*:\s*true/);

// Server decision contract and PAPER limits.
has(/BOT-SERVER-V4/,server);has(/mode:'PAPER'/,server);has(/MAX_TRADES=3/,server);has(/RISK=10/,server);has(/CAPITAL=2000/,server);has(/WAIT — copertura/,server);has(/calibrazione non disponibile/,server);has(/rsiWilder/,server);has(/atr\(/,server);has(/VIX/,server);has(/high.?yield|High Yield/,server);has(/api\/bot\/decision|bot\/decision-v4/,fs.readFileSync('live-worker.js','utf8'));

console.log('Market UI static integrity: PASS');
console.log('News pipeline linkage: PASS');
console.log('Single Bot surface: PASS');
console.log('Server decision contract: PASS');
console.log('Paper limits: PASS');
