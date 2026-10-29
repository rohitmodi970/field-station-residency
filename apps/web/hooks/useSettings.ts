"use client"

import { useState, useCallback, useEffect } from 'react';
import { UserSettings, UpdateSettingsRequest, StorageProvider } from '@/types/database';

export interface UseSettingsReturn {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  update: (updates: UpdateSettingsRequest) => Promise<void>;
  updateStorageProvider: (provider: StorageProvider) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSettings(initialLoad: boolean = true): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(initialLoad);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/settings');
      
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data.settings);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (updates: UpdateSettingsRequest) => {
    try {
      setError(null);

      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }

      const result = await response.json();
      setSettings(result.settings);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateStorageProvider = useCallback(async (provider: StorageProvider) => {
    await update({ storage_provider: provider });
  }, [update]);

  useEffect(() => {
    if (initialLoad) {
      refresh();
    }
  }, [initialLoad, refresh]);

  return {
    settings,
    loading,
    error,
    update,
    updateStorageProvider,
    refresh,
  };
}
