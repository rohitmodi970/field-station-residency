'use client';

import { useEffect, useState } from 'react';
import AnimatedOrb from './animated-orb';

interface ReflectionStepProps {
  onNext: () => void;
}

const FALLBACK_LINE = 'You said you wanted to work on\ncommunicating clearly and asking better questions.';

function buildReflectionPrompt(reflection: string): string {
  return `Rewrite the user's reflection into one emotionally precise sentence.

The sentence should:
- sound grounded, observant, and human
- preserve the user's actual tension, desire, or transition
- avoid generic inspirational language
- avoid sounding like a therapist or productivity app
- feel like something the user could have written themselves, just clearer

Keep it between 18–35 words.

Return only the sentence.

User reflection:
"""${reflection}"""`;
}

export default function ReflectionStep({ onNext }: ReflectionStepProps) {
  const [summaryLine, setSummaryLine] = useState(FALLBACK_LINE);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const setCompactedReflection = async (reflection: string, isActive: boolean) => {
    try {
      const llmResponse = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: buildReflectionPrompt(reflection),
          provider: 'claude',
          options: { rawPrompt: true, temperature: 0.4 },
        }),
      });

      if (!llmResponse.ok) {
        return;
      }

      const llmData = await llmResponse.json();
      const rawText = String(llmData?.text || '').trim();
      if (!rawText || !isActive) {
        return;
      }

      const firstLine = rawText.split('\n').find((line) => line.trim().length > 0) || '';
      const cleaned = firstLine
        .replace(/^['"`]+|['"`]+$/g, '')
        .trim();

      if (cleaned) {
        setSummaryLine(cleaned);
        setIsFallback(false);
      }
    } finally {
      if (isActive) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadReflection = async () => {
      try {
        const waitlistReflection = typeof window !== 'undefined'
          ? localStorage.getItem('force_reflection')
          : null;
        const reflectionSource = String(waitlistReflection || '').trim();

        if (reflectionSource) {
          await setCompactedReflection(reflectionSource, isActive);
          if (isActive) {
            setIsFallback(false);
          }
          return;
        }

        const bucketResponse = await fetch('/api/personalization/bucket');
        if (!bucketResponse.ok) {
          if (isActive) {
            setIsFallback(true);
            setIsLoading(false);
          }
          return;
        }

        const bucketData = await bucketResponse.json();
        const reflection = String(bucketData?.reflection || '').trim();
        if (!reflection) {
          if (isActive) {
            setIsFallback(true);
            setIsLoading(false);
          }
          return;
        }

        await setCompactedReflection(reflection, isActive);
      } catch (error) {
        console.error('Failed to load reflection summary:', error);
        if (isActive) {
          setIsFallback(true);
          setIsLoading(false);
        }
      }
    };

    loadReflection();

    return () => {
      isActive = false;
    };
  }, []);

  const summaryLines = summaryLine.split('\n');
// button to show intro again for testing
  if (showIntro) {
    return (
      <button
        type="button"
        onClick={() => setShowIntro(false)}
        className="w-full min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center cursor-pointer"
      >
        <div className="mb-16">
          <AnimatedOrb />
        </div>

        <h2 className="font-terminal-grotesque text-5xl md:text-4xl text-foreground/80 leading-relaxed font-medium max-w-3xl tracking-[-0.02em]">
          Picking up where you left off.
        </h2>

        <p className="mt-16 font-terminal-grotesque text-base md:text-lg text-foreground/30 font-medium tracking-[0.08em] uppercase">
          Click anywhere to continue
        </p>
      </button>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-20 flex flex-col items-center justify-center min-h-screen">
      {/* Animated orb */}
      <div className="mb-16">
        <AnimatedOrb />
      </div>

      <div className="text-center space-y-8 mb-12">
        {isLoading ? (
          <div className="space-y-4">
            <p className="font-terminal-grotesque text-base md:text-lg uppercase tracking-[0.24em] text-foreground/40 font-medium">Gathering your reflection</p>
            <div className="mx-auto h-1.5 w-32 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-foreground/40" />
            </div>
          </div>
        ) : (
          <>
            <p className="font-terminal-grotesque text-4xl md:text-4xl text-foreground leading-relaxed font-medium tracking-[-0.02em]">
              {summaryLines.map((line, index) => (
                <span key={index}>
                  {line}
                  {index < summaryLines.length - 1 && <br />}
                </span>
              ))}
            </p>
            <p className="font-terminal-grotesque text-xl md:text-2xl text-foreground/60 font-medium tracking-[0.01em]">
              {isFallback ? "Let's begin from here." : "Let's start there."}
            </p>
          </>
        )}
      </div>

      {!isLoading && (
        <button
          onClick={onNext}
          className="font-terminal-grotesque px-8 py-4 text-center text-lg text-foreground bg-white/20 hover:bg-white/30 rounded-2xl border border-foreground/10 hover:border-foreground/30 transition-all duration-200"
        >
          Continue
        </button>
      )}
    </div>
  );
}
