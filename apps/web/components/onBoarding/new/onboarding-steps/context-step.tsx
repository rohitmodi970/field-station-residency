'use client';

import { useState, useEffect } from 'react';

interface ContextStepProps {
  onNext: () => void;
}

const manifesto = `Most people don't struggle because they don't think enough.

They struggle because their thinking feels scattered
and hard to trust.

You can write and still feel unclear.
You can talk and still feel stuck.

Force exists to help you understand your thoughts - not just store them.

Because clarity isn't something you wait for.
It's something you build.`;

export default function ContextStep({ onNext }: ContextStepProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [targetText, setTargetText] = useState(manifesto);

  useEffect(() => {
    // Always use the core manifesto; don't append user-supplied extra lines
    setTargetText(manifesto);
    setDisplayedText('');
    setIsComplete(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem('force_onboarding_context', manifesto);
    }
  }, []);

  useEffect(() => {
    if (displayedText.length < targetText.length) {
      const timer = setTimeout(() => {
        setDisplayedText(targetText.slice(0, displayedText.length + 1));
      }, 55);
      return () => clearTimeout(timer);
    } else {
      setIsComplete(true);
    }
  }, [displayedText, targetText]);

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-20 flex flex-col items-center justify-center min-h-screen">
      {/* Mac-style window */}
      <div className="w-full max-w-xl bg-white/95 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-700">
        {/* Title bar with traffic lights */}
        <div className="bg-gray-100 px-6 py-4 flex items-center gap-3 border-b border-gray-200">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
        </div>

        {/* Content */}
        <div className="p-8 min-h-96 flex flex-col justify-between">
          {/* Typewriter text */}
          <div className="font-terminal-grotesque text-lg md:text-xl text-foreground leading-9 font-medium whitespace-pre-wrap tracking-[0.01em]">
            <span>{displayedText}</span>
            {!isComplete && <span className="animate-blink">|</span>}
          </div>

          {/* Button appears when complete */}
          {isComplete && (
            <button
              onClick={onNext}
              className="mt-8 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 self-start font-terminal-grotesque text-lg font-medium animate-in fade-in"
            >
              Let&apos;s go
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
