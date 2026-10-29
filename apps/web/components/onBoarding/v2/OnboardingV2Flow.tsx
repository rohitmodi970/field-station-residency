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
import type { DayOneBaselineProps } from './DayOneBaselineCard';
import OnairosConnectFork from './OnairosConnectFork';
import OnboardingShell from './OnboardingShell';
import type { FlowStep } from './OnboardingShell';
import { ObSpinner, ObCard, ObButton } from './ui';

const ONBOARDING_ONAIROS_ONLY = false;

interface OnboardingV2FlowProps {
  onComplete?: () => void;
  isReadOnly?: boolean;
}

export default function OnboardingV2Flow({
  onComplete,
  isReadOnly = false,
}: OnboardingV2FlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('onairos_fork');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasOnairosContext, setHasOnairosContext] = useState(false);
  const [skippedQuestionIds, setSkippedQuestionIds] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0); // index into activeQuestions
  const [answers, setAnswers] = useState<Record<string, { answer: string; chips: string[] }>>({});
  const [socialLinks, setSocialLinks] = useState<{
    linkedin: string;
    twitter: string;
    instagram: string;
    facebook: string;
    website: string;
    github: string;
  }>({
    linkedin: '',
    twitter: '',
    instagram: '',
    facebook: '',
    website: '',
    github: '',
  });

  const [discoveries, setDiscoveries] = useState<DiscoveryItem[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [reflection, setReflection] = useState<string>('');
  const [sourceBadges, setSourceBadges] = useState<string[]>([]);
  const [isZeroSignal, setIsZeroSignal] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [baselineStats, setBaselineStats] = useState<DayOneBaselineProps | undefined>(undefined);

  // Initialize V2 context on mount
  useEffect(() => {
    async function initV2() {
      console.log('🚀 [OnboardingFlow:Client] Initializing V2 Onboarding flow...');
      try {
        const res = await fetch('/api/onboarding/v2/start', { method: 'POST' });
        const data = await res.json();
        console.log('✅ [OnboardingFlow:Client] V2 context initialized:', data);

        if (data?.user_email) {
          setUserEmail(data.user_email);
        }
        if (data?.social_links) {
          setSocialLinks(data.social_links);
        }
        if (data?.onairos_connected) {
          console.log('🌐 [OnboardingFlow:Client] User already connected Onairos. Streamlining questions...');
          setHasOnairosContext(true);
          setSkippedQuestionIds(['q1_current_state', 'q2_values']);
        }
        if (data?.answers && Object.keys(data.answers).length > 0) {
          const loadedAnswers: Record<string, { answer: string; chips: string[] }> = {};
          for (const [k, v] of Object.entries(data.answers as Record<string, any>)) {
            loadedAnswers[k] = {
              answer: v.raw_answer || '',
              chips: v.chips_selected || [],
            };
          }
          setAnswers(loadedAnswers);
        }
      } catch (err) {
        console.warn('⚠️ [OnboardingFlow:Client] Start init warning:', err);
      }
    }
    initV2();
  }, []);

  // 0. Step 0 (Onairos Fork) -> Handlers
  const handleOnairosSuccess = (data: any) => {
    console.log('⚡ [OnboardingFlow:Client] Onairos connect completed successfully:', data);
    setHasOnairosContext(true);
    if (Array.isArray(data?.recommended_skip_questions)) {
      setSkippedQuestionIds(data.recommended_skip_questions);
    }
    if (Array.isArray(data?.discoveries) && data.discoveries.length > 0) {
      setDiscoveries((prev) => [...data.discoveries, ...prev]);
    }
    if (!ONBOARDING_ONAIROS_ONLY) {
      setCurrentStep('intro');
    }
  };

  const handleOnairosSkip = () => {
    console.log('⏩ [OnboardingFlow:Client] User skipped Onairos -> Moving to Intro (Standard Flow)');
    if (!ONBOARDING_ONAIROS_ONLY) {
      setCurrentStep('intro');
    }
  };

  // 1. Step 1 -> Step 2
  const handleStartIntro = () => {
    console.log('▶️ [OnboardingFlow:Client] Step 1 complete -> Moving to Step 2 (Links-First)');
    setCurrentStep('links');
  };

  // 2. Step 2 -> Step 3 (Save links & kick off background enrichment)
  const handleLinksSubmit = async (
    links: typeof socialLinks,
    skipped: boolean
  ) => {
    console.log('▶️ [OnboardingFlow:Client] Step 2 complete -> Moving to Step 3 (Conversational Questions). Skipped:', skipped, links);
    setSocialLinks(links);
    setCurrentStep('questions');
    setQuestionIndex(0);

    if (!skipped) {
      setIsEnriching(true);
      try {
        console.log('🔗 [OnboardingFlow:Client] Saving social links to database...');
        // Save links to DB
        await fetch('/api/onboarding/v2/social/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links, consent_given: true }),
        });

        console.log('⚡ [OnboardingFlow:Client] Firing background parallel enrichment...');
        // Fire fast-tier enrichment in the background
        fetch('/api/onboarding/v2/social/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.discoveries) {
              console.log(`✅ [OnboardingFlow:Client] Background enrichment completed in ${data.latency_ms}ms with ${data.discoveries.length} items:`, data.discoveries);
              setDiscoveries(data.discoveries);
            }
          })
          .catch((e) => console.warn('⚠️ [OnboardingFlow:Client] Background fetch warning:', e))
          .finally(() => setIsEnriching(false));
      } catch (err) {
        console.error('❌ [OnboardingFlow:Client] Link submit error:', err);
        setIsEnriching(false);
      }
    }
  };

  // 3. Step 3: Question answer submission
  const handleAnswerSubmit = async (
    qConfig: QuestionConfig,
    answerText: string,
    chips: string[]
  ) => {
    console.log(`💬 [OnboardingFlow:Client] Submitting answer for [${qConfig.id}] (Question ${questionIndex + 1}/5):`, {
      answer: answerText,
      chips,
    });

    setAnswers((prev) => ({
      ...prev,
      [qConfig.id]: { answer: answerText, chips },
    }));

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
      console.error('❌ [OnboardingFlow:Client] Answer submit error:', err);
    }

    // Dynamic active question list based on Onairos trait skipping
    const activeQuestions = CONVERSATIONAL_QUESTIONS.filter(
      (q) => !skippedQuestionIds.includes(q.id)
    );

    // Advance to next question or to Discovery Feed
    if (questionIndex < activeQuestions.length - 1) {
      console.log(`▶️ [OnboardingFlow:Client] Advancing to Question ${questionIndex + 2}/${activeQuestions.length}`);
      setQuestionIndex((prev) => prev + 1);
    } else {
      console.log('▶️ [OnboardingFlow:Client] All questions complete -> Moving to Step 4 (Discovery Feed)');
      setCurrentStep('feed');
    }
  };

  const handleSkipQuestion = () => {
    const activeQuestions = CONVERSATIONAL_QUESTIONS.filter(
      (q) => !skippedQuestionIds.includes(q.id)
    );

    console.log(`⏩ [OnboardingFlow:Client] Skipped Question ${questionIndex + 1}/${activeQuestions.length}`);
    if (questionIndex < activeQuestions.length - 1) {
      setQuestionIndex((prev) => prev + 1);
    } else {
      setCurrentStep('feed');
    }
  };

  // 4. Step 4: Discovery Feed item removal
  const handleRemoveDiscovery = async (id: string) => {
    console.log(`🗑️ [OnboardingFlow:Client] User removed discovery item: ${id}`);
    setDiscoveries((prev) => prev.filter((d) => d.id !== id));
    const platform = id.replace(/-(.*)$/, '');
    if (platform) {
      try {
        await fetch(`/api/onboarding/v2/social/${encodeURIComponent(platform)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.warn('⚠️ [OnboardingFlow:Client] Delete item error:', err);
      }
    }
  };

  // 5. Step 4 -> Step 5: Synthesize Reflection
  const handleProceedToReflection = useCallback(async () => {
    console.log('▶️ [OnboardingFlow:Client] Moving to Step 5 (Reflection Synthesis)...');
    setCurrentStep('reflection');
    setIsSynthesizing(true);
    setSynthesisError(null);

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

      if (!res.ok || !data?.narrative_reflection) {
        throw new Error(data?.error || 'Failed to generate reflection. Please try again.');
      }

      console.log('✨ [OnboardingFlow:Client] Synthesized reflection received:', data);
      setReflection(data.narrative_reflection);
      setSourceBadges(data.source_badges || []);
      setIsZeroSignal(!!data.is_zero_signal);
      if (data.baseline_stats) {
        setBaselineStats(data.baseline_stats);
      }
    } catch (err: any) {
      console.error('❌ [OnboardingFlow:Client] Synthesis error:', err);
      setSynthesisError(err?.message || 'Failed to synthesize reflection due to an internal AI model error.');
    } finally {
      setIsSynthesizing(false);
    }
  }, [answers, discoveries, socialLinks]);

  // 6. Step 5: Reflection correction
  const handleCorrectionSubmit = async (
    correctionNote: string,
    updatedReflection?: string
  ) => {
    console.log(`✏️ [OnboardingFlow:Client] Submitting reflection correction: "${correctionNote}"`);
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

      if (updatedReflection) {
        setReflection(updatedReflection);
      }
    } catch (err) {
      console.error('❌ [OnboardingFlow:Client] Correction error:', err);
    }
  };

  // 7. Complete Onboarding
  const handleConfirmReflection = async () => {
    console.log('🎉 [OnboardingFlow:Client] Locking model and completing onboarding...');
    try {
      await fetch('/api/onboarding/v2/complete', { method: 'POST' });
      console.log('🚀 [OnboardingFlow:Client] Complete! Navigating to /dashboard');
      if (onComplete) {
        onComplete();
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      console.error('❌ [OnboardingFlow:Client] Complete error:', err);
      window.location.href = '/dashboard';
    }
  };

  const activeQuestions = CONVERSATIONAL_QUESTIONS.filter(
    (q) => !skippedQuestionIds.includes(q.id)
  );
  const currentQuestion = activeQuestions[questionIndex];
  const currentAnswerData = currentQuestion ? answers[currentQuestion.id] : undefined;

  return (
    <OnboardingShell currentStep={currentStep}>
      {/* Step 0: Onairos Pre-Onboarding Fork */}
      {currentStep === 'onairos_fork' && (
        <OnairosConnectFork
          userEmail={userEmail}
          isAlreadyConnected={hasOnairosContext}
          testOnly={ONBOARDING_ONAIROS_ONLY}
          onSuccess={handleOnairosSuccess}
          onSkip={handleOnairosSkip}
        />
      )}

      {/* Step 1: Orb Intro */}
      {currentStep === 'intro' && <AgentIntroStep onStart={handleStartIntro} />}

      {/* Step 2: Social Links (Links-First) */}
      {currentStep === 'links' && (
        <SocialProfileLinker
          initialLinks={socialLinks}
          onContinue={handleLinksSubmit}
        />
      )}

      {/* Step 3: Conversational Questions (1 per screen) */}
      {currentStep === 'questions' && currentQuestion && (
        <ConversationalQuestion
          key={currentQuestion.id}
          question={currentQuestion}
          questionIndex={questionIndex}
          totalQuestions={activeQuestions.length}
          initialAnswer={currentAnswerData?.answer || ''}
          initialChips={currentAnswerData?.chips || []}
          skipBadge={
            hasOnairosContext && skippedQuestionIds.length > 0
              ? `${skippedQuestionIds.length} skipped via Onairos`
              : undefined
          }
          onAnswerSubmit={handleAnswerSubmit}
          onSkip={handleSkipQuestion}
        />
      )}

      {/* Step 4: Real-Time Discovery Feed */}
      {currentStep === 'feed' && (
        <DiscoveryFeed
          discoveries={discoveries}
          isLoading={isEnriching}
          onRemoveItem={handleRemoveDiscovery}
          onContinue={handleProceedToReflection}
        />
      )}

      {/* Step 5: The Reflection Screen */}
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
  );
}
