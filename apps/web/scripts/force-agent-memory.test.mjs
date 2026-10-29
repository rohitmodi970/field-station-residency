import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAnalysisPrompt,
  buildChatPrompt,
  buildForcePersona,
  dedupeContextLines,
  formatLegacyKnowledgeContext,
  formatStoryLensLegacyContext,
  generateDeterministicEmbedding,
  inferMemoryCategories,
  resolveMemorySource,
  scoreLegacyKnowledge,
} from '../lib/force-agent/memoryHelpers.js';

test('resolveMemorySource prefers vektori over legacy', () => {
  const result = resolveMemorySource('VEKTORI FACTS:\n- loves hiking', 'WHAT I KNOW ABOUT YOU:\n- likes coffee');
  assert.equal(result.source, 'vektori');
  assert.ok(result.context.includes('VEKTORI'));
});

test('resolveMemorySource falls back to legacy when vektori is empty', () => {
  const result = resolveMemorySource('', 'WHAT I KNOW ABOUT YOU:\n- likes coffee');
  assert.equal(result.source, 'legacy');
  assert.ok(result.context.includes('coffee'));
});

test('resolveMemorySource returns none when both paths are empty', () => {
  const result = resolveMemorySource('', '');
  assert.equal(result.source, 'none');
  assert.equal(result.context, '');
});

test('resolveMemorySource treats whitespace-only vektori as empty', () => {
  const result = resolveMemorySource('   ', 'WHAT I KNOW ABOUT YOU:\n- legacy fact');
  assert.equal(result.source, 'legacy');
});

test('scoreLegacyKnowledge ranks relevant items above noise', () => {
  const runEmbedding = generateDeterministicEmbedding('morning run park exercise');
  const noiseEmbedding = generateDeterministicEmbedding('unrelated finance spreadsheet notes');

  const knowledge = [
    {
      knowledge_type: 'memory',
      content: 'User enjoys morning runs in the park',
      confidence: 0.9,
      embedding: runEmbedding,
    },
    {
      knowledge_type: 'raw',
      content: 'Unrelated finance spreadsheet notes',
      confidence: 0.5,
      embedding: noiseEmbedding,
    },
  ];

  const scored = scoreLegacyKnowledge(knowledge, 'morning run park exercise');
  assert.ok(scored.length >= 1);
  assert.ok(scored[0].content.includes('morning runs'));
});

test('formatLegacyKnowledgeContext preserves chat-route shape', () => {
  const formatted = formatLegacyKnowledgeContext([
    { knowledge_type: 'memory', content: 'Values family time' },
    { knowledge_type: 'raw', content: 'Mentioned stress at work yesterday' },
  ]);

  assert.ok(formatted.includes('WHAT I KNOW ABOUT YOU:'));
  assert.ok(formatted.includes('RELEVANT CONTEXT FROM YOUR JOURNALS:'));
  assert.ok(formatted.includes('Values family time'));
});

test('formatStoryLensLegacyContext preserves journal-route shape', () => {
  const formatted = formatStoryLensLegacyContext([
    { knowledge_type: 'memory', content: 'Values family time' },
    { knowledge_type: 'raw', content: 'Mentioned stress at work yesterday' },
  ]);

  assert.ok(formatted.includes('LEGACY MEMORY (CURATED):'));
  assert.ok(formatted.includes('LEGACY MEMORY (RAW OBSERVATIONS):'));
});

test('dedupeContextLines removes repeated lines across blocks', () => {
  const deduped = dedupeContextLines([
    'VEKTORI FACTS:\n- same line\n- unique-a',
    'LEGACY MEMORY:\n- same line\n- unique-b',
  ]);

  const occurrences = deduped.split('- same line').length - 1;
  assert.equal(occurrences, 1);
  assert.ok(deduped.includes('unique-a'));
  assert.ok(deduped.includes('unique-b'));
});

test('inferMemoryCategories detects reflective and mechanical signals', () => {
  const categories = inferMemoryCategories(
    'Over time you consistently feel happiest outdoors. Your passport expires next month.'
  );

  assert.ok(categories.includes('reflective'));
  assert.ok(categories.includes('mechanical'));
});

test('inferMemoryCategories defaults to narrative when no strong signal', () => {
  const categories = inferMemoryCategories('Working through a difficult conversation with a friend.');
  assert.deepEqual(categories, ['narrative']);
});

test('persona enforces quiet, compassionate, judgment-preserving posture', () => {
  const persona = buildForcePersona();
  assert.ok(persona.includes('reflective companion'));
  assert.ok(persona.includes('Quiet by default'));
  assert.ok(persona.includes('offers the person can accept, refine, or dismiss — never as verdicts'));
  assert.ok(persona.includes('Never abruptly abandon sensitive relationships'));
});

test('buildChatPrompt injects memoryContext and relational safety correctly', () => {
  const prompt = buildChatPrompt({
    systemContext: 'User is talking about family dinner.',
    memoryContext: 'WHAT I KNOW ABOUT YOU:\n- Values honesty',
  });

  assert.ok(prompt.includes('WHAT I KNOW ABOUT YOU:'));
  assert.ok(prompt.includes('User is talking about family dinner.'));
  assert.ok(prompt.includes('RELATIONAL SAFETY'));
});

test('buildAnalysisPrompt formats sentiment and textual schemas cleanly', () => {
  const sentimentPrompt = buildAnalysisPrompt({
    title: 'Rough day',
    content: 'Felt tired and overwhelmed',
    analysisType: 'sentiment',
    historicalContext: 'Context from past entries',
  });

  assert.ok(sentimentPrompt.includes('overallSentiment'));
  assert.ok(sentimentPrompt.includes('Rough day'));
  assert.ok(sentimentPrompt.includes('Context from past entries'));
});

