'use client';

import React from 'react';

export interface ObCardProps extends React.HTMLAttributes<HTMLDivElement> {
  layer?: 'surface' | 'raised';
  children: React.ReactNode;
}

export const ObCard = React.forwardRef<HTMLDivElement, ObCardProps>(
  ({ layer = 'surface', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          'rounded-3xl border border-ob-border p-6 transition-all shadow-[0_4px_24px_rgba(42,33,28,0.04)]',
          layer === 'raised' ? 'bg-ob-raised' : 'bg-ob-surface',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ObCard.displayName = 'ObCard';
export default ObCard;
