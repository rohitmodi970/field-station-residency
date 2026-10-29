'use client';

import React from 'react';

export interface ObInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const ObInput = React.forwardRef<HTMLInputElement, ObInputProps>(
  ({ className = '', error = false, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={[
          'w-full h-12 rounded-xl bg-ob-raised border px-4 text-base text-ob-ink placeholder:text-ob-ink-faint transition-all font-[family-name:var(--font-ob-body)] outline-none disabled:opacity-40 disabled:cursor-not-allowed',
          error
            ? 'border-ob-danger focus:border-ob-danger focus:ring-4 focus:ring-ob-danger/15'
            : 'border-ob-border focus:border-ob-clay focus:ring-4 focus:ring-ob-clay/15',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    );
  }
);

ObInput.displayName = 'ObInput';
export default ObInput;
