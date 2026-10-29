'use client';

import React from 'react';

export interface ObButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'link';
  children: React.ReactNode;
}

export const ObButton = React.forwardRef<HTMLButtonElement, ObButtonProps>(
  ({ variant = 'primary', className = '', children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center transition-all cursor-pointer select-none font-[family-name:var(--font-ob-body)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none';

    let variantClasses = '';
    if (variant === 'primary') {
      variantClasses =
        'h-12 px-8 rounded-full bg-ob-ink text-ob-canvas text-[15px] font-medium hover:bg-ob-ink-hover active:scale-[0.98] shadow-sm';
    } else if (variant === 'secondary') {
      variantClasses =
        'h-12 px-8 rounded-full bg-ob-raised border border-ob-border text-ob-ink text-[15px] font-medium hover:bg-ob-surface hover:border-ob-border-strong active:scale-[0.98] shadow-xs';
    } else if (variant === 'link') {
      variantClasses =
        'text-sm text-ob-ink-muted hover:text-ob-ink underline-offset-4 hover:underline p-0 h-auto bg-transparent border-0';
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[base, variantClasses, className].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ObButton.displayName = 'ObButton';
export default ObButton;
