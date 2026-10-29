"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Upload,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import type { UploadedFile } from './BulkJournalImport';

// ─── Types ───────────────────────────────────────────────────────────

/** Per-file upload status tracked internally */
export type FileUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface FileUploadProgress {
  id: string;            // matches UploadedFile.id
  fileName: string;
  status: FileUploadStatus;
  /** Supabase storage path once uploaded */
  filePath: string | null;
  mimeType: string;
  error?: string;
}

interface ProcessingStepProps {
  /** Files selected in Step 1 */
  uploadedFiles: UploadedFile[];
  /** Called when ALL uploads finish (success or partial). Passes the uploaded file metadata. */
  onUploadsComplete: (results: FileUploadProgress[], tempFolder: string) => void;
  /** Go back to Step 1 */
  onBack: () => void;
}

// Presigned upload API accepts max 10 files per request
const BATCH_SIZE = 10;

// ─── Component ───────────────────────────────────────────────────────

const ProcessingStep: React.FC<ProcessingStepProps> = ({
  uploadedFiles,
  onUploadsComplete,
  onBack,
}) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  const [fileProgress, setFileProgress] = useState<FileUploadProgress[]>([]);
  const [overallStatus, setOverallStatus] = useState<'uploading' | 'done' | 'error'>('uploading');
  const [statusMessage, setStatusMessage] = useState('Preparing upload…');

  // Prevent double-firing in strict mode
  const hasStarted = useRef(false);
  // Store tempFolder path for later cleanup
  const tempFolderRef = useRef<string>('');

  // ── Initialize progress array ─────────────────────────────────────

  useEffect(() => {
    if (uploadedFiles.length > 0 && fileProgress.length === 0) {
      setFileProgress(
        uploadedFiles.map((f) => ({
          id: f.id,
          fileName: f.file.name,
          status: 'pending',
          filePath: null,
          mimeType: f.file.type || 'application/octet-stream',
        })),
      );
    }
  }, [uploadedFiles, fileProgress.length]);

  // ── Upload orchestration ──────────────────────────────────────────

  const runUploads = useCallback(async () => {
    if (uploadedFiles.length === 0) return;

    // Split files into batches of BATCH_SIZE (API limit = 10 per request)
    const batches: UploadedFile[][] = [];
    for (let i = 0; i < uploadedFiles.length; i += BATCH_SIZE) {
      batches.push(uploadedFiles.slice(i, i + BATCH_SIZE));
    }

    const allResults: FileUploadProgress[] = uploadedFiles.map((f) => ({
      id: f.id,
      fileName: f.file.name,
      status: 'pending' as FileUploadStatus,
      filePath: null,
      mimeType: f.file.type || 'application/octet-stream',
    }));

    setFileProgress([...allResults]);

    let globalFileIdx = 0; // tracks position across batches

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      if (!batch) continue;

      setStatusMessage(
        `Getting upload URLs (batch ${batchIdx + 1}/${batches.length})…`,
      );

      // ── 1. Get presigned URLs for this batch ────────────────────────

      const fileMetadata = batch.map((f) => ({
        fileName: f.file.name,
        fileSize: f.file.size,
        mimeType: f.file.type || 'application/octet-stream',
      }));

      let uploads: Array<{
        uploadUrl: string;
        filePath: string;
        token: string;
        fileName: string;
      }>;

      try {
        const resp = await fetch('/api/ocr/presigned-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: fileMetadata }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || `Presigned URL request failed (${resp.status})`,
          );
        }

        const data = await resp.json();
        uploads = data.uploads;

        // Capture the temp folder from the first file path (everything before the filename)
        if (uploads[0]?.filePath && !tempFolderRef.current) {
          const parts = uploads[0].filePath.split('/');
          parts.pop(); // remove filename
          tempFolderRef.current = parts.join('/');
        }
      } catch (err) {
        // Mark entire batch as failed
        for (let j = 0; j < batch.length; j++) {
          const idx = globalFileIdx + j;
          if (allResults[idx]) {
            allResults[idx] = {
              ...allResults[idx],
              status: 'failed',
              error: err instanceof Error ? err.message : 'Failed to get upload URL',
            };
          }
        }
        setFileProgress([...allResults]);
        globalFileIdx += batch.length;
        continue; // next batch
      }

      // ── 2. Upload each file in parallel within batch ────────────────

      setStatusMessage(
        `Uploading files ${globalFileIdx + 1}–${globalFileIdx + batch.length} of ${uploadedFiles.length}…`,
      );

      const uploadPromises = batch.map(async (uf, j) => {
        const idx = globalFileIdx + j;
        const upload = uploads[j];
        if (!upload) {
          allResults[idx] = {
            ...allResults[idx]!,
            status: 'failed',
            error: 'No upload URL received',
          };
          setFileProgress([...allResults]);
          return;
        }

        // Mark as uploading
        allResults[idx] = { ...allResults[idx]!, status: 'uploading' };
        setFileProgress([...allResults]);

        try {
          const putResp = await fetch(upload.uploadUrl, {
            method: 'PUT',
            body: uf.file,
            headers: {
              'Content-Type': uf.file.type || 'application/octet-stream',
            },
          });

          if (!putResp.ok) {
            throw new Error(`HTTP ${putResp.status}`);
          }

          allResults[idx] = {
            ...allResults[idx]!,
            status: 'uploaded',
            filePath: upload.filePath,
          };
        } catch (err) {
          allResults[idx] = {
            ...allResults[idx]!,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Upload failed',
          };
        }

        setFileProgress([...allResults]);
      });

      await Promise.all(uploadPromises);
      globalFileIdx += batch.length;
    }

    // ── Final status ────────────────────────────────────────────────

    const successCount = allResults.filter((r) => r.status === 'uploaded').length;
    const failCount = allResults.filter((r) => r.status === 'failed').length;

    if (successCount === 0) {
      setOverallStatus('error');
      setStatusMessage('All uploads failed. Please try again.');
    } else if (failCount > 0) {
      setOverallStatus('done');
      setStatusMessage(
        `${successCount} of ${allResults.length} files uploaded. ${failCount} failed.`,
      );
    } else {
      setOverallStatus('done');
      setStatusMessage(`All ${successCount} files uploaded successfully!`);
    }

    setFileProgress([...allResults]);

    // Auto-advance after a short delay if all succeeded
    if (failCount === 0) {
      setTimeout(() => {
        onUploadsComplete(allResults, tempFolderRef.current);
      }, 800);
    }
  }, [uploadedFiles, onUploadsComplete]);

  // ── Trigger uploads on mount ──────────────────────────────────────

  useEffect(() => {
    if (hasStarted.current) return;
    if (fileProgress.length === 0) return; // wait for init
    hasStarted.current = true;
    runUploads();
  }, [fileProgress.length, runUploads]);

  // ── Retry failed uploads ──────────────────────────────────────────

  const handleRetryFailed = useCallback(() => {
    // Reset only failed files and re-run the entire flow
    hasStarted.current = false;
    setFileProgress([]);
    setOverallStatus('uploading');
    setStatusMessage('Retrying…');
  }, []);

  // ── Continue with partial success ──────────────────────────────────

  const handleContinue = useCallback(() => {
    onUploadsComplete(fileProgress, tempFolderRef.current);
  }, [fileProgress, onUploadsComplete]);

  // ── Render helpers ─────────────────────────────────────────────────

  const successCount = fileProgress.filter((f) => f.status === 'uploaded').length;
  const failCount = fileProgress.filter((f) => f.status === 'failed').length;
  const progressPercent =
    fileProgress.length > 0
      ? Math.round(
          (fileProgress.filter((f) => f.status === 'uploaded' || f.status === 'failed').length /
            fileProgress.length) *
            100,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Uploading Files
        </h2>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {statusMessage}
        </p>
      </div>

      {/* ── Overall progress bar ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {successCount} / {fileProgress.length} uploaded
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
        {fileProgress.map((fp, idx) => (
          <div
            key={fp.id}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              idx < fileProgress.length - 1
                ? isDarkMode
                  ? 'border-b border-gray-700/50'
                  : 'border-b border-gray-200/50'
                : ''
            }`}
          >
            {/* Status icon */}
            <div className="shrink-0">
              {fp.status === 'pending' && (
                <Cloud size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
              )}
              {fp.status === 'uploading' && (
                <Loader2 size={16} className="text-blue-400 animate-spin" />
              )}
              {fp.status === 'uploaded' && (
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
                    ? isDarkMode
                      ? 'text-red-400'
                      : 'text-red-600'
                    : isDarkMode
                      ? 'text-gray-200'
                      : 'text-gray-800'
                }`}
              >
                <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mr-1.5`}>
                  {idx + 1}.
                </span>
                {fp.fileName}
              </p>
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
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-gray-200 text-gray-500'
                  : fp.status === 'uploading'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : fp.status === 'uploaded'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {fp.status === 'pending'
                ? 'Waiting'
                : fp.status === 'uploading'
                  ? 'Uploading'
                  : fp.status === 'uploaded'
                    ? 'Done'
                    : 'Failed'}
            </span>
          </div>
        ))}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={overallStatus === 'uploading'}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
            overallStatus === 'uploading'
              ? 'opacity-40 cursor-not-allowed'
              : isDarkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3">
          {/* Show retry button if there are failures */}
          {failCount > 0 && overallStatus === 'done' && (
            <button
              onClick={handleRetryFailed}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                isDarkMode
                  ? 'text-yellow-400 hover:bg-yellow-900/20 border border-yellow-800'
                  : 'text-yellow-700 hover:bg-yellow-50 border border-yellow-300'
              }`}
            >
              <RefreshCw size={14} /> Retry Failed
            </button>
          )}

          {/* Continue button (shown when done, even with partial failures) */}
          {overallStatus === 'done' && successCount > 0 && (
            <button
              onClick={handleContinue}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors hover:opacity-90"
              style={{ backgroundColor: elementColors.button }}
            >
              Continue to OCR
              <Upload size={14} />
            </button>
          )}

          {/* Error state: only back button available (already shown) */}
          {overallStatus === 'error' && (
            <button
              onClick={handleRetryFailed}
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

export default ProcessingStep;
