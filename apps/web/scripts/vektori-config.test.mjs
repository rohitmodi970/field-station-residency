import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVektoriHeaders, getVektoriConfig, isVektoriEnabled, isVektoriEnabledForUser } from '../utils/vektori/config.js';

test('getVektoriConfig applies defaults and env overrides', () => {
  const config = getVektoriConfig({
    VEKTORI_ENABLED: 'true',
    VEKTORI_BASE_URL: 'https://vektori.example.com',
    VEKTORI_API_KEY: 'secret',
    VEKTORI_ADD_PATH: '/ingest',
    VEKTORI_SEARCH_PATH: '/lookup',
    VEKTORI_HEALTH_PATH: '/ready',
    VEKTORI_DEFAULT_DEPTH: 'l2',
    VEKTORI_REQUEST_TIMEOUT_MS: '7000',
    VEKTORI_FAILURE_THRESHOLD: '5',
    VEKTORI_COOLDOWN_MS: '120000',
  });

  assert.equal(config.enabled, true);
  assert.equal(config.configured, true);
  assert.equal(config.baseUrl, 'https://vektori.example.com');
  assert.equal(config.addPath, '/ingest');
  assert.equal(config.searchPath, '/lookup');
  assert.equal(config.healthPath, '/ready');
  assert.equal(config.defaultDepth, 'l2');
  assert.equal(config.timeoutMs, 7000);
  assert.equal(config.failureThreshold, 5);
  assert.equal(config.cooldownMs, 120000);
});

test('createVektoriHeaders adds auth only when configured', () => {
  const headers = createVektoriHeaders({ VEKTORI_API_KEY: 'secret' });
  assert.equal(headers.Authorization, 'Bearer secret');
  assert.equal(headers['Content-Type'], 'application/json');
});

test('isVektoriEnabled requires both enable flag and base url', () => {
  assert.equal(isVektoriEnabled({ VEKTORI_ENABLED: 'true' }), false);
  assert.equal(isVektoriEnabled({ VEKTORI_ENABLED: 'true', VEKTORI_BASE_URL: 'https://x' }), true);
});

test('isVektoriEnabledForUser respects rollout percent', () => {
  const env = { VEKTORI_ENABLED: 'true', VEKTORI_BASE_URL: 'https://x', VEKTORI_ROLLOUT_PERCENT: '0' };
  assert.equal(isVektoriEnabledForUser('user-1', env), false);

  const fullEnv = { VEKTORI_ENABLED: 'true', VEKTORI_BASE_URL: 'https://x', VEKTORI_ROLLOUT_PERCENT: '100' };
  assert.equal(isVektoriEnabledForUser('user-1', fullEnv), true);
});
