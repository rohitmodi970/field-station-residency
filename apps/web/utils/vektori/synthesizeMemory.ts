import {
  buildCandidateContext,
  collectCandidateMemories,
  type ParsedJournalMemory,
} from './parseJournalMemory';

export type SynthesizedMemoryItem = {
  journalId: string;
  title: string;
  date?: string;
  summary: string;
  relevance: number;
  highlight?: string;
};

export type SynthesizedMemoryResponse = {
  answer: string;
  memories: SynthesizedMemoryItem[];
  model?: string;
};

type RawSearchItems = Array<{ text: string; score?: number }>;

function extractJsonObject(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function synthesizeMemoryResults(params: {
  query: string;
  facts?: RawSearchItems;
  episodes?: RawSearchItems;
  sentences?: RawSearchItems;
  directCandidates?: ParsedJournalMemory[];
  rankedCandidates?: ParsedJournalMemory[];
}): Promise<SynthesizedMemoryResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const candidates =
    params.rankedCandidates && params.rankedCandidates.length > 0
      ? params.rankedCandidates.slice(0, 10)
      : (() => {
          const fromVektori = collectCandidateMemories(
            [...(params.facts || []), ...(params.episodes || []), ...(params.sentences || [])],
            10
          );

          return fromVektori.length > 0
            ? fromVektori
            : (params.directCandidates || []).slice(0, 10);
        })();

  if (candidates.length === 0) {
    return {
      answer:
        'I could not find journal entries that answer this question yet. Try syncing your journals to memory, or ask in a different way — for example, "What medications do I take?" instead of only a single keyword.',
      memories: [],
    };
  }

  const candidateContext = buildCandidateContext(candidates);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 1200,
      system: `You are Force Memory, a precise journal memory assistant.
You receive candidate journal excerpts retrieved from a user's private journal history.
Your job is to answer the user's question and return ONLY the journal entries that truly match the intent.

Rules:
- Understand intent, not just exact keywords. Example: "Do I have allergies?" should match entries mentioning allergy medicine, allergic reactions, or antihistamines even if the word "allergies" is not present.
- Ignore entries that only match by accidental word overlap (example: "med" inside "intermediate").
- Prefer entries whose title or content clearly relate to the user's question.
- Write concise, human summaries — never dump raw journal text.
- If nothing is truly relevant, say so honestly in plain language.
- Return valid JSON only.`,
      messages: [
        {
          role: 'user',
          content: `User question: ${params.query}

Candidate journal excerpts:
${candidateContext}

Return JSON with this exact shape:
{
  "answer": "2-4 sentence direct answer to the user's question",
  "memories": [
    {
      "journalId": "string",
      "title": "string",
      "date": "string or empty",
      "summary": "1-2 sentence summary of why this entry matters for the question",
      "relevance": 0-100,
      "highlight": "short quoted phrase from the entry if useful"
    }
  ]
}

Include at most 5 memories. Only include genuinely relevant entries.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.warn('[vektori/synthesize] Anthropic request failed:', response.status);
    return null;
  }

  const data = await response.json();
  const textBlock = data?.content?.find((block: { type?: string }) => block.type === 'text');
  const parsed = extractJsonObject(String(textBlock?.text || ''));

  if (!parsed || typeof parsed.answer !== 'string' || !Array.isArray(parsed.memories)) {
    return null;
  }

  const memories: SynthesizedMemoryItem[] = parsed.memories
    .map((item: Record<string, unknown>) => ({
      journalId: String(item.journalId || ''),
      title: String(item.title || 'Journal entry'),
      date: item.date ? String(item.date) : undefined,
      summary: String(item.summary || ''),
      relevance: typeof item.relevance === 'number' ? item.relevance : 0,
      highlight: item.highlight ? String(item.highlight) : undefined,
    }))
    .filter((item: SynthesizedMemoryItem) => item.summary.trim().length > 0)
    .slice(0, 5);

  return {
    answer: parsed.answer.trim(),
    memories,
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  };
}

export function buildFallbackSynthesis(
  query: string,
  candidates: ParsedJournalMemory[]
): SynthesizedMemoryResponse {
  const top = candidates.slice(0, 3);

  return {
    answer:
      top.length > 0
        ? `I found ${top.length} indexed ${top.length === 1 ? 'entry' : 'entries'} that may relate to "${query}".`
        : `No indexed memories matched "${query}" yet.`,
    memories: top.map((candidate) => ({
      journalId: candidate.journalId,
      title: candidate.title,
      date: candidate.entryDate,
      summary: candidate.content.slice(0, 180) + (candidate.content.length > 180 ? '…' : ''),
      relevance: 60,
    })),
  };
}
