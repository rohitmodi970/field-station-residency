'use client';

import React, { useState, useEffect } from 'react';
import AnimatedOrb from '../new/onboarding-steps/animated-orb';
import StepFrame from './StepFrame';
import { ObCard, ObButton, ObInput, ObTextarea, ObBadge, ObSpinner } from './ui';
import DayOneBaselineCard, { DayOneBaselineProps } from './DayOneBaselineCard';

export interface ReflectionScreenProps {
  narrativeReflection: string;
  sourceBadges?: string[];
  isZeroSignal?: boolean;
  isSynthesizing?: boolean;
  synthesisError?: string | null;
  baselineStats?: DayOneBaselineProps;
  onRetry?: () => void;
  onConfirm: () => void;
  onCorrectionSubmit: (correctionText: string, updatedReflection?: string) => Promise<void>;
}

export default function ReflectionScreen({
  narrativeReflection,
  sourceBadges = [],
  isZeroSignal = false,
  isSynthesizing = false,
  synthesisError = null,
  baselineStats,
  onRetry,
  onConfirm,
  onCorrectionSubmit,
}: ReflectionScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(narrativeReflection);
  const [correctionNote, setCorrectionNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedText(narrativeReflection);
  }, [narrativeReflection]);

  // 1. Synthesizing state: AnimatedOrb pulsing + calm status line (aria-live="polite")
  // No placeholder or fake narrative text before real content arrives.
  if (isSynthesizing) {
    return (
      <StepFrame width="lg" align="left">
        <div className="space-y-6 py-6" aria-live="polite">
          <div className="scale-75 origin-left -ml-3">
            <AnimatedOrb />
          </div>
          <p className="text-base text-ob-ink-muted font-normal font-[family-name:var(--font-ob-body)]">
            Synthesizing what I understand so far...
          </p>
        </div>
      </StepFrame>
    );
  }

  // 2. Error state: ObCard tinted bg-ob-danger-soft, border ob-danger/30, text ob-danger, with a Retry button
  if (synthesisError) {
    return (
      <StepFrame width="lg" align="left">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-ob-danger font-semibold font-[family-name:var(--font-ob-body)]">
              Synthesis Interrupted
            </p>
            <h1 className="text-4xl md:text-5xl font-[500] tracking-normal leading-[1.1] text-balance text-ob-ink font-[family-name:var(--font-ob-display)]">
              Something went wrong
            </h1>
          </div>

          <ObCard
            layer="surface"
            className="bg-ob-danger-soft border-ob-danger/30 text-ob-danger space-y-4 p-6 md:p-8 max-w-[60ch]"
          >
            <p className="text-sm font-normal leading-relaxed text-ob-ink">
              {synthesisError}
            </p>
            {onRetry && (
              <div className="pt-2">
                <ObButton
                  variant="primary"
                  onClick={onRetry}
                  className="bg-ob-danger hover:bg-ob-danger/90 text-ob-canvas shadow-none"
                >
                  <span>Retry</span>
                  <span>↻</span>
                </ObButton>
              </div>
            )}
          </ObCard>
        </div>
      </StepFrame>
    );
  }

  // 3. Zero-signal state: a gentle, designed card (not an error look) with a clear way to continue
  if (isZeroSignal) {
    return (
      <StepFrame width="lg" align="left">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-ob-clay-strong font-semibold font-[family-name:var(--font-ob-body)]">
              Fresh Canvas
            </p>
            <h1 className="text-4xl md:text-5xl font-[500] tracking-normal leading-[1.1] text-balance text-ob-ink font-[family-name:var(--font-ob-display)]">
              Starting Fresh
            </h1>
            <p className="text-base leading-relaxed text-ob-ink-muted font-normal text-pretty font-[family-name:var(--font-ob-body)]">
              We&apos;ll build your model naturally as we interact.
            </p>
          </div>

          <ObCard layer="raised" className="p-6 md:p-8 space-y-6 max-w-[60ch]">
            <p className="text-base text-ob-ink-muted leading-relaxed font-normal font-[family-name:var(--font-ob-body)]">
              You chose to skip profile connections and questions, which is completely fine. Your preferences, communication style, and worldview will take shape gradually through your daily conversations.
            </p>
            <div className="pt-2">
              <ObButton
                variant="primary"
                onClick={onConfirm}
                className="w-full sm:w-auto"
              >
                <span>Continue</span>
                <span>→</span>
              </ObButton>
            </div>
          </ObCard>
        </div>
      </StepFrame>
    );
  }

  const handleSaveCorrection = async () => {
    setIsSaving(true);
    try {
      await onCorrectionSubmit(correctionNote, editedText);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Synthesized narrative state
  return (
    <StepFrame width="lg" align="left">
      <div className="space-y-6">
        {/* Title & Subtitle */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-ob-clay-strong font-semibold font-[family-name:var(--font-ob-body)]">
            Synthesis Complete
          </p>
          <h1 className="text-4xl md:text-5xl font-[500] tracking-normal leading-[1.1] text-balance text-ob-ink font-[family-name:var(--font-ob-display)]">
            Here&apos;s what I understand so far
          </h1>
          <p className="text-base leading-relaxed text-ob-ink-muted font-normal text-pretty font-[family-name:var(--font-ob-body)]">
            Based on our conversation and what you shared.
          </p>
        </div>

        {/* Day-1 Baseline Cognitive Parameters Card */}
        <div className="max-w-[60ch]">
          <DayOneBaselineCard
            signalsCount={sourceBadges.length > 0 ? sourceBadges.length : 4}
            wordsAnalyzed={1420}
            {...baselineStats}
          />
        </div>

        {/* Main ObCard with comfortable padding, narrative in display serif, max ~60ch */}
        <ObCard layer="raised" className="p-6 md:p-8 space-y-6 max-w-[60ch]">
          {isEditing ? (
            /* Inline Edit / Correct flow: ObTextarea with Save (primary) and Cancel (link) */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ob-ink block">
                  Edit reflection directly:
                </label>
                <ObTextarea
                  autoGrow
                  minRows={5}
                  maxRows={14}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ob-ink-muted block">
                  What did I misunderstand? (optional note)
                </label>
                <ObInput
                  type="text"
                  placeholder="e.g. Actually, I am transitioning out of engineering..."
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <ObButton
                  variant="link"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedText(narrativeReflection);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </ObButton>
                <ObButton
                  variant="primary"
                  disabled={isSaving || !editedText.trim()}
                  onClick={handleSaveCorrection}
                  className="h-10 px-6 text-xs"
                >
                  {isSaving ? (
                    <span className="inline-flex items-center gap-2">
                      <ObSpinner size="sm" />
                      <span>Saving...</span>
                    </span>
                  ) : (
                    'Save'
                  )}
                </ObButton>
              </div>
            </div>
          ) : (
            <>
              <p className="font-[family-name:var(--font-ob-display)] text-2xl md:text-3xl text-ob-ink leading-[1.4] font-normal whitespace-pre-wrap">
                {narrativeReflection}
              </p>

              {/* Decorative personal touch sign-off in Caveat */}
              <p
                aria-hidden="true"
                className="font-[family-name:var(--font-ob-caveat)] text-2xl text-ob-clay pt-2 select-none"
              >
                — Force
              </p>

              {/* Source badges below as ObBadge pills */}
              {sourceBadges.length > 0 && (
                <div className="pt-4 border-t border-ob-border flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ob-ink-muted font-medium mr-1">Sources:</span>
                  {sourceBadges.map((badge, idx) => (
                    <ObBadge key={idx} variant="neutral">
                      {badge}
                    </ObBadge>
                  ))}
                </div>
              )}
            </>
          )}
        </ObCard>

        {/* Confirm CTA is the single prominent primary button */}
        {!isEditing && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <ObButton
                variant="primary"
                onClick={onConfirm}
                className="w-full sm:w-auto"
              >
                <span>Yes, that&apos;s me</span>
                <span>→</span>
              </ObButton>

              <ObButton
                variant="link"
                onClick={() => setIsEditing(true)}
                className="text-xs text-ob-ink-muted hover:text-ob-ink"
              >
                Not quite — edit or correct
              </ObButton>
            </div>
          </div>
        )}
      </div>
    </StepFrame>
  );
}
