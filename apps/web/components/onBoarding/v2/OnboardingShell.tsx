'use client';

import React from 'react';

/* ──────────────────────────────────────────────────────────────────────
   OnboardingShell
   Fixed-inset light backdrop that prevents any parent dark layout from
   bleeding through.  Provides ambient warm gradients, a top bar with
   FORCE wordmark + step progress, and a centered content slot.
   ────────────────────────────────────────────────────────────────────── */

const STEP_ORDER = [
  'onairos_fork',
  'intro',
  'links',
  'questions',
  'feed',
  'reflection',
] as const;

export type FlowStep = (typeof STEP_ORDER)[number] | 'completed';

interface OnboardingShellProps {
  currentStep: FlowStep;
  children: React.ReactNode;
  customSteps?: readonly FlowStep[] | FlowStep[];
}

export default function OnboardingShell({
  currentStep,
  children,
  customSteps,
}: OnboardingShellProps) {
  const steps = customSteps || STEP_ORDER;
  const stepIndex = steps.indexOf(currentStep as any);
  const total = steps.length;
  const progress = stepIndex >= 0 ? stepIndex + 1 : total;

  return (
    <div
      className="fixed inset-0 z-[100] min-h-dvh bg-ob-canvas text-ob-ink overflow-y-auto font-[family-name:var(--font-ob-body)]"
      style={{ colorScheme: 'light' }}
    >
      {/* ── Ambient warm gradients ────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
      >
        <div className="absolute -top-[20%] -left-[10%] h-[700px] w-[700px] rounded-full bg-[#9F6958] opacity-[0.07] blur-[140px]" />
        <div className="absolute -bottom-[15%] -right-[10%] h-[600px] w-[600px] rounded-full bg-[#D4A88C] opacity-[0.08] blur-[120px]" />
      </div>

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-8">
        {/* FORCE wordmark (display font >= text-xl) */}
        <span className="font-[family-name:var(--font-ob-display)] text-xl font-semibold tracking-wide text-ob-ink select-none">
          FORCE
        </span>

        {/* Step progress (presentational) */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx < progress
                  ? 'w-5 bg-ob-clay'
                  : idx === progress
                    ? 'w-3 bg-ob-clay/40'
                    : 'w-1.5 bg-ob-border-strong'
              }`}
            />
          ))}
        </div>
      </header>

      {/* ── Main content slot ────────────────────────────────────── */}
      <main className="relative z-10 flex min-h-[calc(100dvh-4rem)] w-full flex-col items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </main>
    </div>
  );
}
