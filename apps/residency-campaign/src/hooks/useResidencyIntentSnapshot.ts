// apps/residency-campaign/src/hooks/useResidencyIntentSnapshot.ts
// React Native Hook to fetch, review, and approve the resident's Intent Snapshot.

import { useState, useEffect, useCallback } from 'react';

export interface ResidencyIntentSnapshot {
  id: string;
  user_id: string;
  user_name?: string;
  cohort_id: string;
  intent: string;
  problem: string;
  approach: string[];
  current_frontier: string;
  contribution: { can_offer: string[]; seeking: string[] };
  next_step: { text: string; why_it_may_help: string; status: string };
  word_allocation?: {
    total_words: number;
    intent_pct: number;
    problem_pct: number;
    frontier_pct: number;
    dominant_category: string;
    dominant_pct: number;
  };
  status: string;
  sharing_consent: boolean;
}

export function useResidencyIntentSnapshot(userId: string, cohortId = 'dhun-oct-2026') {
  const [snapshot, setSnapshot] = useState<ResidencyIntentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/residency/intent/snapshot?userId=${encodeURIComponent(userId)}&cohortId=${encodeURIComponent(cohortId)}`);
      const data = await res.json();
      if (data?.snapshot) {
        setSnapshot(data.snapshot);
      } else {
        setSnapshot(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch intent snapshot');
    } finally {
      setLoading(false);
    }
  }, [userId, cohortId]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const approveSnapshot = async (overrides: {
    intent?: string;
    problem?: string;
    sharingConsent?: boolean;
    approach?: string[];
    archetype?: string;
    positive_traits?: any;
    user_summary?: string;
    top_traits_explanation?: string;
    nudges?: any;
    current_frontier?: string;
    nextStep?: any;
  }) => {
    try {
      const res = await fetch('/api/residency/intent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          cohort_id: cohortId,
          sharing_consent: overrides.sharingConsent ?? false,
          edited_fields: {
            ...(overrides.intent !== undefined ? { intent: overrides.intent } : {}),
            ...(overrides.problem !== undefined ? { problem: overrides.problem } : {}),
            ...(overrides.approach ? { approach: overrides.approach } : {}),
            ...(overrides.archetype !== undefined ? { archetype: overrides.archetype } : {}),
            ...(overrides.positive_traits !== undefined ? { positive_traits: overrides.positive_traits } : {}),
            ...(overrides.user_summary !== undefined ? { user_summary: overrides.user_summary } : {}),
            ...(overrides.top_traits_explanation !== undefined ? { top_traits_explanation: overrides.top_traits_explanation } : {}),
            ...(overrides.nudges !== undefined ? { nudges: overrides.nudges } : {}),
            ...(overrides.current_frontier !== undefined ? { current_frontier: overrides.current_frontier } : {}),
            ...(overrides.nextStep ? { next_step: overrides.nextStep } : {}),
          },
        }),
      });
      const result = await res.json();
      if (result.success && result.snapshot) {
        setSnapshot(result.snapshot);
      }
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to approve snapshot' };
    }
  };

  return {
    snapshot,
    loading,
    error,
    refreshSnapshot: fetchSnapshot,
    approveSnapshot,
  };
}

