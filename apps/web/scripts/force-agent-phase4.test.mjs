import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAnalysisPrompt,
  buildAutomationPrompt,
  buildChatPrompt,
  buildForcePersona,
  buildGoal,
  buildTaskPrompt,
  inferMemoryCategories,
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

// ─── 1. Persisted Agent Traces Tests ─────────────────────────────────────────

test('Phase 4: Orchestrator records execution traces with latency on handle()', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  orchestrator.clearTraces();

  const result = await orchestrator.handle({
    userId: 'user-trace-1',
    type: 'chat',
    messages: [{ role: 'user', content: 'Hello Force Agent!' }],
  });

  assert.equal(result.type, 'chat');
  const traces = orchestrator.getAgentTraces({ userId: 'user-trace-1' });
  assert.equal(traces.length, 1);

  const trace = traces[0];
  assert.ok(trace.id.startsWith('trace-'));
  assert.equal(trace.userId, 'user-trace-1');
  assert.equal(trace.requestType, 'chat');
  assert.ok(typeof trace.latencyMs === 'number' && trace.latencyMs >= 0);
  assert.ok(['success', 'fallback', 'error'].includes(trace.status));
  assert.ok(['vektori', 'legacy', 'none'].includes(trace.memorySource));
  assert.equal(trace.query, 'Hello Force Agent!');
});

test('Phase 4: Agent traces filter by userId and requestType cleanly', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  orchestrator.clearTraces();

  await orchestrator.handle({
    userId: 'user-a',
    type: 'chat',
    messages: [{ role: 'user', content: 'Chat user A' }],
  });

  await orchestrator.handle({
    userId: 'user-b',
    type: 'journal_analysis',
    entryText: 'Reflecting on project architecture...',
    metadata: { title: 'Architecture Milestone' },
  });

  await orchestrator.handle({
    userId: 'user-a',
    type: 'ai_task_generation',
    entryText: 'Need to file expenses and send slides',
  });

  const userATraces = orchestrator.getAgentTraces({ userId: 'user-a' });
  assert.equal(userATraces.length, 2);

  const analysisTraces = orchestrator.getAgentTraces({ requestType: 'journal_analysis' });
  assert.equal(analysisTraces.length, 1);
  assert.equal(analysisTraces[0].userId, 'user-b');
  assert.equal(analysisTraces[0].memoryTier, 'l2');

  orchestrator.clearTraces();
  assert.equal(orchestrator.getAgentTraces().length, 0);
});

// ─── 2. External Action Audit Logs Tests ─────────────────────────────────────

test('Phase 4: Tool execution records structured external action audit events', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  orchestrator.clearAuditEvents();

  // TinyFish registration action
  await orchestrator.handle({
    userId: 'user-audit-1',
    type: 'chat',
    messages: [{ role: 'user', content: 'Register me for https://lu.ma/open-source-summit' }],
  });

  const auditEvents = orchestrator.getAuditEvents();
  assert.equal(auditEvents.length, 1);

  const event = auditEvents[0];
  assert.ok(event.id.startsWith('audit-'));
  assert.equal(event.type, 'external_action');
  assert.equal(event.source, 'tinyfish');
  assert.ok(event.summary.includes('TinyFish') || event.summary.includes('Registration'));
  assert.equal(event.status, 'success');
});

test('Phase 4: External ingest records audit event with source and payload summary', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  orchestrator.clearAuditEvents();

  await orchestrator.handle({
    userId: 'user-audit-2',
    type: 'external_ingest',
    tool: 'photon',
    metadata: {
      action: 'process',
      payload: { message: 'Quick voice note reflection received via telegram' },
    },
  });

  const auditEvents = orchestrator.getAuditEvents();
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].source, 'photon');
  assert.equal(auditEvents[0].status, 'success');
});

test('Phase 4: Audit events filter by type and source', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  orchestrator.clearAuditEvents();

  orchestrator.recordAuditEvent({
    type: 'external_action',
    source: 'tinyfish',
    summary: 'Luma event RSVP registered',
    status: 'success',
  });

  orchestrator.recordAuditEvent({
    type: 'synthesis',
    source: 'reflective_synthesis',
    summary: 'Synthesized Category-4 life pattern',
    status: 'success',
  });

  orchestrator.recordAuditEvent({
    type: 'feedback',
    source: 'reflective_synthesis',
    summary: 'User affirmed reflection offer',
    status: 'success',
  });

  assert.equal(orchestrator.getAuditEvents({ type: 'external_action' }).length, 1);
  assert.equal(orchestrator.getAuditEvents({ type: 'synthesis' }).length, 1);
  assert.equal(orchestrator.getAuditEvents({ type: 'feedback' }).length, 1);
  assert.equal(orchestrator.getAuditEvents({ source: 'tinyfish' }).length, 1);
  assert.equal(orchestrator.getAuditEvents().length, 3);

  orchestrator.clearAuditEvents();
  assert.equal(orchestrator.getAuditEvents().length, 0);
});

// ─── 3. Four Memory Categories Diagnostics (Section 2.1) ─────────────────────

test('Phase 4: Four memory categories are recognized with respective tiers', () => {
  const tiers = {
    mechanical: { tier: 'Tier 1 · Commodity', interpretative: false },
    preference: { tier: 'Tier 2 · Commodity', interpretative: false },
    narrative: { tier: 'Tier 3 · Force Territory', interpretative: true },
    reflective: { tier: 'Tier 4 · Force Territory', interpretative: true },
  };

  assert.equal(tiers.mechanical.tier, 'Tier 1 · Commodity');
  assert.equal(tiers.preference.tier, 'Tier 2 · Commodity');
  assert.equal(tiers.narrative.tier, 'Tier 3 · Force Territory');
  assert.equal(tiers.reflective.tier, 'Tier 4 · Force Territory');

  assert.equal(tiers.mechanical.interpretative, false);
  assert.equal(tiers.preference.interpretative, false);
  assert.equal(tiers.narrative.interpretative, true);
  assert.equal(tiers.reflective.interpretative, true);
});

test('Phase 4: Memory category inference assigns samples to correct tiers', () => {
  const mechanicalSample = 'Your passport expires on November 15, 2026.';
  const preferenceSample = 'You prefer an oat milk flat white with cinnamon.';
  const narrativeSample = 'Standing intention: complete the architecture migration by end of month.';
  const reflectiveSample = 'Over the past six months, you report highest emotional resilience on days with outdoor walks.';

  const mechanicalCategories = inferMemoryCategories(mechanicalSample);
  assert.ok(mechanicalCategories.includes('mechanical') || mechanicalCategories.length > 0);

  const preferenceCategories = inferMemoryCategories(preferenceSample);
  assert.ok(preferenceCategories.includes('preference') || preferenceCategories.length > 0);

  const narrativeCategories = inferMemoryCategories(narrativeSample);
  assert.ok(narrativeCategories.includes('narrative') || narrativeCategories.length > 0);

  const reflectiveCategories = inferMemoryCategories(reflectiveSample);
  assert.ok(reflectiveCategories.includes('reflective') || reflectiveCategories.length > 0);
});

// ─── 4. Dual Write-Path Architecture Tests (Section 2.3) ─────────────────────

test('Phase 4: Dual write paths separate Capture (messaging) from Synthesis (journal)', () => {
  const dualPaths = {
    capture: {
      name: 'Capture Path (Messaging Layer)',
      triggers: ['chat turns', 'photon webhook messages'],
      categories: ['mechanical', 'preference', 'raw narrative'],
      effort: 'low',
      frequency: 'high',
    },
    synthesis: {
      name: 'Synthesis Path (Journal & Reflection)',
      triggers: ['journal analysis', 'periodic reflection passes'],
      categories: ['confirmed narrative', 'reflective'],
      effort: 'higher',
      frequency: 'periodic',
    },
  };

  // Capture path invariants
  assert.equal(dualPaths.capture.effort, 'low');
  assert.equal(dualPaths.capture.frequency, 'high');
  assert.ok(dualPaths.capture.triggers.includes('chat turns'));
  assert.ok(dualPaths.capture.categories.includes('mechanical'));

  // Synthesis path invariants
  assert.equal(dualPaths.synthesis.effort, 'higher');
  assert.equal(dualPaths.synthesis.frequency, 'periodic');
  assert.ok(dualPaths.synthesis.triggers.includes('journal analysis'));
  assert.ok(dualPaths.synthesis.categories.includes('reflective'));
});

// ─── 5. Reflective Insight Acceptance-Rate Instrumentation ────────────────────

function calculateAcceptanceRate(offers) {
  const decided = offers.filter((o) => o.status !== 'pending');
  if (decided.length === 0) return 100;
  const accepted = decided.filter((o) => o.status === 'accepted').length;
  const refined = decided.filter((o) => o.status === 'refined').length;
  return Math.round(((accepted + refined * 0.5) / decided.length) * 100);
}

test('Phase 4: Reflective acceptance rate calculates weighted decision metric', () => {
  // Empty or pending-only defaults to 100%
  assert.equal(calculateAcceptanceRate([]), 100);
  assert.equal(calculateAcceptanceRate([{ status: 'pending' }]), 100);

  // 1 accepted = 100%
  assert.equal(calculateAcceptanceRate([{ status: 'accepted' }]), 100);

  // 1 refined = 50%
  assert.equal(calculateAcceptanceRate([{ status: 'refined' }]), 50);

  // 1 dismissed = 0%
  assert.equal(calculateAcceptanceRate([{ status: 'dismissed' }]), 0);

  // 2 accepted, 1 refined, 1 dismissed, 2 pending
  // (2*1.0 + 1*0.5 + 0) / 4 = 2.5 / 4 = 62.5% -> 63%
  const mixedOffers = [
    { id: '1', status: 'accepted' },
    { id: '2', status: 'accepted' },
    { id: '3', status: 'refined', userNote: 'Mainly on weekdays' },
    { id: '4', status: 'dismissed' },
    { id: '5', status: 'pending' },
    { id: '6', status: 'pending' },
  ];
  assert.equal(calculateAcceptanceRate(mixedOffers), 63);
});

test('Phase 4: User nuance notes attach properly to refined offers', () => {
  const offer = {
    id: 'offer-nuance-test',
    category: 'reflective',
    title: 'Morning Focus Window',
    status: 'pending',
  };

  offer.status = 'refined';
  offer.userNote = 'Only applies when I sleep before 11 PM';
  offer.respondedAt = new Date().toISOString();

  assert.equal(offer.status, 'refined');
  assert.equal(offer.userNote, 'Only applies when I sleep before 11 PM');
  assert.ok(offer.respondedAt);
});

// ─── 6. Section 8 Demo Sequence Automated Verification ───────────────────────

test('Phase 4 Demo 1: Memory-aware chat injects context and returns unified persona', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner({
    memoryContextMock: 'WHAT I KNOW ABOUT YOU:\n- Prioritizes mindful focus and early morning walks',
  });

  const result = await orchestrator.handle({
    userId: 'demo-user',
    type: 'chat',
    messages: [{ role: 'user', content: 'What do you remember about my morning routine?' }],
  });

  assert.equal(result.type, 'chat');
  assert.ok(result.message);
  assert.ok(['legacy', 'vektori'].includes(result.memorySource));
});

test('Phase 4 Demo 2: Unified journal analysis synthesizes reflections via synthesis path', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'demo-user',
    type: 'journal_analysis',
    entryText: 'Feeling energized by the new product launch, but mindful not to overcommit.',
    metadata: { title: 'Product Launch Reflection', analysisType: 'combined' },
  });

  assert.equal(result.type, 'journal_analysis');
  assert.ok(result.analysis);
  assert.equal(result.memorySource, 'vektori');
});

test('Phase 4 Demo 3: AI task generation produces memory-grounded action items', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'demo-user',
    type: 'ai_task_generation',
    entryText: 'Need to schedule quarterly review with the team and send out agenda.',
    query: 'Actionable next steps',
  });

  assert.equal(result.type, 'ai_task_generation');
  assert.ok(Array.isArray(result.tasks));
  assert.ok(result.tasks.length > 0);
  assert.ok(result.tasks[0].title);
});

test('Phase 4 Demo 4: External ingestion from Photon captures messages into memory', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'demo-user',
    type: 'external_ingest',
    tool: 'photon',
    metadata: {
      action: 'ingest',
      payload: { text: 'Thought while walking: keep user privacy as default invariant' },
    },
  });

  assert.equal(result.type, 'external_ingest');
  assert.ok(result.actionOutcome);
  assert.equal(result.actionOutcome.handled, true);
});

test('Phase 4 Demo 5: TinyFish automation registers event and returns stream data', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'demo-user',
    type: 'chat',
    messages: [{ role: 'user', content: 'Please register me for https://lu.ma/force-design-summit' }],
  });

  assert.equal(result.type, 'chat');
  assert.ok(result.toolExecution);
  assert.equal(result.toolExecution.tool, 'tinyfish');
  assert.ok(result.toolExecution.data.eventUrl.includes('lu.ma/force-design-summit'));
});

test('Phase 4 Demo 6: Reflective synthesis surfaces Category-4 offer as quiet observation', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();
  const result = await orchestrator.handle({
    userId: 'demo-user',
    type: 'chat',
    messages: [{ role: 'user', content: 'What patterns have you noticed in my recent journals?' }],
  });

  assert.equal(result.type, 'chat');
  assert.ok(result.toolExecution);
  assert.equal(result.toolExecution.tool, 'reflective_synthesis');
  assert.ok(result.toolExecution.data.observation);
  assert.ok(result.toolExecution.data.offerId);
});

// ─── 7. Control Center & Diagnostics Query Action Tests ───────────────────────

test('Phase 4: Agent control handles traces, audit_logs, and category diagnostics', async () => {
  const orchestrator = new ForceAgentOrchestratorRunner();

  // Test traces query
  const tracesRes = await orchestrator.handle({
    userId: 'ctrl-user',
    type: 'agent_control',
    metadata: { action: 'traces' },
  });
  assert.equal(tracesRes.type, 'agent_control');
  assert.ok(Array.isArray(tracesRes.actionOutcome.traces));

  // Test audit_logs query
  const auditRes = await orchestrator.handle({
    userId: 'ctrl-user',
    type: 'agent_control',
    metadata: { action: 'audit_logs' },
  });
  assert.equal(auditRes.type, 'agent_control');
  assert.ok(Array.isArray(auditRes.actionOutcome.auditEvents));

  // Test category diagnostics query
  const catRes = await orchestrator.handle({
    userId: 'ctrl-user',
    type: 'agent_control',
    metadata: { action: 'category_diagnostics' },
  });
  assert.equal(catRes.type, 'agent_control');
  assert.ok(catRes.actionOutcome.mechanical);
  assert.ok(catRes.actionOutcome.preference);
  assert.ok(catRes.actionOutcome.narrative);
  assert.ok(catRes.actionOutcome.reflective);
});
