import type {
  EnergyBucket,
  PersonalizedActionPanel,
  PersonalizedBehaviorDirectives,
  PersonalizedDashboardPayload,
  PersonalizedDashboardVariants,
  PersonalizedInsight,
  PersonalizedPillar,
  PersonalizedSectionLabels,
  PersonalizedWritingPrompt,
} from './types';
import {
  PERSONALIZATION_PROMPT_VERSION,
  buildDashboardPersonalizationPrompt,
} from './dashboard-prompts';
import { executeLLMRequest } from '@/lib/llm/llmService';

function fallbackSectionLabels(bucket: EnergyBucket): PersonalizedSectionLabels {
  if (bucket === 'clarity') {
    return {
      writingRitual: 'Clarity Practice',
      momentum: 'Patterns + Signal',
      execution: 'Focused Actions',
      memory: 'Memory Stream',
      explore: 'Explore Clarity Paths',
    };
  }

  if (bucket === 'growth') {
    return {
      writingRitual: 'Growth Writing Ritual',
      momentum: 'Momentum + Intelligence',
      execution: 'Execution Layer',
      memory: 'Progress Memory Stream',
      explore: 'Explore Growth Paths',
    };
  }

  return {
    writingRitual: 'Grounding Writing Ritual',
    momentum: 'Stability + Signal',
    execution: 'Gentle Actions',
    memory: 'Calm Memory Stream',
    explore: 'Explore Stability Paths',
  };
}

export function fallbackNarrativePillars(bucket: EnergyBucket): PersonalizedPillar[] {
  if (bucket === 'clarity') {
    return [
      { title: 'Observe', desc: 'Notice what feels true before trying to fix it.' },
      { title: 'Name', desc: 'Put your inner noise into clear language and patterns.' },
      { title: 'Refine', desc: 'Take one precise next step that reduces confusion.' },
    ];
  }

  if (bucket === 'growth') {
    return [
      { title: 'Capture', desc: 'Record your wins, lessons, and friction honestly.' },
      { title: 'Build', desc: 'Turn insight into one practical move for today.' },
      { title: 'Compound', desc: 'Repeat small actions until they become momentum.' },
    ];
  }

  return [
    { title: 'Settle', desc: 'Slow down enough to feel what your body is carrying.' },
    { title: 'Ground', desc: 'Return to basics that make your day emotionally safer.' },
    { title: 'Balance', desc: 'Choose one supportive action that keeps you steady.' },
  ];
}

function fallbackWritingPrompt(bucket: EnergyBucket): PersonalizedWritingPrompt {
  if (bucket === 'clarity') {
    return {
      text: 'What thought loop is asking for clarity today?',
      explanation: 'Write what feels confusing, then name one thing that is actually clear.',
      ctaLabel: 'Write for clarity',
    };
  }

  if (bucket === 'growth') {
    return {
      text: 'What is one meaningful step you can take today?',
      explanation: 'Capture one recent win and one practical action for your next 24 hours.',
      ctaLabel: 'Write for growth',
    };
  }

  return {
    text: 'What would help you feel more grounded right now?',
    explanation: 'Describe your current state gently, then name one calming step you can take today.',
    ctaLabel: 'Write to ground',
  };
}

function fallbackActionPanel(bucket: EnergyBucket): PersonalizedActionPanel {
  if (bucket === 'clarity') {
    return {
      title: 'Focused Actions',
      emptyTitle: 'No focused actions yet',
      emptyDescription: 'Analyze a journal entry to surface one clear next step.',
    };
  }

  if (bucket === 'growth') {
    return {
      title: 'Growth Actions',
      emptyTitle: 'No growth actions yet',
      emptyDescription: 'Analyze a journal entry to generate practical momentum actions.',
    };
  }

  return {
    title: 'Grounding Actions',
    emptyTitle: 'No grounding actions yet',
    emptyDescription: 'Analyze a journal entry to get a gentle stabilizing action.',
  };
}

function fallbackChipLabels(bucket: EnergyBucket): string[] {
  if (bucket === 'clarity') {
    return ['Trend Clarity', 'Deep Insights', 'Journal Library', 'Write Entry', 'Gallery', 'AI Assistant', 'To-Do', 'Entry Analysis'];
  }

  if (bucket === 'growth') {
    return ['Growth Trends', 'Deep Insights', 'Journal Library', 'Write Entry', 'Gallery', 'AI Assistant', 'To-Do', 'Entry Analysis'];
  }

  return ['Calm Trends', 'Deep Insights', 'Journal Library', 'Write Entry', 'Gallery', 'AI Assistant', 'To-Do', 'Entry Analysis'];
}

function fallbackBehavior(bucket: EnergyBucket): PersonalizedBehaviorDirectives {
  return {
    preferSpotlightV2: bucket !== 'stability',
    discoverChipOrder: bucket === 'growth' ? [3, 0, 6, 7, 1, 5, 2, 4] : [0, 1, 3, 2, 7, 6, 5, 4],
  };
}

function fallbackVariantsForBucket(bucket: EnergyBucket): PersonalizedDashboardVariants {
  return {
    sectionLabels: fallbackSectionLabels(bucket),
    writingPrompt: fallbackWritingPrompt(bucket),
    narrativePillars: fallbackNarrativePillars(bucket),
    discoverChipLabels: fallbackChipLabels(bucket),
    actionPanel: fallbackActionPanel(bucket),
    behavior: fallbackBehavior(bucket),
  };
}

function normalizeDiscoverOrder(value: unknown): number[] {
  if (!Array.isArray(value)) return [0, 1, 2, 3, 4, 5, 6, 7];
  const valid = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < 8);

  const unique = Array.from(new Set(valid));
  if (unique.length !== 8) return [0, 1, 2, 3, 4, 5, 6, 7];
  return unique;
}

function parseAndSanitizeVariants(raw: unknown, bucket: EnergyBucket): PersonalizedDashboardVariants {
  const fallback = fallbackVariantsForBucket(bucket);
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const sectionLabelsRaw = source.sectionLabels as Record<string, unknown> | undefined;
  const writingPromptRaw = source.writingPrompt as Record<string, unknown> | undefined;
  const actionPanelRaw = source.actionPanel as Record<string, unknown> | undefined;
  const behaviorRaw = source.behavior as Record<string, unknown> | undefined;
  const pillarsRaw = Array.isArray(source.narrativePillars) ? source.narrativePillars : [];
  const chipsRaw = Array.isArray(source.discoverChipLabels) ? source.discoverChipLabels : [];

  return {
    sectionLabels: {
      writingRitual: String(sectionLabelsRaw?.writingRitual || fallback.sectionLabels.writingRitual).slice(0, 28),
      momentum: String(sectionLabelsRaw?.momentum || fallback.sectionLabels.momentum).slice(0, 28),
      execution: String(sectionLabelsRaw?.execution || fallback.sectionLabels.execution).slice(0, 28),
      memory: String(sectionLabelsRaw?.memory || fallback.sectionLabels.memory).slice(0, 28),
      explore: String(sectionLabelsRaw?.explore || fallback.sectionLabels.explore).slice(0, 28),
    },
    writingPrompt: {
      text: String(writingPromptRaw?.text || fallback.writingPrompt.text).slice(0, 120),
      explanation: String(writingPromptRaw?.explanation || fallback.writingPrompt.explanation).slice(0, 220),
      ctaLabel: String(writingPromptRaw?.ctaLabel || fallback.writingPrompt.ctaLabel).slice(0, 24),
    },
    narrativePillars: [0, 1, 2].map((index) => {
      const entry = pillarsRaw[index] as Record<string, unknown> | undefined;
      const fallbackEntry = fallback.narrativePillars[index] || { title: 'Focus', desc: 'Take one meaningful next step.' };
      return {
        title: String(entry?.title || fallbackEntry.title).slice(0, 20),
        desc: String(entry?.desc || fallbackEntry.desc).slice(0, 120),
      };
    }),
    discoverChipLabels: [0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
      const label = chipsRaw[index];
      return String(label || fallback.discoverChipLabels[index]).slice(0, 24);
    }),
    actionPanel: {
      title: String(actionPanelRaw?.title || fallback.actionPanel.title).slice(0, 24),
      emptyTitle: String(actionPanelRaw?.emptyTitle || fallback.actionPanel.emptyTitle).slice(0, 40),
      emptyDescription: String(actionPanelRaw?.emptyDescription || fallback.actionPanel.emptyDescription).slice(0, 140),
    },
    behavior: {
      preferSpotlightV2: Boolean(behaviorRaw?.preferSpotlightV2 ?? fallback.behavior.preferSpotlightV2),
      discoverChipOrder: normalizeDiscoverOrder(behaviorRaw?.discoverChipOrder ?? fallback.behavior.discoverChipOrder),
    },
  };
}

function parseLLMResponse(rawText: string, bucket: EnergyBucket): { insight: PersonalizedInsight; variants: PersonalizedDashboardVariants } | null {
  try {
    let jsonStr = rawText.trim();
    const blockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (blockMatch && blockMatch[1]) jsonStr = blockMatch[1].trim();

    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonStr = objectMatch[0];

    const parsed = JSON.parse(jsonStr);
    const insightBlock = parsed?.insight;
    if (!insightBlock?.headline || !insightBlock?.insight || !insightBlock?.actionLabel || !insightBlock?.actionHint) {
      return null;
    }

    return {
      insight: {
        headline: String(insightBlock.headline).slice(0, 90),
        insight: String(insightBlock.insight).slice(0, 280),
        actionLabel: String(insightBlock.actionLabel).slice(0, 40),
        actionHint: String(insightBlock.actionHint).slice(0, 140),
      },
      variants: parseAndSanitizeVariants(parsed?.variants, bucket),
    };
  } catch {
    return null;
  }
}

export async function generateDashboardPersonalization(params: {
  requestUrl: string;
  bucket: EnergyBucket;
  reflection?: string | null;
  firstName: string;
  snippets: string[];
}): Promise<PersonalizedDashboardPayload | null> {
  const prompt = buildDashboardPersonalizationPrompt({
    bucket: params.bucket,
    reflection: params.reflection,
    recentSnippets: params.snippets,
    firstName: params.firstName,
  });
  const generatedAt = Date.now();
  const retryDelaysMs = [400, 1200];

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const requestPersonalization = async (): Promise<{ insight: PersonalizedInsight; variants: PersonalizedDashboardVariants } | null> => {
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        const json = await executeLLMRequest({
          prompt,
          provider: 'claude',
          options: { temperature: 0.6 },
        });

        if (!json?.text || json?.error) {
          throw new Error(json?.error || 'Personalization LLM returned no text');
        }

        const parsed = parseLLMResponse(json.text, params.bucket);
        if (!parsed) {
          throw new Error('Personalization LLM response was invalid');
        }

        return parsed;
      } catch {
        const delay = retryDelaysMs[attempt];
        if (delay !== undefined) {
          await wait(delay);
          continue;
        }
        return null;
      }
    }

    return null;
  };

  const parsed = await requestPersonalization();
  if (!parsed) return null;

  return {
    bucket: params.bucket,
    source: 'llm',
    promptVersion: PERSONALIZATION_PROMPT_VERSION,
    insight: parsed.insight,
    variants: parsed.variants,
    generatedAt,
  };
}
