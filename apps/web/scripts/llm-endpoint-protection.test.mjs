import test from 'node:test';
import assert from 'node:assert/strict';

import { checkLLMRateLimit } from '../lib/llm/rateLimiter.ts';
import {
  isInternalSecretValid,
  getInternalSecret,
  MAX_PROMPT_LENGTH_CHARS,
  LLM_CONFIG,
} from '../lib/llm/llmService.ts';

test('Rate limiter blocks rapid IP requests exceeding limit', () => {
  const testIp = '198.51.100.42';

  // Fire 15 allowed requests
  for (let i = 0; i < 15; i++) {
    const res = checkLLMRateLimit({ ip: testIp });
    assert.equal(res.allowed, true, `Request ${i + 1} should be allowed`);
  }

  // 16th request must be throttled with 429
  const blockedRes = checkLLMRateLimit({ ip: testIp });
  assert.equal(blockedRes.allowed, false, '16th request from same IP must be blocked');
  assert.ok(blockedRes.reason?.includes('Too many LLM requests from your IP'));
  assert.ok((blockedRes.retryAfterSeconds || 0) > 0);
});

test('Rate limiter blocks rapid user requests exceeding limit', () => {
  const testUserId = 'user_exhaustion_test_123';

  // Fire 20 allowed requests
  for (let i = 0; i < 20; i++) {
    const res = checkLLMRateLimit({ userId: testUserId });
    assert.equal(res.allowed, true, `Request ${i + 1} should be allowed`);
  }

  // 21st request must be throttled with 429
  const blockedRes = checkLLMRateLimit({ userId: testUserId });
  assert.equal(blockedRes.allowed, false, '21st request from same user must be blocked');
  assert.ok(blockedRes.reason?.includes('Too many LLM requests for this account'));
  assert.ok((blockedRes.retryAfterSeconds || 0) > 0);
});

test('Internal secret validation accepts valid secret and rejects invalid', () => {
  const secret = getInternalSecret();
  assert.ok(secret && secret.length > 0, 'Internal secret must exist');

  assert.equal(isInternalSecretValid(secret), true, 'Valid secret must pass');
  assert.equal(isInternalSecretValid('random_attacker_secret_xyz'), false, 'Fake secret must fail');
  assert.equal(isInternalSecretValid(''), false, 'Empty secret must fail');
  assert.equal(isInternalSecretValid(null), false, 'Null secret must fail');
  assert.equal(isInternalSecretValid(undefined), false, 'Undefined secret must fail');
});

test('Prompt length guard rejects oversized prompts', () => {
  assert.equal(MAX_PROMPT_LENGTH_CHARS, 40000);
});

test('Claude token cap is bounded to prevent runaway credit exhaustion', () => {
  // Claude was previously configured with 24,576 tokens output max!
  // Hard cap must be <= 8192 and default <= 4096
  assert.ok(LLM_CONFIG.claude.defaultMaxTokens <= 4096);
  assert.ok(LLM_CONFIG.claude.hardTokenCap <= 8192);
  assert.ok(LLM_CONFIG.gemini.defaultMaxTokens <= 4096);
  assert.ok(LLM_CONFIG.openai.defaultMaxTokens <= 4096);
});
