// apps/web/scripts/test-onairos-intent-snapshot.mjs
// Verifies Onairos General Persona ingestion & 5-field snapshot transformation

import assert from 'node:assert';
import { normalizeOnairosContext } from '../lib/residency/onairosAdapter.js';
import { synthesizeIntentSnapshot } from '../lib/residency/intentSynthesizer.js';
import { ONAIROS_GENERAL_PERSONA_FIXTURE } from '../lib/residency/fixtures/onairosFixture.js';
import { FIELDS, FIELD_LABEL, FIELD_MEANING, isEmpty } from '../contract/residency.js';

console.log('🧪 Starting Onairos Intent Snapshot Transformation Tests...\n');

// 1. User's exact example payload
const userOnairosPayload = {
  "DataAnalysis": {
    "personality_traits": {
      "positive_traits": {
        "Creative Problem Solving": 92,
        "Science and Technology Enthusiasm": 88,
        "Community Engagement": 85,
        "Visual Storytelling": 78
      },
      "traits_to_improve": {
        "Structured Planning": 65,
        "Financial Awareness": 54,
        "Routine Consistency": 46
      },
      "user_summary": "You are a curious, creative individual who learns by exploring multiple disciplines, combining analytical depth with visual and narrative expression.",
      "top_traits_explanation": "Your positive traits reflect a strong pattern of exploratory problem-solving and cross-pollination between technical systems and creative community engagement.",
      "archetype": "Creative Explorer",
      "nudges": [
        { "text": "You're highly analytical — try journaling a decision you're mulling over." },
        { "text": "Consider dedicating time to purely enjoyable, less analytical activities — it can refresh your perspective." }
      ]
    }
  },
  "metadata": {
    "total_items_analyzed": 847,
    "items_sampled": 420,
    "chunks_processed": 4,
    "total_chunks": 6,
    "coverage": "66.7%",
    "platform_breakdown": {
      "reddit": {
        "summary": "Strong community, technology, and learning interests."
      },
      "youtube": {
        "summary": "Creative tutorials, music discovery, and long-form explainers."
      }
    }
  }
};

// Test 1: normalizeOnairosContext with user payload
console.log('Test 1: Testing normalizeOnairosContext with real payload...');
const normalized = normalizeOnairosContext(userOnairosPayload);
assert.strictEqual(normalized.archetype, 'Creative Explorer', 'Archetype must match');
assert.strictEqual(normalized.positive_traits.length, 4, 'Must have 4 positive traits');
assert.strictEqual(normalized.positive_traits[0].trait, 'Creative Problem Solving');
assert.strictEqual(normalized.positive_traits[0].score, 92);
assert.strictEqual(normalized.positive_traits[1].trait, 'Science and Technology Enthusiasm');
assert.strictEqual(normalized.positive_traits[1].score, 88);
assert.strictEqual(normalized.positive_traits[2].trait, 'Community Engagement');
assert.strictEqual(normalized.positive_traits[2].score, 85);
assert.strictEqual(normalized.positive_traits[3].trait, 'Visual Storytelling');
assert.strictEqual(normalized.positive_traits[3].score, 78);
assert(normalized.user_summary.includes('curious, creative individual'), 'User summary must match');
assert(normalized.top_traits_explanation.includes('positive traits reflect'), 'Top traits explanation must match');
assert.strictEqual(normalized.nudges.length, 2, 'Must have 2 nudges');
assert.strictEqual(normalized.nudges[0].text, "You're highly analytical — try journaling a decision you're mulling over.");
assert.strictEqual(normalized.metadata.coverage, '66.7%');
assert.strictEqual(normalized.metadata.items_sampled, 420);
assert.strictEqual(normalized.metadata.total_items_analyzed, 847);
console.log('✅ Test 1 Passed: Onairos adapter normalized payload with 100% fidelity.\n');

// Test 2: synthesizeIntentSnapshot produces the snapshot with Onairos fields
console.log('Test 2: Testing synthesizeIntentSnapshot with Onairos context...');
const snapshot = await synthesizeIntentSnapshot({
  userId: 'user_test_onairos',
  userName: 'Srinjoy',
  cohortId: 'dhun-oct-2026',
  answers: [
    'I want to build local, decentralized cognitive memory systems that respect resident sovereignty.',
    'People hand over their entire personal journals and thoughts to closed servers without knowing how they are analyzed.',
    'Creating lightweight client-side graphs without high-latency server roundtrips.',
  ],
  onairosContext: normalized,
});

assert.strictEqual(snapshot.archetype, 'Creative Explorer');
assert(Array.isArray(snapshot.positive_traits) && snapshot.positive_traits.length === 4);
assert.strictEqual(snapshot.positive_traits[0].trait, 'Creative Problem Solving');
assert.strictEqual(snapshot.positive_traits[0].score, 92);
assert(snapshot.user_summary.includes('curious, creative'));
assert(snapshot.top_traits_explanation.includes('exploratory problem-solving'));
assert.strictEqual(snapshot.nudges.length, 2);
assert.strictEqual(snapshot.onairos_metadata.coverage, '66.7%');
assert.strictEqual(snapshot.onairos_metadata.items_sampled, 420);
assert.strictEqual(snapshot.onairos_metadata.total_items_analyzed, 847);
console.log('✅ Test 2 Passed: synthesizeIntentSnapshot correctly populated archetype, positive_traits, user_summary, top_traits_explanation, and nudges.\n');

// Test 3: Verify contract FIELDS contains the required fields
console.log('Test 3: Testing contract FIELDS...');
assert(FIELDS.includes('archetype'), 'FIELDS must include archetype');
assert(FIELDS.includes('positive_traits'), 'FIELDS must include positive_traits');
assert(FIELDS.includes('user_summary'), 'FIELDS must include user_summary');
assert(FIELDS.includes('top_traits_explanation'), 'FIELDS must include top_traits_explanation');
assert(FIELDS.includes('nudges'), 'FIELDS must include nudges');
assert(FIELDS.includes('intent'), 'FIELDS must include intent');
assert(FIELDS.includes('problem'), 'FIELDS must include problem');
assert(FIELDS.includes('approach'), 'FIELDS must include approach');

for (const f of FIELDS) {
  assert(FIELD_LABEL[f], `FIELD_LABEL for ${f} must exist`);
  assert(FIELD_MEANING[f], `FIELD_MEANING for ${f} must exist`);
}
console.log('✅ Test 3 Passed: Contract FIELDS and labels properly defined.\n');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
