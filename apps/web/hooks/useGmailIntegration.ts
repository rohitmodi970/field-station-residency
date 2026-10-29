'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  disconnectGmail,
  getGmailStatus,
  redirectToGmailAuth,
} from '@/utilities/gmailIntegration';

export interface UseGmailIntegrationState {
  isConnected: boolean;
  isLoading: boolean;
  email: string | null;
  needsReauth: boolean;
  error: string | null;
}

export function useGmailIntegration() {
  const [state, setState] = useState<UseGmailIntegrationState>({
    isConnected: false,
    isLoading: true,
    email: null,
    needsReauth: false,
    error: null,
  });

  const checkConnectionStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const status = await getGmailStatus();
      setState((prev) => ({
        ...prev,
        isConnected: Boolean(status.connected),
        email: status.email || null,
        needsReauth: Boolean(status.needsReauth),
        error: status.error || null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        error: 'Failed to check Gmail connection',
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    void checkConnectionStatus();
  }, [checkConnectionStatus]);

  const connectGmail = useCallback(() => {
    redirectToGmailAuth();
  }, []);

  const disconnect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const result = await disconnectGmail();
      if (result.success) {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          email: null,
          needsReauth: false,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          error: result.error || 'Failed to disconnect',
        }));
      }
      return result.success;
    } catch {
      setState((prev) => ({
        ...prev,
        error: 'Failed to disconnect Gmail',
      }));
      return false;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  return {
    ...state,
    checkConnectionStatus,
    connectGmail,
    disconnect,
  };
}
