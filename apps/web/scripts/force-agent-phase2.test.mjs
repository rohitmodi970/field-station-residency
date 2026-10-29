import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import {
  buildAutomationPrompt,
  buildGoal,
  buildTaskPrompt,
  normalizeEventUrl,
  toCleanText,
  verifySignature,
} from '../lib/force-agent/memoryHelpers.js';
import {
  ForceAgentOrchestratorRunner,
  anthropicAdapter,
  checkAllToolsHealth,
  getToolAdapter,
  photonAdapter,
  tinyfishAdapter,
  toolRegistry,
  vektoriAdapter,
} from '../lib/force-agent/phase2Adapters.js';

// ─── TinyFish Adapter Tests ───────────────────────────────────────────────────

test('TinyFish buildGoal formats comprehensive prompt with profile and rules', () => {
  const profile = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    bio: 'Mathematician & programmer',
    company: 'Analytical Engines Inc',
    customAnswers: {
      'T-Shirt Size': 'M',
      'Dietary Requirements': 'Vegetarian',
    },
  };

  const goal = buildGoal(profile);
  assert.ok(goal.includes('Ada Lovelace'));
  assert.ok(goal.includes('ada@example.com'));
  assert.ok(goal.includes('Analytical Engines Inc'));
  assert.ok(goal.includes('T-Shirt Size'));
  assert.ok(goal.includes('Vegetarian'));
  assert.ok(goal.includes('CAPTCHA_DETECTED'));
  assert.ok(goal.includes('EVENT_FULL'));
  assert.ok(goal.includes('REGISTRATION_CLOSED'));
});

test('TinyFish normalizeEventUrl removes tracking queries and hashes', () => {
  const raw = 'https://lu.ma/my-event?utm_source=twitter&utm_medium=social#details';
  const normalized = normalizeEventUrl(raw);
  assert.equal(normalized, 'https://lu.ma/my-event');
});

test('TinyFish toCleanText decodes entities and collapses whitespace', () => {
  const cleaned = toCleanText('  Tech &amp; AI Summit &quot;2026&quot;   \n  Day 1  ');
  assert.equal(cleaned, 'Tech & AI Summit "2026" Day 1');
});

test('TinyFish adapter executes action "goal" correctly', async () => {
  const result = await tinyfishAdapter.execute({
    action: 'goal',
    eventUrl: 'https://lu.ma/ai-conf',
    profile: { name: 'Alan Turing', email: 'alan@bletchley.org' },
  });

  assert.equal(result.ok, true);
  assert.ok(result.data);
  const data = result.data;
  assert.equal(data.eventUrl, 'https://lu.ma/ai-conf');
  assert.ok(data.goal.includes('Alan Turing'));
});

test('TinyFish adapter validates missing profile on stream action', async () => {
  const result = await tinyfishAdapter.execute({
    action: 'stream',
    eventUrl: 'https://lu.ma/ai-conf',
  });

  assert.equal(result.ok, false);
  assert.ok(result.error?.includes('Profile is required'));
});

test('TinyFish adapter health returns valid structure', async () => {
  const health = await tinyfishAdapter.health();
  assert.equal(typeof health.ok, 'boolean');
  assert.equal(health.name, 'tinyfish');
  assert.equal(typeof health.latencyMs, 'number');
});

// ─── Photon Adapter Tests ─────────────────────────────────────────────────────

test('Photon verifySignature validates valid HMAC signatures', () => {
  const secret = 'test-webhook-secret';
  const timestamp = '1700000000';
  const body = Buffer.from(JSON.stringify({ event: 'messages', text: 'Hello' }));

  const expectedSig = `v0=${crypto.createHmac('sha256', secret)
    .update(`v0:${timestamp}:`)
    .update(body)
    .digest('hex')}`;

  const isValid = verifySignature(body, timestamp, expectedSig, secret);
  assert.equal(isValid, true);
});

test('Photon verifySignature rejects invalid signatures or tampered body', () => {
  const secret = 'test-webhook-secret';
  const timestamp = '1700000000';
  const body = Buffer.from(JSON.stringify({ event: 'messages', text: 'Hello' }));
  const tamperedBody = Buffer.from(JSON.stringify({ event: 'messages', text: 'Tampered' }));

  const validSig = `v0=fake_signature_hash_12345`;

  const isValid = verifySignature(tamperedBody, timestamp, validSig, secret);
  assert.equal(isValid, false);
});

test('Photon adapter execute action "verify" validates signature', async () => {
  const secret = 'unit-secret';
  const timestamp = '1700000000';
  const rawBody = Buffer.from(JSON.stringify({ event: 'test' }));
  const signature = `v0=${crypto.createHmac('sha256', secret)
    .update(`v0:${timestamp}:`)
    .update(rawBody)
    .digest('hex')}`;

  process.env.WEBHOOK_SECRET = secret;

  const result = await photonAdapter.execute({
    action: 'verify',
    rawBody,
    timestamp,
    signature,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { valid: true });
});

test('Photon adapter health returns valid structure', async () => {
  const health = await photonAdapter.health();
  assert.equal(typeof health.ok, 'boolean');
  assert.equal(health.name, 'photon');
  assert.equal(typeof health.latencyMs, 'number');
});

// ─── Vektori & Anthropic Adapter Tests ────────────────────────────────────────

test('Vektori adapter execute supports status and metrics actions', async () => {
  const statusResult = await vektoriAdapter.execute({ action: 'status' });
  assert.equal(statusResult.ok, true);
  assert.ok(statusResult.data);

  const metricsResult = await vektoriAdapter.execute({ action: 'metrics' });
  assert.equal(metricsResult.ok, true);
  assert.ok(metricsResult.data);
});

test('Vektori adapter health check returns valid structure', async () => {
  const health = await vektoriAdapter.health();
  assert.equal(typeof health.ok, 'boolean');
  assert.equal(health.name, 'vektori');
  assert.equal(typeof health.latencyMs, 'number');
});

test('Anthropic adapter health check returns valid structure', async () => {
  const health = await anthropicAdapter.health();
  assert.equal(typeof health.ok, 'boolean');
  assert.equal(health.name, 'anthropic');
  assert.equal(typeof health.latencyMs, 'number');
});

// ─── Tool Registry & Health Aggregator ────────────────────────────────────────

test('toolRegistry exposes all 4 core adapters', () => {
  assert.ok(toolRegistry.anthropic);
  assert.ok(toolRegistry.vektori);
  assert.ok(toolRegistry.tinyfish);
  assert.ok(toolRegistry.photon);

  assert.equal(getToolAdapter('tinyfish')?.name, 'tinyfish');
  assert.equal(getToolAdapter('PHOTON')?.name, 'photon');
  assert.equal(getToolAdapter('unknown_tool'), undefined);
});

test('checkAllToolsHealth aggregates health across all registered adapters', async () => {
  const allHealth = await checkAllToolsHealth();
  assert.ok(allHealth.anthropic);
  assert.ok(allHealth.vektori);
  assert.ok(allHealth.tinyfish);
  assert.ok(allHealth.photon);

  assert.equal(allHealth.anthropic.name, 'anthropic');
  assert.equal(allHealth.vektori.name, 'vektori');
  assert.equal(allHealth.tinyfish.name, 'tinyfish');
  assert.equal(allHealth.photon.name, 'photon');
});

// ─── Prompt Builder Task & Automation Tests ───────────────────────────────────

test('buildTaskPrompt formats grounded task instructions with memory', () => {
  const prompt = buildTaskPrompt({
    journalEntry: 'Need to prepare presentation for Monday and follow up with Sarah.',
    query: 'What should I do today?',
    memoryContext: 'WHAT I KNOW ABOUT YOU:\n- Prioritizes calm mornings',
  });

  assert.ok(prompt.includes('presentation for Monday'));
  assert.ok(prompt.includes('Sarah'));
  assert.ok(prompt.includes('Prioritizes calm mornings'));
  assert.ok(prompt.includes('reflective companion'));
});

test('buildAutomationPrompt formats browser action instructions', () => {
  const prompt = buildAutomationPrompt({
    eventUrl: 'https://lu.ma/tech-event',
    goal: 'Register for ticket',
    memoryContext: 'User prefers vegetarian lunch option',
  });

  assert.ok(prompt.includes('https://lu.ma/tech-event'));
  assert.ok(prompt.includes('Register for ticket'));
  assert.ok(prompt.includes('vegetarian lunch option'));
});

// ─── Orchestrator Request Routing Tests ───────────────────────────────────────

test('orchestrator rejects empty chat request gracefully', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user-1',
    type: 'chat',
    messages: [],
  });

  assert.equal(result.type, 'chat');
  assert.equal(result.memorySource, 'none');
  assert.ok(result.errors && result.errors.length > 0);
});

test('orchestrator rejects empty journal analysis request gracefully', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user-1',
    type: 'journal_analysis',
    entryText: '',
  });

  assert.equal(result.type, 'journal_analysis');
  assert.equal(result.memorySource, 'none');
  assert.ok(result.errors && result.errors.length > 0);
});

test('orchestrator routes external_action to tinyfish adapter', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user-1',
    type: 'external_action',
    tool: 'tinyfish',
    metadata: {
      action: 'goal',
      eventUrl: 'https://lu.ma/founders-dinner',
      profile: { name: 'Grace Hopper', email: 'grace@navy.mil' },
    },
  });

  assert.equal(result.type, 'external_action');
  assert.equal(result.memorySource, 'none');
  assert.ok(result.actionOutcome);
  const outcome = result.actionOutcome;
  assert.ok(outcome.goal.includes('Grace Hopper'));
});

test('orchestrator handles external_action for unknown tool cleanly', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user-1',
    type: 'external_action',
    tool: 'non_existent_tool',
  });

  assert.equal(result.type, 'external_action');
  assert.ok(result.errors && result.errors[0].includes('not found'));
});

test('orchestrator routes memory_query and returns memory source and categories', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user-1',
    type: 'memory_query',
    query: 'What are my favorite books?',
  });

  assert.equal(result.type, 'memory_query');
  assert.ok(['vektori', 'legacy', 'none'].includes(result.memorySource));
  assert.ok(result.actionOutcome);
});

test('orchestrator agent_control returns comprehensive health summary', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user-1',
    type: 'agent_control',
    metadata: { action: 'health' },
  });

  assert.equal(result.type, 'agent_control');
  assert.ok(result.actionOutcome);
  const outcome = result.actionOutcome;
  assert.ok(['healthy', 'degraded', 'unhealthy'].includes(outcome.status));
  assert.ok(outcome.memory);
  assert.ok(outcome.tools);
  assert.ok(outcome.tools.tinyfish);
  assert.ok(outcome.tools.photon);
  assert.ok(outcome.tools.vektori);
  assert.ok(outcome.tools.anthropic);
});

test('orchestrator agent_control returns diagnostics when requested', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user-1',
    type: 'agent_control',
    metadata: { action: 'diagnostics' },
  });

  assert.equal(result.type, 'agent_control');
  assert.ok(result.actionOutcome);
  const outcome = result.actionOutcome;
  assert.ok(outcome.vektori);
  assert.ok(outcome.metrics);
});

test('orchestrator returns error on unknown request type', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user-1',
    type: 'invalid_type',
  });

  assert.equal(result.type, 'invalid_type');
  assert.ok(result.errors && result.errors[0].includes('Unknown request type'));
});
