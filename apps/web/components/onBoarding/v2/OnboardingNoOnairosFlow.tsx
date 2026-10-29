'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AgentIntroStep from './AgentIntroStep';
import SocialProfileLinker from './SocialProfileLinker';
import ConversationalQuestion, {
  CONVERSATIONAL_QUESTIONS,
  QuestionConfig,
} from './ConversationalQuestion';
import DiscoveryFeed, { DiscoveryItem } from './DiscoveryFeed';
import ReflectionScreen from './ReflectionScreen';
import OnboardingShell from './OnboardingShell';
import type { FlowStep } from './OnboardingShell';
import DebugPanel, { DebugEntry } from './debug/DebugPanel';

interface OnboardingNoOnairosFlowProps {
  onComplete?: () => void;
  isReadOnly?: boolean;
}

/**
 * OnboardingNoOnairosFlow — Variant A
 *
 * Standard V2 onboarding WITHOUT Onairos.
 * Flow: Intro → Social Links (Exa/Apify/GitHub/Firecrawl) → Questions → Discovery Feed → Reflection
 *
 * All 5 questions are shown (no Onairos skip).
 * A debug panel shows raw server responses from each enrichment source.
 */
export default function OnboardingNoOnairosFlow({
  onComplete,
}: OnboardingNoOnairosFlowProps) {
  // Step state — starts at intro (no onairos_fork)
  const [currentStep, setCurrentStep] = useState<FlowStep>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answer: string; chips: string[] }>>({});
  const [socialLinks, setSocialLinks] = useState({
    linkedin: '',
    twitter: '',
    instagram: '',
    facebook: '',
    website: '',
    github: '',
  });
  const [discoveries, setDiscoveries] = useState<DiscoveryItem[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [reflection, setReflection] = useState('');
  const [sourceBadges, setSourceBadges] = useState<string[]>([]);
  const [isZeroSignal, setIsZeroSignal] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [baselineStats, setBaselineStats] = useState<any>(null);

  // ── Debug state ─────────────────────────────────────────────────────────────
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([
    { source: 'Start API', icon: '🚀', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Exa.ai', icon: '🔍', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'LinkedIn (Apify)', icon: '🔗', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Twitter (Apify)', icon: '𝕏', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Instagram (Apify)', icon: '📸', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'GitHub API', icon: '🐱', status: 'pending', timestamp: new Date().toISOString() },
    { source: 'Firecrawl', icon: '🌐', status: 'pending', timestamp: new Date().toISOString() },
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

  // Initialize context model on mount
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
          error: !res.ok ? (data?.error ?? 'Non-OK response') : undefined,
        });
        if (data?.social_links) setSocialLinks(data.social_links);
        if (data?.answers && Object.keys(data.answers).length > 0) {
          const loaded: Record<string, { answer: string; chips: string[] }> = {};
          for (const [k, v] of Object.entries(data.answers as Record<string, any>)) {
            loaded[k] = { answer: v.raw_answer || '', chips: v.chips_selected || [] };
          }
          setAnswers(loaded);
        }
      } catch (err: any) {
        updateDebug('Start API', { status: 'error', latencyMs: Date.now() - t0, error: err.message });
      }
    }
    init();
  }, [updateDebug]);

  // Step 1 → Step 2
  const handleStartIntro = () => setCurrentStep('links');

  // Step 2 → Step 3: Save links + kick off enrichment
  const handleLinksSubmit = async (
    links: typeof socialLinks,
    skipped: boolean
  ) => {
    setSocialLinks(links);
    setCurrentStep('questions');
    setQuestionIndex(0);

    if (skipped) {
      // Mark all enrichment sources as skipped
      ['Exa.ai', 'LinkedIn (Apify)', 'Twitter (Apify)', 'Instagram (Apify)', 'GitHub API', 'Firecrawl'].forEach(
        (s) => updateDebug(s, { status: 'skipped', rawData: 'User skipped social links' })
      );
      return;
    }

    setIsEnriching(true);
    const t0 = Date.now();

    try {
      // Save links
      await fetch('/api/onboarding/v2/social/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links, consent_given: true }),
      });

      // Mark all as pending while fetch runs
      ['Exa.ai', 'LinkedIn (Apify)', 'Twitter (Apify)', 'Instagram (Apify)', 'GitHub API', 'Firecrawl'].forEach(
        (s) => updateDebug(s, { status: 'pending' })
      );

      // Fire enrichment — we intercept the full response to extract per-source raw data
      const fetchRes = await fetch('/api/onboarding/v2/social/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const fetchData = await fetchRes.json();
      const totalMs = Date.now() - t0;

      if (fetchData?.discoveries) {
        setDiscoveries(fetchData.discoveries);
      }

      // Map discoveries back to debug sources using platform field
      const discoveryMap: Record<string, DiscoveryItem> = {};
      for (const d of fetchData?.discoveries ?? []) {
        discoveryMap[d.platform] = d;
      }

      const platformToDebug: Record<string, string> = {
        linkedin: 'LinkedIn (Apify)',
        twitter: 'Twitter (Apify)',
        instagram: 'Instagram (Apify)',
        github: 'GitHub API',
        website: 'Firecrawl',
        exa_web_search: 'Exa.ai',
      };

      // Mark matched platforms as success
      for (const [platform, debugSource] of Object.entries(platformToDebug)) {
        if (discoveryMap[platform]) {
          updateDebug(debugSource, {
            status: 'success',
            latencyMs: totalMs,
            rawData: discoveryMap[platform],
          });
        } else if (links[platform as keyof typeof links]) {
          // Link was given but no discovery returned → partial/error
          updateDebug(debugSource, {
            status: 'error',
            latencyMs: totalMs,
            rawData: null,
            error: 'No data returned (scraper may have failed or returned empty)',
          });
        } else {
          updateDebug(debugSource, {
            status: 'skipped',
            rawData: 'No link provided for this platform',
          });
        }
      }

      // Store full raw payload under Exa separately if available
      if (fetchData?.raw_exa) {
        updateDebug('Exa.ai', { status: 'success', latencyMs: totalMs, rawData: fetchData.raw_exa });
      }

      // Full fetch response as fallback for Exa
      if (!discoveryMap['exa_web_search'] && !fetchData?.raw_exa) {
        updateDebug('Exa.ai', { status: 'success', latencyMs: totalMs, rawData: fetchData });
      }

    } catch (err: any) {
      ['Exa.ai', 'LinkedIn (Apify)', 'Twitter (Apify)', 'Instagram (Apify)', 'GitHub API', 'Firecrawl'].forEach(
        (s) => updateDebug(s, { status: 'error', error: err.message })
      );
    } finally {
      setIsEnriching(false);
    }
  };

  // Step 3: Question answer submission (all 5, no skips from Onairos)
  const handleAnswerSubmit = async (
    qConfig: QuestionConfig,
    answerText: string,
    chips: string[]
  ) => {
    setAnswers((prev) => ({ ...prev, [qConfig.id]: { answer: answerText, chips } }));

    try {
      await fetch('/api/onboarding/v2/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: qConfig.id,
          question_prompt: qConfig.prompt,
          answer: answerText,
          chips_selected: chips,
          step_index: questionIndex + 1,
        }),
      });
    } catch (err) {
      console.error('[NoOnairos] Answer submit error:', err);
    }

    if (questionIndex < CONVERSATIONAL_QUESTIONS.length - 1) {
      setQuestionIndex((prev) => prev + 1);
    } else {
      setCurrentStep('feed');
    }
  };

  const handleSkipQuestion = () => {
    if (questionIndex < CONVERSATIONAL_QUESTIONS.length - 1) {
      setQuestionIndex((prev) => prev + 1);
    } else {
      setCurrentStep('feed');
    }
  };

  // Step 4: Remove discovery item
  const handleRemoveDiscovery = async (id: string) => {
    setDiscoveries((prev) => prev.filter((d) => d.id !== id));
    const platform = id.replace(/-(.*)$/, '');
    if (platform) {
      try {
        await fetch(`/api/onboarding/v2/social/${encodeURIComponent(platform)}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('[NoOnairos] Delete item error:', err);
      }
    }
  };

  // Step 4 → Step 5: Synthesize reflection
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
          social_links: socialLinks,
        }),
      });
      const data = await res.json();
      const ms = Date.now() - t0;

      if (!res.ok || !data?.narrative_reflection) {
        updateDebug('Synthesis (Claude)', {
          status: 'error',
          latencyMs: ms,
          rawData: data,
          error: data?.error || 'No narrative_reflection in response',
        });
        throw new Error(data?.error || 'Failed to generate reflection. Please try again.');
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
  }, [answers, discoveries, socialLinks, updateDebug]);

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
      console.error('[NoOnairos] Correction error:', err);
    }
  };

  // Step 5: Complete
  const handleConfirmReflection = async () => {
    try {
      await fetch('/api/onboarding/v2/complete', { method: 'POST' });
      if (onComplete) {
        onComplete();
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      window.location.href = '/dashboard';
    }
  };

  const currentQuestion = CONVERSATIONAL_QUESTIONS[questionIndex];
  const currentAnswerData = currentQuestion ? answers[currentQuestion.id] : undefined;

  return (
    <>
      <OnboardingShell currentStep={currentStep}>
        {/* Variant label */}
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[101] bg-ob-raised border border-ob-border rounded-full px-3 py-1 text-[10px] text-ob-ink-muted font-semibold tracking-widest uppercase select-none">
          Variant A — Standard (No Onairos)
        </div>

        {/* Step 1: Orb Intro */}
        {currentStep === 'intro' && <AgentIntroStep onStart={handleStartIntro} />}

        {/* Step 2: Social Links */}
        {currentStep === 'links' && (
          <SocialProfileLinker initialLinks={socialLinks} onContinue={handleLinksSubmit} />
        )}

        {/* Step 3: Conversational Questions (all 5) */}
        {currentStep === 'questions' && currentQuestion && (
          <ConversationalQuestion
            key={currentQuestion.id}
            question={currentQuestion}
            questionIndex={questionIndex}
            totalQuestions={CONVERSATIONAL_QUESTIONS.length}
            initialAnswer={currentAnswerData?.answer || ''}
            initialChips={currentAnswerData?.chips || []}
            onAnswerSubmit={handleAnswerSubmit}
            onSkip={handleSkipQuestion}
          />
        )}

        {/* Step 4: Discovery Feed */}
        {currentStep === 'feed' && (
          <DiscoveryFeed
            discoveries={discoveries}
            isLoading={isEnriching}
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

      {/* Debug Panel — always visible in dev */}
      <DebugPanel title="Variant A Debug — Exa / Apify / GitHub / Firecrawl / Claude" entries={debugEntries} />
    </>
  );
}
