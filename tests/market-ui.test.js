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

assert.match(html,/data-panel="market"/);
assert.match(html,/lightweight-charts@5\.2\.1/);
assert.match(html,/\/v1\/market\.js\?v=1\.0\.0/);
assert.match(nav,/const PANELS=\['radar','market','investimenti','bot','strategy','blackswan','settings'\]/);
assert.doesNotMatch(nav,/tradingdesk/);
assert.doesNotMatch(html,/trading-desk\.(js|css)/);
assert.match(market,/\/api\/chart/);
assert.match(market,/\/api\/market-monitor/);
assert.match(market,/CandlestickSeries/);
assert.match(market,/HistogramSeries/);
assert.match(market,/LineSeries/);
assert.match(css,/\.market-chart/);

// Investimenti charts must remain isolated from Market and use recorded portfolio history.
const strategy=fs.readFileSync('public/v1/strategy-lab.js','utf8');
assert.match(html,/strategy-lab\.js\?v=2\.3\.2/);
assert.match(strategy,/id:'learning'/);
assert.match(strategy,/id:'memory'/);
assert.match(strategy,/id:'jesse'/);
assert.match(strategy,/id:'technical'/);
assert.match(strategy,/id:'multi'/);
assert.match(strategy,/id:'historical'/);
assert.match(strategy,/id:'backtest'/);
assert.match(strategy,/Accuracy/);
assert.match(strategy,/Error Analysis/);
assert.match(strategy,/Recent Outcomes/);
assert.match(strategy,/data-section/);
assert.match(html,/investment-charts\.js\?v=1\.0\.1/);
assert.match(html,/investment-charts\.css\?v=1\.0\.1/);
assert.match(investments,/const ROOT='ml_portfolio_v7'/);
assert.match(investments,/HK=ROOT\+'\.history'/);
assert.match(investments,/positions:t\.rows\.map/);
assert.match(investmentCharts,/Grafici investimenti/);
assert.match(investmentCharts,/ml_portfolio_v7\.history/);
assert.match(investmentCharts,/AreaSeries/);
assert.match(investmentCss,/\.iv-chart-section/);

// News pipeline must remain connected to the canonical adapter and bridge.
assert.match(data,/ML_NEWS_CONTRACT/);
assert.match(data,/\/api\/live/);
assert.match(data,/\/api\/full-scan/);
assert.match(bridge,/window\.ML\.on\('data'/);

// Bot is the single operational trading surface: paper-only, explicit multi-agent action.
assert.match(html,/trading-agents\.js\?v=1\.0\.3/);
assert.match(html,/trading-agents\.css\?v=1\.0\.3/);
assert.match(bot,/bot-multi/);
assert.match(bot,/MULTI-AGENT DECISION/);
assert.match(bot,//api/market-monitor-v2/);
assert.match(bot,//api/market-monitor\?ts=/);
assert.match(bot,/Promise\.allSettled/);
assert.match(bot,/paper trading|paper only/i);
assert.match(bot,/Rischio massimo €10/);
assert.match(bot,/massimo 3 operazioni\/giorno/);
assert.match(bot,/PAPER REGISTRATO/);
assert.match(bot,/net=a\.bull\.score/);

console.log('Market UI static integrity: PASS');
console.log('News pipeline linkage: PASS');
console.log('Bot-only trading surface integrity: PASS');

// Strategy Lab must mount synchronously and remain reachable through panel navigation.
assert.match(strategy,/function boot\(\)\{loadSaved\(\);try\{render\('jesse','Inizializzazione Strategy Lab…','Overview'\)/);
assert.match(nav,/lab\?\.render\('jesse'/);
assert.match(nav,/requestAnimationFrame\(paint\)/);
assert.match(nav,/Modulo non inizializzato/);
assert.match(strategy,/async function autoRun\(\)/);
assert.match(strategy,/dataErrors/);
assert.match(strategy,/status:state\.running\?'running':'ready',render\}/);
console.log('Strategy Lab mount and navigation guards: PASS');
