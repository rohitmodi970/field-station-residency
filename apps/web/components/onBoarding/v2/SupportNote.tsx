'use client';

import React from 'react';

import { ObCard } from './ui';

interface SupportNoteProps {
  onDismiss?: () => void;
}

export default function SupportNote({ onDismiss }: SupportNoteProps) {
  return (
    <ObCard layer="surface" className="mt-4 border-ob-border-strong text-left ob-enter">
      <div className="flex items-start gap-3">
        <div className="text-xl shrink-0">🤍</div>
        <div className="flex-1 text-sm text-ob-ink space-y-1 font-[family-name:var(--font-ob-body)]">
          <p className="font-medium text-ob-ink">
            That sounds really heavy, and I want to make sure you&apos;re supported.
          </p>
          <p className="text-ob-ink-muted text-xs leading-relaxed">
            I&apos;m an AI companion, but there are caring people ready to listen right now. If you&apos;re in crisis, you can call or text{' '}
            <a
              href="tel:988"
              className="text-ob-clay font-semibold underline underline-offset-2 hover:text-ob-clay-strong"
            >
              988
            </a>{' '}
            (US/Canada) or reach the{' '}
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ob-clay underline underline-offset-2 hover:text-ob-clay-strong"
            >
              Crisis Text Line
            </a>
            .
          </p>
          <p className="text-ob-ink-faint text-xs pt-1">
            You can take your time or continue whenever you feel ready.
          </p>
        </div>
      </div>
    </ObCard>
  );
}
