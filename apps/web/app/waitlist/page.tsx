"use client"

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePostHog } from 'posthog-js/react';

// Dynamically import WaitList component to avoid SSR issues
const WaitList = dynamic(() => import('@/components/waitList/WaitList'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-lg font-display text-foreground">Loading waitlist...</p>
      </div>
    </div>
  ),
});

export default function WaitlistPage() {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;

    // Track waitlist page view with custom properties
    posthog.capture('waitlist_page_viewed', {
      page: '/waitlist',
      timestamp: new Date().toISOString(),
      referrer: document.referrer || 'direct',
    });

    // Track when user leaves the waitlist page
    return () => {
      posthog.capture('waitlist_page_exited', {
        page: '/waitlist',
        time_on_page_seconds: Math.round((Date.now() - Date.now()) / 1000),
      });
    };
  }, [posthog]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-lg font-display text-foreground">Loading waitlist...</p>
          </div>
        </div>
      }
    >
      <WaitList />
    </Suspense>
  );
}
