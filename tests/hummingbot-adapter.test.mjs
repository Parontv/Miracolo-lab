import test from 'node:test';
import assert from 'node:assert/strict';
import { getHummingbotOverview } from '../hummingbot-adapter.js';

const env = {
  HUMMINGBOT_API_URL: 'https://hummingbot.example.test',
  HUMMINGBOT_API_USERNAME: 'miracolo-readonly',
  HUMMINGBOT_API_PASSWORD: 'test-password',
  CF_ACCESS_CLIENT_ID: 'access-id',
  CF_ACCESS_CLIENT_SECRET: 'access-secret'
};

test('Hummingbot adapter stays disabled when URL or credentials are missing', async () => {
  const missing = await getHummingbotOverview({});
  assert.equal(missing.ok, false);
  assert.equal(missing.configured, false);
  assert.equal(missing.connected, false);
  assert.equal(missing.mode, 'READ_ONLY');
});

test('Hummingbot adapter rejects non-HTTPS endpoints before network access', async () => {
  let called = false;
  const result = await getHummingbotOverview({
    ...env,
    HUMMINGBOT_API_URL: 'http://hummingbot.example.test'
  }, { fetchImpl: async () => { called = true; } });
  assert.equal(result.ok, false);
  assert.equal(result.configured, false);
  assert.equal(called, false);
});

test('Hummingbot adapter performs only authenticated GET requests and normalizes status', async () => {
  const calls = [];
  const fixtures = {
    '/system/info': { api_version: '2.14.0', hummingbot_version: '2.14.0', docker_available: true, secret: 'must-not-leak' },
    '/connectors/': ['binance', 'binance_paper_trade', 42],
    '/executors/summary': { total_active: 2, total_pnl_quote: 12.5, total_volume_quote: 900, by_connector: { binance: 2 }, api_key: 'must-not-leak' }
  };
  const result = await getHummingbotOverview(env, {
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      const path = new URL(url).pathname;
      return new Response(JSON.stringify(fixtures[path]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.connected, true);
  assert.equal(result.mode, 'READ_ONLY');
  assert.deepEqual(result.connectors.available, ['binance', 'binance_paper_trade']);
  assert.equal(result.executors.summary.total_active, 2);
  assert.equal(result.executors.summary.total_pnl_quote, 12.5);
  assert.equal(result.executors.summary.total_volume_quote, 900);
  assert.deepEqual(result.executors.summary.by_connector, { binance: 2 });
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.options.method, 'GET');
    assert.match(call.options.headers.Authorization, /^Basic /);
    assert.equal(call.options.headers['CF-Access-Client-Id'], 'access-id');
    assert.equal(call.options.headers['CF-Access-Client-Secret'], 'access-secret');
    assert.equal(call.options.redirect, 'error');
  }
});

test('Hummingbot adapter reports partial failures without hiding a reachable service', async () => {
  const result = await getHummingbotOverview(env, {
    fetchImpl: async url => {
      const path = new URL(url).pathname;
      if (path === '/connectors/') return new Response('forbidden', { status: 403 });
      if (path === '/system/info') return Response.json({ api_version: 'test' });
      return Response.json({ total_active: 0 });
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.connected, true);
  assert.equal(result.connectors.status, 'ERROR');
  assert.equal(result.endpoints.system, 'OK');
});

test('Hummingbot adapter does not trust malformed JSON or oversized payloads', async () => {
  const malformed = await getHummingbotOverview(env, {
    fetchImpl: async () => new Response('not-json', { status: 200 })
  });
  assert.equal(malformed.ok, false);
  assert.ok(malformed.errors.length > 0);
});
