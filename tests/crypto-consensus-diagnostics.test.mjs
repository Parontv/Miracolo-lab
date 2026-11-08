import test from 'node:test';
import assert from 'node:assert/strict';
import { cryptoConsensus } from '../bot-crypto-paper.js';

const fresh = direction => ({
  direction, strength: direction ? 0.8 : 0, coverage: 1, confidence: 80,
  dataAvailable: true, asOf: new Date().toISOString(),
  marketType: 'spot', source: 'test'
});

test('one directional vote is not shown as meaningful 100% agreement', () => {
  const result = cryptoConsensus({ score: 0.3, coverage: 1 }, {
    modules: { flow: fresh(0), macro: fresh(0), crypto_news: fresh(0) }
  }, 'BTCUSDT');
  assert.equal(result.activeVotes, 1);
  assert.equal(result.agreement, 1);
  assert.equal(result.agreementLabel, 'NON SIGNIFICATIVO (1/2 voti direzionali minimi)');
  assert.match(result.reason, /1\/2 voti direzionali minimi/);
  assert.equal(result.action, 'WAIT');
});

test('agreement displays numerator and denominator when multiple votes are directional', () => {
  const result = cryptoConsensus({ score: 0.8, coverage: 1 }, {
    modules: { flow: fresh(1), macro: fresh(1), crypto_news: fresh(0) }
  }, 'BTCUSDT');
  assert.equal(result.activeVotes, 3);
  assert.equal(result.agreementCount, 3);
  assert.equal(result.agreementLabel, '100% (3/3)');
});
