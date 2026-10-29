"use client"

import { useState, useCallback } from 'react';
import { 
  Journal, 
  CreateJournalRequest, 
  JournalWithMedia,
  JournalMedia 
} from '@/types/database';
import { isEncryptionInitialized } from '@/utils/encryption/keyManager';
import { encryptJournalEntry } from '@/utils/encryption/journalEncryption';
import useDashboardStore from '@/stores/dashboardStore';

export interface UseJournalsReturn {
  journals: JournalWithMedia[];
  loading: boolean;
  error: string | null;
  create: (data: CreateJournalRequest) => Promise<Journal>;
  update: (journalId: string, updates: Partial<Journal>) => Promise<void>;
  remove: (journalId: string, permanent?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  getById: (journalId: string, includeMedia?: boolean) => Promise<JournalWithMedia | null>;
}

export function useJournals(initialLoad: boolean = true): UseJournalsReturn {
  const [journals, setJournals] = useState<JournalWithMedia[]>([]);
  const [loading, setLoading] = useState(initialLoad);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

  const response = await fetch('/api/journals?include_media=true');
      
      if (!response.ok) {
        throw new Error('Failed to fetch journals');
      }

      const data = await response.json();
      setJournals(data.journals || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching journals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateJournalRequest): Promise<Journal> => {
    try {
      setError(null);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[useJournals.create] incoming data', data);
      }
      // Ensure a journal_id exists (API requires it)
      const journalId = (data as any).journal_id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`);

      // Build base payload
      let payload: any = {
        ...data,
        journal_id: journalId,
        tags: (data as any).tags ?? [],
        date: (data as any).date ?? new Date().toISOString().slice(0, 10),
        is_favorite: (data as any).is_favorite ?? false,
        is_archived: (data as any).is_archived ?? false,
      };

      // If encryption initialized, encrypt title/content on client
      if (isEncryptionInitialized()) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[useJournals.create] encryption initialized, attempting encryption');
        }
        try {
          const userResp = await fetch('/api/user/current');
          const userJson = await userResp.json();
          const userId = userJson?.user?.id;

          if (userId) {
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[useJournals.create] encrypting for user', userId);
            }
            const encrypted = await encryptJournalEntry({
              title: (data as any).title ?? null,
              content: (data as any).content ?? null,
              journal_type: (data as any).journal_type,
              mood: (data as any).mood,
              tags: (data as any).tags ?? [],
              location: (data as any).location,
              weather: (data as any).weather,
              date: payload.date,
              is_favorite: payload.is_favorite,
              is_archived: payload.is_archived,
            }, userId);

            payload = {
              ...payload,
              title_encrypted: encrypted.title_encrypted,
              title_iv: encrypted.title_iv,
              content_encrypted: encrypted.content_encrypted,
              content_iv: encrypted.content_iv,
              is_encrypted: true,
              word_count: encrypted.word_count,
              title: null,
              content: null,
            };
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[useJournals.create] encrypted payload prepared (no plaintext)');
            }
          }
        } catch (e) {
          // If encryption fails, fall back to plaintext
          console.error('Encryption failed in create(): falling back to plaintext', e);
          payload.is_encrypted = false;
        }
      } else {
        payload.is_encrypted = false;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[useJournals.create] final payload (redacted)', {
          ...payload,
          title_encrypted: payload.title_encrypted ? '[redacted]' : null,
          content_encrypted: payload.content_encrypted ? '[redacted]' : null,
          title: payload.title ? '[redacted]' : null,
          content: payload.content ? '[redacted]' : null,
        });
      }

      const response = await fetch('/api/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create journal');
      }

      const result = await response.json();
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[useJournals.create] server response', result);
      }
      
      // Add the new journal to the list
      setJournals(prev => [result.journal, ...prev]);
      
      const store = useDashboardStore.getState();
      store.clearSection('stats');
      store.clearSection('insights');
      store.clearSection('prompts');
      
      return result.journal;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const update = useCallback(async (journalId: string, updates: Partial<Journal>) => {
    try {
      setError(null);

      const response = await fetch('/api/journals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journal_id: journalId,
          ...updates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update journal');
      }

      const result = await response.json();
      
      // Update the journal in the list
      setJournals(prev =>
        prev.map(j => (j.journal_id === journalId ? { ...j, ...result.journal } : j))
      );

      const store = useDashboardStore.getState();
      store.clearSection('stats');
      store.clearSection('insights');
      store.clearSection('prompts');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const remove = useCallback(async (journalId: string, permanent = false) => {
    try {
      setError(null);

      const response = await fetch(
        `/api/journals?journal_id=${journalId}&permanent=${permanent}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete journal');
      }

      // Remove from list
      setJournals(prev => prev.filter(j => j.journal_id !== journalId));

      const store = useDashboardStore.getState();
      store.clearSection('stats');
      store.clearSection('insights');
      store.clearSection('prompts');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getById = useCallback(async (
    journalId: string,
    includeMedia = true
  ): Promise<JournalWithMedia | null> => {
    try {
      setError(null);

      const response = await fetch(
        `/api/journals/${journalId}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch journal');
      }

      const data = await response.json();
      return data.journal;
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching journal:', err);
      return null;
    }
  }, []);

  return {
    journals,
    loading,
    error,
    create,
    update,
    remove,
    refresh,
    getById,
  };
}
