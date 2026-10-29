"use client";

import React, { useState } from 'react';
import {
  Sparkles,
  HeartHandshake,
  MessageSquare,
  Copy,
  Check,
  Eye,
  EyeOff,
  X,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  MediationInterventionEntity,
  MediationFeedbackRating,
} from '@/types/mediation-schemas';

interface MediationCardProps {
  connectionId: string;
  intervention: MediationInterventionEntity;
  currentUserId: string;
  onStatusChange?: () => void;
}

export function MediationCard({
  connectionId,
  intervention,
  currentUserId,
  onStatusChange,
}: MediationCardProps) {
  const [copied, setCopied] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [selectedRating, setSelectedRating] = useState<MediationFeedbackRating | null>(null);

  const isShared = intervention.visibility === 'shared';
  const isPrivateToMe =
    (intervention.visibility === 'private_to_initiator' && intervention.initiator_id === currentUserId) ||
    (intervention.visibility === 'private_to_target' && intervention.target_user_id === currentUserId);

  const handleCopy = async () => {
    const textToCopy = intervention.bridging_question || intervention.content || '';
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Bridging question copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleUpdateStatus = async (newStatus: 'acted_upon' | 'dismissed') => {
    setIsActing(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}/mediation/${intervention.id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(newStatus === 'acted_upon' ? 'Marked as discussed!' : 'Intervention dismissed');
        if (onStatusChange) onStatusChange();
      } else {
        toast.error('Failed to update intervention status');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsActing(false);
    }
  };

  const handleFeedback = async (rating: MediationFeedbackRating) => {
    setSelectedRating(rating);
    try {
      const res = await fetch(`/api/connections/${connectionId}/mediation/${intervention.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });

      if (res.ok) {
        setFeedbackSent(true);
        toast.success('Thank you for helping Force learn!');
      } else {
        toast.error('Could not record feedback');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const getInterventionBadge = () => {
    switch (intervention.intervention_type) {
      case 'bridging_question':
        return { label: 'Bridging Question', icon: MessageSquare, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' };
      case 'pattern_reflection':
        return { label: 'Pattern Reflection', icon: Sparkles, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
      case 'friction_nudge':
        return { label: 'Friction Nudge', icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      default:
        return { label: 'Relationship Insight', icon: HeartHandshake, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
  };

  const badgeInfo = getInterventionBadge();
  const BadgeIcon = badgeInfo.icon;

  return (
    <div className="relative p-5 rounded-2xl bg-gradient-to-b from-card to-card/90 border border-border/80 shadow-md space-y-4 transition-all hover:border-violet-500/30">
      {/* Header with Type & Visibility Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeInfo.color}`}>
            <BadgeIcon className="w-3.5 h-3.5" />
            <span>{badgeInfo.label}</span>
          </span>

          {isShared ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Eye className="w-3 h-3" />
              <span>Visible to both</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <EyeOff className="w-3 h-3" />
              <span>Only visible to you</span>
            </span>
          )}
        </div>

        {/* Confidence pill */}
        <span className="text-[11px] text-muted-foreground font-mono">
          Confidence: {Math.round(intervention.confidence * 100)}%
        </span>
      </div>

      {/* Observation Content */}
      {intervention.content && (
        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
          {intervention.content}
        </p>
      )}

      {/* Highlighted Bridging Question */}
      {intervention.bridging_question && (
        <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-900/40 text-xs sm:text-sm space-y-2">
          <div className="flex items-center gap-1.5 text-violet-300 font-semibold text-[11px] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>A Question to Explore Together</span>
          </div>
          <p className="text-violet-100 font-medium italic leading-relaxed text-sm">
            "{intervention.bridging_question}"
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
        <div className="flex items-center gap-2">
          {intervention.bridging_question && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="text-xs h-8 text-foreground/80 hover:text-foreground"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? 'Copied!' : 'Copy Question'}
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={() => handleUpdateStatus('acted_upon')}
            disabled={isActing}
            className="text-xs h-8 bg-violet-600 hover:bg-violet-500 text-white"
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            Mark as Discussed
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleUpdateStatus('dismissed')}
          disabled={isActing}
          className="text-xs h-8 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Dismiss
        </Button>
      </div>

      {/* Inline Feedback Widget */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Was this mediation helpful?</span>
        {feedbackSent ? (
          <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
            <Check className="w-3 h-3" /> Feedback noted
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleFeedback('helpful')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 border ${
                selectedRating === 'helpful'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/40'
              }`}
            >
              <ThumbsUp className="w-3 h-3" /> Helpful
            </button>
            <button
              type="button"
              onClick={() => handleFeedback('awkward')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 border ${
                selectedRating === 'awkward'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/40'
              }`}
            >
              Awkward
            </button>
            <button
              type="button"
              onClick={() => handleFeedback('intrusive')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 border ${
                selectedRating === 'intrusive'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/40'
              }`}
            >
              <ThumbsDown className="w-3 h-3" /> Intrusive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
