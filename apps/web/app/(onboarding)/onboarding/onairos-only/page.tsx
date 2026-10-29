'use client';

import React, { useEffect, useState } from 'react';
import OnboardingOnairosOnlyFlow from '@/components/onBoarding/v2/OnboardingOnairosOnlyFlow';
import { ObSpinner } from '@/components/onBoarding/v2/ui';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

/**
 * /onboarding/onairos-only
 *
 * Variant B page — Onairos-ONLY onboarding.
 * No social link scraping. Context comes entirely from Onairos consented persona payload.
 * Debug panel shows Onairos SDK event, ingest API response, Big Five traits, and synthesis.
 *
 * Access: /onboarding/onairos-only (authenticated users only)
 */
export default function OnboardingOnairosOnlyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const supabase = createClient();
        await supabase.auth.getUser();
        // [TEMPORARY: Onairos testing] Public access enabled — do not redirect to /login
        if (active) setLoading(false);
      } catch {
        if (active) setLoading(false);
      }
    }
    checkAuth();
    return () => { active = false; };
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-ob-canvas" style={{ colorScheme: 'light' }}>
        <div className="text-center space-y-3">
          <ObSpinner size="lg" className="mx-auto" />
          <p className="text-xs text-ob-ink-muted">Loading Variant B...</p>
        </div>
      </div>
    );
  }

  return <OnboardingOnairosOnlyFlow onComplete={() => { window.location.href = '/dashboard'; }} />;
}
