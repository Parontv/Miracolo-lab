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

assert.match(html,/data-panel="market"/);
assert.match(html,/lightweight-charts@5\.2\.1/);
assert.match(html,/\/v1\/market\.js\?v=1\.0\.0/);
assert.match(nav,/const PANELS=\['radar','market'/);
assert.match(market,/\/api\/chart/);
assert.match(market,/\/api\/market-monitor/);
assert.match(market,/CandlestickSeries/);
assert.match(market,/HistogramSeries/);
assert.match(market,/LineSeries/);
assert.match(css,/\.market-chart/);

// Investimenti charts must remain isolated from Market and use recorded portfolio history.
assert.match(html,/investment-charts\.js\?v=1\.0\.1/);
assert.match(html,/investment-charts\.css\?v=1\.0.1/);
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

console.log('Market UI static integrity: PASS');
console.log('News pipeline linkage: PASS');
