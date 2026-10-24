const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('public/index.html','utf8');
const nav=fs.readFileSync('public/v1/tab-navigation.js','utf8');
const market=fs.readFileSync('public/v1/market.js','utf8');
const bot=fs.readFileSync('public/v1/bot-workspace-v1.js','utf8');
const botEngine=fs.readFileSync('public/v1/bot-engine.js','utf8');
const live=fs.readFileSync('live-worker.js','utf8');
const server=fs.readFileSync('bot-server-engine-v10.js','utf8');
const serverV11=fs.readFileSync('bot-server-engine-v11.js','utf8');
function has(re,text,msg){assert.match(text,re,msg)}

// Required UI surfaces and assets exist.
for(const path of ['public/v1/market.js','public/v1/market.css','public/v1/investments.js','public/v1/investment-charts.js','public/v1/investment-charts.css','public/v1/bot-engine.js','public/v1/bot-workspace-v1.js','public/v1/news-feed-bridge.js'])assert.ok(fs.existsSync(path),`missing ${path}`);
has(/data-panel="market"/,html);has(/data-panel="bot"/,html);assert.doesNotMatch(html,/data-panel="strategy"/);assert.doesNotMatch(nav,/['"]strategy['"]/);

// Market client has the server contracts required by the current UI.
has(/\/api\/chart/,market);has(/\/api\/market-monitor/,market);

// News pipeline remains connected to the live layer.
has(/ML_NEWS_CONTRACT/,fs.readFileSync('public/v1/data.js','utf8'));has(/\/api\/live/,fs.readFileSync('public/v1/data.js','utf8'));has(/window\.ML\.on\('data'/,fs.readFileSync('public/v1/news-feed-bridge.js','utf8'));

// One user-facing Bot surface and one server-side decision path.
has(/bot-workspace-v1\.js/,html);has(/Avvia tutto/,bot);has(/PAPER ONLY/,bot);has(/\/api\/bot\/run/,botEngine);has(/miracolo:botdecision/,botEngine);has(/BOT-SERVER-V10/,server);has(/BOT-SERVER-V11/,serverV11);has(/bot-server-engine-v11/,live);has(/mode:'PAPER'/,server);has(/MAX_TRADES=3/,server);has(/RISK=10/,server);has(/CAPITAL=2000/,server);

console.log('Market/UI static integrity: PASS');
console.log('News pipeline linkage: PASS');
console.log('Single Bot surface: PASS');
console.log('Server decision contract: PASS');
console.log('Paper limits: PASS');
