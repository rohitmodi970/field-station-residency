/**
 * Spotlight Cache Layer
 * 
 * Centralized caching utilities for spotlight data.
 * Supports both server-side and client-side caching.
 */

import { CACHE_CONFIG } from './constants';
import type { SpotlightCacheData, SpotlightInsight } from './types';

// ============================================
// CLIENT-SIDE MEMORY CACHE
// ============================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SpotlightMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL = CACHE_CONFIG.TTL_MS;

  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
}

// Singleton instance
export const spotlightCache = new SpotlightMemoryCache();

// ============================================
// CACHE KEY BUILDERS
// ============================================

export const CacheKeys = {
  spotlight: (userId: string) => `spotlight:${userId}`,
  activityScore: (userId: string) => `activity-score:${userId}`,
  reengagement: (userId: string) => `reengagement:${userId}`,
  insights: (userId: string, type: string) => `insights:${userId}:${type}`,
};

// ============================================
// CACHE UTILITIES
// ============================================

export function isSpotlightCacheValid(cache: SpotlightCacheData | null): boolean {
  if (!cache) return false;
  
  const now = new Date();
  const expiresAt = cache.expiresAt instanceof Date 
    ? cache.expiresAt 
    : new Date(cache.expiresAt);
  
  return expiresAt > now;
}

export function getCacheRemainingMs(cache: SpotlightCacheData): number {
  const expiresAt = cache.expiresAt instanceof Date 
    ? cache.expiresAt.getTime() 
    : new Date(cache.expiresAt).getTime();
  
  return Math.max(0, expiresAt - Date.now());
}

export function shouldRefreshCache(cache: SpotlightCacheData | null): boolean {
  if (!cache) return true;
  
  // Refresh if less than 10% of TTL remaining
  const remainingMs = getCacheRemainingMs(cache);
  const threshold = CACHE_CONFIG.TTL_MS * 0.1;
  
  return remainingMs < threshold;
}

// ============================================
// STALE-WHILE-REVALIDATE PATTERN
// ============================================

export interface SWRResult<T> {
  data: T | null;
  isStale: boolean;
  isFetching: boolean;
}

type FetchFn<T> = () => Promise<T>;

export async function staleWhileRevalidate<T>(
  cacheKey: string,
  fetchFn: FetchFn<T>,
  options?: {
    ttlMs?: number;
    staleThresholdMs?: number;
  }
): Promise<SWRResult<T>> {
  const cached = spotlightCache.get<T>(cacheKey);
  
  if (cached) {
    // Return cached data, potentially refresh in background
    const entry = (spotlightCache as any).cache.get(cacheKey) as CacheEntry<T>;
    const remainingMs = entry.expiresAt - Date.now();
    const staleThreshold = options?.staleThresholdMs ?? CACHE_CONFIG.TTL_MS * 0.1;
    
    if (remainingMs < staleThreshold) {
      // Stale - revalidate in background
      fetchFn().then(data => {
        spotlightCache.set(cacheKey, data, options?.ttlMs);
      }).catch(console.error);
      
      return { data: cached, isStale: true, isFetching: true };
    }
    
    return { data: cached, isStale: false, isFetching: false };
  }
  
  // No cache - fetch fresh
  try {
    const data = await fetchFn();
    spotlightCache.set(cacheKey, data, options?.ttlMs);
    return { data, isStale: false, isFetching: false };
  } catch (error) {
    return { data: null, isStale: false, isFetching: false };
  }
}

// ============================================
// INSIGHT DEDUPLICATION
// ============================================

/**
 * Filter out insights that were recently shown
 */
export function deduplicateInsights(
  insights: SpotlightInsight[],
  recentlyShownIds: string[],
  maxAge: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): SpotlightInsight[] {
  const recentSet = new Set(recentlyShownIds);
  
  return insights.filter(insight => {
    // Skip if recently shown
    if (recentSet.has(insight.id)) return false;
    
    // Skip if expired
    if (insight.expiresAt && new Date(insight.expiresAt) < new Date()) {
      return false;
    }
    
    return true;
  });
}

/**
 * Prioritize and limit insights
 */
export function prioritizeInsights(
  insights: SpotlightInsight[],
  maxCount: number = 3
): SpotlightInsight[] {
  return insights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxCount);
}
