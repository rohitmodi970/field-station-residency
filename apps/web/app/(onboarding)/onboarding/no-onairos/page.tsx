'use client';

import React, { useEffect, useState } from 'react';
import OnboardingNoOnairosFlow from '@/components/onBoarding/v2/OnboardingNoOnairosFlow';
import { ObSpinner } from '@/components/onBoarding/v2/ui';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

/**
 * /onboarding/no-onairos
 *
 * Variant A page — Standard onboarding without Onairos.
 * Uses Exa.ai + Apify + GitHub + Firecrawl for social enrichment.
 * Debug panel shows raw server payloads.
 *
 * Access: /onboarding/no-onairos (authenticated users only)
 */
export default function OnboardingNoOnairosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
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
          <p className="text-xs text-ob-ink-muted">Loading Variant A...</p>
        </div>
      </div>
    );
  }

  return <OnboardingNoOnairosFlow onComplete={() => { window.location.href = '/dashboard'; }} />;
}
