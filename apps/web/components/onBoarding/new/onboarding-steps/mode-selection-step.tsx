"use client";
import AnimatedOrb from './animated-orb';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/quilted-gallery/ui/button';
interface ModeSelectionStepProps {
  onNext: (mode: 'write' | 'speak') => void;
  onClose: () => void;
}

export default function ModeSelectionStep({ onNext, onClose }: ModeSelectionStepProps) {
  const router = useRouter();
  const handleClose = () => {
    const confirmed = window.confirm('Exit onboarding for now? You can finish it later.');
    if (!confirmed) {
      return;
    }
    onClose();
  };

  const [question, setQuestion] = useState<string | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);

  useEffect(() => {
    let isActive = true;

    const buildPromptForQuestion = (reflection: string) => {
      return `Write one short reflective question that naturally continues the user's thought process.

The question should:
- feel personal and emotionally intelligent
- be grounded in the user's actual reflection
- help them begin expressing what's already on their mind
- avoid generic journaling language
- avoid sounding poetic, therapeutic, or motivational
- feel calm, direct, and human

The user will answer by either speaking or writing.

Keep it under 25 words.
Return only the question.

User reflection:
"""${reflection}"""`;
    };

    const generateQuestionFromReflection = async (reflection: string) => {
      setIsLoadingQuestion(true);
      try {
        // Persist reflection to server so it is stored like other onboarding data
        try {
          await fetch('/api/personalization/bucket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reflection }),
          });
        } catch (err) {
          // ignore persistence errors client-side
          console.debug('Failed to persist reflection:', err);
        }

        const resp = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: buildPromptForQuestion(reflection), provider: 'claude', options: { rawPrompt: true } }),
        });

        if (!resp.ok) {
          throw new Error('LLM request failed');
        }

        const data = await resp.json();
        const text = String(data?.text || '').trim();
        if (!text) throw new Error('No text returned');

        if (isActive) {
          setQuestion(text);
          // Save to localStorage for persistence
          if (typeof window !== 'undefined') {
            localStorage.setItem('force_mode_selection_question', text);
          }
        }
      } catch (error) {
        console.error('Failed to generate question from reflection:', error);
      } finally {
        if (isActive) setIsLoadingQuestion(false);
      }
    };

    const loadQuestion = async () => {
      // Prefer local question if already generated
      const cachedQuestion = typeof window !== 'undefined' ? localStorage.getItem('force_mode_selection_question') : null;
      if (cachedQuestion && cachedQuestion.trim()) {
        if (isActive) setQuestion(cachedQuestion.trim());
        return;
      }

      // Prefer local reflection if available
      const localReflection = typeof window !== 'undefined' ? localStorage.getItem('force_reflection') : null;
      if (localReflection && localReflection.trim()) {
        void generateQuestionFromReflection(localReflection.trim());
        return;
      }

      // Otherwise, fall back to server-generated personalized prompt
      try {
        const resp = await fetch('/api/prompts/personalized');
        if (!resp.ok) return;
        const json = await resp.json();
        const promptText = json?.prompt?.text;
        if (isActive && promptText) {
          setQuestion(promptText);
          // Save to localStorage for persistence
          if (typeof window !== 'undefined') {
            localStorage.setItem('force_mode_selection_question', promptText);
          }
        }
      } catch (err) {
        console.debug('Failed to fetch personalized prompt fallback:', err);
      }
    };

    void loadQuestion();

    return () => { isActive = false; };
  }, []);

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center px-6 py-12 relative">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md font-terminal-grotesque"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Animated orb */}
      <div className="mb-20 relative">
        <div className="relative">
          <AnimatedOrb />
        </div>
      </div>

      {/* Question */}
      <h2 className="font-terminal-grotesque text-4xl md:text-5xl text-gray-700 font-medium mb-16 text-center max-w-2xl leading-relaxed tracking-[-0.02em]">
        {isLoadingQuestion ? 'Thinking about a good question...' : question || 'How would you like to start?'}
      </h2>

      {/* Mode options - pill buttons */}
      <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch max-w-4xl w-full">
        {/* Speak it out */}
        <button
          onClick={() => onNext('speak')}
          className="flex-1 px-8 py-8 bg-white/95 hover:bg-white rounded-3xl shadow-lg hover:shadow-none transition-all duration-200 flex flex-col items-center justify-center gap-4 group hover:scale-105 transform font-terminal-grotesque"
        >
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <div className="w-3 h-3 rounded-full bg-gray-400" />
          </div>
          <div className="text-3xl font-terminal-grotesque font-medium text-gray-800 text-center leading-tight tracking-[-0.01em]">
            Speak<br />it out
          </div>
          <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" />
            </svg>
          </div>
        </button>

        {/* Write it down */}
        <button
          onClick={() => onNext('write')}
          className="flex-1 px-8 py-8 bg-white/95 hover:bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-4 group hover:scale-105 transform font-terminal-grotesque"
        >
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <div className="w-3 h-3 rounded-full bg-gray-400" />
          </div>
          <div className="text-3xl font-terminal-grotesque font-medium text-gray-800 text-center leading-tight tracking-[-0.01em]">
            Write<br />it down
          </div>
          <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        </button>

      </div>

      <div
        onClick={async () => {
          try {
            // Persist a lightweight local flag for immediate UX
            if (typeof window !== 'undefined') {
              localStorage.setItem('force_onboarding_completed', 'true');
            }

            // Try to mark onboarding completed server-side via Supabase
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { error } = await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id);
              if (error) console.error('Failed to mark onboarding complete:', error);
            }
          } catch (err) {
            console.error('Error completing onboarding on Explore click:', err);
          } finally {
            // Navigate to dashboard regardless of update result
            router.push('/dashboard');
          }
        }}
        className="mt-10 font-terminal-grotesque text-xl font-medium tracking-wide hover:cursor-alias text-gray-600 bg-none rounded-full px-6 py-3 transition-all duration-200"
      >
        Explore
      </div>
    </div>
  );
}
