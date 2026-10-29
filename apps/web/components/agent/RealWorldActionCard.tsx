'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Footprints,
  PhoneCall,
  Coffee,
  Utensils,
  Sparkles,
  Clock,
  Check,
  CheckCircle2,
  Copy,
  ArrowRight,
  X,
  Heart,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { InterventionFeedbackBar } from './InterventionFeedbackBar';

export type RealWorldActionType =
  | 'walk'
  | 'call_friend'
  | 'take_break'
  | 'meal'
  | 'custom'
  | string;

export interface RealWorldActionData {
  action_type: RealWorldActionType;
  title: string;
  description: string;
  estimated_minutes?: number;
  target_person?: string;
  suggested_prompt?: string;
}

export interface RealWorldActionCardProps {
  action: RealWorldActionData;
  messageId?: string;
  interactionEventId?: string;
  onStatusChange?: (status: 'started' | 'completed' | 'dismissed') => void;
  className?: string;
}

interface ActionConfig {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

const DEFAULT_CONFIG: ActionConfig = {
  label: 'Real-World Action · Offline',
  icon: Sparkles,
  accentColor: '#8f4d30',
  bgColor: 'bg-[#FAF7F2]',
  borderColor: 'border-[#E6DFD5]',
  textColor: 'text-[#2E2012]',
};

const ACTION_CONFIGS: Record<string, ActionConfig> = {
  walk: {
    label: 'Real-World Action · Walk',
    icon: Footprints,
    accentColor: '#4A6B53',
    bgColor: 'bg-emerald-50/70',
    borderColor: 'border-emerald-200/80',
    textColor: 'text-emerald-900',
  },
  call_friend: {
    label: 'Real-World Action · Connection',
    icon: PhoneCall,
    accentColor: '#8f4d30',
    bgColor: 'bg-[#FAF3EE]',
    borderColor: 'border-[#E6D4C6]',
    textColor: 'text-[#5A2C18]',
  },
  take_break: {
    label: 'Real-World Action · Rest & Reset',
    icon: Coffee,
    accentColor: '#7A5A3A',
    bgColor: 'bg-[#F7F4EF]',
    borderColor: 'border-[#E6DEC4]',
    textColor: 'text-[#4A321A]',
  },
  meal: {
    label: 'Real-World Action · Meal',
    icon: Utensils,
    accentColor: '#9C6644',
    bgColor: 'bg-[#FBF6F0]',
    borderColor: 'border-[#EADCCF]',
    textColor: 'text-[#5C3822]',
  },
  custom: DEFAULT_CONFIG,
};

export function RealWorldActionCard({
  action,
  messageId,
  interactionEventId,
  onStatusChange,
  className = '',
}: RealWorldActionCardProps) {
  const [status, setStatus] = useState<'idle' | 'started' | 'completed' | 'dismissed'>('idle');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const config: ActionConfig =
    (action?.action_type && ACTION_CONFIGS[action.action_type]) || DEFAULT_CONFIG;
  const IconComponent = config.icon;

  const logActionState = async (nextStatus: 'started' | 'completed' | 'dismissed') => {
    try {
      await fetch('/api/agent/v2/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: `real_world_action_${nextStatus}`,
          event_data: {
            action_type: action.action_type,
            title: action.title,
            estimated_minutes: action.estimated_minutes,
            target_person: action.target_person,
            message_id: messageId,
          },
          source: 'web_app',
        }),
      });
    } catch {
      // best-effort event logging
    }
  };

  const handleStart = () => {
    setStatus('started');
    logActionState('started');
    onStatusChange?.('started');
    toast.success('Stepping away. Force will hold your context until you return.', {
      duration: 4000,
    });
  };

  const handleComplete = () => {
    setStatus('completed');
    logActionState('completed');
    onStatusChange?.('completed');
    toast.success('Completed! Nice job reconnecting with the physical world.');
  };

  const handleDismiss = () => {
    setStatus('dismissed');
    logActionState('dismissed');
    onStatusChange?.('dismissed');
  };

  const handleCopyPrompt = () => {
    if (action.suggested_prompt) {
      navigator.clipboard.writeText(action.suggested_prompt);
      setCopiedPrompt(true);
      toast.success('Message copied to clipboard');
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  if (status === 'dismissed') {
    return (
      <div className="ml-7 mt-2 text-xs text-[#A39284] italic">
        Action deferred for later.
      </div>
    );
  }

  return (
    <div
      className={`ml-7 mt-3 rounded-2xl border ${config.borderColor} ${config.bgColor} p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 shadow-2xs">
            <IconComponent size={14} className={config.textColor} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5C3E21]">
            {config.label}
          </span>
        </div>

        {action.estimated_minutes && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-[#7A5A3A] border border-black/5">
            <Clock size={11} />
            <span>~{action.estimated_minutes} min</span>
          </span>
        )}
      </div>

      {/* Main Action Content */}
      <div className="mt-3 space-y-2">
        <h4 className="font-serif text-base sm:text-lg font-semibold text-[#1F140D] leading-snug">
          {action.title}
        </h4>
        <p className="text-xs sm:text-sm text-[#5C3E21] leading-relaxed">
          {action.description}
        </p>

        {/* Target person / Suggested conversation starter */}
        {action.suggested_prompt && (
          <div className="mt-2.5 rounded-xl border border-black/5 bg-white/80 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C7A6B]">
                Suggested Starter {action.target_person ? `for ${action.target_person}` : ''}
              </span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1 text-[11px] text-[#8f4d30] hover:underline cursor-pointer"
              >
                {copiedPrompt ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-xs text-[#2E2012] italic">&ldquo;{action.suggested_prompt}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Interactive Action Controls */}
      <div className="mt-4 pt-3 border-t border-black/5 flex flex-wrap items-center justify-between gap-2.5">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#8f4d30] px-3.5 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-[#723c24] transition-all cursor-pointer"
              >
                <ArrowRight size={13} />
                <span>Doing this now</span>
              </button>

              <button
                type="button"
                onClick={handleComplete}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5C9BD] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#5C3E21] hover:bg-white transition-all cursor-pointer"
              >
                <Check size={13} />
                <span>Mark completed</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="text-[11px] text-[#8C7A6B] hover:text-[#2E2012] px-2 py-1 transition-colors cursor-pointer"
              >
                Maybe later
              </button>
            </motion.div>
          )}

          {status === 'started' && (
            <motion.div
              key="started"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between w-full gap-2"
            >
              <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Active offline. Step outside — take your time.</span>
              </div>

              <button
                type="button"
                onClick={handleComplete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors shadow-2xs cursor-pointer"
              >
                <Check size={13} />
                <span>I'm back · Completed</span>
              </button>
            </motion.div>
          )}

          {status === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 size={16} className="text-emerald-700" />
              <span>Great job taking action in the real world. Your context is preserved.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Integrated feedback bar right on the action card */}
        <InterventionFeedbackBar
          compact
          messageId={messageId || 'action'}
          interactionEventId={interactionEventId}
          className="ml-auto"
        />
      </div>
    </div>
  );
}

export default RealWorldActionCard;
