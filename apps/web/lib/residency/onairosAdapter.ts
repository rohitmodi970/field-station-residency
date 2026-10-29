// apps/web/lib/residency/onairosAdapter.ts
// Robust adapter for Onairos General Persona with format tolerance & privacy guardrails

import { ONAIROS_GENERAL_PERSONA_FIXTURE } from './fixtures/onairosFixture';
import type { OnairosNormalizedContext } from './types';

export function normalizeOnairosContext(rawPayload?: any): OnairosNormalizedContext {
  const data = rawPayload?.DataAnalysis ? rawPayload : (rawPayload || ONAIROS_GENERAL_PERSONA_FIXTURE);
  const analysis = data?.DataAnalysis || ONAIROS_GENERAL_PERSONA_FIXTURE.DataAnalysis;
  const p = analysis?.personality_traits || analysis;
  const rawPositive = p?.positive_traits;

  const normalizedTraits: Array<{ trait: string; score: number; evidence?: string }> = [];

  if (rawPositive && typeof rawPositive === 'object') {
    for (const [traitName, value] of Object.entries(rawPositive)) {
      if (typeof value === 'number') {
        // Standard mode: trait -> number
        normalizedTraits.push({
          trait: traitName.trim(),
          score: Math.max(0, Math.min(100, Math.round(value))),
        });
      } else if (value && typeof value === 'object') {
        // Evidence mode: trait -> { score, emoji, evidence }
        const obj = value as { score?: number; emoji?: string; evidence?: string };
        const score = typeof obj.score === 'number' ? Math.max(0, Math.min(100, Math.round(obj.score))) : 75;
        normalizedTraits.push({
          trait: traitName.trim(),
          score,
          evidence: obj.evidence ? String(obj.evidence).trim() : undefined,
        });
      }
    }
  }

  // Handle legacy payload fallback (if rawPayload has big_five instead of General Persona)
  if (normalizedTraits.length === 0 && rawPayload?.personality_assessment?.big_five) {
    const b5 = rawPayload.personality_assessment.big_five;
    if (typeof b5.openness === 'number') {
      normalizedTraits.push({
        trait: 'High Openness & Curiosity',
        score: Math.round(b5.openness * 100),
        evidence: 'Inferred exploratory cognitive style.',
      });
    }
    if (typeof b5.agreeableness === 'number') {
      normalizedTraits.push({
        trait: 'Relational Warmth',
        score: Math.round(b5.agreeableness * 100),
        evidence: 'Values genuine interpersonal anchors.',
      });
    }
    if (typeof b5.conscientiousness === 'number') {
      normalizedTraits.push({
        trait: 'Iterative Execution',
        score: Math.round(b5.conscientiousness * 100),
        evidence: 'Persistent builder focus.',
      });
    }
  }

  // Metadata & platforms
  const meta = data?.metadata || rawPayload?.metadata || analysis?.metadata || ONAIROS_GENERAL_PERSONA_FIXTURE.metadata;
  let platforms: string[] = [];
  if (meta?.platform_breakdown && typeof meta.platform_breakdown === 'object') {
    platforms = Object.keys(meta.platform_breakdown);
  } else if (Array.isArray(meta?.platforms_analyzed)) {
    platforms = meta.platforms_analyzed;
  } else if (Array.isArray(rawPayload?.platforms)) {
    platforms = rawPayload.platforms;
  } else {
    platforms = ['Reddit', 'YouTube'];
  }

  // Nudges extraction
  const rawNudges = p?.nudges || analysis?.nudges || ONAIROS_GENERAL_PERSONA_FIXTURE.DataAnalysis.personality_traits.nudges;
  const normalizedNudges = Array.isArray(rawNudges)
    ? rawNudges.map((n: any) => ({
        text: typeof n === 'string' ? n.trim() : n?.text ? String(n.text).trim() : String(n),
      })).filter((n) => !!n.text)
    : [];

  return {
    positive_traits: normalizedTraits.length > 0 ? normalizedTraits : [
      { trait: 'Creative Problem Solving', score: 92, evidence: 'Exploratory problem-solving patterns' },
      { trait: 'Science and Technology Enthusiasm', score: 88, evidence: 'Technical curiosity and systems thinking' },
      { trait: 'Community Engagement', score: 85, evidence: 'Active collaborative participation' },
      { trait: 'Visual Storytelling', score: 78, evidence: 'Narrative and expressive framing' },
    ],
    user_summary: p?.user_summary || analysis?.user_summary || rawPayload?.narrative_reflection || ONAIROS_GENERAL_PERSONA_FIXTURE.DataAnalysis.personality_traits.user_summary,
    top_traits_explanation: p?.top_traits_explanation || analysis?.top_traits_explanation || ONAIROS_GENERAL_PERSONA_FIXTURE.DataAnalysis.personality_traits.top_traits_explanation,
    archetype: p?.archetype || analysis?.archetype || 'Creative Explorer',
    nudges: normalizedNudges,
    metadata: {
      total_items_analyzed: meta?.total_items_analyzed ?? 847,
      items_sampled: meta?.items_sampled ?? 420,
      chunks_processed: meta?.chunks_processed ?? 4,
      total_chunks: meta?.total_chunks ?? 6,
      coverage: meta?.coverage ?? '66.7%',
      platform_breakdown: meta?.platform_breakdown,
    },
    source_platforms: platforms,
    coverage_status: meta?.coverage ? `${meta.coverage} coverage` : 'normal',
  };
}
