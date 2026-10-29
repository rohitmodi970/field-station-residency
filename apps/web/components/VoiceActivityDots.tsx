'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useVoiceLevel from '@/hooks/useVoiceLevel';

interface VoiceActivityDotsProps {
  stream: MediaStream | null;
  bars?: number;
  maxHeight?: number; // px
}

export default function VoiceActivityDots({ stream, bars = 24, maxHeight = 36 }: VoiceActivityDotsProps) {
  const level = useVoiceLevel(stream);

  // per-bar random phase offsets to create variety
  const phases = useMemo(() => {
    const arr = new Array(bars);
    for (let i = 0; i < bars; i++) {
      // bias towards center bars having higher phase
      const center = 1 - Math.abs(i / bars - 0.5) * 1.4;
      arr[i] = 0.6 + Math.random() * 0.9 + center * 0.25;
    }
    return arr;
  }, [bars]);

  // peaks decay more slowly than the main bar; store in ref to avoid re-alloc
  const peaksRef = useRef(new Float32Array(bars));
  const rafRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!stream) {
      // reset peaks when no stream
      peaksRef.current.fill(0);
      setTick((t) => t + 1);
      return;
    }

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      // update peaks for each bar
      const peaks = peaksRef.current as Float32Array;
      for (let i = 0; i < bars; i++) {
        const target = Math.max(0.02, Math.min(1, level * phases[i]));
        if (target > (peaks[i] ?? 0)) {
          peaks[i] = target;
        } else {
          // exponential decay for peaks
          const decay = Math.exp(-dt / 200.0); // 200ms time constant
          peaks[i] = (peaks[i] ?? 0) * decay;
        }
      }

      // trigger re-render
      setTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [stream, level, phases, bars]);

  const baseHeight = Math.max(6, Math.round(maxHeight));

  return (
    <div className="flex gap-2 items-end justify-center mb-16" aria-hidden style={{ alignItems: 'flex-end' }}>
      {Array.from({ length: bars }).map((_, i) => {
        const phase = phases[i];
        const value = Math.max(0.02, Math.min(1, level * phase));
        const scaleY = Math.max(0.08, 0.18 + value * 1.4);
        const opacity = Math.min(1, 0.32 + value * 1.4);
        const peak = peaksRef.current?.[i] ?? 0;
        const peakBottom = baseHeight - Math.round(peak * baseHeight);

        return (
          <div key={i} style={{ width: 4, height: baseHeight, position: 'relative', display: 'inline-block' }}>
            {/* peak cap */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: 3,
                bottom: Math.max(0, peakBottom) + 'px',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 2,
                transform: 'translateY(0)',
                pointerEvents: 'none',
                transition: 'bottom 120ms linear, opacity 160ms linear',
                opacity: Math.min(1, 0.9 * peak + 0.05),
              }}
            />

            {/* main bar */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: baseHeight + 'px',
                transform: `scaleY(${scaleY})`,
                transformOrigin: 'bottom center',
                borderRadius: 8,
                opacity,
                willChange: 'transform, opacity',
                transition: 'transform 160ms cubic-bezier(.22,1,.36,1), opacity 180ms linear',
                background: 'linear-gradient(180deg,#8b5cf6,#ffb6e6)',
                boxShadow: `0 2px ${Math.round(2 + value * 6)}px rgba(139,92,246,${0.12 + value * 0.18})`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
