// apps/web/scripts/test-onairos-routes.mjs
import assert from 'node:assert';
import { POST as synthesizeRoute } from '../app/api/residency/intent/synthesize/route.ts';
import { POST as approveRoute } from '../app/api/residency/intent/approve/route.ts';
import { GET as snapshotRoute } from '../app/api/residency/intent/snapshot/route.ts';
import { NextRequest } from 'next/server';

console.log('🧪 Testing Next.js Route Handlers with Onairos Data...\n');

// 1. Test POST /api/residency/intent/synthesize
console.log('Test 1: Calling POST /api/residency/intent/synthesize...');
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
      "reddit": { "summary": "Strong community, technology, and learning interests." },
      "youtube": { "summary": "Creative tutorials, music discovery, and long-form explainers." }
    }
  }
};

const synthReq = new Request('http://localhost:3000/api/residency/intent/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resident_id: 'resident_onairos_test',
    name: 'Srinjoy',
    cohort_id: 'dhun-oct-2026',
    answers: [
      'Build local memory graphs for residents.',
      'Data sovereignty is lost in monolithic centralized clouds.',
      'Keeping retrieval snappy and private.',
    ],
    onairos: {
      positive: [
        { name: 'Creative Problem Solving', strength: 92 },
        { name: 'Science and Technology Enthusiasm', strength: 88 },
        { name: 'Community Engagement', strength: 85 },
        { name: 'Visual Storytelling', strength: 78 },
      ],
      archetype: 'Creative Explorer',
      summary: userOnairosPayload.DataAnalysis.personality_traits.user_summary,
      explanation: userOnairosPayload.DataAnalysis.personality_traits.top_traits_explanation,
      nudges: [
        "You're highly analytical — try journaling a decision you're mulling over.",
        "Consider dedicating time to purely enjoyable, less analytical activities — it can refresh your perspective.",
      ],
      coverage: {
        analyzed: 847,
        sampled: 420,
        label: '66.7%',
        platforms: ['reddit', 'youtube'],
      },
    },
  }),
});

const synthRes = await synthesizeRoute(synthReq);
const synthJson = await synthRes.json();
console.log('Synthesized Response snapshot:', {
  id: synthJson.id,
  archetype: synthJson.archetype,
  positive_traits: synthJson.positive_traits?.length,
  user_summary: synthJson.user_summary?.slice(0, 40) + '...',
  nudges_count: synthJson.nudges?.length,
});

assert.strictEqual(synthJson.archetype, 'Creative Explorer');
assert.strictEqual(synthJson.positive_traits.length, 4);
assert.strictEqual(synthJson.positive_traits[0].name, 'Creative Problem Solving');
assert.strictEqual(synthJson.positive_traits[0].strength, 92);
assert(synthJson.user_summary.includes('curious, creative'));
assert.strictEqual(synthJson.nudges.length, 2);
console.log('✅ Test 1 Passed: synthesize route returns Onairos fields.\n');

// 2. Test POST /api/residency/intent/approve
console.log('Test 2: Calling POST /api/residency/intent/approve...');
const approveReq = new NextRequest('http://localhost:3000/api/residency/intent/approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    snapshot_id: synthJson.id,
    resident_id: 'resident_onairos_test',
    cohort_id: 'dhun-oct-2026',
    shared: true,
    edited_fields: {
      intent: synthJson.intent,
      problem: synthJson.problem,
      approach: synthJson.approach,
      archetype: synthJson.archetype,
      positive_traits: synthJson.positive_traits,
      user_summary: synthJson.user_summary,
      top_traits_explanation: synthJson.top_traits_explanation,
      nudges: synthJson.nudges,
    },
  }),
});

const approveRes = await approveRoute(approveReq);
const approveJson = await approveRes.json();
console.log('Approved Response snapshot:', {
  id: approveJson.id,
  archetype: approveJson.archetype,
  status: approveJson.status,
  shared: approveJson.shared,
});

assert.strictEqual(approveJson.archetype, 'Creative Explorer');
assert.strictEqual(approveJson.positive_traits.length, 4);
assert(approveJson.status === 'user_approved' || approveJson.status === 'approved');
assert.strictEqual(approveJson.snapshot.status, 'approved');
console.log('✅ Test 2 Passed: approve route persists and returns Onairos fields.\n');

// 3. Test GET /api/residency/intent/snapshot
console.log('Test 3: Calling GET /api/residency/intent/snapshot...');
const getReq = new NextRequest('http://localhost:3000/api/residency/intent/snapshot?userId=resident_onairos_test&cohortId=dhun-oct-2026');
const getRes = await snapshotRoute(getReq);
const getJson = await getRes.json();
console.log('Retrieved Snapshot via GET:', {
  id: getJson.snapshot?.id,
  archetype: getJson.snapshot?.archetype,
  has_traits: !!getJson.snapshot?.positive_traits,
});

assert(getJson.success, 'GET snapshot must succeed');
if (getJson.snapshot) {
  assert.strictEqual(getJson.snapshot.archetype, 'Creative Explorer');
}
console.log('✅ Test 3 Passed: GET snapshot route functions cleanly.\n');

console.log('🎉 ALL ROUTE TESTS PASSED SUCCESSFULLY!');
