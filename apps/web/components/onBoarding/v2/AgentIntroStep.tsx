'use client';

import React, { useState, useEffect } from 'react';
import AnimatedOrb from '../new/onboarding-steps/animated-orb';
import StepFrame from './StepFrame';
import { ObButton, ObCard, ObInput, ObSpinner } from './ui';

interface AgentIntroStepProps {
  onStart: () => void;
}

export default function AgentIntroStep({ onStart }: AgentIntroStepProps) {
  const lines = [
    "I'm Force.",
    "I'm trying to understand how you think, what you care about, and what's going on in your life.",
    'Not to judge. Just to be useful.',
  ];

  const [lineIndex, setLineIndex] = useState(0);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callingState, setCallingState] = useState<'idle' | 'calling' | 'success' | 'error'>('idle');
  const [callMessage, setCallMessage] = useState('');

  // Check prefers-reduced-motion and reveal lines staggered by 400ms
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLineIndex(lines.length - 1);
      return;
    }

    if (lineIndex < lines.length - 1) {
      const timer = setTimeout(() => {
        setLineIndex((prev) => prev + 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [lineIndex, lines.length]);

  const handleVoiceCall = async () => {
    if (!phoneNumber.trim()) return;
    setCallingState('calling');
    setCallMessage('Connecting to Force Voice...');

    try {
      const res = await fetch('/api/onboarding/v2/voice-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCallingState('error');
        setCallMessage(data.error || 'Failed to initiate phone call');
        return;
      }

      setCallingState('success');
      setCallMessage(`Calling ${phoneNumber}... Please answer when your phone rings!`);
    } catch (e: any) {
      setCallingState('error');
      setCallMessage(e.message || 'Error triggering phone call');
    }
  };

  const isRevealed = lineIndex >= lines.length - 1;

  return (
    <StepFrame width="md" align="center">
      <div className="flex flex-col items-center space-y-7">
        {/* Orb */}
        <div className="scale-105 my-1">
          <AnimatedOrb />
        </div>

        {/* 3 Lines Revealed Staggered (400ms) */}
        <div className="space-y-3.5 max-w-lg mx-auto min-h-[160px] flex flex-col justify-center">
          {lines.slice(0, lineIndex + 1).map((line, idx) => {
            if (idx === 0) {
              return (
                <h1
                  key={idx}
                  className="text-4xl md:text-5xl font-[500] tracking-normal leading-[1.1] text-balance text-ob-ink font-[family-name:var(--font-ob-display)] animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  I&apos;m <em className="not-italic italic text-ob-clay-strong">Force</em>.
                </h1>
              );
            }
            return (
              <p
                key={idx}
                className={[
                  'text-base leading-relaxed text-ob-ink-muted font-normal text-pretty font-[family-name:var(--font-ob-body)] animate-in fade-in slide-in-from-bottom-2 duration-300',
                  idx === 2 ? 'italic text-ob-ink' : '',
                ].join(' ')}
              >
                {line}
              </p>
            );
          })}
        </div>

        {/* CTA Block: revealed once lines are shown or under reduced motion */}
        <div
          className={[
            'flex flex-col items-center space-y-3 w-full max-w-sm transition-opacity duration-500',
            isRevealed ? 'opacity-100' : 'opacity-0 pointer-events-none',
          ].join(' ')}
        >
          {!showPhoneInput ? (
            <>
              <ObButton
                variant="primary"
                onClick={onStart}
                className="w-full"
              >
                <span>Let&apos;s start</span>
                <span>→</span>
              </ObButton>

              <ObButton
                variant="link"
                onClick={() => setShowPhoneInput(true)}
                className="pt-1 text-xs"
              >
                <span className="mr-1.5">📞</span>
                <span>Call me instead — let&apos;s talk for 2 mins</span>
              </ObButton>
            </>
          ) : (
            <ObCard layer="raised" className="w-full p-5 space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ob-ink block">
                  Your Mobile Number (with country code)
                </label>
                <ObInput
                  type="tel"
                  placeholder="+1 555 123 4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={callingState === 'calling' || callingState === 'success'}
                />
              </div>

              {callMessage && (
                <p
                  className={[
                    'text-xs font-medium',
                    callingState === 'error' ? 'text-ob-danger' : 'text-ob-success',
                  ].join(' ')}
                >
                  {callMessage}
                </p>
              )}

              {callingState !== 'success' ? (
                <ObButton
                  variant="primary"
                  onClick={handleVoiceCall}
                  disabled={callingState === 'calling' || !phoneNumber.trim()}
                  className="w-full h-11 text-xs"
                >
                  {callingState === 'calling' ? (
                    <span className="inline-flex items-center gap-2">
                      <ObSpinner size="sm" />
                      <span>Connecting call...</span>
                    </span>
                  ) : (
                    <span>Ring me now →</span>
                  )}
                </ObButton>
              ) : (
                <div className="p-3 bg-ob-success-soft border border-ob-success/30 rounded-xl text-xs text-ob-success space-y-1">
                  <p className="font-medium">Call in progress!</p>
                  <p className="text-ob-ink-muted text-xs">
                    When you finish the call, your reflection will appear on your dashboard.
                  </p>
                </div>
              )}

              <div className="text-center pt-1">
                <ObButton
                  variant="link"
                  onClick={() => {
                    setShowPhoneInput(false);
                    setCallingState('idle');
                    setCallMessage('');
                  }}
                  className="text-xs"
                >
                  ← Back to screen flow
                </ObButton>
              </div>
            </ObCard>
          )}
        </div>
      </div>
    </StepFrame>
  );
}
