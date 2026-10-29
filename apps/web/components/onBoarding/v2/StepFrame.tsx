'use client';

import React from 'react';

/* ──────────────────────────────────────────────────────────────────────
   StepFrame
   Per-step content wrapper with width variants, alignment, and an
   enter animation (fade + 8px rise, 300ms, disabled under
   prefers-reduced-motion via the .ob-enter utility).
   ────────────────────────────────────────────────────────────────────── */

const WIDTH_MAP = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
} as const;

interface StepFrameProps {
  width?: keyof typeof WIDTH_MAP;
  align?: 'center' | 'left';
  children: React.ReactNode;
}

export default function StepFrame({
  width = 'md',
  align = 'center',
  children,
}: StepFrameProps) {
  return (
    <div
      className={[
        'w-full px-4 py-6 ob-enter',
        WIDTH_MAP[width],
        align === 'center' ? 'mx-auto text-center' : 'text-left',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
