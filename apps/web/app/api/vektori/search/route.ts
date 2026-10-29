import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { searchVektoriMemory } from '@/utils/vektori/client';
import { buildSearchPlan, scoreTextMatch, scoreVektoriResult } from '@/utils/vektori/query.js';
import {
  collectCandidateMemories,
  mergeSearchCandidates,
  type ParsedJournalMemory,
} from '@/utils/vektori/parseJournalMemory';
import { repairVektoriIndex } from '@/utils/vektori/repairMemory';
import { buildFallbackSynthesis, synthesizeMemoryResults } from '@/utils/vektori/synthesizeMemory';

type ClientJournalInput = {
  journalId: string;
  title?: string;
  content?: string;
  mood?: string;
  entryDate?: string;
  broadFallback?: boolean;
};

const MIN_VEKTORI_RELEVANCE = 2;

function parseClientCandidates(journals: unknown): Array<ParsedJournalMemory & { broadFallback?: boolean }> {
  if (!Array.isArray(journals)) return [];

  return journals
    .map((journal): (ParsedJournalMemory & { broadFallback?: boolean }) | null => {
      if (!journal || typeof journal !== 'object') return null;
      const item = journal as ClientJournalInput;
      const title = String(item.title || '').trim();
      const content = String(item.content || '').trim();
      if (!title && !content) return null;

      return {
        journalId: String(item.journalId || 'unknown'),
        title: title || 'Untitled entry',
        content,
        entryDate: item.entryDate ? String(item.entryDate) : undefined,
        mood: item.mood ? String(item.mood) : undefined,
        broadFallback: Boolean(item.broadFallback),
      } as ParsedJournalMemory & { broadFallback?: boolean };
    })
    .filter((item): item is ParsedJournalMemory & { broadFallback?: boolean } => item !== null);
}

function hasVektoriHits(result: Awaited<ReturnType<typeof searchVektoriMemory>>) {
  if (!result) return false;
  return result.facts.length + result.episodes.length + result.sentences.length > 0;
}

function bestLocalScore(candidates: ParsedJournalMemory[], baseTerms: string[]) {
  let best = 0;
  for (const candidate of candidates) {
    best = Math.max(best, scoreTextMatch(`${candidate.title}\n${candidate.content}`, baseTerms));
  }
  return best;
}

async function searchBestVektoriMatch(params: {
  userId: string;
  searchPlan: ReturnType<typeof buildSearchPlan>;
  depth: 'l0' | 'l1' | 'l2';
  contextWindow: number;
}) {
  let bestResult: Awaited<ReturnType<typeof searchVektoriMemory>> = null;
  let bestScore = 0;
  let queryUsed = params.searchPlan.primary;

  for (const candidateQuery of params.searchPlan.searchQueries) {
    const attempt = await searchVektoriMemory({
      userId: params.userId,
      query: candidateQuery,
      depth: params.depth,
      contextWindow: params.contextWindow,
    });

    const score = scoreVektoriResult(attempt, params.searchPlan.baseTerms);
    if (score > bestScore) {
      bestScore = score;
      bestResult = attempt;
      queryUsed = candidateQuery;
    }
  }

  return { result: bestResult, bestScore, queryUsed };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawQuery = String(body.query || '').trim();

    if (!rawQuery) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const searchPlan = buildSearchPlan(rawQuery);
    const depth = body.depth === 'l0' || body.depth === 'l2' ? body.depth : 'l1';
    const clientCandidates = parseClientCandidates(body.journals);
    const contextWindow = typeof body.contextWindow === 'number' ? body.contextWindow : 2;
    const focusedClientCandidates = clientCandidates.filter((candidate) => !candidate.broadFallback);

    let { result, bestScore, queryUsed } = await searchBestVektoriMatch({
      userId: user.id,
      searchPlan,
      depth,
      contextWindow,
    });

    let memoryRepaired = false;
    let repairedCount = 0;

    const localScore = bestLocalScore(focusedClientCandidates, searchPlan.baseTerms);
    const shouldRepair =
      focusedClientCandidates.length > 0 &&
      (localScore >= MIN_VEKTORI_RELEVANCE || !hasVektoriHits(result) || bestScore < MIN_VEKTORI_RELEVANCE);

    if (shouldRepair) {
      repairedCount = await repairVektoriIndex(user.id, focusedClientCandidates);
      if (repairedCount > 0) {
        memoryRepaired = true;
        const repairedSearch = await searchBestVektoriMatch({
          userId: user.id,
          searchPlan,
          depth,
          contextWindow,
        });
        if (repairedSearch.bestScore >= bestScore) {
          result = repairedSearch.result;
          bestScore = repairedSearch.bestScore;
          queryUsed = repairedSearch.queryUsed;
        }
      }
    }

    const vektoriItems = result
      ? [...result.facts, ...result.episodes, ...result.sentences]
      : [];

    const vektoriCandidates = collectCandidateMemories(vektoriItems, 12);
    const mergedCandidates = mergeSearchCandidates(
      vektoriCandidates,
      clientCandidates,
      searchPlan.baseTerms,
      10
    );
    const usedVektori = vektoriCandidates.length > 0;

    let synthesized =
      (await synthesizeMemoryResults({
        query: rawQuery,
        rankedCandidates: mergedCandidates,
      })) ||
      buildFallbackSynthesis(rawQuery, mergedCandidates);

    if (synthesized.memories.length === 0 && mergedCandidates.length > 0) {
      const strongLocal = mergeSearchCandidates([], focusedClientCandidates, searchPlan.baseTerms, 5);
      if (strongLocal.length > 0) {
        synthesized =
          (await synthesizeMemoryResults({
            query: rawQuery,
            rankedCandidates: strongLocal,
          })) || buildFallbackSynthesis(rawQuery, strongLocal);
      }
    }

    const total = synthesized.memories.length;
    const source =
      usedVektori && focusedClientCandidates.length > 0
        ? 'vektori'
        : usedVektori
          ? 'vektori'
          : clientCandidates.length > 0
            ? 'local'
            : 'none';

    return NextResponse.json({
      ok: total > 0 || synthesized.answer.length > 0,
      source,
      queryUsed,
      searchTerms: searchPlan.expandedTerms,
      usedBroadFallback: clientCandidates.some((candidate) => candidate.broadFallback),
      answer: synthesized.answer,
      memories: synthesized.memories,
      synthesized: Boolean(process.env.ANTHROPIC_API_KEY),
      memoryRepaired,
      repairedCount,
      usedClientFallback: !usedVektori && clientCandidates.length > 0,
      model: synthesized.model,
      facts: result?.facts || [],
      episodes: result?.episodes || [],
      sentences: result?.sentences || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
