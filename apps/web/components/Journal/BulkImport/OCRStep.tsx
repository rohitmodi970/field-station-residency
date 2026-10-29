"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  ScanText,
  FileText,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import type { PageData } from './BulkJournalImport';
import type { FileUploadProgress } from './ProcessingStep';

// ─── Types ───────────────────────────────────────────────────────────

export type OCRFileStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface OCRFileProgress {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  status: OCRFileStatus;
  extractedText: string;
  error?: string;
}

interface OCRStepProps {
  /** Successfully-uploaded file metadata from Step 2 */
  uploadResults: FileUploadProgress[];
  /** Called when OCR extraction completes for all files */
  onOCRComplete: (pages: PageData[]) => void;
  /** Go back to upload phase */
  onBack: () => void;
}

// Process 5 files per batch to avoid overwhelming the Mistral API
const OCR_BATCH_SIZE = 5;

// ─── Component ───────────────────────────────────────────────────────

const OCRStep: React.FC<OCRStepProps> = ({
  uploadResults,
  onOCRComplete,
  onBack,
}) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  const [ocrProgress, setOcrProgress] = useState<OCRFileProgress[]>([]);
  const [overallStatus, setOverallStatus] = useState<'processing' | 'done' | 'error'>('processing');
  const [statusMessage, setStatusMessage] = useState('Preparing OCR extraction…');

  const hasStarted = useRef(false);

  // Only process successfully-uploaded files
  const uploadedFiles = uploadResults.filter(
    (r) => r.status === 'uploaded' && r.filePath,
  );

  // ── Initialize progress array ─────────────────────────────────────

  useEffect(() => {
    if (uploadedFiles.length > 0 && ocrProgress.length === 0) {
      setOcrProgress(
        uploadedFiles.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          filePath: f.filePath!,
          mimeType: f.mimeType,
          status: 'pending' as OCRFileStatus,
          extractedText: '',
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles.length, ocrProgress.length]);

  // ── OCR orchestration ─────────────────────────────────────────────

  const runOCR = useCallback(async () => {
    if (uploadedFiles.length === 0) return;

    // Build the full progress array
    const allResults: OCRFileProgress[] = uploadedFiles.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      filePath: f.filePath!,
      mimeType: f.mimeType,
      status: 'pending' as OCRFileStatus,
      extractedText: '',
    }));

    setOcrProgress([...allResults]);

    // Split into batches
    const batches: typeof uploadedFiles[] = [];
    for (let i = 0; i < uploadedFiles.length; i += OCR_BATCH_SIZE) {
      batches.push(uploadedFiles.slice(i, i + OCR_BATCH_SIZE));
    }

    let globalIdx = 0;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]!;

      setStatusMessage(
        `Extracting text (batch ${batchIdx + 1}/${batches.length})… ${globalIdx}/${uploadedFiles.length} done`,
      );

      // Mark batch items as processing
      for (let j = 0; j < batch.length; j++) {
        const idx = globalIdx + j;
        allResults[idx] = { ...allResults[idx]!, status: 'processing' };
      }
      setOcrProgress([...allResults]);

      // Call the existing process-from-storage endpoint for this batch
      try {
        const filesPayload = batch.map((f) => ({
          filePath: f.filePath!,
          fileName: f.fileName,
          mimeType: f.mimeType,
        }));

        const resp = await fetch('/api/ocr/process-from-storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: filesPayload }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || `OCR request failed (${resp.status})`,
          );
        }

        const data = await resp.json();
        const individualResults: Array<{
          fileName: string;
          fileIndex: number;
          success: boolean;
          text: string;
          error: string | null;
        }> = data.individualResults ?? [];

        // Map results back into allResults
        for (let j = 0; j < batch.length; j++) {
          const idx = globalIdx + j;
          const result = individualResults.find(
            (r) => r.fileIndex === j,
          );

          if (result?.success) {
            allResults[idx] = {
              ...allResults[idx]!,
              status: 'done',
              extractedText: result.text,
            };
          } else {
            allResults[idx] = {
              ...allResults[idx]!,
              status: 'failed',
              extractedText: '',
              error: result?.error || 'No result returned',
            };
          }
        }
      } catch (err) {
        // Mark entire batch as failed
        for (let j = 0; j < batch.length; j++) {
          const idx = globalIdx + j;
          allResults[idx] = {
            ...allResults[idx]!,
            status: 'failed',
            error: err instanceof Error ? err.message : 'OCR failed',
          };
        }
      }

      setOcrProgress([...allResults]);
      globalIdx += batch.length;
    }

    // ── Final status ────────────────────────────────────────────────

    const successCount = allResults.filter((r) => r.status === 'done').length;
    const failCount = allResults.filter((r) => r.status === 'failed').length;

    if (successCount === 0) {
      setOverallStatus('error');
      setStatusMessage('Text extraction failed for all files. Please try again.');
    } else if (failCount > 0) {
      setOverallStatus('done');
      setStatusMessage(
        `Extracted text from ${successCount} of ${allResults.length} files. ${failCount} failed.`,
      );
    } else {
      setOverallStatus('done');
      setStatusMessage(`Successfully extracted text from all ${successCount} files!`);
    }

    setOcrProgress([...allResults]);

    // Auto-advance if all succeeded
    if (failCount === 0) {
      setTimeout(() => {
        emitResults(allResults);
      }, 800);
    }
  }, [uploadedFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build PageData and call parent ────────────────────────────────

  const emitResults = useCallback(
    (results: OCRFileProgress[]) => {
      const pages: PageData[] = results
        .filter((r) => r.status === 'done')
        .map((r, idx) => ({
          imageIndex: idx,
          fileName: r.fileName,
          filePath: r.filePath,
          rawText: r.extractedText,
          ocrSuccess: true,
        }));

      onOCRComplete(pages);
    },
    [onOCRComplete],
  );

  // ── Trigger on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (hasStarted.current) return;
    if (ocrProgress.length === 0) return;
    hasStarted.current = true;
    runOCR();
  }, [ocrProgress.length, runOCR]);

  // ── Retry ─────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    hasStarted.current = false;
    setOcrProgress([]);
    setOverallStatus('processing');
    setStatusMessage('Retrying…');
  }, []);

  // ── Continue with partial success ─────────────────────────────────

  const handleContinue = useCallback(() => {
    emitResults(ocrProgress);
  }, [ocrProgress, emitResults]);

  // ── Render helpers ─────────────────────────────────────────────────

  const successCount = ocrProgress.filter((f) => f.status === 'done').length;
  const failCount = ocrProgress.filter((f) => f.status === 'failed').length;
  const completedCount = ocrProgress.filter(
    (f) => f.status === 'done' || f.status === 'failed',
  ).length;
  const progressPercent =
    ocrProgress.length > 0 ? Math.round((completedCount / ocrProgress.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${currentTheme.primary}20` }}
        >
          <ScanText size={20} style={{ color: currentTheme.primary }} />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Extracting Text (OCR)
          </h2>
          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {statusMessage}
          </p>
        </div>
      </div>

      {/* ── Overall progress bar ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {successCount} / {ocrProgress.length} extracted
          </span>
          <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {progressPercent}%
          </span>
        </div>
        <div
          className={`w-full h-2 rounded-full overflow-hidden ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: currentTheme.primary }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ── Per-file list ── */}
      <div
        className={`rounded-lg border max-h-80 overflow-y-auto ${
          isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        {ocrProgress.map((fp, idx) => (
          <div
            key={fp.id}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              idx < ocrProgress.length - 1
                ? isDarkMode
                  ? 'border-b border-gray-700/50'
                  : 'border-b border-gray-200/50'
                : ''
            }`}
          >
            {/* Status icon */}
            <div className="shrink-0">
              {fp.status === 'pending' && (
                <FileText size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
              )}
              {fp.status === 'processing' && (
                <Loader2 size={16} className="text-blue-400 animate-spin" />
              )}
              {fp.status === 'done' && (
                <CheckCircle2 size={16} className="text-green-500" />
              )}
              {fp.status === 'failed' && (
                <XCircle size={16} className="text-red-500" />
              )}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  fp.status === 'failed'
                    ? isDarkMode ? 'text-red-400' : 'text-red-600'
                    : isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mr-1.5`}>
                  {idx + 1}.
                </span>
                {fp.fileName}
              </p>
              {fp.status === 'done' && fp.extractedText && (
                <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {fp.extractedText.slice(0, 80)}
                  {fp.extractedText.length > 80 ? '…' : ''}
                </p>
              )}
              {fp.error && (
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-red-400/80' : 'text-red-500'}`}>
                  {fp.error}
                </p>
              )}
            </div>

            {/* Status label */}
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                fp.status === 'pending'
                  ? isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  : fp.status === 'processing'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : fp.status === 'done'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {fp.status === 'pending'
                ? 'Waiting'
                : fp.status === 'processing'
                  ? 'Reading…'
                  : fp.status === 'done'
                    ? 'Extracted'
                    : 'Failed'}
            </span>
          </div>
        ))}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={overallStatus === 'processing'}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
            overallStatus === 'processing'
              ? 'opacity-40 cursor-not-allowed'
              : isDarkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3">
          {failCount > 0 && overallStatus === 'done' && (
            <button
              onClick={handleRetry}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                isDarkMode
                  ? 'text-yellow-400 hover:bg-yellow-900/20 border border-yellow-800'
                  : 'text-yellow-700 hover:bg-yellow-50 border border-yellow-300'
              }`}
            >
              <RefreshCw size={14} /> Retry Failed
            </button>
          )}

          {overallStatus === 'done' && successCount > 0 && (
            <button
              onClick={handleContinue}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors hover:opacity-90"
              style={{ backgroundColor: elementColors.button }}
            >
              Continue to Date Detection
              <ArrowRight size={14} />
            </button>
          )}

          {overallStatus === 'error' && (
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
              style={{ backgroundColor: elementColors.button }}
            >
              <RefreshCw size={14} /> Retry All
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRStep;
