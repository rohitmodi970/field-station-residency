import type { EnergyBucket } from './types';

export const PERSONALIZATION_PROMPT_VERSION = 'dashboard-v1';

interface PromptContext {
  bucket: EnergyBucket;
  reflection?: string | null;
  recentSnippets: string[];
  firstName: string;
}

function bucketProfile(bucket: EnergyBucket): { title: string; description: string; guidance: string } {
  if (bucket === 'clarity') {
    return {
      title: 'Seeking clarity',
      description: 'I want to understand what I am feeling and where my thoughts are stuck.',
      guidance: 'Focus on helping the user observe patterns and mental clarity.',
    };
  }

  if (bucket === 'growth') {
    return {
      title: 'Ready for growth',
      description: 'I want momentum, forward movement, and a practical next step.',
      guidance: 'Focus on momentum, growth steps, and intentional progress.',
    };
  }

  return {
    title: 'Craving stability',
    description: 'I want calm, grounding, and emotional steadiness right now.',
    guidance: 'Focus on emotional grounding, calm routines, and inner balance.',
  };
}

const BASE_SYSTEM_PROMPT = `You are creating short, emotionally safe dashboard personalization copy for a journaling product.

Rules:
1. Warm, grounded, practical tone.
2. No guilt language, no manipulation, no diagnosis.
3. Keep content concise and actionable.
4. Do not claim facts not present in input context.
5. Return ONLY valid JSON that matches the exact schema requested.`;

export function buildDashboardPersonalizationPrompt(ctx: PromptContext): string {
  const profile = bucketProfile(ctx.bucket);

  return `${BASE_SYSTEM_PROMPT}

Bucket: ${ctx.bucket}
Bucket title: ${profile.title}
Bucket description: ${profile.description}
Bucket guidance: ${profile.guidance}
User first name: ${ctx.firstName}
Onboarding reflection: ${ctx.reflection || 'none'}
Recent snippets: ${ctx.recentSnippets.length ? ctx.recentSnippets.join(' | ') : 'none'}

Return JSON exactly like:
{
  "insight": {
    "headline": "string up to 80 chars",
    "insight": "string up to 220 chars",
    "actionLabel": "string up to 28 chars",
    "actionHint": "string up to 120 chars"
  },
  "variants": {
    "sectionLabels": {
      "writingRitual": "string up to 28 chars",
      "momentum": "string up to 28 chars",
      "execution": "string up to 28 chars",
      "memory": "string up to 28 chars",
      "explore": "string up to 28 chars"
    },
    "writingPrompt": {
      "text": "string up to 120 chars",
      "explanation": "string up to 220 chars",
      "ctaLabel": "string up to 24 chars"
    },
    "narrativePillars": [
      { "title": "string up to 20 chars", "desc": "string up to 120 chars" },
      { "title": "string up to 20 chars", "desc": "string up to 120 chars" },
      { "title": "string up to 20 chars", "desc": "string up to 120 chars" }
    ],
    "discoverChipLabels": ["string", "string", "string", "string", "string", "string", "string", "string"],
    "actionPanel": {
      "title": "string up to 24 chars",
      "emptyTitle": "string up to 40 chars",
      "emptyDescription": "string up to 140 chars"
    },
    "behavior": {
      "preferSpotlightV2": "boolean",
      "discoverChipOrder": [0,1,2,3,4,5,6,7]
    }
  }
}`;
}
