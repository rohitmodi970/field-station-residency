"use client";

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { JournalEntry } from '@/components/Journal/types';

interface JournalStoreState {
  entries: JournalEntry[] | null;
  totalFromApi: number;
  lastUpdated: number;
  setEntries: (entries: JournalEntry[] | null, totalFromApi?: number) => void;
  clear: () => void;
  isFresh: (ttlSeconds?: number) => boolean;
}

const useJournalStore = create<JournalStoreState>()(
  persist(
    (set, get) => ({
      entries: null,
      totalFromApi: 0,
      lastUpdated: 0,
      setEntries: (entries, totalFromApi = 0) => set({ entries, totalFromApi, lastUpdated: Date.now() }),
      clear: () => set({ entries: null, totalFromApi: 0, lastUpdated: 0 }),
      isFresh: (ttlSeconds = 300) => {
        const lastUpdated = get().lastUpdated;
        if (!lastUpdated) return false;
        return Date.now() - lastUpdated < ttlSeconds * 1000;
      },
    }),
    {
      name: 'force:journal-cache',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ entries: state.entries, totalFromApi: state.totalFromApi, lastUpdated: state.lastUpdated }),
    }
  )
);

export default useJournalStore;
