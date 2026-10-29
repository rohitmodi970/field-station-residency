'use client';
// apps/web/components/security/RecoveryCodesDisplay.tsx

import React, { useState } from 'react';
import {
  Copy, Check, Download, ShieldCheck, AlertTriangle,
  X, KeyRound, Eye, EyeOff,
} from 'lucide-react';

interface RecoveryCodesDisplayProps {
  /** The 8 plain-text recovery codes (XXXX-XXXX format) */
  codes: string[];
  /** Called when the user confirms they have saved the codes */
  onDismiss: () => void;
  /** Visual mode: 'modal' (full-screen overlay) or 'inline' (embedded in page) */
  mode?: 'modal' | 'inline';
  /** Label context shown in the header */
  context?: 'signup' | 'regenerated';
}

export default function RecoveryCodesDisplay({
  codes,
  onDismiss,
  mode = 'modal',
  context = 'regenerated',
}: RecoveryCodesDisplayProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [revealed, setRevealed] = useState(true);

  /* ── Clipboard helpers ── */
  const copyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const copyAllCodes = async () => {
    const text = codes.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  /* ── Download helper ── */
  const downloadCodes = () => {
    const now = new Date().toISOString().split('T')[0];
    const content = [
      'FORCE Recovery Codes',
      `Generated: ${now}`,
      '',
      'Store these codes somewhere safe (password manager, printed copy).',
      'Each code can only be used ONCE.',
      '',
      ...codes.map((c, i) => `${i + 1}. ${c}`),
      '',
      'If you lose all your devices AND these codes, your encrypted data',
      'cannot be recovered. FORCE operates with zero-knowledge encryption.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `force-recovery-codes-${now}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Content ── */
  const content = (
    <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white overflow-hidden shadow-md font-sans">
      {/* Header strip — one intentional brand moment, kept minimal */}
      <div className="px-5 py-4 border-b border-stone-200 flex items-start gap-3 bg-stone-50">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-100 flex items-center justify-center">
          <KeyRound size={15} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="m-0 text-[15px] font-[500] text-stone-900">
            {context === 'signup' ? 'Save your recovery codes' : 'New recovery codes generated'}
          </h2>
          <p className="mt-0.5 m-0 text-[12px] text-stone-600">
            {context === 'signup'
              ? 'Your account is protected. Save these codes immediately.'
              : 'Your previous codes are now invalid. Save these new ones.'}
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-5 py-3">
        <AlertTriangle size={13} className="mt-px shrink-0 text-amber-600" />
        <p className="m-0 text-[12px] leading-relaxed text-amber-800">
          <strong>These codes are shown once and never again.</strong> Save them in a password manager or print them. Do not rely on screenshots.
        </p>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setRevealed(v => !v)}
            className="inline-flex items-center gap-1.5 text-[12px] font-[500] text-stone-600 hover:text-stone-900 border-none bg-transparent p-0 cursor-pointer transition-colors"
          >
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
            {revealed ? 'Hide codes' : 'Show codes'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={copyAllCodes}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 px-3 py-1.5 text-[12px] font-[500] text-stone-600 hover:text-stone-900 transition-colors"
            >
              {copiedAll ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              {copiedAll ? 'Copied!' : 'Copy all'}
            </button>
            <button
              onClick={downloadCodes}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 px-3 py-1.5 text-[12px] font-[500] text-stone-600 hover:text-stone-900 transition-colors"
            >
              <Download size={12} />
              Download
            </button>
          </div>
        </div>

        {/* Codes grid */}
        <div className="grid grid-cols-2 gap-2">
          {codes.map((code, i) => (
            <button
              key={i}
              onClick={() => copyCode(code, i)}
              className="group relative flex items-center justify-between rounded-lg border border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 px-3.5 py-2.5 text-left transition-all"
              title="Click to copy"
            >
              <span
                className={`font-mono text-[14px] font-[500] tracking-widest text-stone-900 transition-all ${!revealed ? 'blur-sm select-none' : ''}`}
              >
                {code}
              </span>
              <span className="ml-2 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                {copiedIndex === i
                  ? <Check size={12} className="text-emerald-600" />
                  : <Copy size={12} className="text-stone-400" />}
              </span>
              {copiedIndex === i && (
                <span
                  className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-md px-2 py-0.5 text-[11px] font-[500] shadow bg-emerald-100 text-emerald-800"
                >
                  Copied
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Confirmation checkbox */}
        <label
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 bg-white hover:border-stone-300 px-4 py-3 transition-colors"
          htmlFor="recovery-codes-confirm"
        >
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-stone-300 shrink-0 text-stone-900 focus:ring-stone-900"
            id="recovery-codes-confirm"
          />
          <span className="text-[13px] leading-relaxed text-stone-600">
            I've saved my recovery codes in a safe place and understand they
            will <strong className="text-stone-900 font-[500]">not be shown again</strong>.
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-stone-500">
            <ShieldCheck size={13} />
            <span>{codes.length} codes · one-time use each</span>
          </div>
          <button
            onClick={onDismiss}
            disabled={!confirmed}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-[500] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 bg-stone-800 text-stone-50 hover:bg-stone-900 active:bg-stone-950"
          >
            <Check size={14} />
            Done, I've saved them
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === 'inline') return content;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div className="relative w-full max-w-lg">
        {content}
        {confirmed && (
          <button
            onClick={onDismiss}
            className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white shadow-md transition-transform hover:scale-110"
            title="Close"
          >
            <X size={13} className="text-stone-500 hover:text-stone-900" />
          </button>
        )}
      </div>
    </div>
  );
}