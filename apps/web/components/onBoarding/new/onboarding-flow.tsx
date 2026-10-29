'use client';

import { useEffect, useState } from 'react';
import RecognitionStep from './onboarding-steps/recognition-step';
import ReflectionStep from './onboarding-steps/reflection-step';
import ContextStep from './onboarding-steps/context-step';
import ModeSelectionStep from './onboarding-steps/mode-selection-step';
import EntryStep from './onboarding-steps/entry-step';

interface OnboardingFlowProps {
  onComplete: (result?: { journalId: string; mode: 'write' | 'speak' }) => void;
  isReadOnly?: boolean;
  previewResult?: {
    journalId: string;
    mode: 'write' | 'speak';
    recognitionResult?: string | null;
    reflectionPrompt?: string | null;
    onboardingContext?: string | null;
  } | null;
  onExit?: () => void;
}

export default function OnboardingFlow({
  onComplete,
  isReadOnly = false,
  previewResult = null,
  onExit,
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [inputMode, setInputMode] = useState<'write' | 'speak' | null>(previewResult?.mode ?? null);

  useEffect(() => {
    if (isReadOnly && previewResult?.mode) {
      setInputMode(previewResult.mode);
      setCurrentStep(4);
    }
  }, [isReadOnly, previewResult]);

  const steps = [
    <RecognitionStep
      key="recognition"
      onNext={() => setCurrentStep(1)}
      onExplore={() => onComplete()}
    />,
    <ReflectionStep key="reflection" onNext={() => setCurrentStep(2)} />,
    <ContextStep key="context" onNext={() => setCurrentStep(3)} />,
    <ModeSelectionStep key="mode" onClose={() => setCurrentStep(2)} onNext={(mode) => {
      setInputMode(mode);
      setCurrentStep(4);
    }} />,
    <EntryStep
      key="entry"
      mode={inputMode}
      onComplete={onComplete}
      isReadOnly={isReadOnly}
      previewJournalId={previewResult?.journalId ?? null}
      previewMetadata={previewResult ? {
        recognitionResult: previewResult.recognitionResult ?? null,
        reflectionPrompt: previewResult.reflectionPrompt ?? null,
        onboardingContext: previewResult.onboardingContext ?? null,
      } : null}
      onExit={onExit}
    />,
  ];

  return (
    <div className="relative w-full min-h-screen overflow-hidden flex items-center justify-center">
      <div className="w-full animate-in fade-in duration-700">
        {steps[currentStep]}
      </div>
    </div>
  );
}
