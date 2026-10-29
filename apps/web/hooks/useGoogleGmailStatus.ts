'use client';

import { useState, useEffect, useCallback } from 'react';
import { redirectToGmailAuth } from '@/utilities/gmailIntegration';

export interface GoogleGmailStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  email: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  totalMessagesFetched: number;
  needsReauth: boolean;
}

export function useGoogleGmailStatus(): GoogleGmailStatus & {
  refresh: () => Promise<void>;
  connect: () => void;
  disconnect: () => Promise<boolean>;
} {
  const [status, setStatus] = useState<GoogleGmailStatus>({
    isConnected: false,
    isLoading: true,
    error: null,
    email: null,
    syncEnabled: false,
    lastSyncAt: null,
    totalMessagesFetched: 0,
    needsReauth: false,
  });

  const fetchStatus = useCallback(async () => {
    try {
      setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/gmail/status');
      if (!response.ok) {
        throw new Error('Failed to fetch Gmail status');
      }

      const data = await response.json();
      setStatus({
        isConnected: data.connected ?? false,
        isLoading: false,
        error: null,
        email: data.email ?? null,
        syncEnabled: data.syncEnabled ?? false,
        lastSyncAt: data.lastSyncAt ?? null,
        totalMessagesFetched: data.totalMessagesFetched ?? 0,
        needsReauth: data.needsReauth ?? false,
      });
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const connect = useCallback(() => {
    redirectToGmailAuth();
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/google-gmail/disconnect', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }
      await fetchStatus();
      return true;
    } catch (err) {
      console.error('Gmail disconnect error:', err);
      return false;
    }
  }, [fetchStatus]);

  return {
    ...status,
    refresh: fetchStatus,
    connect,
    disconnect,
  };
}

export default useGoogleGmailStatus;
