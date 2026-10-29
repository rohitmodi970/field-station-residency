'use client';

import React from 'react';

export interface ObBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'danger' | 'clay';
  children: React.ReactNode;
}

export const ObBadge = React.forwardRef<HTMLSpanElement, ObBadgeProps>(
  ({ variant = 'neutral', className = '', children, ...props }, ref) => {
    let variantStyles = 'bg-ob-surface border-ob-border text-ob-ink-muted';
    if (variant === 'success') {
      variantStyles = 'bg-ob-success-soft border-ob-success/30 text-ob-success font-medium';
    } else if (variant === 'danger') {
      variantStyles = 'bg-ob-danger-soft border-ob-danger/30 text-ob-danger font-medium';
    } else if (variant === 'clay') {
      variantStyles = 'bg-ob-clay-soft border-ob-clay text-ob-clay-strong font-medium';
    }

    return (
      <span
        ref={ref}
        className={[
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-normal tracking-wide font-[family-name:var(--font-ob-body)] select-none',
          variantStyles,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </span>
    );
  }
);

ObBadge.displayName = 'ObBadge';
export default ObBadge;
