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
const bot=fs.readFileSync('public/v1/trading-agents.js','utf8');
const strategy=fs.readFileSync('public/v1/strategy-lab.js','utf8');
function has(re,text,msg){assert.match(text,re,msg)}

has(/data-panel="market"/,html);has(/lightweight-charts@5\.2\.1/,html);has(/\/v1\/market\.js\?v=1\.0\.0/,html);
has(/const PANELS=\['radar','market','investimenti','bot','strategy','blackswan','settings'\]/,nav);assert.doesNotMatch(nav,/tradingdesk/);assert.doesNotMatch(html,/trading-desk\.(js|css)/);
has(/\/api\/chart/,market);has(/\/api\/market-monitor/,market);has(/CandlestickSeries/,market);has(/HistogramSeries/,market);has(/LineSeries/,market);has(/\.market-chart/,css);

// Strategy Lab remains the analytical layer.
has(/strategy-lab\.js\?v=2\.3\.2/,html);for(const id of ['learning','memory','jesse','technical','multi','historical','backtest'])has(new RegExp(`id:'${id}'`),strategy);
has(/Accuracy/,strategy);has(/Error Analysis/,strategy);has(/Recent Outcomes/,strategy);has(/data-section/,strategy);
has(/investment-charts\.js\?v=1\.0\.1/,html);has(/investment-charts\.css\?v=1\.0\.1/,html);has(/const ROOT='ml_portfolio_v7'/,investments);has(/HK=ROOT\+'\.history'/,investments);has(/positions:t\.rows\.map/,investments);has(/Grafici investimenti/,investmentCharts);has(/ml_portfolio_v7\.history/,investmentCharts);has(/AreaSeries/,investmentCharts);has(/\.iv-chart-section/,investmentCss);

// News pipeline.
has(/ML_NEWS_CONTRACT/,data);has(/\/api\/live/,data);has(/\/api\/full-scan/,data);has(/window\.ML\.on\('data'/,bridge);

// Bot: one button, paper-only, full scan first.
has(/trading-agents\.js\?v=1\.0\.4/,html);has(/trading-agents\.css\?v=1\.0.4/,html);has(/AVVIA ANALISI COMPLETA/,bot);assert.doesNotMatch(bot,/bot-multi/);
has(/\/api\/market-monitor-v2/,bot);has(/\/api\/market-monitor/,bot);has(/\/api\/full-scan/,bot);has(/Promise\.allSettled/,bot);has(/paper trading|paper only/i,bot);has(/rischio massimo €10/i,bot);has(/massimo 3 operazioni\/giorno/,bot);
has(/PAPER TRADE APERTO|APRI POSIZIONE PAPER/,bot);has(/status==='OPEN'/,bot);has(/status='CLOSED'/,bot);has(/STOP/,bot);has(/TARGET/,bot);

// Strategy Lab outputs feed the operational Bot.
has(/ml_strategy_lab_v23/,bot);has(/Strategy Lab/,bot);for(const name of ['Jesse','WolfBot','Multi-Agent','Historical','Backtest','Learning','Memory'])has(new RegExp(name),bot);
has(/strategyConsensus/,bot);has(/decisionSource/,bot);has(/availableCount/,bot);has(/WEIGHTS/,bot);

// Cockpit click binding is explicit and panel mounting does not depend on active-panel state.
has(/addEventListener\('click'/,bot);has(/querySelector\('\.bot-run'\)/,bot);has(/function mount\(\)\{var side=document\.getElementById\('sidePanel'\)/,bot);

// Runtime wiring: all Bot engines must actually be loaded by the page.
has(/\/v1\/bot-strategy\.js\?v=2\.5\.0/,html);has(/\/v1\/backtest-engine\.js\?v=2\.5\.0/,html);has(/\/v1\/bot-decision-engine\.js\?v=2\.5\.0/,html);has(/\/v1\/bot-tab-bridge\.js\?v=2\.5\.0/,html);

console.log('Market UI static integrity: PASS');
console.log('News pipeline linkage: PASS');
console.log('Single-button Bot workflow: PASS');
console.log('Strategy Lab → Bot decision linkage: PASS');
console.log('Bot cockpit click binding: PASS');
console.log('Bot runtime engine loading: PASS');