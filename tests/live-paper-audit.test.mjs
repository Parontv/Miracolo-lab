import assert from 'node:assert/strict';

const BASE = process.env.MIRACOLO_BASE_URL;
assert.ok(BASE, 'MIRACOLO_BASE_URL is required');

async function get(path) {
  const r = await fetch(`${BASE.replace(/\/$/, '')}${path}?ts=${Date.now()}`, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  });
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body };
}

const alpaca = await get('/api/alpaca/status');
assert.equal(alpaca.status, 200, 'Alpaca status endpoint must be reachable');
assert.equal(alpaca.body?.mode, 'PAPER', 'live audit must prove PAPER mode');

const crypto = await get('/api/bot/crypto');
assert.equal(crypto.status, 200, 'crypto endpoint must be reachable');
assert.equal(crypto.body?.ok, true, 'crypto endpoint must return ok=true');
assert.equal(crypto.body?.symbol, 'BTC/USD', 'crypto audit must use BTC/USD');

const plan = await get('/api/bot/plan');
assert.equal(plan.status, 200, 'bot plan endpoint must be reachable');
assert.equal(plan.body?.mode, 'PAPER', 'bot plan must be PAPER');
assert.equal(plan.body?.execution?.dryRun, true, 'audit must remain dry-run');

const action = plan.body?.botAction?.action ?? 'HOLD';
assert.ok(['BUY', 'SELL', 'HOLD', 'WAIT'].includes(action), `unexpected bot action: ${action}`);

console.log(JSON.stringify({
  alpacaMode: alpaca.body.mode,
  symbol: crypto.body.symbol,
  action,
  confidence: plan.body?.confidence ?? null,
  coverage: plan.body?.coverage ?? null,
  dryRun: plan.body?.execution?.dryRun,
}, null, 2));

console.log('LIVE PAPER AUDIT: PASS — live Worker reachable, PAPER mode verified, BTC/USD verified, plan generated; no order submitted.');
