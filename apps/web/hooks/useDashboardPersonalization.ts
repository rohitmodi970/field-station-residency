"use client";

import { useCallback, useEffect, useState } from 'react';
import type { EnergyBucket, PersonalizedDashboardPayload } from '@/lib/personalization/types';

interface DashboardResponse {
  success: boolean;
  requiresSelection: boolean;
  bucket: EnergyBucket | null;
  reflection?: string | null;
  commitment?: boolean;
  personalization?: PersonalizedDashboardPayload;
  error?: string;
}

interface BucketResponse {
  success: boolean;
  bucket?: EnergyBucket;
  error?: string;
}

export function useDashboardPersonalization() {
  const [loading, setLoading] = useState(true);
  const [savingBucket, setSavingBucket] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DashboardResponse | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/personalization/dashboard', {
        method: 'GET',
        cache: 'no-store',
      });

      const json = (await response.json()) as DashboardResponse;

      if (!response.ok || json.error) {
        throw new Error(json.error || 'Failed to load personalization dashboard');
      }

      setState(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while loading dashboard personalization');
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveBucket = useCallback(async (bucket: EnergyBucket): Promise<boolean> => {
    setSavingBucket(true);
    setError(null);

    try {
      const response = await fetch('/api/personalization/bucket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucket }),
      });

      const json = (await response.json()) as BucketResponse;
      if (!response.ok || json.error || !json.success) {
        throw new Error(json.error || 'Failed to save your personalization mode');
      }

      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while saving personalization mode');
      return false;
    } finally {
      setSavingBucket(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    savingBucket,
    error,
    state,
    refresh,
    saveBucket,
  };
}
