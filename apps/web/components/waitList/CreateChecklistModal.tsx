"use client"
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, CalendarDays, CalendarRange, Briefcase, Heart, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Period } from '@/types/checklist';

interface CreateChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, period: Period, template: string) => void;
}

const periods: { value: Period; label: string; icon: typeof Calendar; description: string }[] = [
  { value: 'daily', label: 'Daily', icon: Calendar, description: 'Reset every day' },
  { value: 'weekly', label: 'Weekly', icon: CalendarDays, description: 'Reset every week' },
  { value: 'monthly', label: 'Monthly', icon: CalendarRange, description: 'Reset every month' },
];

const templates = [
  { value: 'work', label: 'Work Focus', icon: Briefcase, description: 'Prioritize professional goals' },
  { value: 'personal', label: 'Personal Focus', icon: Heart, description: 'Focus on wellbeing & relationships' },
  { value: 'balanced', label: 'Balanced', icon: Scale, description: 'Equal focus on both' },
];

export const CreateChecklistModal = ({ isOpen, onClose, onCreate }: CreateChecklistModalProps) => {
  const [step, setStep] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('monthly');
  const [selectedTemplate, setSelectedTemplate] = useState('balanced');
  const [name, setName] = useState('');

  const handleCreate = () => {
    const checklistName = name.trim() || `${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Balance`;
    onCreate(checklistName, selectedPeriod, selectedTemplate);
    // Reset state
    setStep(1);
    setSelectedPeriod('monthly');
    setSelectedTemplate('balanced');
    setName('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-4 top-[10%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg z-50"
          >
            <div className="card-elevated p-6 md:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display text-foreground">Create a Balance Checklist</h2>
                  <p className="text-sm text-muted-foreground mt-1">Step {step} of 3</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Steps */}
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h3 className="font-medium text-foreground mb-4">Choose your rhythm</h3>
                    <div className="space-y-3">
                      {periods.map((period) => {
                        const Icon = period.icon;
                        return (
                          <button
                            key={period.value}
                            onClick={() => setSelectedPeriod(period.value)}
                            className={cn(
                              'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                              selectedPeriod === period.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                            )}
                          >
                            <div className={cn(
                              'p-2 rounded-lg',
                              selectedPeriod === period.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                            )}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-foreground">{period.label}</p>
                              <p className="text-sm text-muted-foreground">{period.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h3 className="font-medium text-foreground mb-4">Pick a template</h3>
                    <div className="space-y-3">
                      {templates.map((template) => {
                        const Icon = template.icon;
                        return (
                          <button
                            key={template.value}
                            onClick={() => setSelectedTemplate(template.value)}
                            className={cn(
                              'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                              selectedTemplate === template.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                            )}
                          >
                            <div className={cn(
                              'p-2 rounded-lg',
                              selectedTemplate === template.value 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-secondary text-muted-foreground'
                            )}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-foreground">{template.label}</p>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h3 className="font-medium text-foreground mb-4">Name your checklist (optional)</h3>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Balance`}
                      className="input-force"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      You can always rename it later
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex gap-3 mt-8">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="btn-force-secondary flex-1"
                  >
                    Back
                  </button>
                )}
                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    className="btn-force-primary flex-1"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={handleCreate}
                    className="btn-force-primary flex-1"
                  >
                    Create Checklist
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
