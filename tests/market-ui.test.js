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
const botBridge=fs.readFileSync('public/v1/bot-tab-bridge.js','utf8');
const botWorkspace=fs.readFileSync('public/v1/bot-workspace-v1.js','utf8');
const strategy=fs.readFileSync('public/v1/strategy-lab.js','utf8');
function has(re,text,msg){assert.match(text,re,msg)}

// Navigation: Strategy Lab is internal now, not a user-facing tab.
has(/data-panel="bot"/,html);assert.doesNotMatch(html,/data-panel="strategy"/);assert.doesNotMatch(nav,/['"]strategy['"]/);assert.doesNotMatch(html,/trading-desk\.(js|css)/);

// Market UI.
has(/data-panel="market"/,html);has(/lightweight-charts@5\.2\.1/,html);has(/\/v1\/market\.js\?v=1\.0\.0/,html);
has(/\/api\/chart/,market);has(/\/api\/market-monitor/,market);has(/CandlestickSeries/,market);has(/HistogramSeries/,market);has(/LineSeries/,market);has(/\.market-chart/,css);

// Investments.
has(/investment-charts\.js\?v=1\.0\.1/,html);has(/investment-charts\.css\?v=1\.0\.1/,html);has(/const ROOT='ml_portfolio_v7'/,investments);has(/HK=ROOT\+'\.history'/,investments);has(/positions:t\.rows\.map/,investments);has(/Grafici investimenti/,investmentCharts);has(/ml_portfolio_v7\.history/,investmentCharts);has(/AreaSeries/,investmentCharts);has(/\.iv-chart-section/,investmentCss);

// News pipeline.
has(/ML_NEWS_CONTRACT/,data);has(/\/api\/live/,data);has(/\/api\/full-scan/,data);has(/window\.ML\.on\('data'/,bridge);

// Single operational Bot surface.
has(/bot-workspace-v1\.js/,html);has(/bot-tab-bridge\.js/,html);has(/bot-decision-engine\.js/,html);
has(/Avvia tutto/,botWorkspace);has(/PAPER ONLY/,botWorkspace);has(/Fonti utilizzate/,botWorkspace);has(/Analisi del Bot/,botWorkspace);has(/Operazioni PAPER/,botWorkspace);has(/Journal/,botWorkspace);
for(const name of ['Jesse','WolfBot','Multi-Agent','Historical','Backtest','Learning','Memory','Macro\/FRED'])has(new RegExp(name),botWorkspace);

// Sources come from the real scan payload, not an undefined S.sources object.
has(/ML\?\.state/,botWorkspace);has(/scan\.items/,botWorkspace);has(/api\/full-scan/,botWorkspace);has(/Fonti realmente ricevute/,botWorkspace);

// Operational Bot: scan → consensus → risk → paper execution.
has(/\/api\/full-scan/,botBridge);has(/\/api\/bot-monitor/,botBridge);has(/\/api\/ai/,botBridge);has(/Promise\.allSettled/,botBridge);
has(/CAPITAL=2000/,botBridge);has(/RISK=10/,botBridge);has(/MAX=3/,botBridge);has(/PAPER TRADE APERTO/,botBridge);has(/status==='OPEN'/,botBridge);has(/status='CLOSED'/,botBridge);has(/STOP/,botBridge);has(/TARGET/,botBridge);
has(/Macro\/FRED/,botBridge);has(/W\.macro/,botBridge);has(/consensus\(modules\(\),m,n,ma\)/,botBridge);

// Strategy engines remain internal components of the Bot.
for(const id of ['learning','memory','jesse','technical','multi','historical','backtest'])has(new RegExp(`id:'${id}'`),strategy);
has(/ml_strategy_lab_v23/,botBridge);for(const name of ['Jesse','WolfBot','Multi-Agent','Historical','Backtest','Learning','Memory'])has(new RegExp(name),botBridge);

// Canonical click binding.
has(/addEventListener\('click'/,botWorkspace);has(/querySelector\('\.bot-run'\)/,botWorkspace);has(/window\.runMiracoloBotDecision=run/,botBridge);

console.log('Market UI static integrity: PASS');
console.log('News pipeline linkage: PASS');
console.log('Single operational Bot surface: PASS');
console.log('Consultable source panels: PASS');
console.log('Strategy engines → Bot consensus linkage: PASS');
console.log('Paper execution controls: PASS');
