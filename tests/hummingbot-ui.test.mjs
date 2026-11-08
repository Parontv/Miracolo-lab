import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, index, worker] = await Promise.all([
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../bot-live-router.js', import.meta.url), 'utf8')
]);

test('settings panel exposes Hummingbot read-only health without collecting credentials', () => {
  assert.match(app, /Hummingbot · Motore crypto/);
  assert.match(app, /refreshHummingbotStatus/);
  assert.match(app, /Monitoraggio in sola lettura/);
  assert.match(app, /Worker Secrets Cloudflare/);
  assert.doesNotMatch(app, /HUMMINGBOT_API_PASSWORD|HUMMINGBOT_API_USERNAME|CF_ACCESS_CLIENT_SECRET/);
});

test('app bundle cache version is bumped and Worker route exists', () => {
  assert.match(index, /\/app\.js\?v=1\.4\.2/);
  assert.match(worker, /\/api\/hummingbot\/overview/);
});
