'use client';

import { useState } from 'react';
import { Brain, Loader2, Search, Sparkles } from 'lucide-react';
import { findLocalJournalCandidates } from '@/utils/vektori/localJournalSearch';

type SynthesizedMemory = {
  journalId: string;
  title: string;
  date?: string;
  summary: string;
  relevance: number;
  highlight?: string;
};

type SearchResult = {
  ok: boolean;
  source: 'vektori' | 'local' | 'none';
  queryUsed?: string;
  searchTerms?: string[];
  answer?: string;
  memories?: SynthesizedMemory[];
  synthesized?: boolean;
  memoryRepaired?: boolean;
  repairedCount?: number;
  usedClientFallback?: boolean;
  usedBroadFallback?: boolean;
};

type Props = {
  isDarkMode: boolean;
  accentColor: string;
  compact?: boolean;
  memoryReady?: boolean;
  indexedCount?: number;
  totalEntries?: number;
};

const exampleQueries = [
  'Do I have allergies?',
  'med timings',
  'Goals and habits',
];

const FALLBACK_ACCENT = '#4A7DA5';

export function VektoriMemoryExplorer({
  isDarkMode,
  accentColor,
  compact = false,
  memoryReady = false,
  indexedCount = 0,
  totalEntries = 0,
}: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const accent = accentColor?.trim() || FALLBACK_ACCENT;

  const runSearch = async (searchQuery?: string) => {
    const trimmed = (searchQuery ?? query).trim();
    if (!trimmed || loading) return;

    setQuery(trimmed);
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const localCandidates = await findLocalJournalCandidates(trimmed, 8);

      const response = await fetch('/api/vektori/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          depth: 'l1',
          journals: localCandidates,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Search failed');
      }

      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const memories = result?.memories ?? [];
  const totalHits = memories.length;

  return (
    <div className={`relative z-10 space-y-4 ${compact ? '' : 'mt-5 rounded-[24px] border p-4'} ${compact ? '' : isDarkMode ? 'border-slate-700 bg-slate-950/40' : 'border-[#e0cabd] bg-[#fffdfa]'}`}>
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: `${accent}55`, color: accent }}>
          <Brain size={12} /> Memory Explorer
        </div>
        <p className={`mt-2 text-sm leading-6 ${isDarkMode ? 'text-slate-300' : 'text-[#6f5048]'}`}>
          Ask a question in plain language. Force searches the Vektori memory layer first, then Claude summarizes what it finds.
        </p>
      </div>

      {!memoryReady && !compact && (
        <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${isDarkMode ? 'border-amber-900/40 bg-amber-950/20 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          Your {totalEntries} journal entries are not indexed yet. Click <strong>Sync existing journals to memory</strong> above first, then search here.
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try: what are my med timings?"
          className={`flex-1 rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500' : 'border-[#c9a896] bg-white text-[#3f2a24] placeholder:text-[#9a7568]'}`}
          style={{ boxShadow: isDarkMode ? undefined : 'inset 0 1px 2px rgba(79,57,39,0.06)' }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: accent, minWidth: 148 }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search memory
        </button>
      </form>

      {!compact && (
        <div className="flex flex-wrap gap-2">
          {exampleQueries.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => runSearch(example)}
              disabled={loading}
              className={`rounded-full border px-3 py-1.5 text-xs transition hover:opacity-80 disabled:opacity-50 ${isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-200' : 'border-[#c9a896] bg-white text-[#6f5048]'}`}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {(hasSearched || memoryReady) && !error && result && (
        <div className="space-y-4">
          {result.answer && (
            <div
              className={`rounded-[24px] border p-5 ${isDarkMode ? 'border-slate-700 bg-slate-950/60' : 'border-[#d8c2b5] bg-gradient-to-br from-[#fffdfa] to-[#f7f1ec]'}`}
              style={{ boxShadow: isDarkMode ? undefined : '0 10px 24px rgba(94,71,51,0.08)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
                  <Sparkles size={14} /> Memory answer
                </div>
                <span className="rounded-full border px-3 py-1 text-[11px] font-semibold" style={{ borderColor: `${accent}55`, color: accent }}>
                  {result.source === 'vektori'
                    ? result.memoryRepaired
                      ? 'Vektori · re-indexed'
                      : 'Vektori memory'
                    : result.synthesized
                      ? 'Claude · journal fallback'
                      : 'Indexed search'}
                </span>
              </div>
              <p className={`mt-3 text-sm leading-7 ${isDarkMode ? 'text-slate-200' : 'text-[#4a312b]'}`}>
                {result.answer}
              </p>
              {result.memoryRepaired && (
                <p className={`mt-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>
                  Memory service was empty, so {result.repairedCount} relevant {result.repairedCount === 1 ? 'entry was' : 'entries were'} re-indexed into Vektori before answering.
                </p>
              )}
              {result.queryUsed && (
                <p className={`mt-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>
                  Search focus: <strong>{result.queryUsed}</strong>
                  {result.searchTerms && result.searchTerms.length > 0 && (
                    <>
                      {' '}· also checked related terms like {result.searchTerms.slice(0, 6).join(', ')}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {totalHits > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] opacity-70">
                {totalHits} relevant {totalHits === 1 ? 'memory' : 'memories'}
              </p>
              {memories.map((memory) => (
                <article
                  key={`${memory.journalId}-${memory.title}`}
                  className={`rounded-[22px] border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-900/70' : 'border-[#e8d3c7] bg-[#fffcfa]'}`}
                  style={{ borderLeft: `4px solid ${accent}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{memory.title}</h3>
                      {memory.date && (
                        <p className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>{memory.date}</p>
                      )}
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: `${accent}18`, color: accent }}
                    >
                      {Math.round(memory.relevance)}% match
                    </span>
                  </div>
                  <p className={`mt-3 text-sm leading-6 ${isDarkMode ? 'text-slate-300' : 'text-[#5c4038]'}`}>
                    {memory.summary}
                  </p>
                  {memory.highlight && (
                    <p className={`mt-3 rounded-2xl border px-3 py-2 text-sm italic ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-[#ecdacb] text-[#6f5048]'}`}>
                      “{memory.highlight}”
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className={`rounded-2xl border px-4 py-3 text-sm ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-[#e0cabd] text-[#7a5148]'}`}>
              {memoryReady || indexedCount > 0
                ? 'Nothing in your indexed journals answered this question. Try rephrasing in plain language, or sync again if you recently restarted the memory service.'
                : 'Sync your journals first using the button above, then search again.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
