/**
 * In-memory sliding window rate limiter for LLM endpoint protection.
 * Prevents credit exhaustion by throttling rapid or automated requests.
 */

interface RateLimitRecord {
  timestamps: number[];
  lastCleanup: number;
}

class SlidingWindowRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every 2 minutes to prevent memory growth
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.purgeExpired(), 120_000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Check if a request for the given key is allowed under the rate limit.
   */
  public check(
    key: string,
    limit: number,
    windowMs = 60_000
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number; currentCount: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [], lastCleanup: now };
      this.records.set(key, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    record.lastCleanup = now;

    if (record.timestamps.length >= limit) {
      const oldestInWindow = record.timestamps[0] || now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        currentCount: record.timestamps.length,
      };
    }

    // Record the current timestamp
    record.timestamps.push(now);

    return {
      allowed: true,
      remaining: Math.max(0, limit - record.timestamps.length),
      retryAfterSeconds: 0,
      currentCount: record.timestamps.length,
    };
  }

  /**
   * Purge records that have had no activity for over 5 minutes.
   */
  private purgeExpired(): void {
    const staleThreshold = Date.now() - 300_000;
    for (const [key, record] of this.records.entries()) {
      if (record.lastCleanup < staleThreshold && record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }
}

// Global singleton rate limiter across requests
const globalRateLimiter = new SlidingWindowRateLimiter();

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
  remaining?: number;
}

/**
 * Enforces rate limits for LLM endpoint calls:
 * - By authenticated user ID (max 20 req / min)
 * - By client IP address (max 15 req / min)
 */
export function checkLLMRateLimit(identifier: {
  userId?: string | null;
  ip?: string | null;
}): RateLimitCheckResult {
  // If RATE_LIMIT_ENABLED is explicitly false in env, skip
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return { allowed: true };
  }

  // 1. Check IP rate limit (15 requests/min)
  if (identifier.ip) {
    const ipLimit = parseInt(process.env.LLM_IP_RATE_LIMIT || '15', 10);
    const ipResult = globalRateLimiter.check(`ip:${identifier.ip}`, ipLimit, 60_000);
    if (!ipResult.allowed) {
      return {
        allowed: false,
        reason: `Too many LLM requests from your IP. Limit is ${ipLimit} requests per minute.`,
        retryAfterSeconds: ipResult.retryAfterSeconds,
        remaining: 0,
      };
    }
  }

  // 2. Check user rate limit (20 requests/min)
  if (identifier.userId) {
    const userLimit = parseInt(process.env.LLM_USER_RATE_LIMIT || '20', 10);
    const userResult = globalRateLimiter.check(`user:${identifier.userId}`, userLimit, 60_000);
    if (!userResult.allowed) {
      return {
        allowed: false,
        reason: `Too many LLM requests for this account. Limit is ${userLimit} requests per minute.`,
        retryAfterSeconds: userResult.retryAfterSeconds,
        remaining: 0,
      };
    }
  }

  return { allowed: true };
}
