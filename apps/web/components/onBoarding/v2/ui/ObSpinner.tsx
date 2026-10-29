'use client';

import React from 'react';

export interface ObSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-3',
};

export const ObSpinner = React.forwardRef<HTMLDivElement, ObSpinnerProps>(
  ({ size = 'md', className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading"
        className={[
          'rounded-full border-ob-ink/20 border-t-ob-ink animate-spin shrink-0',
          SIZE_MAP[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    );
  }
);

ObSpinner.displayName = 'ObSpinner';
export default ObSpinner;
