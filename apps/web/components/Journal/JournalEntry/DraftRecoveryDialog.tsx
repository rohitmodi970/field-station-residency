import React from 'react';

type DraftRecoveryDialogStyles = {
  primaryColor: string;
  bgCard: string;
  bgPage: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
};

type DraftRecoveryDialogProps = {
  isOpen: boolean;
  draftTitle?: string | null;
  styles: DraftRecoveryDialogStyles;
  themePrimary: string;
  onDismiss: () => void;
  onStartFresh: () => void;
  onContinue: () => void;
};

const DraftRecoveryDialog: React.FC<DraftRecoveryDialogProps> = ({
  isOpen,
  draftTitle,
  styles,
  themePrimary,
  onDismiss,
  onStartFresh,
  onContinue,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
        style={{ backgroundColor: styles.bgCard, borderColor: styles.borderColor }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ backgroundColor: `${themePrimary}15`, color: themePrimary }}
            >
              Draft recovery
            </div>
            <h3 className="mt-3 text-base font-semibold" style={{ color: styles.textPrimary }}>
              Recover your latest unsynced draft?
            </h3>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: styles.borderColor,
              color: styles.textSecondary,
              backgroundColor: styles.bgPage,
            }}
            aria-label="Dismiss draft recovery"
          >
            Not now
          </button>
        </div>

        <p className="mt-3 text-sm leading-6" style={{ color: styles.textSecondary }}>
          We found cached changes from a previous session. You can continue from where you left off, start fresh,
          or skip recovery for this session.
        </p>
        {draftTitle && (
          <p
            className="mt-3 rounded-xl border px-3 py-2 text-xs"
            style={{
              color: styles.textSecondary,
              borderColor: styles.borderColor,
              backgroundColor: styles.bgPage,
            }}
          >
            Latest: {draftTitle || '(untitled draft)'}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onStartFresh}
            className="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: themePrimary, color: themePrimary, backgroundColor: styles.bgPage }}
          >
            Start fresh
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition-colors"
            style={{ backgroundColor: styles.primaryColor, color: '#fff' }}
          >
            Continue Latest
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-5" style={{ color: styles.textSecondary }}>
          Skipping leaves the cache untouched and hides this prompt until the next session.
        </p>
      </div>
    </div>
  );
};

export default DraftRecoveryDialog;
