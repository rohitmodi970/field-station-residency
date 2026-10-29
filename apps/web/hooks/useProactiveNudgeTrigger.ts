'use client';

import { useEffect, useRef } from 'react';

const THROTTLE_MS = 60 * 60 * 1000; // 60 minutes client-side request throttle
const STORAGE_KEY = 'force_last_nudge_check_attempt';

/**
 * Hook mounted in UserLayout that quietly checks if Force has a proactive
 * reflection or nudge for the user.
 * 
 * Client-side throttle: Max once per 60 minutes to prevent unnecessary network roundtrips.
 * Server-side authority: triggerEngine.ts strictly enforces 4-hour cooldown, 2/day cap,
 * and 24-hour auto-expiry in PostgreSQL.
 */
export function useProactiveNudgeTrigger() {
  const hasRun = useRef(false);

  useEffect(() => {
    // Expose developer testing triggers on window in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // Run the real reasoning engine (may return silence)
      (window as any).__forceCheckNudge = async (force = true) => {
        console.log('⚡ [Force] Triggering proactive nudge check (force =', force, ')...');
        const res = await fetch(`/api/agent/v2/nudge/check?force=${force}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        console.log('⚡ [Force] Proactive nudge check result:', data);
        if (data?.result?.should_reach && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('force:nudge-updated', { detail: data }));
        }
        return data;
      };

      // Bypass LLM entirely — inject a test nudge notification to verify toast + bell UI
      (window as any).__forceSimulateNudge = async (message?: string) => {
        console.log('🧪 [Force] Simulating nudge (bypasses LLM)...');
        const res = await fetch(`/api/agent/v2/nudge/check?simulate=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulate: true, ...(message ? { message } : {}) }),
        });
        const data = await res.json();
        console.log('🧪 [Force] Simulate result:', data);
        if (data.success) {
          console.log('✅ Toast + notification appearing now...');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('force:nudge-updated', { detail: data }));
          }
        }
        return data;
      };
    }

    if (hasRun.current) return;
    hasRun.current = true;

    async function checkProactiveNudge() {
      try {
        const lastAttempt = localStorage.getItem(STORAGE_KEY);
        const now = Date.now();

        if (lastAttempt) {
          const elapsed = now - Number(lastAttempt);
          if (elapsed < THROTTLE_MS) {
            return; // Skip network ping if checked in last 60 minutes
          }
        }

        localStorage.setItem(STORAGE_KEY, String(now));

        // Fire background check (non-blocking)
        const res = await fetch('/api/agent/v2/nudge/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (data?.result?.should_reach && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('force:nudge-updated', { detail: data }));
        }
      } catch (err) {
        // Silent failure in background - never disturb user flow
        console.debug('[ProactiveTrigger] Background check skipped:', err);
      }
    }

    // Delay slightly after app mount so critical page assets load first
    const timer = setTimeout(() => {
      void checkProactiveNudge();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);
}
