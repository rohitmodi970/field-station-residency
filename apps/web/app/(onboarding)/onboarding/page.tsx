'use client';

import React, { useEffect, useState } from 'react';
import OnboardingFlow from '@/components/onBoarding/new/onboarding-flow';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    journalId: string;
    mode: 'write' | 'speak';
    recognitionResult?: string | null;
    reflectionPrompt?: string | null;
    onboardingContext?: string | null;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          // [TEMPORARY: Onboarding testing] Public access enabled — do not redirect to /login
          if (active) setLoading(false);
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', user.id)
          .maybeSingle();

        const completed = Boolean(userData?.onboarding_complete);
        if (active) {
          setIsReadOnly(completed);
        }

        if (!userError && completed) {
          if (active) setPreviewLoading(true);
          const resultResponse = await fetch('/api/user/onboarding-result');
          if (!resultResponse.ok) {
            if (active) setPreviewError('Unable to load your onboarding preview.');
          } else {
            const resultJson = await resultResponse.json();
            const resultData = resultJson?.result || null;
            if (resultData?.journal_id && resultData?.mode && active) {
              setPreviewResult({
                journalId: resultData.journal_id,
                mode: resultData.mode,
                recognitionResult: resultData.recognition_result ?? null,
                reflectionPrompt: resultData.reflection_prompt ?? null,
                onboardingContext: resultData.onboarding_context ?? null,
              });
            }
          }
          if (active) setPreviewLoading(false);
        }
      } catch (error) {
        console.warn('Error checking onboarding status:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [router]);

  const handleOnboardingComplete = async (result?: { journalId: string; mode: 'write' | 'speak' }) => {
    if (isCompleting || isReadOnly) {
      return;
    }

    setIsCompleting(true);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;

      if (userId && result?.journalId && result?.mode) {
        const recognitionResult = typeof window !== 'undefined'
          ? window.localStorage.getItem('force_energy')
          : null;
        const reflectionPrompt = typeof window !== 'undefined'
          ? window.localStorage.getItem('force_reflection_prompt')
          : null;
        const onboardingContext = typeof window !== 'undefined'
          ? window.localStorage.getItem('force_onboarding_context')
          : null;

        const resultResponse = await fetch('/api/user/onboarding-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journal_id: result.journalId,
            mode: result.mode,
            recognition_result: recognitionResult,
            reflection_prompt: reflectionPrompt,
            onboarding_context: onboardingContext,
          }),
        });

        if (!resultResponse.ok) {
          const body = await resultResponse.json().catch(() => ({}));
          console.error('Error saving onboarding result:', body?.error || resultResponse.statusText);
        }
      }

      if (userId) {
        const { error } = await supabase
          .from('users')
          .update({ onboarding_complete: true })
          .eq('id', userId);

        if (error) {
          console.error('Error updating onboarding status:', error);
        }
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsCompleting(false);
      return;
    }

    window.location.href = '/dashboard';
  };

  const handleExit = () => {
    window.location.href = '/dashboard';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-foreground/60">Loading Force...</p>
        </div>
      </div>
    );
  }

  if (isReadOnly && !previewResult) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        {previewLoading ? (
          <div className="w-full max-w-md px-6 animate-pulse text-center">
            <div className="h-8 w-48 bg-foreground/10 rounded-full mx-auto mb-4" />
            <div className="h-4 w-full bg-foreground/10 rounded-full mb-3" />
            <div className="h-4 w-5/6 bg-foreground/10 rounded-full mx-auto mb-8" />
            <div className="h-10 w-40 bg-foreground/10 rounded-full mx-auto" />
          </div>
        ) : (
          <div className="text-center max-w-md px-6">
            <h2 className="text-2xl mb-3 font-semibold text-foreground">Onboarding complete</h2>
            <p className="text-foreground/60 mb-6">
              {previewError || 'Your preview is still being prepared.'}
            </p>
            <button
              onClick={handleExit}
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <OnboardingFlow
      onComplete={handleOnboardingComplete}
      isReadOnly={isReadOnly}
      previewResult={previewResult}
      onExit={handleExit}
    />
  );
}

