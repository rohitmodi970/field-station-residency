"use client"
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ImmersiveOnboarding } from './ImmersiveOnboarding';
import { WaitlistTracker } from '@/lib/waitlist-analytics';
import { useRouter, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/posthog-events';

const ONBOARDING_PHASES = ['Awaken', 'Align', 'Choose', 'Reflect', 'Claim', 'Enter'];

const WaitlistTopProgress = ({
  currentStep,
  totalSteps,
  show,
}: {
  currentStep: number;
  totalSteps: number;
  show: boolean;
}) => {
  if (!show) return null;

  const clampedStep = Math.min(Math.max(currentStep, 1), totalSteps);
  const currentPhase = ONBOARDING_PHASES[clampedStep - 1] || ONBOARDING_PHASES[0];

  return (
    <div
      className="fixed top-0 left-0 right-0 z-55 pointer-events-none "
      role="progressbar"
      aria-label={`Waitlist onboarding progress: ${currentPhase}`}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={clampedStep}
    >
      <div className="relative w-full h-1.5 bg-black/10 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 -left-1/4 w-1/4 bg-linear-to-r from-transparent via-white/60 to-transparent"
          animate={{ x: ['-20%', '520%'] }}
          transition={{ duration: 2.6, ease: 'linear', repeat: Infinity }}
        />
{/*   */}
        <div className="grid grid-cols-6 gap-0.5 h-full">
          {ONBOARDING_PHASES.map((phase, index) => {
            const phaseStep = index + 1;
            const isDone = phaseStep < clampedStep;
            const isActive = phaseStep === clampedStep;

            return (
              <motion.div
                key={phase}
                animate={
                  isActive
                    ? {
                        opacity: [0.9, 1, 0.9],
                        boxShadow: [
                          '0 0 0px rgba(168,85,247,0)',
                          '0 0 14px rgba(168,85,247,0.6)',
                          '0 0 0px rgba(168,85,247,0)'
                        ]
                      }
                    : { opacity: 1, boxShadow: '0 0 0px rgba(0,0,0,0)' }
                }
                transition={isActive ? { duration: 1.7, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                className={[
                  'h-full transition-all duration-300',
                  isDone ? 'bg-gray-700' : '',
                  isActive ? 'bg-gray-400' : '',
                  !isDone && !isActive ? 'bg-white/20' : '',
                ].join(' ')}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const WaitList = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams?.get('email') || '';
  const source = searchParams?.get('source') || '';
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const trackerRef = useRef<WaitlistTracker | null>(null);
  const hasOauthNotice = source === 'oauth' && prefilledEmail;

  // Initialize tracker on mount
  useEffect(() => {
    trackerRef.current = new WaitlistTracker();
  }, []);

  const handleOnboardingComplete = async (data: { energy: string; commitment: boolean; reflection: string; email: string }) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Get analytics data
      const analytics = trackerRef.current?.getAnalytics();

      // Track waitlist join attempt
      trackEvent.waitlistJoined({
        energy_level: data.energy as 'low' | 'medium' | 'high',
        commitment: data.commitment,
        time_spent_seconds: analytics?.timeSpentSeconds || 0,
        utm_source: analytics?.utmParams?.source,
        referrer: analytics?.referrer,
      });

      // Submit to API
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          energy: data.energy,
          commitment: data.commitment,
          reflection: data.reflection,
          timeSpentSeconds: analytics?.timeSpentSeconds || 0,
          userAgent: analytics?.userAgent || '',
          referrer: analytics?.referrer || '',
          utmParams: analytics?.utmParams || {},
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to join waitlist');
      }

      // Success - store locally and hide onboarding
      localStorage.setItem('force_onboarded', 'true');
      localStorage.setItem('force_energy', data.energy);
      localStorage.setItem('force_commitment', String(data.commitment));
      localStorage.setItem('force_reflection', data.reflection);
      localStorage.setItem('force_email', data.email);
      localStorage.setItem('force_waitlist_id', result.data.id);
      
      setShowOnboarding(false);

      // Redirect to home after success
      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (error: any) {
      console.error('Waitlist submission error:', error);
      setSubmitError(error.message || 'Failed to join waitlist. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-teal-50 to-green-50">
      <WaitlistTopProgress
        currentStep={currentStep}
        totalSteps={ONBOARDING_PHASES.length}
        show={showOnboarding}
      />

      <ImmersiveOnboarding 
        isOpen={showOnboarding} 
        onComplete={handleOnboardingComplete}
        initialEmail={prefilledEmail}
        step={currentStep}
        onStepChange={setCurrentStep}
        totalSteps={ONBOARDING_PHASES.length}
      />
      
      {/* OAuth User Notice */}
      {hasOauthNotice && (
        <div className="fixed top-0 left-0 right-0 bg-linear-to-r from-purple-600 to-pink-600 text-white px-4 py-3 text-center z-50 shadow-lg">
          <p className="text-sm md:text-base">
            ✨ <strong>Welcome!</strong> We detected you signed in with Google ({prefilledEmail}). 
            Please complete the waitlist form below to get access.
          </p>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-lg font-display">Joining waitlist...</p>
          </div>
        </div>
      )}
      
      {submitError && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md">
          <p className="font-medium">{submitError}</p>
          <button 
            onClick={() => setSubmitError(null)}
            className="absolute top-2 right-2 text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default WaitList;
