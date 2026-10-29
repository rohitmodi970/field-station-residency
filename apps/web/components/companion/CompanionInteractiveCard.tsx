'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Clock, Check, Pause, Send, ArrowRight, Loader2 } from 'lucide-react';
import { ObChip } from '@/components/onBoarding/v2/ui';
import { InterventionFeedbackBar } from '@/components/agent/InterventionFeedbackBar';

export interface CompanionInteractiveCardProps {
  notificationId?: string;
  threadId?: string;
  promptText: string;
  initialUserReply?: string;
  initialInstantReply?: string;
  onSuccess?: (instantReply: string) => void;
  compact?: boolean;
  embedded?: boolean;
  showHeader?: boolean;
  className?: string;
}

/**
 * Small warm jewel-like Force mark
 */
export function ForceMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      aria-hidden="true"
    >
      <span className="w-full h-full rounded-full bg-gradient-to-tr from-ob-clay via-[#C88470] to-[#E5A894] shadow-[0_1px_4px_rgba(159,105,88,0.28)] flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FFFDF9] shadow-xs" />
      </span>
    </div>
  );
}

export function CompanionInteractiveCard({
  notificationId,
  threadId,
  promptText,
  initialUserReply,
  initialInstantReply,
  onSuccess,
  compact = false,
  embedded = false,
  showHeader = true,
  className = '',
}: CompanionInteractiveCardProps) {
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [userReply, setUserReply] = useState<string | null>(initialUserReply || null);
  const [instantReply, setInstantReply] = useState<string | null>(initialInstantReply || null);

  const handleSend = async (actionType?: string, text?: string) => {
    const messageToSend = (text || replyText || actionType || '').trim();
    if (!messageToSend || loading) return;

    if (actionType) {
      setSelectedChip(actionType);
    }
    setLoading(true);
    try {
      const res = await fetch('/api/agent/v2/quick-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          threadId,
          replyText: messageToSend,
          actionType: actionType || 'custom',
        }),
      });

      const data = await res.json();
      if (data.success && data.instantReply) {
        setUserReply(messageToSend);
        setInstantReply(data.instantReply);
        setReplyText('');
        if (onSuccess) {
          onSuccess(data.instantReply);
        }
      }
    } catch (err) {
      console.error('Failed to submit quick reply:', err);
    } finally {
      setLoading(false);
    }
  };

  const containerClasses = embedded
    ? `p-5 ${className}`
    : `rounded-3xl border border-ob-border bg-ob-raised p-5 shadow-[0_8px_30px_rgba(42,33,28,0.06)] ${className}`;

  return (
    <div className={containerClasses}>
      {/* Header — Only rendered if showHeader is true (e.g. standalone notification item) */}
      {showHeader && (
        <div className="flex items-center gap-2 mb-3">
          <ForceMark className="w-4 h-4" />
          <span className="text-xs font-medium text-ob-ink font-[family-name:var(--font-ob-body)]">
            Force
          </span>
        </div>
      )}

      {/* Eyebrow */}
      <p className="text-[10px] uppercase tracking-[0.14em] text-ob-clay-strong font-semibold font-[family-name:var(--font-ob-body)] mb-2 select-none">
        Reflection
      </p>

      {/* Force's message body in Cormorant Garamond */}
      <p className="font-[family-name:var(--font-ob-display)] text-lg md:text-xl leading-relaxed text-ob-ink max-w-[42ch] mb-4">
        {promptText}
      </p>

      {/* Already Replied / Instant Output State */}
      {instantReply ? (
        <div className="space-y-3 pt-2 border-t border-ob-border/60">
          {/* User's reply bubble (right-aligned) */}
          {userReply && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-ob-surface border border-ob-border px-3.5 py-2 text-sm text-ob-ink font-[family-name:var(--font-ob-body)] shadow-xs">
                <p className="leading-snug">{userReply}</p>
              </div>
            </div>
          )}

          {/* Force's instant reply bubble (left-aligned) */}
          <div className="flex justify-start items-start gap-2.5">
            <ForceMark className="w-3.5 h-3.5 mt-1 shrink-0" />
            <div className="max-w-[90%] rounded-2xl rounded-tl-xs bg-ob-clay-soft/60 border border-ob-clay/25 px-3.5 py-2.5 text-sm text-ob-ink font-[family-name:var(--font-ob-body)] shadow-xs">
              <p className="leading-relaxed">{instantReply}</p>
            </div>
          </div>

          {/* Quiet text link to continue with Force + Intervention Feedback */}
          <div className="flex items-center justify-between pt-1">
            <InterventionFeedbackBar
              compact
              messageId={notificationId || 'companion-nudge'}
            />
            <Link
              href={threadId ? `/agent?threadId=${encodeURIComponent(threadId)}` : '/agent'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ob-clay-strong hover:text-ob-clay underline-offset-4 hover:underline transition-colors font-[family-name:var(--font-ob-body)] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay rounded"
            >
              <span>Continue with Force</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      ) : (
        /* Actionable Quick Chips & Input State */
        <div className="space-y-3 pt-2 border-t border-ob-border/60">
          {/* Quick Action Chips using shared ObChip */}
          <div className="flex flex-wrap gap-2">
            <ObChip
              disabled={loading}
              selected={selectedChip === 'talk_later'}
              onClick={() => handleSend('talk_later', 'Will talk later')}
              className="h-8 px-3 text-xs gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-ob-clay shrink-0" />
              <span>Talk later</span>
            </ObChip>

            <ObChip
              disabled={loading}
              selected={selectedChip === 'resolved'}
              onClick={() => handleSend('resolved', 'It went well!')}
              className="h-8 px-3 text-xs gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-ob-clay shrink-0" />
              <span>It went well</span>
            </ObChip>

            <ObChip
              disabled={loading}
              selected={selectedChip === 'postponed'}
              onClick={() => handleSend('postponed', 'Postponed for now')}
              className="h-8 px-3 text-xs gap-1.5"
            >
              <Pause className="w-3.5 h-3.5 text-ob-clay shrink-0" />
              <span>Postponed</span>
            </ObChip>
          </div>

          {/* Inline Text Input with Icon Send Button */}
          <div className="relative flex items-center w-full">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Reply or share a thought..."
              disabled={loading}
              className="w-full h-11 pl-4 pr-11 rounded-xl bg-ob-surface/60 border border-ob-border text-sm text-ob-ink placeholder:text-ob-ink-faint transition-all font-[family-name:var(--font-ob-body)] outline-none focus:border-ob-clay focus:ring-2 focus:ring-ob-clay/20 disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !replyText.trim()}
              className="absolute right-1.5 p-2 rounded-lg text-ob-clay hover:text-ob-clay-strong hover:bg-ob-clay-soft/60 disabled:text-ob-ink-faint/35 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay cursor-pointer disabled:cursor-not-allowed"
              title="Send reply"
              aria-label="Send reply"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-ob-clay" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanionInteractiveCard;
