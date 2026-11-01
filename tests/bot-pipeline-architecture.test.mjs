import assert from 'node:assert/strict';
import fs from 'node:fs';

const router=fs.readFileSync('bot-live-router.js','utf8');
const auto=fs.readFileSync('bot-paper-auto.js','utf8');
const executor=fs.readFileSync('bot-paper-executor.js','utf8');
const risk=fs.readFileSync('bot-risk-engine.js','utf8');
const engine=fs.readFileSync('bot-server-engine.js','utf8');

assert.match(router,/paper-api\.alpaca\.markets\/v2\/orders\?status=all/,'router must reconcile all PAPER order states');
assert.match(router,/bot\/orders\/v1/,'router must update persisted order audit');
assert.match(router,/filledQty/,'reconciliation must persist filled quantity');
assert.match(router,/filledAt/,'reconciliation must persist fill timestamp');
assert.match(router,/analysisResult:botResult/,'scheduled pipeline must reuse the already computed decision');
assert.match(auto,/analysisResult=null/,'auto executor must accept a precomputed analysis');
assert.match(executor,/ensurePaper\(env\)/,'executor must enforce PAPER endpoint');
assert.match(executor,/auditPersisted/,'executor must expose audit persistence status');
assert.match(engine,/riskEngine\(/,'decision engine must calculate deterministic risk gate');
assert.match(engine,/portfolio=\{approved:risk\.allowed/,'portfolio approval must be gated by risk engine');

console.log('PAPER lifecycle + pipeline architecture contract: PASS');
