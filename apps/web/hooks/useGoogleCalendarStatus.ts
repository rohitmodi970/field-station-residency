// apps/web/hooks/useGoogleCalendarStatus.ts
// Hook for checking Google Calendar connection status

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface GoogleCalendarStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  email: string | null;
  calendarName: string | null;
  timezone: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  needsReauth: boolean;
  connectUrl: string;
  disconnectUrl: string;
}

export function useGoogleCalendarStatus(): GoogleCalendarStatus & {
  refresh: () => Promise<void>;
  connect: () => void;
  disconnect: () => Promise<boolean>;
} {
  const [status, setStatus] = useState<GoogleCalendarStatus>({
    isConnected: false,
    isLoading: true,
    error: null,
    email: null,
    calendarName: null,
    timezone: null,
    syncEnabled: false,
    lastSyncAt: null,
    needsReauth: false,
    connectUrl: '/api/auth/google-calendar/connect',
    disconnectUrl: '/api/auth/google-calendar/disconnect',
  });

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/calendar/status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch calendar status');
      }
      
      const data = await response.json();
      
      setStatus({
        isConnected: data.connected ?? false,
        isLoading: false,
        error: null,
        email: data.email ?? null,
        calendarName: data.calendarName ?? null,
        timezone: data.timezone ?? null,
        syncEnabled: data.syncEnabled ?? false,
        lastSyncAt: data.lastSyncAt ?? null,
        needsReauth: data.needsReauth ?? false,
        connectUrl: data.connectUrl ?? '/api/auth/google-calendar/connect',
        disconnectUrl: data.disconnectUrl ?? '/api/auth/google-calendar/disconnect',
      });
    } catch (err) {
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Refresh function
  const refresh = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  // Connect - fetch auth URL then redirect
  const connect = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/google-calendar/connect');
      if (!response.ok) {
        throw new Error('Failed to initiate calendar connection');
      }
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error('Calendar connect error:', err);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      const response = await fetch(status.disconnectUrl, { method: 'POST' });
      
      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }
      
      // Refresh status after disconnect
      await fetchStatus();
      return true;
    } catch (err) {
      console.error('Disconnect error:', err);
      return false;
    }
  }, [status.disconnectUrl, fetchStatus]);

  return {
    ...status,
    refresh,
    connect,
    disconnect,
  };
}

export default useGoogleCalendarStatus;
