'use client';

import React, { useState } from 'react';
import AnimatedOrb from '../new/onboarding-steps/animated-orb';
import StepFrame from './StepFrame';
import { ObButton, ObChip, ObTextarea, ObSpinner } from './ui';

export interface QuestionConfig {
  id: 'q1_current_state' | 'q2_values' | 'q3_relationships' | 'q4_current_thread' | 'q5_aspiration';
  prompt: string;
  emphasisWord: string; // one word/phrase to italicize in Cormorant italic + clay-strong
  chips: string[];
  placeholder: string;
}

export const CONVERSATIONAL_QUESTIONS: QuestionConfig[] = [
  {
    id: 'q1_current_state',
    prompt: "If someone asked you 'how's life?' right now — honestly — what would you say?",
    emphasisWord: 'honestly',
    chips: ['Things are good', "It's complicated", "Honestly, I'm not sure", 'In a big transition'],
    placeholder: 'Type your answer...',
  },
  {
    id: 'q2_values',
    prompt: "What's something you care about that most people around you don't really get?",
    emphasisWord: 'care',
    chips: ['My need for alone time', 'How I think about work', "Something I'm building", 'A belief I hold'],
    placeholder: 'What matters deeply to you...',
  },
  {
    id: 'q3_relationships',
    prompt: "Who's the first person you'd call if something really good happened to you?",
    emphasisWord: 'first',
    chips: ['My partner', 'A close friend', 'A family member', "Honestly, I'd keep it to myself"],
    placeholder: 'Who comes to mind...',
  },
  {
    id: 'q4_current_thread',
    prompt: "What's one thing that keeps coming back to your mind lately — something you haven't fully figured out?",
    emphasisWord: 'fully',
    chips: ['A decision I need to make', 'Something about work', 'A relationship', 'What I actually want'],
    placeholder: "What's occupying your headspace...",
  },
  {
    id: 'q5_aspiration',
    prompt: 'If Force could help you with one thing over the next month, what would be most useful?',
    emphasisWord: 'one thing',
    chips: ['Help me think more clearly', 'Understand my patterns', 'Communicate better with someone', 'Just help me process'],
    placeholder: 'What would be highest leverage...',
  },
];

/**
 * Renders prompt text with the emphasisWord wrapped in Cormorant italic + clay-strong.
 * No copy is changed — only the target word is styled.
 */
function renderPrompt(prompt: string, emphasisWord: string) {
  const idx = prompt.toLowerCase().indexOf(emphasisWord.toLowerCase());
  if (idx === -1) return <>{prompt}</>;
  return (
    <>
      {prompt.slice(0, idx)}
      <em className="italic font-[family-name:var(--font-ob-display)] text-ob-clay-strong">
        {prompt.slice(idx, idx + emphasisWord.length)}
      </em>
      {prompt.slice(idx + emphasisWord.length)}
    </>
  );
}

interface ConversationalQuestionProps {
  question?: QuestionConfig;
  questionIndex: number; // 0-based index within active questions
  initialAnswer?: string;
  initialChips?: string[];
  totalQuestions?: number;
  skipBadge?: string;
  onAnswerSubmit: (
    question: QuestionConfig,
    answer: string,
    chips: string[]
  ) => Promise<void> | void;
  onSkip: () => void;
}

export default function ConversationalQuestion({
  question,
  questionIndex,
  initialAnswer = '',
  initialChips = [],
  totalQuestions = CONVERSATIONAL_QUESTIONS.length,
  skipBadge,
  onAnswerSubmit,
  onSkip,
}: ConversationalQuestionProps) {
  const currentQ: QuestionConfig =
    question || CONVERSATIONAL_QUESTIONS[questionIndex] || CONVERSATIONAL_QUESTIONS[0]!;

  const [answer, setAnswer] = useState(initialAnswer);
  const [selectedChips, setSelectedChips] = useState<string[]>(initialChips);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleChip = (chip: string) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleNext = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await onAnswerSubmit(currentQ, answer, selectedChips);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <StepFrame width="md" align="center">
      <div className="flex flex-col items-center space-y-6">
        {/* Orb */}
        <div className="scale-75 -my-4">
          <AnimatedOrb />
        </div>

        {/* Eyebrow & Segmented Progress Bar */}
        <div className="space-y-2 w-full max-w-md mx-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-ob-clay-strong font-semibold font-[family-name:var(--font-ob-body)]">
              <span className="tabular-nums">Question {questionIndex + 1} of {totalQuestions}</span>
            </p>
            {skipBadge && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ob-clay-strong bg-ob-clay/10 px-2.5 py-0.5 rounded-full border border-ob-clay/20 animate-in fade-in duration-300">
                <span>⚡</span>
                <span>{skipBadge}</span>
              </span>
            )}
          </div>

          <div
            role="progressbar"
            aria-valuenow={questionIndex + 1}
            aria-valuemin={1}
            aria-valuemax={totalQuestions}
            className="flex items-center gap-1.5 w-full max-w-xs mx-auto py-0.5"
          >
            {Array.from({ length: totalQuestions }).map((_, idx) => (
              <div
                key={idx}
                className={[
                  'h-1 rounded-full flex-1 transition-all duration-300',
                  idx <= questionIndex ? 'bg-ob-clay' : 'bg-ob-border',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        {/* Question Prompt in Display Serif — text-3xl/text-4xl per spec (one step below display headings) */}
        <div className="space-y-2 max-w-lg mx-auto">
          <h1 className="text-3xl md:text-4xl font-[500] tracking-normal leading-[1.1] text-balance text-ob-ink font-[family-name:var(--font-ob-display)]">
            &ldquo;{renderPrompt(currentQ.prompt, currentQ.emphasisWord)}&rdquo;
          </h1>
        </div>

        {/* Chips Centered and Wrapping */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
          {currentQ.chips.map((chip) => (
            <ObChip
              key={chip}
              selected={selectedChips.includes(chip)}
              onToggle={() => toggleChip(chip)}
            >
              {chip}
            </ObChip>
          ))}
        </div>

        {/* Auto-growing Textarea */}
        <div className="w-full relative">
          <ObTextarea
            autoGrow
            minRows={3}
            maxRows={8}
            placeholder={currentQ.placeholder}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="hidden sm:block absolute bottom-3 right-4 text-xs text-ob-ink-faint select-none pointer-events-none">
            ⌘ + Enter to continue
          </span>
        </div>

        {/* Actions & Mobile Sticky Bottom Bar */}
        <div className="w-full pt-4 sticky bottom-0 bg-ob-canvas/90 backdrop-blur-md pb-safe py-3 px-4 -mx-4 flex items-center justify-between border-t border-ob-border/40 sm:static sm:bg-transparent sm:backdrop-blur-none sm:p-0 sm:m-0 sm:border-0 z-10">
          <ObButton
            variant="link"
            onClick={onSkip}
          >
            Skip
          </ObButton>

          <ObButton
            variant="primary"
            disabled={isSubmitting}
            onClick={handleNext}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <ObSpinner size="sm" />
                <span>Saving...</span>
              </span>
            ) : (
              <>
                <span>{questionIndex === totalQuestions - 1 ? 'Review' : 'Continue'}</span>
                <span>→</span>
              </>
            )}
          </ObButton>
        </div>
      </div>
    </StepFrame>
  );
}
