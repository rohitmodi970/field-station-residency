"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import { ArrowLeft, Upload, ScanText, Calendar, Zap, CheckCircle } from 'lucide-react';
import ImageUploadStep from './ImageUploadStep';
import ProcessingStep, { type FileUploadProgress } from './ProcessingStep';
import OCRStep from './OCRStep';
import DateDetectionStep from './DateDetectionStep';
import { groupPages } from './groupPages';
import ReviewStep from './ReviewStep';
import ConfirmStep, { type BulkCreateResults } from './ConfirmStep';
import ResultStep from './ResultStep';
import { saveBulkImportCache, loadBulkImportCache, clearBulkImportCache } from './bulkImportCache';

// ─── Types ───────────────────────────────────────────────────────────

export interface UploadedFile {
  file: File;
  id: string;           // unique client id for dnd-kit
  preview: string;      // object URL for thumbnail
}

export interface PageData {
  imageIndex: number;
  fileName: string;
  filePath: string;       // Supabase temp path (filled after upload)
  rawText: string;        // OCR extracted text
  ocrSuccess: boolean;
}

export interface DateDetectionResult {
  pageIndex: number;
  date: string | null;
  isContinuation: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface JournalGroup {
  groupId: string;
  date: string | null;
  confidence: 'high' | 'medium' | 'low';
  pages: PageData[];
  combinedText: string;
  title: string;
  tags: string[];
  journalType: string;
  includeInImport: boolean;
  attachImages: boolean;
}

// Wizard step identifiers
type WizardStep = 'upload' | 'processing' | 'review' | 'confirm' | 'result';

const STEP_CONFIG: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'upload',     label: 'Upload',     icon: <Upload size={16} /> },
  { id: 'processing', label: 'Processing', icon: <ScanText size={16} /> },
  { id: 'review',     label: 'Review',     icon: <Calendar size={16} /> },
  { id: 'confirm',    label: 'Confirm',    icon: <Zap size={16} /> },
  { id: 'result',     label: 'Done',       icon: <CheckCircle size={16} /> },
];

// ─── Props ───────────────────────────────────────────────────────────

interface BulkJournalImportProps {
  onBack: () => void;   // Return to NewEntryLanding tab view
}

// ─── Component ───────────────────────────────────────────────────────

const BulkJournalImport: React.FC<BulkJournalImportProps> = ({ onBack }) => {
  const { currentTheme, isDarkMode, currentFont } = useTheme();
  const router = useRouter();

  // Track whether we've restored from cache (run once)
  const cacheRestored = useRef(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');

  // Sub-phase within the 'processing' wizard step
  type ProcessingPhase = 'upload' | 'ocr' | 'dateDetection';
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('upload');

  // Step 1 state – images selected by the user
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [attachImages, setAttachImages] = useState(true);

  // Step 2 state – upload results
  const [uploadResults, setUploadResults] = useState<FileUploadProgress[]>([]);
  const [tempFolder, setTempFolder] = useState<string>('');

  // Step 3 state – per-image OCR extracted text
  const [pages, setPages] = useState<PageData[]>([]);

  // Step 4 state – date detection results
  const [dateResults, setDateResults] = useState<DateDetectionResult[]>([]);

  // Step 5 state – grouped journal entries
  const [journalGroups, setJournalGroups] = useState<JournalGroup[]>([]);

  // Step 10 state – bulk create results
  const [bulkCreateResults, setBulkCreateResults] = useState<BulkCreateResults | null>(null);

  // ── Cache: restore on mount ──────────────────────────────────────

  useEffect(() => {
    if (cacheRestored.current) return;
    cacheRestored.current = true;

    const cached = loadBulkImportCache();
    if (!cached) return;

    // Only restore if we got past file uploads (Step 2+)
    if (cached.uploadResults.length === 0) return;

    console.log('[BulkImport] Restoring from cache, step:', cached.currentStep, 'phase:', cached.processingPhase);

    setUploadResults(cached.uploadResults);
    setTempFolder(cached.tempFolder);
    setAttachImages(cached.attachImages);

    if (cached.pages.length > 0) setPages(cached.pages);
    if (cached.dateResults.length > 0) setDateResults(cached.dateResults);
    if (cached.journalGroups.length > 0) setJournalGroups(cached.journalGroups);

    // Determine the best step to jump to
    if (cached.journalGroups.length > 0) {
      // We have groups — go straight to review
      setCurrentStep('review' as WizardStep);
    } else if (cached.dateResults.length > 0) {
      // Have date results but no groups — re-run grouping
      const groups = groupPages(cached.pages, cached.dateResults, cached.attachImages);
      setJournalGroups(groups);
      setCurrentStep('review' as WizardStep);
    } else if (cached.pages.length > 0) {
      // Have OCR pages — go to date detection
      setCurrentStep('processing' as WizardStep);
      setProcessingPhase('dateDetection');
    } else if (cached.uploadResults.length > 0) {
      // Have upload results — go to OCR
      setCurrentStep('processing' as WizardStep);
      setProcessingPhase('ocr');
    }
  }, []);

  // ── Cache: save on meaningful state changes ──────────────────────

  useEffect(() => {
    // Don't save once we've reached confirm/result — cache was already cleared
    if (currentStep === 'confirm' || currentStep === 'result') return;

    // Only save if we have something worth caching
    if (uploadResults.length === 0 && pages.length === 0 && journalGroups.length === 0) return;

    saveBulkImportCache({
      currentStep,
      processingPhase,
      uploadResults,
      tempFolder,
      pages,
      dateResults,
      journalGroups,
      attachImages,
    });
  }, [currentStep, processingPhase, uploadResults, tempFolder, pages, dateResults, journalGroups, attachImages]);

  // ── Helpers ──────────────────────────────────────────────────────

  const currentStepIndex = STEP_CONFIG.findIndex(s => s.id === currentStep);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  // Called when user clicks "Next" from the upload step
  const handleUploadNext = useCallback(() => {
    if (uploadedFiles.length === 0) return;
    goToStep('processing');
  }, [uploadedFiles, goToStep]);

  // Called when file uploads to Supabase complete (Step 2 → Step 3 OCR)
  const handleUploadsComplete = useCallback(
    (results: FileUploadProgress[], folder: string) => {
      setUploadResults(results);
      setTempFolder(folder);
      setProcessingPhase('ocr');
    },
    [],
  );

  // Called when OCR extraction completes (Step 3 → Step 4 date detection)
  const handleOCRComplete = useCallback(
    (extractedPages: PageData[]) => {
      setPages(extractedPages);
      setProcessingPhase('dateDetection');
    },
    [],
  );

  // Called when date detection completes (Step 4 → Step 5 grouping → review)
  const handleDateDetectionComplete = useCallback(
    (results: DateDetectionResult[]) => {
      setDateResults(results);

      // Step 5 — run client-side grouping
      const groups = groupPages(pages, results, attachImages);
      setJournalGroups(groups);

      console.log(
        '[BulkImport] Grouped into',
        groups.length,
        'journal entries from',
        pages.length,
        'pages',
      );

      // Advance to the Review wizard step
      goToStep('review');
    },
    [pages, attachImages, goToStep],
  );

  // Called when user confirms from the Review step
  const handleReviewConfirm = useCallback(() => {
    goToStep('confirm');
  }, [goToStep]);

  // Called when ConfirmStep finishes creating journals
  const handleConfirmComplete = useCallback(
    (results: BulkCreateResults) => {
      setBulkCreateResults(results);
      clearBulkImportCache();
      goToStep('result');
    },
    [goToStep],
  );

  // Called from ResultStep to navigate to journal list
  const handleGoToJournals = useCallback(() => {
    router.push('/journal');
  }, [router]);

  // Called from ResultStep to start a fresh import
  const handleStartNew = useCallback(() => {
    // Reset all state
    setCurrentStep('upload');
    setProcessingPhase('upload');
    setUploadedFiles([]);
    setAttachImages(true);
    setUploadResults([]);
    setTempFolder('');
    setPages([]);
    setDateResults([]);
    setJournalGroups([]);
    setBulkCreateResults(null);
    clearBulkImportCache();
  }, []);

  // ── Styles ───────────────────────────────────────────────────────

  const headerBgStyle = { backgroundColor: currentTheme.primary };
  const cardBg = isDarkMode ? 'bg-gray-800' : 'bg-white';

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-6xl mx-auto p-6" style={{ fontFamily: 'var(--font-family)' }}>
      <div className={`${cardBg} rounded-2xl shadow-xl overflow-hidden`}>
        {/* Header */}
        <div style={headerBgStyle} className="px-6 py-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-white/80 hover:text-white transition-colors"
              title="Back to entry options"
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Import Handwritten Journals
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white/90">Beta</span>
              </h1>
              <p className="text-white/70 text-sm">
                Upload photos of your pages — we&apos;ll turn them into digital entries
              </p>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        {currentStep !== 'result' && (
          <div className={`px-6 py-3 border-b ${isDarkMode ? 'border-gray-700/50' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {STEP_CONFIG.filter(s => s.id !== 'result').map((step, idx) => {
                const isActive = idx === Math.min(currentStepIndex, STEP_CONFIG.length - 2);
                const isCompleted = idx < currentStepIndex;
                return (
                  <React.Fragment key={step.id}>
                    {idx > 0 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-300 ${
                          isCompleted
                            ? ''
                            : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`}
                        style={isCompleted ? { backgroundColor: currentTheme.primary } : undefined}
                      />
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          isActive
                            ? 'text-white shadow-lg scale-110'
                            : isCompleted
                              ? 'text-white'
                              : isDarkMode
                                ? 'bg-gray-700 text-gray-400'
                                : 'bg-gray-200 text-gray-500'
                        }`}
                        style={
                          isActive || isCompleted
                            ? { backgroundColor: currentTheme.primary }
                            : undefined
                        }
                      >
                        {step.icon}
                      </div>
                      <span
                        className={`text-[10px] font-medium hidden sm:block transition-colors duration-300 ${
                          isActive
                            ? 'font-semibold'
                            : isCompleted
                              ? ''
                              : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}
                        style={isActive || isCompleted ? { color: currentTheme.primary } : undefined}
                      >
                        {step.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {currentStep === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <ImageUploadStep
                  uploadedFiles={uploadedFiles}
                  setUploadedFiles={setUploadedFiles}
                  attachImages={attachImages}
                  setAttachImages={setAttachImages}
                  onNext={handleUploadNext}
                />
              </motion.div>
            )}

            {currentStep === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {processingPhase === 'upload' && (
                  <ProcessingStep
                    uploadedFiles={uploadedFiles}
                    onUploadsComplete={handleUploadsComplete}
                    onBack={() => goToStep('upload')}
                  />
                )}
                {processingPhase === 'ocr' && (
                  <OCRStep
                    uploadResults={uploadResults}
                    onOCRComplete={handleOCRComplete}
                    onBack={() => setProcessingPhase('upload')}
                  />
                )}
                {processingPhase === 'dateDetection' && (
                  <DateDetectionStep
                    pages={pages}
                    onDetectionComplete={handleDateDetectionComplete}
                    onBack={() => setProcessingPhase('ocr')}
                  />
                )}
              </motion.div>
            )}

            {currentStep === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <ReviewStep
                  journalGroups={journalGroups}
                  onGroupsChange={setJournalGroups}
                  onConfirm={handleReviewConfirm}
                  onBack={() => {
                    goToStep('processing');
                    setProcessingPhase('dateDetection');
                  }}
                />
              </motion.div>
            )}

            {currentStep === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <ConfirmStep
                  journalGroups={journalGroups}
                  tempFolder={tempFolder}
                  onComplete={handleConfirmComplete}
                  onBack={() => goToStep('review')}
                />
              </motion.div>
            )}

            {currentStep === 'result' && bulkCreateResults && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 250, damping: 25 }}
              >
                <ResultStep
                  results={bulkCreateResults}
                  onGoToJournals={handleGoToJournals}
                  onStartNew={handleStartNew}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default BulkJournalImport;
