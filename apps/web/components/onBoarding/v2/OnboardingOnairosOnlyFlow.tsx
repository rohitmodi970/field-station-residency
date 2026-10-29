'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AgentIntroStep from './AgentIntroStep';
import OnairosConnectFork from './OnairosConnectFork';
import DiscoveryFeed, { DiscoveryItem } from './DiscoveryFeed';
import ReflectionScreen from './ReflectionScreen';
import type { DayOneBaselineProps } from './DayOneBaselineCard';
import OnboardingShell from './OnboardingShell';
import type { FlowStep } from './OnboardingShell';
import { ObSpinner } from './ui';
import DebugPanel, { DebugEntry } from './debug/DebugPanel';

interface OnboardingOnairosOnlyFlowProps {
  onComplete?: () => void;
}

/**
 * OnboardingOnairosOnlyFlow — Variant B
 *
 * Onairos-ONLY onboarding. No social link scraping and NO questions.
 * Context comes directly from Onairos consented persona payload.
 *
 * Flow: Onairos Fork → Intro → Discovery Feed (Onairos discoveries) → Reflection
 */
export default function OnboardingOnairosOnlyFlow({ onComplete }: OnboardingOnairosOnlyFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('onairos_fork');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasOnairosContext, setHasOnairosContext] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { answer: string; chips: string[] }>>({});
  const [discoveries, setDiscoveries] = useState<DiscoveryItem[]>([]);
  const [reflection, setReflection] = useState('');
  const [sourceBadges, setSourceBadges] = useState<string[]>([]);
  const [isZeroSignal, setIsZeroSignal] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [baselineStats, setBaselineStats] = useState<DayOneBaselineProps | undefined>(undefined);

  // ── Debug state ─────────────────────────────────────────────────────────────
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([
    { source: 'Start API', icon: '🚀', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Onairos SDK', icon: '🌐', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Onairos Ingest API', icon: '📦', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Big Five Traits', icon: '🧬', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Interest Archetypes', icon: '💡', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Sentiment Signals', icon: '📊', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Raw Connector Dump', icon: '🔌', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Synthesis (Claude)', icon: '🧠', status: 'pending', timestamp: new Date().toISOString() },
  ]);

  const updateDebug = useCallback((source: string, patch: Partial<DebugEntry>) => {
    setDebugEntries((prev) =>
      prev.map((e) =>
        e.source === source ? { ...e, ...patch, timestamp: new Date().toISOString() } : e
      )
    );
  }, []);
  // ────────────────────────────────────────────────────────────────────────────

  // Init — fetch email and existing Onairos state
  useEffect(() => {
    async function init() {
      const t0 = Date.now();
      try {
        const res = await fetch('/api/onboarding/v2/start', { method: 'POST' });
        const data = await res.json();
        updateDebug('Start API', {
          status: res.ok ? 'success' : 'error',
          latencyMs: Date.now() - t0,
          rawData: data,
          error: !res.ok ? data?.error : undefined,
        });
        if (data?.user_email) setUserEmail(data.user_email);
        if (data?.onairos_connected) {
          setHasOnairosContext(true);
        }
        if (data?.answers && Object.keys(data.answers).length > 0) {
          const loaded: Record<string, { answer: string; chips: string[] }> = {};
          for (const [k, v] of Object.entries(data.answers as Record<string, any>)) {
            loaded[k] = { answer: v.raw_answer || '', chips: v.chips_selected || [] };
          }
          setAnswers(loaded);
        }
      } catch (err: any) {
        updateDebug('Start API', { status: 'error', error: err.message });
      }
    }
    init();
  }, [updateDebug]);

  // Onairos SDK connect success — called by OnairosConnectFork
  const handleOnairosSuccess = useCallback(
    (data: {
      seeded_facts_count?: number;
      recommended_skip_questions?: string[];
      discoveries?: any[];
      big_five?: Record<string, number>;
      has_personality?: boolean;
    }) => {
      console.log('[OnairosOnlyFlow] Onairos success payload:', data);

      // Update debug with the full API response from our backend ingest
      updateDebug('Onairos Ingest API', {
        status: 'success',
        rawData: data,
      });

      if (data?.big_five) {
        updateDebug('Big Five Traits', { status: 'success', rawData: data.big_five });
      } else {
        updateDebug('Big Five Traits', { status: 'skipped', rawData: null });
      }

      if (data?.discoveries && data.discoveries.length > 0) {
        updateDebug('Interest Archetypes', {
          status: 'success',
          rawData: data.discoveries.map((d: any) => ({ title: d.title, summary: d.summary })),
        });
        // Map interest discoveries into DiscoveryItem format
        const items: DiscoveryItem[] = data.discoveries.map((d: any, idx: number) => ({
          id: d.id || `onairos-item-${idx}`,
          platform: 'onairos',
          title: d.title || d.source_label || 'Interest Archetype',
          summary: d.summary || `Inferred behavioral archetype`,
          badgeLabel: '🌐 Onairos',
          url: undefined,
        }));
        setDiscoveries(items);
      } else {
        updateDebug('Interest Archetypes', { status: 'skipped', rawData: null });
        setDiscoveries([]);
      }

      if ((data as any)?.raw_payload) {
        updateDebug('Raw Connector Dump', {
          status: 'success',
          rawData: (data as any).raw_payload,
        });
      }

      setHasOnairosContext(true);
      setCurrentStep('intro');
    },
    [updateDebug]
  );

  // User clicked the Onairos SDK button — capture the raw SDK event
  const handleOnairosSdkRawEvent = useCallback(
    (rawResult: unknown) => {
      updateDebug('Onairos SDK', {
        status: 'success',
        rawData: rawResult,
      });
    },
    [updateDebug]
  );

  // User skipped Onairos → show all 5 questions, no discoveries
  const handleOnairosSkip = () => {
    ['Onairos SDK', 'Onairos Ingest API', 'Big Five Traits', 'Interest Archetypes', 'Sentiment Signals'].forEach(
      (s) => updateDebug(s, { status: 'skipped', rawData: 'User skipped Onairos connection' })
    );
    setCurrentStep('intro');
  };

  // Step 1 → Step 4 (questions removed: jump straight to Discovery Feed)
  const handleStartIntro = () => {
    setCurrentStep('feed');
  };

  // Step 4: Remove discovery
  const handleRemoveDiscovery = async (id: string) => {
    setDiscoveries((prev) => prev.filter((d) => d.id !== id));
  };

  // Step 4 → Step 5: Synthesize
  const handleProceedToReflection = useCallback(async () => {
    setCurrentStep('reflection');
    setIsSynthesizing(true);
    setSynthesisError(null);
    updateDebug('Synthesis (Claude)', { status: 'pending' });
    const t0 = Date.now();

    try {
      const res = await fetch('/api/onboarding/v2/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          discoveries,
        }),
      });
      const data = await res.json();
      const ms = Date.now() - t0;

      if (!res.ok || !data?.narrative_reflection) {
        updateDebug('Synthesis (Claude)', {
          status: 'error',
          latencyMs: ms,
          rawData: data,
          error: data?.error || 'No narrative_reflection returned',
        });
        throw new Error(data?.error || 'Failed to synthesize. Please try again.');
      }

      updateDebug('Synthesis (Claude)', { status: 'success', latencyMs: ms, rawData: data });
      setReflection(data.narrative_reflection);
      setSourceBadges(data.source_badges || []);
      setIsZeroSignal(!!data.is_zero_signal);
      if (data.baseline_stats) {
        setBaselineStats(data.baseline_stats);
      }
    } catch (err: any) {
      setSynthesisError(err?.message || 'Synthesis failed due to an internal error.');
    } finally {
      setIsSynthesizing(false);
    }
  }, [updateDebug]);

  // Step 5: Correction
  const handleCorrectionSubmit = async (correctionNote: string, updatedReflection?: string) => {
    try {
      await fetch('/api/onboarding/v2/model/correct', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_claim: reflection,
          user_correction: correctionNote,
          updated_reflection: updatedReflection,
        }),
      });
      if (updatedReflection) setReflection(updatedReflection);
    } catch (err) {
      console.error('[OnairosOnly] Correction error:', err);
    }
  };

  // Step 5: Complete
  const handleConfirmReflection = async () => {
    try {
      await fetch('/api/onboarding/v2/complete', { method: 'POST' });
      if (onComplete) onComplete();
      else window.location.href = '/dashboard';
    } catch {
      window.location.href = '/dashboard';
    }
  };

  // Wrap OnairosConnectFork to intercept raw SDK events
  const WrappedOnairosConnectFork = () => (
    <OnairosConnectFork
      userEmail={userEmail}
      isAlreadyConnected={hasOnairosContext}
      onSuccess={(data) => {
        handleOnairosSuccess(data as any);
      }}
      onRawSdkEvent={(rawResult: unknown) => {
        // Capture the full raw SDK object before any processing
        updateDebug('Onairos SDK', { status: 'success', rawData: rawResult });
      }}
      onSkip={handleOnairosSkip}
    />
  );

  return (
    <>
      <OnboardingShell currentStep={currentStep}>
        {/* Variant label */}
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[101] bg-ob-raised border border-ob-border rounded-full px-3 py-1 text-[10px] text-ob-ink-muted font-semibold tracking-widest uppercase select-none">
          Variant B — Onairos Only (No Questions)
        </div>

        {/* Step 0: Onairos Fork (mandatory, no skip to full flow) */}
        {currentStep === 'onairos_fork' && <WrappedOnairosConnectFork />}

        {/* Step 1: Orb Intro — show Onairos context status */}
        {currentStep === 'intro' && (
          <div className="relative">
            {hasOnairosContext ? (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-8 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-xs text-emerald-700 font-medium flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Onairos context loaded — questions bypassed
              </div>
            ) : (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-8 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-xs text-slate-600 font-medium flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                Questions bypassed — direct account synthesis
              </div>
            )}
            <AgentIntroStep onStart={handleStartIntro} />
          </div>
        )}

        {/* Step 4: Discovery Feed (populated from Onairos interests) */}
        {currentStep === 'feed' && (
          <DiscoveryFeed
            discoveries={discoveries}
            isLoading={false}
            categoryLabel="Onairos Signal Breakdown"
            title="Here's what I found from your connected accounts"
            subtitle="Review the interest archetypes inferred from Onairos before model synthesis."
            emptyTitle="Zero archetypes imported from Onairos"
            emptyDescription="Onairos returned no interest archetypes for the connected platform(s). Proceed to synthesize your Day-1 baseline directly."
            onRemoveItem={handleRemoveDiscovery}
            onContinue={handleProceedToReflection}
          />
        )}

        {/* Step 5: Reflection */}
        {currentStep === 'reflection' && (
          <ReflectionScreen
            narrativeReflection={reflection}
            sourceBadges={sourceBadges}
            isZeroSignal={isZeroSignal}
            isSynthesizing={isSynthesizing}
            synthesisError={synthesisError}
            baselineStats={baselineStats}
            onRetry={handleProceedToReflection}
            onConfirm={handleConfirmReflection}
            onCorrectionSubmit={handleCorrectionSubmit}
          />
        )}
      </OnboardingShell>

      {/* Debug Panel */}
      <DebugPanel title="Variant B Debug — Onairos SDK / Ingest / Big Five / Synthesis" entries={debugEntries} />
    </>
  );
}
