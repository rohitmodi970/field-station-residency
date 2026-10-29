'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Check, Send, X } from 'lucide-react';

export type FeedbackType =
  | 'accurate_and_helpful'
  | 'inaccurate'
  | 'too_intrusive'
  | 'poor_timing'
  | 'irrelevant';

export interface InterventionFeedbackBarProps {
  messageId: string;
  /** If available, the interaction_events row ID for this agent response */
  interactionEventId?: string;
  compact?: boolean;
  className?: string;
}

const NEGATIVE_OPTIONS: Array<{ type: FeedbackType; label: string }> = [
  { type: 'irrelevant', label: 'Not relevant' },
  { type: 'poor_timing', label: 'Poor timing' },
  { type: 'too_intrusive', label: 'Too intrusive' },
  { type: 'inaccurate', label: 'Inaccurate' },
];

/**
 * Minimal intervention feedback bar for agent responses & nudges.
 * "Was this useful?" thumbs up/down + quick reason chips + optional comment.
 * Submits to POST /api/agent/v2/feedback
 */
export function InterventionFeedbackBar({
  messageId,
  interactionEventId,
  compact = false,
  className = '',
}: InterventionFeedbackBarProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [showNegativeDetails, setShowNegativeDetails] = useState(false);
  const [selectedReason, setSelectedReason] = useState<FeedbackType | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [thanked, setThanked] = useState(false);

  const submitFeedback = async (
    type: FeedbackType,
    userComment?: string
  ) => {
    setSending(true);
    try {
      await fetch('/api/agent/v2/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_id: interactionEventId || undefined,
          feedback_type: type,
          user_comment: userComment || undefined,
          rating: type === 'accurate_and_helpful' ? 5 : type === 'inaccurate' ? 2 : 3,
        }),
      });
      setThanked(true);
      setShowNegativeDetails(false);
      setTimeout(() => setThanked(false), 3500);
    } catch {
      // silent fail — feedback is best-effort
    } finally {
      setSending(false);
    }
  };

  const handlePositive = () => {
    setFeedbackGiven('positive');
    submitFeedback('accurate_and_helpful');
  };

  const handleNegativeClick = () => {
    setFeedbackGiven('negative');
    setShowNegativeDetails(true);
  };

  const handleSelectReason = (reason: FeedbackType) => {
    setSelectedReason(reason);
    submitFeedback(reason, comment || undefined);
  };

  const handleSubmitWithComment = () => {
    const feedbackType = selectedReason || 'inaccurate';
    submitFeedback(feedbackType, comment);
  };

  // If already given feedback and thanked state cleared, keep clean
  if (feedbackGiven && !showNegativeDetails && !thanked) return null;

  return (
    <div className={`transition-all select-none ${compact ? 'mt-1' : 'mt-2'} ${className}`}>
      <AnimatePresence mode="wait">
        {/* Thank you acknowledgement */}
        {thanked && (
          <motion.div
            key="thanked"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium"
          >
            <Check size={12} className="text-emerald-600" />
            <span>Thank you for helping Force learn</span>
          </motion.div>
        )}

        {/* Initial "Was this useful?" buttons */}
        {!thanked && !showNegativeDetails && !feedbackGiven && (
          <motion.div
            key="buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1 text-[11px]"
          >
            <span className="text-[10px] text-[#A39284] mr-1">Was this useful?</span>
            <button
              type="button"
              onClick={handlePositive}
              disabled={sending}
              className="p-1 rounded-md text-[#A39284] hover:text-emerald-700 hover:bg-emerald-50/80 transition-colors cursor-pointer disabled:opacity-50"
              title="Yes, this was useful"
              aria-label="Useful"
            >
              <ThumbsUp size={11} />
            </button>
            <button
              type="button"
              onClick={handleNegativeClick}
              disabled={sending}
              className="p-1 rounded-md text-[#A39284] hover:text-amber-800 hover:bg-amber-50/80 transition-colors cursor-pointer disabled:opacity-50"
              title="No, not useful"
              aria-label="Not useful"
            >
              <ThumbsDown size={11} />
            </button>
          </motion.div>
        )}

        {/* Granular reason chips & optional comment */}
        {showNegativeDetails && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1.5 p-2.5 rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] space-y-2 max-w-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-[#7A5A3A] uppercase tracking-wider">
                What could be improved?
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowNegativeDetails(false);
                  submitFeedback('inaccurate');
                }}
                className="text-[#A39284] hover:text-[#5C3E21] p-0.5 rounded cursor-pointer"
                title="Dismiss"
              >
                <X size={12} />
              </button>
            </div>

            {/* Quick 1-tap chips */}
            <div className="flex flex-wrap gap-1.5">
              {NEGATIVE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleSelectReason(opt.type)}
                  disabled={sending}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer border ${
                    selectedReason === opt.type
                      ? 'bg-[#8f4d30] text-white border-[#8f4d30]'
                      : 'bg-white text-[#5C3E21] border-[#E6DFD5] hover:border-[#8f4d30]/50 hover:bg-[#F3EEEA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Optional text input */}
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && comment.trim()) {
                    e.preventDefault();
                    handleSubmitWithComment();
                  }
                }}
                placeholder="Optional details..."
                className="flex-1 h-7 px-2.5 rounded-md border border-[#E6DFD5] bg-white text-[11px] text-[#2E2012] placeholder:text-[#B8A89A] focus:border-[#8f4d30] focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleSubmitWithComment}
                disabled={sending}
                className="h-7 px-2 rounded-md bg-[#8f4d30] text-white hover:bg-[#723c24] text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <Send size={10} />
                <span>Send</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InterventionFeedbackBar;
