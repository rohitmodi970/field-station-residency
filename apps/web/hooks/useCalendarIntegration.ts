// apps/web/hooks/useCalendarIntegration.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  CalendarEvent,
  FetchEventsOptions,
  fetchCalendarEvents,
  getSyncStatus,
  disconnectCalendar,
  redirectToCalendarAuth,
  requestCalendarSync,
} from '@/utilities/calendarIntegration';

export interface UseCalendarIntegrationState {
  isConnected: boolean;
  isSyncing: boolean;
  isLoading: boolean;
  lastSyncTime: string | null;
  events: CalendarEvent[];
  syncStatus: {
    eventsTotal: number;
    eventsCached: number;
    eventsUnsynced: number;
    eventsSynced: number;
    calendar?: {
      name: string;
      email: string;
    };
  };
  error: string | null;
}

export function useCalendarIntegration() {
  const [state, setState] = useState<UseCalendarIntegrationState>({
    isConnected: false,
    isSyncing: false,
    isLoading: true,
    lastSyncTime: null,
    events: [],
    syncStatus: {
      eventsTotal: 0,
      eventsCached: 0,
      eventsUnsynced: 0,
      eventsSynced: 0,
      calendar: undefined,
    },
    error: null,
  });

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const status = await getSyncStatus();
      setState(prev => ({
        ...prev,
        isConnected: status.connected,
        lastSyncTime: status.lastSync || null,
        syncStatus: {
          eventsTotal: status.eventsTotal || 0,
          eventsCached: status.eventsCached || 0,
          eventsUnsynced: status.eventsUnsynced || 0,
          eventsSynced: status.eventsSynced || 0,
          calendar: status.calendar,
        },
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to check calendar connection',
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const connectCalendar = useCallback(() => {
    redirectToCalendarAuth();
  }, []);

  const loadEvents = useCallback(async (options?: FetchEventsOptions) => {
    setState(prev => ({ ...prev, isSyncing: true, error: null }));
    try {
      const result = await fetchCalendarEvents(options);
      setState(prev => ({
        ...prev,
        events: result.events,
        error: result.error || null,
      }));
      return result.success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load calendar events',
      }));
      return false;
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const result = await disconnectCalendar();
      if (result.success) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          events: [],
          lastSyncTime: null,
          error: null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to disconnect',
        }));
      }
      return result.success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to disconnect calendar',
      }));
      return false;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const syncToTodo = useCallback(async (eventIds?: string[]) => {
    setState(prev => ({ ...prev, isSyncing: true, error: null }));
    try {
      const result = await requestCalendarSync(eventIds);
      if (!result.success) {
        setState(prev => ({
          ...prev,
          error: result.error || 'Sync request failed',
        }));
      }
      return result.success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to sync calendar to to-do list',
      }));
      return false;
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  return {
    ...state,
    checkConnectionStatus,
    connectCalendar,
    loadEvents,
    disconnect,
    syncToTodo,
  };
}
