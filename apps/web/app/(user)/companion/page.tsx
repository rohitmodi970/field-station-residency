'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Route consolidation: /companion redirects to the unified /agent page.
 * Memory, active threads, and companion features are now housed inside /agent.
 */
export default function CompanionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/agent');
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#171311] p-2">
          <img src="/logo.svg" alt="Force" className="h-full w-full object-contain" />
        </div>
        <p className="text-xs text-muted-foreground">Opening Force...</p>
      </div>
    </div>
  );
}
