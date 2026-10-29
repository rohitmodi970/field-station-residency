import type { SpotlightInsight } from '../types';
import { executeLLMRequest } from '@/lib/llm/llmService';

type AIProvider = 'claude' | 'gemini' | 'openai';

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

interface RewriteOptions {
  useAI?: boolean;
  aiProvider?: AIProvider;
  timeoutMs?: number;
}

interface RewriteContext {
  segment: 'waitlist' | 'journal';
  facts: string[];
}

interface RewritePayload {
  title: string;
  body: string;
  actionLabel?: string;
}

interface LLMResponse {
  text?: string;
  error?: string;
}

export function sanitizeInsightCopy(insight: SpotlightInsight): SpotlightInsight {
  return {
    ...insight,
    title: cleanCopy(insight.title),
    body: cleanCopy(insight.body),
    actionLabel: insight.actionLabel ? cleanCopy(insight.actionLabel) : insight.actionLabel,
    icon: sanitizeIcon(insight.icon),
  };
}

export async function maybeRewriteInsightsWithLLM(
  insights: SpotlightInsight[],
  options: RewriteOptions,
  context: RewriteContext
): Promise<SpotlightInsight[]> {
  const sanitized = insights.map(sanitizeInsightCopy);

  if (!options.useAI) {
    return sanitized;
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return sanitized;
  }

  const rewritten = await Promise.all(
    sanitized.map(async (insight) => {
      try {
        const rewrittenCopy = await rewriteSingleInsight(insight, {
          provider: options.aiProvider ?? 'claude',
          timeoutMs: options.timeoutMs ?? 1200,
          baseUrl,
          context,
        });

        if (!rewrittenCopy) {
          return insight;
        }

        return sanitizeInsightCopy({
          ...insight,
          title: rewrittenCopy.title || insight.title,
          body: rewrittenCopy.body || insight.body,
          actionLabel: rewrittenCopy.actionLabel || insight.actionLabel,
        });
      } catch {
        return insight;
      }
    })
  );

  return rewritten;
}

function cleanCopy(input: string): string {
  return input
    .replace(EMOJI_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function sanitizeIcon(icon?: string): string | undefined {
  if (!icon) return icon;
  const cleaned = icon.trim();
  return cleaned || undefined;
}

function getBaseUrl(): string | null {
  const envBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;

  return envBaseUrl || null;
}

async function rewriteSingleInsight(
  insight: SpotlightInsight,
  options: {
    provider: AIProvider;
    timeoutMs: number;
    baseUrl: string;
    context: RewriteContext;
  }
): Promise<RewritePayload | null> {
  const prompt = buildRewritePrompt(insight, options.context);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const payload = await executeLLMRequest({
      provider: options.provider,
      prompt,
      options: {
        temperature: 0.45,
        topP: 0.9,
      },
    });

    if (!payload.text || payload.error) {
      return null;
    }

    return parseRewriteResponse(payload.text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildRewritePrompt(insight: SpotlightInsight, context: RewriteContext): string {
  return [
    'Rewrite this product insight so it sounds natural and specific to a real person.',
    'Hard constraints:',
    '- Return JSON only: {"title":"...","body":"...","actionLabel":"..."}',
    '- Keep meaning and intent exactly the same.',
    '- Do not use emojis, markdown, hashtags, or exclamation-heavy language.',
    '- Do not mention AI, model, algorithm, or analysis engine.',
    '- Keep title <= 80 chars, body <= 220 chars, actionLabel <= 28 chars.',
    '- Keep plain, warm, grounded language.',
    `Segment: ${context.segment}`,
    `Facts: ${context.facts.join(' | ')}`,
    `Original title: ${insight.title}`,
    `Original body: ${insight.body}`,
    `Original actionLabel: ${insight.actionLabel || ''}`,
  ].join('\n');
}

function parseRewriteResponse(text: string): RewritePayload | null {
  let jsonText = text.trim();

  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    jsonText = fenced[1].trim();
  }

  const objectMatch = jsonText.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonText = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<RewritePayload>;

    const title = typeof parsed.title === 'string' ? cleanCopy(parsed.title).slice(0, 80) : '';
    const body = typeof parsed.body === 'string' ? cleanCopy(parsed.body).slice(0, 220) : '';
    const actionLabel = typeof parsed.actionLabel === 'string'
      ? cleanCopy(parsed.actionLabel).slice(0, 28)
      : undefined;

    if (!title || !body) {
      return null;
    }

    return { title, body, actionLabel };
  } catch {
    return null;
  }
}
