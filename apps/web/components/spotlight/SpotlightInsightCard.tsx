"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight, Zap } from 'lucide-react';
import type { SpotlightInsight } from '@/lib/spotlight/types';

interface SpotlightInsightCardProps {
  insight: SpotlightInsight;
  onDismiss?: (id: string) => void;
  onAction?: (id: string) => void;
  variant?: 'default' | 'compact' | 'featured';
  className?: string;
}

const STRATEGY_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  low_effort_prompt: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: '✨' },
  achievement_highlight: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: '🏆' },
  pattern_trigger: { bg: 'bg-stone-50 dark:bg-stone-900/40', border: 'border-stone-200 dark:border-stone-700', icon: '📅' },
  nostalgia_hook: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', icon: '💭' },
  gamification_nudge: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', icon: '🎯' },
  progress_reminder: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', icon: '📊' },
  mood_callback: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', icon: '💖' },
};

export function SpotlightInsightCard({
  insight,
  onDismiss,
  onAction,
  variant = 'default',
  className = '',
}: SpotlightInsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const defaultColors = { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: '✨' };
  const colors = (insight.strategyType && STRATEGY_COLORS[insight.strategyType]) ?? defaultColors;
  const icon = insight.icon || colors.icon;
  const canExpandBody = insight.body.length > 140;

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={`
          flex items-center gap-3 p-3 rounded-lg border
          ${colors.bg} ${colors.border}
          ${className}
        `}
      >
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{insight.title}</p>
        </div>
        {onAction && (
          <button
            onClick={() => onAction(insight.id)}
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            {insight.actionLabel || 'View'}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(insight.id)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </motion.div>
    );
  }

  if (variant === 'featured') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`
          relative overflow-hidden rounded-xl border-2 p-6
          ${colors.bg} ${colors.border}
          ${className}
        `}
      >
        {/* Decorative sparkle */}
        {/* <div className="absolute top-4 right-4 opacity-20">
          
        </div> */}

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={() => onDismiss(insight.id)}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-start gap-4">
            <span className="text-3xl">{icon}</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">{insight.title}</h3>
              <p className={`text-sm text-muted-foreground leading-relaxed ${!expanded && canExpandBody ? 'line-clamp-4' : ''}`}>
                {insight.body}
              </p>
              {canExpandBody && (
                <button
                  onClick={() => setExpanded((prev) => !prev)}
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>

          {/* Action button */}
          {insight.actionLabel && onAction && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAction(insight.id)}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              {insight.actionLabel}
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`
        relative rounded-lg border p-4
        ${colors.bg} ${colors.border}
        ${className}
      `}
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={() => onDismiss(insight.id)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Content */}
      <div className="flex items-start gap-3 pr-6">
        <span className="text-2xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
          <p className={`text-xs text-muted-foreground ${!expanded && canExpandBody ? 'line-clamp-2' : ''}`}>
            {insight.body}
          </p>
          {canExpandBody && (
            <button
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-1 text-[11px] font-semibold text-primary hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          
          {/* Action */}
          {insight.actionLabel && onAction && (
            <button
              onClick={() => onAction(insight.id)}
              className="mt-2 text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              {insight.actionLabel}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default SpotlightInsightCard;
