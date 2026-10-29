'use client';

import { useState, useEffect } from 'react';
import AnimatedOrb from './animated-orb';
import { isEnergyBucket } from '@/lib/personalization/bucket';
import type { EnergyBucket } from '@/lib/personalization/types';

interface RecognitionStepProps {
  onNext: () => void;
  onExplore: () => void;
}

const BUCKET_PHRASES: Record<EnergyBucket, string> = {
  clarity: 'looking for clarity',
  growth: 'ready for growth',
  stability: 'craving stability',
};

export default function RecognitionStep({ onNext, onExplore }: RecognitionStepProps) {
  const [showQuestion, setShowQuestion] = useState(false);
  const [bucketPhrase, setBucketPhrase] = useState(BUCKET_PHRASES.clarity);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowQuestion(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadBucket = async () => {
      try {
        const waitlistEnergy = typeof window !== 'undefined'
          ? localStorage.getItem('force_energy')
          : null;
        if (waitlistEnergy && isEnergyBucket(waitlistEnergy)) {
          setBucketPhrase(BUCKET_PHRASES[waitlistEnergy]);
          return;
        }

        const response = await fetch('/api/personalization/bucket');
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!isActive) {
          return;
        }

        if (isEnergyBucket(data?.bucket)) {
          const bucket = data.bucket as EnergyBucket;
          setBucketPhrase(BUCKET_PHRASES[bucket]);
        }
      } catch (error) {
        console.error('Failed to load onboarding bucket:', error);
      }
    };

    loadBucket();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-20 flex flex-col items-center justify-center min-h-screen">
      {/* Animated orb */}
      <div className="mb-16">
        <AnimatedOrb />
      </div>

      {/* Opening statement */}
      <div className="text-center space-y-8 mb-12">
        <p className="font-terminal-grotesque text-3xl md:text-4xl text-foreground leading-relaxed font-medium tracking-[-0.02em]">
          The last time we spoke,<br />
          you were {bucketPhrase}.
        </p>

        {/* Second line appears after 1 second */}
        {showQuestion && (
          <p className="font-terminal-grotesque text-3xl md:text-4xl text-foreground animate-in fade-in duration-700 font-medium tracking-[-0.02em]">
            Does that still feel true?
          </p>
        )}
      </div>

      {/* Button options */}
      {showQuestion && (
        <div className="w-full max-w-sm space-y-3 animate-in fade-in duration-700">
          <button
            onClick={onNext}
            className="w-full py-4 px-6 text-center font-terminal-grotesque text-lg font-medium text-foreground hover:bg-white/30 rounded-2xl border border-foreground/10 hover:border-foreground/30 transition-all duration-200 bg-white/20"
          >
            Yes, still here
          </button>
          <button
            onClick={onNext}
            className="w-full py-4 px-6 text-center font-terminal-grotesque text-lg font-medium text-foreground hover:bg-white/30 rounded-2xl border border-foreground/10 hover:border-foreground/30 transition-all duration-200 bg-white/20"
          >
            Not as much anymore
          </button>
          
        </div>
      )}
    </div>
  );
}
