"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, RefreshCw, ChevronDown, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSpotlight } from '@/hooks/useSpotlight';
import { SpotlightInsightCard } from './SpotlightInsightCard';
import { ActivityScoreDisplay } from './ActivityScoreDisplay';

interface SpotlightPanelProps {
  /** Show the activity score ring */
  showScore?: boolean;
  /** Show detailed score breakdown */
  showBreakdown?: boolean;
  /** Maximum insights to show initially */
  maxInsights?: number;
  /** Auto-refresh interval in ms (0 = disabled) */
  refreshInterval?: number;
  /** Custom class name */
  className?: string;
  /** Panel variant */
  variant?: 'full' | 'compact' | 'minimal';
}

export function SpotlightPanel({
  showScore = true,
  showBreakdown = true,
  maxInsights = 2,
  refreshInterval = 0,
  className = '',
  variant = 'full',
}: SpotlightPanelProps) {
  const router = useRouter();
  const {
    data,
    loading,
    error,
    refresh,
    dismissInsight,
    visibleInsights,
    showMore,
    hasMore,
    recordInteraction,
  } = useSpotlight({
    autoFetch: true,
    refreshInterval,
    initialInsightCount: maxInsights,
  });

  // Handle insight action (navigate to the insight's configured target)
  const handleInsightAction = (insightId: string) => {
    recordInteraction(insightId, 'clicked');
    const clickedInsight =
      visibleInsights.find((insight) => insight.id === insightId) ||
      data?.insights.find((insight) => insight.id === insightId);
    const target = clickedInsight?.actionTarget;
    const safeTarget = typeof target === 'string' && target.startsWith('/') ? target : '/journal/new';
    router.push(safeTarget);
  };

  // Handle dismiss
  const handleDismiss = (insightId: string) => {
    dismissInsight(insightId);
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="rounded-xl bg-muted/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-muted/40" />
            <div className="h-5 w-32 bg-muted/40 rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-16 bg-muted/30 rounded-lg" />
            <div className="h-16 bg-muted/30 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Failed to load insights</span>
        </div>
        <button
          onClick={() => refresh(true)}
          className="mt-2 text-xs text-red-500 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Minimal variant - just insights
  if (variant === 'minimal') {
    return (
      <div className={`space-y-2 ${className}`}>
        <AnimatePresence mode="popLayout">
          {visibleInsights.map((insight) => (
            <SpotlightInsightCard
              key={insight.id}
              insight={insight}
              variant="compact"
              onDismiss={handleDismiss}
              onAction={handleInsightAction}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  // Compact variant - card with insights
  if (variant === 'compact') {
    return (
      <div className={`rounded-xl border p-4 ${className}`} style={{ background: '#fff7ea', borderColor: 'rgba(151,107,67,0.2)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">For You</span>
          </div>
          {data && (
            <ActivityScoreDisplay
              score={data.activityScore}
              trend={data.trend}
              variant="compact"
            />
          )}
        </div>
        
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {visibleInsights.length > 0 ? (
              visibleInsights.map((insight) => (
                <SpotlightInsightCard
                  key={insight.id}
                  insight={insight}
                  variant="compact"
                  onDismiss={handleDismiss}
                  onAction={handleInsightAction}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-4 text-sm text-muted-foreground"
              >
                You&apos;re all caught up.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Full variant (default)
  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${className}`} style={{ background: '#fff7ea', borderColor: 'rgba(151,107,67,0.2)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(151,107,67,0.18)' }}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(151,107,67,0.14)' }}>
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ fontFamily: 'var(--dashboard-heading-font, inherit)', letterSpacing: '0.03em', color: '#2e2012' }}>Spotlight</h3>
            <p className="text-xs text-muted-foreground">
              Personalized for you
            </p>
          </div>
        </div>
        <button
          onClick={() => refresh(true)}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
          title="Refresh insights"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        {/* Activity Score Section */}
        {showScore && data && (
          <div className="flex justify-center mb-6">
            <ActivityScoreDisplay
              score={data.activityScore}
              trend={data.trend}
              urgency={data.urgency}
              breakdown={data.scoreBreakdown}
              showBreakdown={showBreakdown}
              variant="ring"
            />
          </div>
        )}

        {/* Featured Insight (first one) */}
        {visibleInsights.length > 0 && (
          <AnimatePresence mode="wait">
            <SpotlightInsightCard
              key={visibleInsights[0]!.id}
              insight={visibleInsights[0]!}
              variant="featured"
              onDismiss={handleDismiss}
              onAction={handleInsightAction}
            />
          </AnimatePresence>
        )}

        {/* Additional Insights */}
        {visibleInsights.length > 1 && (
          <div className="mt-4 space-y-2">
            <AnimatePresence mode="popLayout">
              {visibleInsights.slice(1).map((insight) => (
                <SpotlightInsightCard
                  key={insight.id}
                  insight={insight}
                  variant="default"
                  onDismiss={handleDismiss}
                  onAction={handleInsightAction}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Show More Button */}
        {hasMore && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={showMore}
            className="w-full mt-4 py-2 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Show more
            <ChevronDown className="h-4 w-4" />
          </motion.button>
        )}

        {/* Empty State */}
        {visibleInsights.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/20 flex items-center justify-center">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No new insights right now
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Keep journaling to unlock personalized suggestions
            </p>
          </motion.div>
        )}

        {/* Cache indicator */}
        {data?.fromCache && (
          <div className="mt-3 text-center">
            <span className="text-xs text-muted-foreground/60">
              Cached • Updated {data.computationMs}ms ago
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default SpotlightPanel;
