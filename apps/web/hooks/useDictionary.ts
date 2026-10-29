"use client";

import { useCallback, useMemo, useState } from 'react';

export type DictionarySortBy = 'created_at' | 'updated_at' | 'term';
export type DictionarySortOrder = 'asc' | 'desc';

export interface DictionaryWord {
  id: string;
  user_id: string;
  term: string;
  pronunciation: string | null;
  definition: string;
  examples: string[];
  audio_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DictionaryMutationInput {
  term: string;
  pronunciation?: string;
  definition: string;
  examples?: string[];
  audio_url?: string;
}

export interface UseDictionaryReturn {
  words: DictionaryWord[];
  selectedWord: DictionaryWord | null;
  loading: boolean;
  error: string | null;
  total: number;
  search: string;
  sortBy: DictionarySortBy;
  sortOrder: DictionarySortOrder;
  setSearch: (value: string) => void;
  setSortBy: (value: DictionarySortBy) => void;
  setSortOrder: (value: DictionarySortOrder) => void;
  setSelectedWordId: (id: string | null) => void;
  refresh: () => Promise<void>;
  addWord: (input: DictionaryMutationInput) => Promise<DictionaryWord>;
  updateWord: (id: string, input: Partial<DictionaryMutationInput>) => Promise<DictionaryWord>;
  deleteWord: (id: string) => Promise<void>;
}

function normalizeExamples(examples?: string[]): string[] {
  if (!examples) return [];
  return examples.map((entry) => entry.trim()).filter(Boolean);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function useDictionary(initialLoad = true): UseDictionaryReturn {
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [selectedWordId, setSelectedWordIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(initialLoad);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<DictionarySortBy>('created_at');
  const [sortOrder, setSortOrder] = useState<DictionarySortOrder>('desc');

  const selectedWord = useMemo(
    () => words.find((word) => word.id === selectedWordId) || words[0] || null,
    [words, selectedWordId]
  );

  const setSelectedWordId = useCallback((id: string | null) => {
    setSelectedWordIdState(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        sortBy,
        sortOrder,
      });

      if (search.trim()) {
        params.set('search', search.trim());
      }

      const response = await fetch(`/api/dictionary/words?${params.toString()}`);

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to load dictionary words');
      }

      const data = await response.json();
      const nextWords = (data.words || []) as DictionaryWord[];

      setWords(nextWords);
      setTotal(data.total || nextWords.length || 0);

      // Keep selection stable when possible.
      setSelectedWordIdState((prev) => {
        if (!nextWords.length) return null;
        if (prev && nextWords.some((word) => word.id === prev)) return prev;
        return nextWords[0]?.id || null;
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load dictionary words'));
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder]);

  const addWord = useCallback(async (input: DictionaryMutationInput) => {
    setError(null);

    const payload = {
      term: input.term.trim(),
      pronunciation: input.pronunciation?.trim() || undefined,
      definition: input.definition.trim(),
      examples: normalizeExamples(input.examples),
      audio_url: input.audio_url?.trim() || undefined,
    };

    const response = await fetch('/api/dictionary/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error || 'Failed to create word';
      setError(message);
      throw new Error(message);
    }

    const created = data.word as DictionaryWord;
    setWords((prev) => [created, ...prev]);
    setTotal((prev) => prev + 1);
    setSelectedWordIdState(created.id);

    return created;
  }, []);

  const updateWord = useCallback(async (id: string, input: Partial<DictionaryMutationInput>) => {
    setError(null);

    const payload: Record<string, unknown> = { id };

    if (input.term !== undefined) payload.term = input.term.trim();
    if (input.pronunciation !== undefined) payload.pronunciation = input.pronunciation.trim();
    if (input.definition !== undefined) payload.definition = input.definition.trim();
    if (input.examples !== undefined) payload.examples = normalizeExamples(input.examples);
    if (input.audio_url !== undefined) payload.audio_url = input.audio_url.trim();

    const response = await fetch('/api/dictionary/words', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error || 'Failed to update word';
      setError(message);
      throw new Error(message);
    }

    const updated = data.word as DictionaryWord;
    setWords((prev) => prev.map((word) => (word.id === id ? updated : word)));

    return updated;
  }, []);

  const deleteWord = useCallback(async (id: string) => {
    setError(null);

    const response = await fetch(`/api/dictionary/words?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error || 'Failed to delete word';
      setError(message);
      throw new Error(message);
    }

    setWords((prev) => prev.filter((word) => word.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
    setSelectedWordIdState((prev) => (prev === id ? null : prev));
  }, []);

  return {
    words,
    selectedWord,
    loading,
    error,
    total,
    search,
    sortBy,
    sortOrder,
    setSearch,
    setSortBy,
    setSortOrder,
    setSelectedWordId,
    refresh,
    addWord,
    updateWord,
    deleteWord,
  };
}
