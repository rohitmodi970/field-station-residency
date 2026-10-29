export const JOURNAL_SAVE_THROTTLE_WINDOW_MS = 3000;
export const JOURNAL_SAVE_THROTTLE_CODE = 'JOURNAL_SAVE_THROTTLED';
export const JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE = 'JOURNAL_AUTOSAVE_EMPTY_VOICE';

export interface JournalSaveThrottleResult {
  allowed: boolean;
  retryAfterMs: number;
}

export const toRetryAfterSeconds = (retryAfterMs: number): number => {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
};

export const buildJournalSaveThrottleMessage = (retryAfterSeconds: number): string => {
  return `Please wait ${retryAfterSeconds}s before saving this entry again.`;
};

export const buildJournalAutosaveSkippedMessage = (): string => {
  return 'Autosave skipped because no meaningful voice content was detected yet.';
};

export class InMemoryJournalSaveThrottle {
  private readonly windowMs: number;

  private readonly map = new Map<string, number>();

  constructor(windowMs: number = JOURNAL_SAVE_THROTTLE_WINDOW_MS) {
    this.windowMs = windowMs;
  }

  check(userId: string, journalId: string): JournalSaveThrottleResult {
    const now = Date.now();
    const throttleKey = this.getThrottleKey(userId, journalId);
    const blockedUntil = this.map.get(throttleKey) || 0;

    if (blockedUntil > now) {
      return {
        allowed: false,
        retryAfterMs: blockedUntil - now,
      };
    }

    this.map.set(throttleKey, now + this.windowMs);
    return {
      allowed: true,
      retryAfterMs: 0,
    };
  }

  pruneExpired(now: number = Date.now()): void {
    for (const [key, blockedUntil] of this.map.entries()) {
      if (blockedUntil <= now) {
        this.map.delete(key);
      }
    }
  }

  private getThrottleKey(userId: string, journalId: string): string {
    return `${userId}:${journalId}`;
  }
}