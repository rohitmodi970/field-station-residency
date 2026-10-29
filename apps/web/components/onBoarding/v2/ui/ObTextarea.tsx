'use client';

import React, { useEffect, useRef, useImperativeHandle } from 'react';

export interface ObTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
  minRows?: number;
  maxRows?: number;
  error?: boolean;
}

export const ObTextarea = React.forwardRef<HTMLTextAreaElement, ObTextareaProps>(
  (
    {
      className = '',
      autoGrow = true,
      minRows = 3,
      maxRows = 10,
      rows = minRows,
      error = false,
      value,
      onChange,
      disabled,
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(forwardedRef, () => internalRef.current as HTMLTextAreaElement);

    const resize = () => {
      const el = internalRef.current;
      if (!el || !autoGrow) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, maxRows * 28 + 24)}px`;
    };

    useEffect(() => {
      resize();
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      resize();
      onChange?.(e);
    };

    return (
      <textarea
        ref={internalRef}
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        className={[
          'w-full rounded-xl bg-ob-raised border p-4 text-base text-ob-ink placeholder:text-ob-ink-faint transition-all font-[family-name:var(--font-ob-body)] outline-none leading-relaxed resize-none disabled:opacity-40 disabled:cursor-not-allowed',
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

ObTextarea.displayName = 'ObTextarea';
export default ObTextarea;
