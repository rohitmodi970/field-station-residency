'use client';

import React from 'react';

export interface ObSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ObSkeleton = React.forwardRef<HTMLDivElement, ObSkeletonProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={[
          'relative overflow-hidden rounded-xl bg-ob-surface before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    );
  }
);

ObSkeleton.displayName = 'ObSkeleton';
export default ObSkeleton;
