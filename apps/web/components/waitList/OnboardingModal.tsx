import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Heart, Scale, Check, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (focus: string, commitment: string) => void;
}

const focusOptions = [
  { value: 'work', label: 'Work', icon: Briefcase, color: 'work' },
  { value: 'personal', label: 'Personal', icon: Heart, color: 'personal' },
  { value: 'both', label: 'Both', icon: Scale, color: 'balance' },
];

const commitments = [
  { value: 'checkin', label: "I'll check in 3x a week" },
  { value: 'goal', label: "I'll set one measurable goal this month" },
];

export const OnboardingModal = ({ isOpen, onComplete }: OnboardingModalProps) => {
  const [step, setStep] = useState(1);
  const [selectedFocus, setSelectedFocus] = useState('');
  const [selectedCommitment, setSelectedCommitment] = useState('');
  const [customGoal, setCustomGoal] = useState('');

  const handleComplete = () => {
    const commitment = selectedCommitment === 'goal' ? customGoal : selectedCommitment;
    onComplete(selectedFocus, commitment);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                step >= s ? 'bg-primary w-6' : 'bg-border'
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-display text-foreground mb-3"
              >
                Welcome to Force
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg text-muted-foreground mb-12"
              >
                Are you joining to focus on...
              </motion.p>

              <div className="grid grid-cols-3 gap-4 mb-12">
                {focusOptions.map((option, index) => {
                  const Icon = option.icon;
                  const colorClasses = {
                    work: 'border-work bg-work-soft',
                    personal: 'border-personal bg-personal-soft',
                    balance: 'border-balance bg-balance-soft',
                  };
                  return (
                    <motion.button
                      key={option.value}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.1 }}
                      onClick={() => setSelectedFocus(option.value)}
                      className={cn(
                        'relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all',
                        selectedFocus === option.value
                          ? colorClasses[option.color as keyof typeof colorClasses]
                          : 'border-border hover:border-primary/30 bg-card'
                      )}
                    >
                      <Icon className={cn(
                        'w-8 h-8',
                        selectedFocus === option.value 
                          ? option.color === 'work' ? 'text-work' 
                            : option.color === 'personal' ? 'text-personal' 
                            : 'text-balance'
                          : 'text-muted-foreground'
                      )} />
                      <span className="font-medium text-foreground">{option.label}</span>
                      <AnimatePresence>
                        {selectedFocus === option.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => setStep(2)}
                disabled={!selectedFocus}
                className={cn(
                  'btn-force-primary',
                  !selectedFocus && 'opacity-50 cursor-not-allowed'
                )}
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-display text-foreground mb-3"
              >
                One small commitment
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg text-muted-foreground mb-12"
              >
                Choose what feels right for you
              </motion.p>

              <div className="space-y-4 mb-8">
                {commitments.map((commitment, index) => (
                  <motion.button
                    key={commitment.value}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    onClick={() => setSelectedCommitment(commitment.value)}
                    className={cn(
                      'w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left',
                      selectedCommitment === commitment.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30 bg-card'
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                      selectedCommitment === commitment.value
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    )}>
                      {selectedCommitment === commitment.value && (
                        <Check className="w-4 h-4 text-primary-foreground" />
                      )}
                    </div>
                    <span className="font-medium text-foreground">{commitment.label}</span>
                  </motion.button>
                ))}
              </div>

              {selectedCommitment === 'goal' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-8"
                >
                  <input
                    type="text"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder="My goal: finish my book proposal"
                    className="input-force text-center"
                  />
                </motion.div>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setStep(1)}
                  className="btn-force-secondary"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={!selectedCommitment || (selectedCommitment === 'goal' && !customGoal)}
                  className={cn(
                    'btn-force-primary',
                    (!selectedCommitment || (selectedCommitment === 'goal' && !customGoal)) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Let's go
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
