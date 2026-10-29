"use client";

import React, { useEffect, useState } from 'react';
import { UserSearch } from '@/components/shared-cognition/UserSearch';
import { ConnectionsPanel } from '@/components/shared-cognition/ConnectionsPanel';
import { createClient } from '@/utils/supabase/client';
import { ForcePageShell } from '@/components/layout/ForcePageShell';

export default function ConnectionsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        import('@/utils/encryption/collaborationCrypto')
          .then(({ ensureCollabKeyPair }) => ensureCollabKeyPair(user.id))
          .catch((err) => console.warn('[ConnectionsPage] Collab key bootstrap failed (non-fatal):', err));
      }
    };
    fetchUser();
  }, []);

  const handleConnectionRequested = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (!currentUserId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-foreground border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ForcePageShell
      eyebrow="Together"
      title="Connections"
      description="Find people you trust and share only what you choose."
    >
      <div className="space-y-8">
        <section aria-labelledby="find-someone-heading">
          <UserSearch onConnectionRequested={handleConnectionRequested} />
        </section>

        <section aria-labelledby="connections-heading">
          <ConnectionsPanel currentUserId={currentUserId} refreshTrigger={refreshTrigger} />
        </section>
      </div>
    </ForcePageShell>
  );
}
