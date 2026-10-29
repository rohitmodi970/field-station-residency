import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAnalysisPrompt,
  buildChatPrompt,
  buildForcePersona,
  buildTaskPrompt,
} from '../lib/force-agent/memoryHelpers.js';
import {
  ForceAgentOrchestratorRunner,
  checkAllToolsHealth,
  getToolAdapter,
  toolRegistry,
} from '../lib/force-agent/phase2Adapters.js';

// ─── Phase 3 Persona & Posture Tests ──────────────────────────────────────────

test('Phase 3 Persona enforces quiet observation over intervention', () => {
  const persona = buildForcePersona();
  assert.ok(persona.includes('Quiet by default'));
  assert.ok(persona.includes('notice and ask one good question rather than offering five action items'));
  assert.ok(persona.includes('offers the person can accept, refine, or dismiss — never as verdicts'));
});

test('Phase 3 Persona enforces relational safety constraint', () => {
  const persona = buildForcePersona();
  assert.ok(persona.includes('Never abruptly abandon sensitive relationships'));
  assert.ok(persona.includes('boundaries, calm communication, support, and reflection'));
});

test('Phase 3 buildChatPrompt endows compassionate reflective mentor tone', () => {
  const prompt = buildChatPrompt({
    systemContext: 'User is feeling uncertain about a career pivot.',
    memoryContext: 'WHAT I KNOW ABOUT YOU:\n- Flourishes with autonomy',
  });

  assert.ok(prompt.includes('Flourishes with autonomy'));
  assert.ok(prompt.includes('User is feeling uncertain about a career pivot'));
  assert.ok(prompt.includes('SPIRITUAL SUPPORT'));
  assert.ok(prompt.includes('EMOTIONAL VALIDATION'));
  assert.ok(prompt.includes('MOTIVATION & EMPOWERMENT'));
});

test('Phase 3 buildAnalysisPrompt requires evidence-backed insights and no psycho-babble', () => {
  const prompt = buildAnalysisPrompt({
    title: 'Work stress',
    content: 'Had an intense disagreement with team lead over timelines.',
    analysisType: 'combined',
  });

  assert.ok(prompt.includes('Every key insight must be backed by evidence'));
  assert.ok(prompt.includes('No arbitrary claims. No psycho-babble. No spiritual filler'));
  assert.ok(prompt.includes('Present reflective patterns as observations the person can affirm or refine'));
});

// ─── Phase 3 Reflective Memory Offer Logic & Acceptance Metrics ───────────────

function calculateAcceptanceRate(offers) {
  const decided = offers.filter((o) => o.status !== 'pending');
  if (decided.length === 0) return 100;
  const accepted = decided.filter((o) => o.status === 'accepted').length;
  const refined = decided.filter((o) => o.status === 'refined').length;
  return Math.round(((accepted + refined * 0.5) / decided.length) * 100);
}

test('Reflective offer state transition: pending -> accepted', () => {
  const offer = {
    id: 'test-offer-1',
    category: 'reflective',
    title: 'Outdoor Time Correlation',
    status: 'pending',
  };

  offer.status = 'accepted';
  assert.equal(offer.status, 'accepted');

  const offers = [offer];
  assert.equal(calculateAcceptanceRate(offers), 100);
});

test('Reflective offer state transition: pending -> refined', () => {
  const offer = {
    id: 'test-offer-2',
    category: 'reflective',
    title: 'Morning Routine Shift',
    status: 'pending',
  };

  offer.status = 'refined';
  offer.userNote = 'Only applies to weekdays, not weekends';

  assert.equal(offer.status, 'refined');
  assert.ok(offer.userNote);

  const offers = [offer];
  // Refined counts as 50% partial alignment
  assert.equal(calculateAcceptanceRate(offers), 50);
});

test('Reflective offer state transition: pending -> dismissed', () => {
  const offer = {
    id: 'test-offer-3',
    category: 'reflective',
    title: 'Random coincidence',
    status: 'pending',
  };

  offer.status = 'dismissed';
  assert.equal(offer.status, 'dismissed');

  const offers = [offer];
  assert.equal(calculateAcceptanceRate(offers), 0);
});

test('Acceptance rate aggregates multiple decided offers cleanly', () => {
  const offers = [
    { id: '1', status: 'accepted' }, // 1.0
    { id: '2', status: 'accepted' }, // 1.0
    { id: '3', status: 'refined' },  // 0.5
    { id: '4', status: 'dismissed' },// 0.0
    { id: '5', status: 'pending' },  // ignored
  ];

  // (1 + 1 + 0.5 + 0) / 4 = 2.5 / 4 = 62.5% -> rounded 63%
  const rate = calculateAcceptanceRate(offers);
  assert.equal(rate, 63);
});

// ─── Phase 3 AI Task Generation & Orchestrator Routing Tests ─────────────────

test('Orchestrator handles ai_task_generation with query and journalEntry', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'user-p3-test',
    type: 'ai_task_generation',
    entryText: 'Need to prepare quarterly slides and schedule check-in with product lead.',
    query: 'Generate grounded tasks',
  });

  assert.equal(result.type, 'ai_task_generation');
  assert.ok(['vektori', 'legacy', 'none'].includes(result.memorySource));
});

test('Orchestrator handles memory_query returning inferred categories', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'user-p3-test',
    type: 'memory_query',
    query: 'What are my coffee preferences and passport expiry date?',
  });

  assert.equal(result.type, 'memory_query');
  assert.ok(result.actionOutcome);
  assert.ok(result.actionOutcome.categories);
});

test('All 4 tool adapters are registered and report health in Control Center', async () => {
  const allHealth = await checkAllToolsHealth();
  const tools = ['anthropic', 'vektori', 'tinyfish', 'photon'];

  for (const name of tools) {
    assert.ok(allHealth[name], `Tool ${name} should be in health report`);
    assert.equal(allHealth[name].name, name);
    assert.equal(typeof allHealth[name].ok, 'boolean');
    assert.equal(typeof allHealth[name].latencyMs, 'number');
  }
});

// ─── Conversational Tool Intent & Fallback Tests ──────────────────────────────

test('Conversational chat detects TinyFish Luma URL and surfaces tool execution card', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user',
    type: 'chat',
    messages: [{ role: 'user', content: 'Can you please register me for https://lu.ma/build-club-sf?' }],
  });

  assert.equal(result.type, 'chat');
  assert.ok(result.toolExecution);
  assert.equal(result.toolExecution.tool, 'tinyfish');
  assert.ok(result.toolExecution.data?.eventUrl.includes('lu.ma/build-club-sf'));
  assert.ok(result.message.includes('TinyFish'));
});

test('Conversational chat detects Task creation intent and returns task execution data', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user',
    type: 'chat',
    messages: [{ role: 'user', content: 'Please create a task to review the quarterly budget tomorrow' }],
  });

  assert.equal(result.type, 'chat');
  assert.ok(result.toolExecution);
  assert.equal(result.toolExecution.tool, 'task_generation');
  assert.ok(result.toolExecution.data?.title.includes('review the quarterly budget'));
});

test('Conversational chat detects unsupported action and returns polite fallback message', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user',
    type: 'chat',
    messages: [{ role: 'user', content: 'Book a flight to Tokyo next Friday' }],
  });

  assert.equal(result.type, 'chat');
  assert.ok(result.toolExecution);
  assert.equal(result.toolExecution.tool, 'unsupported');
  assert.ok(result.message.includes('tool adapter') || result.message.includes('external action'));
  assert.ok(result.message.includes('Luma'));
});

test('Conversational chat detects reflective synthesis intent and provides observation offer', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'test-user',
    type: 'chat',
    messages: [{ role: 'user', content: 'What patterns have you noticed in my recent journals?' }],
  });

  assert.equal(result.type, 'chat');
  assert.ok(result.toolExecution);
  assert.equal(result.toolExecution.tool, 'reflective_synthesis');
  assert.ok(result.toolExecution.data?.observation);
});
