"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type { PageData, DateDetectionResult } from './BulkJournalImport';

// ─── Types ───────────────────────────────────────────────────────────

interface DateDetectionStepProps {
  /** Per-page OCR data from Step 3 */
  pages: PageData[];
  /** Called when detection finishes */
  onDetectionComplete: (results: DateDetectionResult[]) => void;
  /** Go back */
  onBack: () => void;
}

type DetectionStatus = 'idle' | 'detecting' | 'done' | 'error';

// ─── Component ───────────────────────────────────────────────────────

const DateDetectionStep: React.FC<DateDetectionStepProps> = ({
  pages,
  onDetectionComplete,
  onBack,
}) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  const [status, setStatus] = useState<DetectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Preparing date analysis…');
  const [results, setResults] = useState<DateDetectionResult[]>([]);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const hasStarted = useRef(false);

  // ── Run date detection ────────────────────────────────────────────

  const runDetection = useCallback(async () => {
    if (pages.length === 0) return;

    setStatus('detecting');
    setStatusMessage('Analyzing journal pages with Claude…');
    setErrorDetail(null);

    try {
      const payload = pages.map((p, idx) => ({
        pageIndex: idx,
        fileName: p.fileName,
        text: p.rawText,
      }));

      const resp = await fetch('/api/journal/detect-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: payload }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ||
            `Date detection failed (${resp.status})`,
        );
      }

      const data = await resp.json();
      const detectionResults: DateDetectionResult[] = data.results ?? [];

      setResults(detectionResults);
      setStatus('done');

      const datesFound = detectionResults.filter((r) => r.date).length;
      const continuations = detectionResults.filter((r) => r.isContinuation).length;
      setStatusMessage(
        `Found dates on ${datesFound} of ${detectionResults.length} pages` +
          (continuations > 0 ? `, ${continuations} continuation${continuations > 1 ? 's' : ''}` : '') +
          '.',
      );

      // Auto-advance after short delay
      setTimeout(() => {
        onDetectionComplete(detectionResults);
      }, 1200);
    } catch (err) {
      console.error('[DateDetection] Error:', err);
      setStatus('error');
      setErrorDetail(err instanceof Error ? err.message : 'Unknown error');
      setStatusMessage('Date detection failed. You can retry or skip this step.');
    }
  }, [pages, onDetectionComplete]);

  // ── Auto-start on mount ───────────────────────────────────────────

  useEffect(() => {
    if (hasStarted.current) return;
    if (pages.length === 0) return;
    hasStarted.current = true;
    runDetection();
  }, [pages.length, runDetection]);

  // ── Retry ─────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    hasStarted.current = false;
    setResults([]);
    setStatus('idle');
    setStatusMessage('Retrying…');
    // Re-trigger via useEffect
    setTimeout(() => {
      hasStarted.current = false;
      runDetection();
    }, 100);
  }, [runDetection]);

  // ── Skip date detection (all pages get null date) ─────────────────

  const handleSkip = useCallback(() => {
    const fallback: DateDetectionResult[] = pages.map((_, idx) => ({
      pageIndex: idx,
      date: null,
      isContinuation: false,
      confidence: 'low' as const,
    }));
    onDetectionComplete(fallback);
  }, [pages, onDetectionComplete]);

  // ── Helpers ────────────────────────────────────────────────────────

  const confidenceBadge = (c: 'high' | 'medium' | 'low') => {
    const styles: Record<string, string> = {
      high: isDarkMode
        ? 'bg-green-900/30 text-green-400'
        : 'bg-green-100 text-green-700',
      medium: isDarkMode
        ? 'bg-yellow-900/30 text-yellow-400'
        : 'bg-yellow-100 text-yellow-700',
      low: isDarkMode
        ? 'bg-red-900/30 text-red-400'
        : 'bg-red-100 text-red-700',
    };
    return styles[c] ?? styles.low;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'No date found';
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${currentTheme.primary}20` }}
        >
          <Calendar size={20} style={{ color: currentTheme.primary }} />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Date Detection
          </h2>
          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {statusMessage}
          </p>
        </div>
      </div>

      {/* ── Loading / Spinner state ── */}
      {status === 'detecting' && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Calendar size={40} style={{ color: currentTheme.primary }} />
          </motion.div>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Claude is analyzing {pages.length} page{pages.length !== 1 ? 's' : ''} for dates and continuations…
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            This usually takes 5–15 seconds
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {status === 'error' && (
        <div
          className={`rounded-lg border p-4 ${
            isDarkMode ? 'border-red-800/50 bg-red-900/20' : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className={isDarkMode ? 'text-red-400 mt-0.5' : 'text-red-500 mt-0.5'}
            />
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                Date detection failed
              </p>
              {errorDetail && (
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-red-400/80' : 'text-red-500'}`}>
                  {errorDetail}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Results table ── */}
      {status === 'done' && results.length > 0 && (
        <div
          className={`rounded-lg border overflow-hidden ${
            isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
          }`}
        >
          {/* Table header */}
          <div
            className={`grid grid-cols-[40px_1fr_160px_80px_80px] gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider ${
              isDarkMode ? 'text-gray-500 bg-gray-800' : 'text-gray-400 bg-gray-100'
            }`}
          >
            <span>#</span>
            <span>File</span>
            <span>Date</span>
            <span>Type</span>
            <span>Confidence</span>
          </div>

          {/* Rows */}
          <div className="max-h-72 overflow-y-auto">
            {results.map((r, idx) => {
              const page = pages[r.pageIndex] ?? pages[idx];
              return (
                <div
                  key={r.pageIndex}
                  className={`grid grid-cols-[40px_1fr_160px_80px_80px] gap-2 px-4 py-2.5 items-center ${
                    idx < results.length - 1
                      ? isDarkMode
                        ? 'border-b border-gray-700/50'
                        : 'border-b border-gray-200/50'
                      : ''
                  }`}
                >
                  {/* Index */}
                  <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {r.pageIndex + 1}
                  </span>

                  {/* File name */}
                  <p
                    className={`text-sm font-medium truncate ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}
                  >
                    {page?.fileName ?? `Page ${r.pageIndex + 1}`}
                  </p>

                  {/* Date */}
                  <div className="flex items-center gap-1.5">
                    {r.date ? (
                      <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={13} className={`shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    )}
                    <span
                      className={`text-xs ${
                        r.date
                          ? isDarkMode ? 'text-gray-200' : 'text-gray-800'
                          : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      {formatDate(r.date)}
                    </span>
                  </div>

                  {/* Continuation badge */}
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full text-center ${
                      r.isContinuation
                        ? isDarkMode
                          ? 'bg-blue-900/30 text-blue-400'
                          : 'bg-blue-100 text-blue-700'
                        : isDarkMode
                          ? 'bg-gray-700 text-gray-400'
                          : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {r.isContinuation ? 'Cont.' : 'New'}
                  </span>

                  {/* Confidence */}
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full text-center ${confidenceBadge(r.confidence)}`}
                  >
                    {r.confidence}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={status === 'detecting'}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
            status === 'detecting'
              ? 'opacity-40 cursor-not-allowed'
              : isDarkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3">
          {/* Skip button — always available except during detection */}
          {status !== 'detecting' && status !== 'done' && (
            <button
              onClick={handleSkip}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                isDarkMode
                  ? 'text-gray-400 hover:bg-gray-700 border border-gray-700'
                  : 'text-gray-500 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Skip Detection
            </button>
          )}

          {/* Retry on error */}
          {status === 'error' && (
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors hover:opacity-90"
              style={{ backgroundColor: elementColors.button }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          )}

          {/* Manual continue when done (in case auto-advance was missed) */}
          {status === 'done' && (
            <button
              onClick={() => onDetectionComplete(results)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors hover:opacity-90"
              style={{ backgroundColor: elementColors.button }}
            >
              Continue to Grouping
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateDetectionStep;
