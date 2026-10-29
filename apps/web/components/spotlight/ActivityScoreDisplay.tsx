"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Trend, ScoreBreakdown, Urgency } from '@/lib/spotlight/types';

interface ActivityScoreDisplayProps {
  score: number;
  trend: Trend;
  urgency?: Urgency;
  breakdown?: ScoreBreakdown | null;
  showBreakdown?: boolean;
  variant?: 'ring' | 'bar' | 'compact';
  className?: string;
}

const TREND_CONFIG = {
  rising: { icon: TrendingUp, color: 'text-green-500', label: 'Improving' },
  declining: { icon: TrendingDown, color: 'text-red-500', label: 'Declining' },
  stable: { icon: Minus, color: 'text-gray-500', label: 'Stable' },
};

const URGENCY_CONFIG: Record<Urgency, { color: string; label: string }> = {
  none: { color: 'text-green-500', label: 'Active' },
  mild: { color: 'text-yellow-500', label: 'Mild' },
  moderate: { color: 'text-orange-500', label: 'Moderate' },
  critical: { color: 'text-red-500', label: 'Critical' },
};

export function ActivityScoreDisplay({
  score,
  trend,
  urgency = 'none',
  breakdown,
  showBreakdown = true,
  variant = 'ring',
  className = '',
}: ActivityScoreDisplayProps) {
  const trendConfig = TREND_CONFIG[trend];
  const TrendIcon = trendConfig.icon;
  const urgencyConfig = URGENCY_CONFIG[urgency];
  
  const percentage = Math.round(score * 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score * circumference);

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className="text-primary"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ strokeDasharray: circumference }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
            {percentage}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TrendIcon className={`h-3 w-3 ${trendConfig.color}`} />
          <span className={`text-xs ${trendConfig.color}`}>{trendConfig.label}</span>
        </div>
      </div>
    );
  }

  if (variant === 'bar') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Activity Score</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{percentage}%</span>
            <TrendIcon className={`h-4 w-4 ${trendConfig.color}`} />
          </div>
        </div>
        <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        {urgency !== 'none' && (
          <div className={`text-xs ${urgencyConfig.color}`}>
            Re-engagement: {urgencyConfig.label}
          </div>
        )}
      </div>
    );
  }

  // Ring variant (default)
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Score Ring */}
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-primary"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ strokeDasharray: circumference }}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-3xl font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            {percentage}
          </motion.span>
          <span className="text-xs text-muted-foreground">Activity</span>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="mt-3 flex items-center gap-1.5">
        <TrendIcon className={`h-4 w-4 ${trendConfig.color}`} />
        <span className={`text-sm font-medium ${trendConfig.color}`}>
          {trendConfig.label}
        </span>
      </div>

      {/* Urgency badge */}
      {urgency !== 'none' && (
        <div className={`mt-1 text-xs px-2 py-0.5 rounded-full bg-muted/20 ${urgencyConfig.color}`}>
          {urgencyConfig.label} re-engagement needed
        </div>
      )}

      {/* Breakdown (optional) */}
      {showBreakdown && breakdown && (
        <div className="mt-4 w-full space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Base Activity</span>
            <span className="font-medium">{Math.round(breakdown.baseActivity * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Engagement Depth</span>
            <span className="font-medium">{Math.round(breakdown.engagementDepth * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Consistency</span>
            <span className="font-medium">{Math.round(breakdown.consistencyIndex * 100)}%</span>
          </div>
          {breakdown.momentumMultiplier !== 1 && (
            <div className="flex items-center justify-between pt-1 border-t">
              <span className="text-muted-foreground">Momentum</span>
              <span className={breakdown.momentumMultiplier > 1 ? 'text-green-500' : 'text-red-500'}>
                {breakdown.momentumMultiplier > 1 ? '+' : ''}{Math.round((breakdown.momentumMultiplier - 1) * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ActivityScoreDisplay;
