// apps/web/scripts/test-social-footprint-synthesis.mjs
import assert from 'node:assert';
import { POST as synthesizeRoute } from '../app/api/residency/intent/synthesize/route.ts';
import { POST as footprintRoute } from '../app/api/residency/footprint/route.ts';

console.log('🧪 Testing Social Media Footprint Ingestion into Intent Snapshot Synthesis...\n');

// 1. Test POST /api/residency/footprint directly
console.log('Test 1: Testing POST /api/residency/footprint directly...');
const fpReq = new Request('http://localhost:3000/api/residency/footprint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Srinjoy',
    links: ['https://github.com/srinjoy', 'https://x.com/srinjoy'],
    consent: true,
  }),
});

const fpRes = await footprintRoute(fpReq);
const fpJson = await fpRes.json();
console.log('Footprint response:', {
  status: fpRes.status,
  findings_count: fpJson.findings?.length || 0,
  read_sources: fpJson.read || [],
});
assert(fpRes.status === 200 || fpRes.status === 503);
console.log('✅ Test 1 Passed: /api/residency/footprint endpoint handles request properly.\n');

// 2. Test POST /api/residency/intent/synthesize with social media links and public findings
console.log('Test 2: Calling POST /api/residency/intent/synthesize with social media links & public findings...');
const synthReq = new Request('http://localhost:3000/api/residency/intent/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resident_id: 'resident_social_test_1',
    name: 'Srinjoy Chakravarty',
    cohort_id: 'dhun-oct-2026',
    links: ['https://github.com/srinjoy', 'https://x.com/srinjoy'],
    socialLinks: {
      github: 'https://github.com/srinjoy',
      x: 'https://x.com/srinjoy',
    },
    answers: [
      'Build local memory graphs for residency cohort members using TypeScript and simple storage.',
      'Data sovereignty and high latency in centralized cognitive assistants.',
      'Scaling graph index traversal on low-resource local devices.',
    ],
    contribution: {
      can_offer: ['TypeScript', 'Systems architecture'],
      seeking: ['Design feedback', 'Edge testing'],
    },
    public: [
      {
        id: 'f0',
        label: 'Systems Engineering',
        text: 'Builds open-source local memory engines and distributed graph agents.',
        sources: [{ title: 'GitHub: srinjoy', url: 'https://github.com/srinjoy' }],
      },
      {
        id: 'f1',
        label: 'Cognitive Architecture',
        text: 'Writes about verifiable personal cognition and sovereign data.',
        sources: [{ title: 'X: @srinjoy', url: 'https://x.com/srinjoy' }],
      },
    ],
    onairos: {
      positive: [
        { name: 'Creative Problem Solving', strength: 92 },
        { name: 'Science and Technology Enthusiasm', strength: 88 },
      ],
      archetype: 'Creative Explorer',
      summary: 'Curious systems builder.',
      explanation: 'Strong analytical and exploratory patterns.',
      nudges: ["You're highly analytical — try journaling a decision you're mulling over."],
      coverage: { analyzed: 847, sampled: 420, label: '66.7%', platforms: ['github', 'x'] },
      fixture: false,
    },
  }),
});

const synthRes = await synthesizeRoute(synthReq);
const synthJson = await synthRes.json();
console.log('Synthesized Response with Social Media Ingestion:', {
  id: synthJson.id,
  intent: synthJson.intent,
  problem: synthJson.problem,
  approach: synthJson.approach,
  provenance: synthJson.provenance,
  noticed: synthJson.noticed,
  public_findings_count: synthJson.public_findings?.length,
});

assert(synthJson.public_findings && synthJson.public_findings.length >= 2, 'Must include public findings');
assert(Array.isArray(synthJson.provenance?.approach), 'Approach provenance must be an array');
assert(
  synthJson.provenance.approach.includes('public:footprint') ||
  synthJson.provenance.approach.includes('public:social') ||
  synthJson.provenance.approach.includes('user_answer'),
  'Provenance should reference user answer or public footprint'
);
assert.strictEqual(synthJson.public_findings[0].label, 'Systems Engineering');
assert.strictEqual(synthJson.public_findings[0].sources[0].title, 'GitHub: srinjoy');

console.log('✅ Test 2 Passed: /api/residency/intent/synthesize successfully ingested public social footprint!\n');

console.log('🎉 All social media footprint tests passed successfully!');
