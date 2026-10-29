"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { spotlightCache } from '@/lib/spotlight/cache';
import type { 
  SpotlightInsight, 
  Trend, 
  Urgency,
  BlendRatios,
  ScoreBreakdown 
} from '@/lib/spotlight/types';

// ============================================
// TYPES
// ============================================

export interface SpotlightData {
  activityScore: number;
  scoreBreakdown: ScoreBreakdown | null;
  trend: Trend;
  urgency: Urgency;
  blendRatios: BlendRatios;
  insights: SpotlightInsight[];
  fromCache: boolean;
  computationMs: number;
}

export interface UseSpotlightOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Refresh interval in ms (0 = disabled) */
  refreshInterval?: number;
  /** Use client-side memory cache */
  useMemoryCache?: boolean;
  /** Initial number of insights to show */
  initialInsightCount?: number;
}

export interface UseSpotlightReturn {
  data: SpotlightData | null;
  loading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
  recordInteraction: (insightId: string, action: InteractionAction) => Promise<void>;
  dismissInsight: (insightId: string) => void;
  visibleInsights: SpotlightInsight[];
  showMore: () => void;
  hasMore: boolean;
}

export type InteractionAction = 'viewed' | 'clicked' | 'dismissed' | 'completed';

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_OPTIONS: UseSpotlightOptions = {
  autoFetch: true,
  refreshInterval: 0,
  useMemoryCache: true,
  initialInsightCount: 2,
};

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useSpotlight(options?: UseSpotlightOptions): UseSpotlightReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [data, setData] = useState<SpotlightData | null>(null);
  const [loading, setLoading] = useState(opts.autoFetch ?? true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(opts.initialInsightCount ?? 2);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fetch spotlight data
  const fetchSpotlight = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'spotlight-current-user';
    
    // Check memory cache first
    if (opts.useMemoryCache && !forceRefresh) {
      const cached = spotlightCache.get<SpotlightData>(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const url = forceRefresh ? '/api/spotlight?refresh=true' : '/api/spotlight';
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      const spotlightData: SpotlightData = {
        activityScore: result.activityScore ?? 0,
        scoreBreakdown: result.scoreBreakdown ?? null,
        trend: result.trend ?? 'stable',
        urgency: result.urgency ?? 'none',
        blendRatios: result.blendRatios ?? { waitlist: 0, journal: 0, reengagement: 0 },
        insights: result.insights ?? [],
        fromCache: result.fromCache ?? false,
        computationMs: result.computationMs ?? 0,
      };

      if (isMountedRef.current) {
        setData(spotlightData);
        
        // Update memory cache
        if (opts.useMemoryCache) {
          // Cache for 5 minutes client-side
          spotlightCache.set(cacheKey, spotlightData, 5 * 60 * 1000);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch spotlight data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [opts.useMemoryCache]);

  // Refresh function
  const refresh = useCallback(async (force = true) => {
    await fetchSpotlight(force);
  }, [fetchSpotlight]);

  // Record interaction
  const recordInteraction = useCallback(async (
    insightId: string, 
    action: InteractionAction
  ) => {
    try {
      const insight = data?.insights.find(i => i.id === insightId);
      
      await fetch('/api/spotlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightId,
          action,
          strategyType: insight?.strategyType,
        }),
      });
    } catch (err) {
      console.error('[useSpotlight] Failed to record interaction:', err);
    }
  }, [data?.insights]);

  // Dismiss insight
  const dismissInsight = useCallback((insightId: string) => {
    setDismissedIds(prev => new Set([...prev, insightId]));
    recordInteraction(insightId, 'dismissed');
  }, [recordInteraction]);

  // Show more insights
  const showMore = useCallback(() => {
    setVisibleCount(prev => prev + 2);
  }, []);

  // Filter and limit visible insights
  const visibleInsights = (data?.insights ?? [])
    .filter(insight => !dismissedIds.has(insight.id))
    .slice(0, visibleCount);

  const hasMore = (data?.insights ?? [])
    .filter(insight => !dismissedIds.has(insight.id))
    .length > visibleCount;

  // Auto-fetch on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (opts.autoFetch) {
      fetchSpotlight();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [opts.autoFetch, fetchSpotlight]);

  // Set up refresh interval
  useEffect(() => {
    if (opts.refreshInterval && opts.refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchSpotlight(false);
      }, opts.refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [opts.refreshInterval, fetchSpotlight]);

  return {
    data,
    loading,
    error,
    refresh,
    recordInteraction,
    dismissInsight,
    visibleInsights,
    showMore,
    hasMore,
  };
}

// ============================================
// ACTIVITY SCORE HOOK
// ============================================

export interface UseActivityScoreReturn {
  score: number;
  breakdown: ScoreBreakdown | null;
  trend: Trend;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useActivityScore(): UseActivityScoreReturn {
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [trend, setTrend] = useState<Trend>('stable');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/spotlight/activity-score');
      
      if (!response.ok) {
        throw new Error('Failed to fetch activity score');
      }

      const data = await response.json();
      setScore(data.score ?? 0);
      setBreakdown(data.breakdown ?? null);
      setTrend(data.trend ?? 'stable');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { score, breakdown, trend, loading, error, refresh };
}

// ============================================
// RE-ENGAGEMENT INSIGHTS HOOK
// ============================================

export interface UseReengagementOptions {
  useAI?: boolean;
  maxInsights?: number;
  provider?: 'claude' | 'gemini' | 'openai';
}

export interface UseReengagementReturn {
  insights: SpotlightInsight[];
  urgency: Urgency;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useReengagement(options?: UseReengagementOptions): UseReengagementReturn {
  const [insights, setInsights] = useState<SpotlightInsight[]>([]);
  const [urgency, setUrgency] = useState<Urgency>('none');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options?.useAI) params.set('ai', 'true');
      if (options?.maxInsights) params.set('max', String(options.maxInsights));
      if (options?.provider) params.set('provider', options.provider);

      const response = await fetch(`/api/spotlight/reengagement?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch re-engagement insights');
      }

      const data = await response.json();
      setInsights(data.insights ?? []);
      setUrgency(data.urgency ?? 'none');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [options?.useAI, options?.maxInsights, options?.provider]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { insights, urgency, loading, error, refresh };
}
