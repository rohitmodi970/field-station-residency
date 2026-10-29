'use client';

import React from 'react';

export interface ObChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'onToggle'> {
  selected?: boolean;
  onToggle?: (selected: boolean) => void;
  children: React.ReactNode;
}

export const ObChip = React.forwardRef<HTMLButtonElement, ObChipProps>(
  (
    {
      selected = false,
      onToggle,
      onClick,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      onToggle?.(!selected);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={handleClick}
        className={[
          'h-9 px-4 rounded-full border text-sm transition-all inline-flex items-center gap-1.5 cursor-pointer select-none font-[family-name:var(--font-ob-body)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay focus-visible:ring-offset-1 disabled:opacity-40 disabled:pointer-events-none',
          selected
            ? 'bg-ob-clay-soft border-ob-clay text-ob-clay-strong font-medium shadow-xs'
            : 'border-ob-border bg-ob-raised text-ob-ink-muted hover:border-ob-clay/50 hover:text-ob-ink',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {selected && (
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
        )}
        <span>{children}</span>
      </button>
    );
  }
);

ObChip.displayName = 'ObChip';
export default ObChip;
