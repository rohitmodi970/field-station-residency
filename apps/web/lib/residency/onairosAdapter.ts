// apps/web/lib/residency/onairosAdapter.ts
// Robust adapter for real Onairos General Persona with format tolerance & privacy guardrails

import type { OnairosNormalizedContext } from './types';

export function normalizeOnairosContext(rawPayload?: any): OnairosNormalizedContext {
  if (!rawPayload || (typeof rawPayload === 'object' && Object.keys(rawPayload).length === 0)) {
    return {
      positive_traits: [],
      user_summary: '',
      top_traits_explanation: '',
      archetype: 'Resident',
      nudges: [],
      metadata: {
        total_items_analyzed: 0,
        items_sampled: 0,
        chunks_processed: 0,
        total_chunks: 0,
        coverage: '0%',
      },
      source_platforms: [],
      coverage_status: 'No data',
    };
  }

  const payload = rawPayload?.apiResponse || rawPayload?.data || rawPayload?.result || rawPayload;
  const analysis = payload?.traits ||
                   payload?.userTraits?.DataAnalysis?.personality_traits ||
                   payload?.InferenceResult?.traits?.personality_traits ||
                   payload?.DataAnalysis?.personality_traits || 
                   payload?.DataAnalysis || 
                   payload?.personality_traits || 
                   rawPayload?.traits ||
                   rawPayload?.userTraits?.DataAnalysis?.personality_traits ||
                   payload;
  const rawPositive = analysis?.positive_traits || analysis?.positive;

  const normalizedTraits: Array<{ trait: string; score: number; evidence?: string }> = [];

  if (rawPositive && typeof rawPositive === 'object') {
    if (Array.isArray(rawPositive)) {
      for (const item of rawPositive) {
        const name = String(item?.name || item?.trait || '').trim();
        const score = typeof item?.strength === 'number' ? item.strength : typeof item?.score === 'number' ? item.score : 75;
        if (name) {
          normalizedTraits.push({ trait: name, score: Math.max(0, Math.min(100, Math.round(score))), evidence: item?.evidence });
        }
      }
    } else {
      for (const [traitName, value] of Object.entries(rawPositive)) {
        if (typeof value === 'number') {
          normalizedTraits.push({
            trait: traitName.trim(),
            score: Math.max(0, Math.min(100, Math.round(value))),
          });
        } else if (value && typeof value === 'object') {
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
  }

  // Metadata & platforms from real payload
  const meta = payload?.userTraits?.metadata || rawPayload?.userTraits?.metadata || payload?.metadata || rawPayload?.metadata || analysis?.metadata || {};
  let platforms: string[] = [];
  if (meta?.platform_breakdown && typeof meta.platform_breakdown === 'object') {
    platforms = Object.keys(meta.platform_breakdown);
  } else if (Array.isArray(meta?.platforms_analyzed)) {
    platforms = meta.platforms_analyzed;
  } else if (Array.isArray(rawPayload?.connectedPlatforms)) {
    platforms = rawPayload.connectedPlatforms;
  } else if (Array.isArray(payload?.connectedPlatforms)) {
    platforms = payload.connectedPlatforms;
  } else if (Array.isArray(rawPayload?.platforms)) {
    platforms = rawPayload.platforms;
  } else if (Array.isArray(rawPayload?.connectedSources)) {
    platforms = rawPayload.connectedSources;
  }

  // Nudges extraction from real payload
  const rawNudges = analysis?.nudges || payload?.nudges || payload?.userProfile?.nudges || rawPayload?.userProfile?.nudges || [];
  const normalizedNudges = Array.isArray(rawNudges)
    ? rawNudges.map((n: any) => ({
        text: typeof n === 'string' ? n.trim() : n?.text ? String(n.text).trim() : String(n),
      })).filter((n) => !!n.text)
    : [];

  return {
    positive_traits: normalizedTraits,
    user_summary: String(analysis?.user_summary || analysis?.summary || payload?.userProfile?.user_summary || rawPayload?.userProfile?.user_summary || rawPayload?.user_summary || rawPayload?.narrative_reflection || '').trim(),
    top_traits_explanation: String(analysis?.top_traits_explanation || analysis?.explanation || payload?.userProfile?.top_traits_explanation || rawPayload?.userProfile?.top_traits_explanation || '').trim(),
    archetype: String(analysis?.archetype || payload?.userProfile?.archetype || rawPayload?.userProfile?.archetype || rawPayload?.archetype || 'Resident').trim(),
    nudges: normalizedNudges,
    metadata: {
      total_items_analyzed: typeof meta?.total_items_analyzed === 'number' ? meta.total_items_analyzed : undefined,
      items_sampled: typeof meta?.items_sampled === 'number' ? meta.items_sampled : undefined,
      chunks_processed: typeof meta?.chunks_processed === 'number' ? meta.chunks_processed : undefined,
      total_chunks: typeof meta?.total_chunks === 'number' ? meta.total_chunks : undefined,
      coverage: meta?.coverage ? String(meta.coverage) : undefined,
      platform_breakdown: meta?.platform_breakdown || {},
    },
    source_platforms: platforms,
    coverage_status: meta?.coverage ? String(meta.coverage) : 'live',
  };
}
