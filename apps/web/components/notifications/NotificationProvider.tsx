// apps/web/components/notifications/NotificationProvider.tsx
'use client';

import React from 'react';
import { NotificationToastProvider } from './NotificationToast';

interface NotificationProviderProps {
  children: React.ReactNode;
}

/**
 * Client-side notification provider that wraps the app with
 * toast notifications for real-time notification delivery.
 * 
 * This should be used in authenticated areas of the app (e.g., user layout).
 */
export function NotificationProvider({ children }: NotificationProviderProps) {
  return (
    <NotificationToastProvider 
      autoDismiss={5000}
      maxToasts={3}
      position="bottom-right"
    >
      {children}
    </NotificationToastProvider>
  );
}

export default NotificationProvider;
