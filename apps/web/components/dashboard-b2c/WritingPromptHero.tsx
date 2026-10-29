"use client"

import React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Pen, ArrowRight, Loader2, RefreshCw, Mic, PenLine, X, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/utilities/context/ThemeContext';
import { trackEvent } from '@/lib/posthog-events';
import { buildJournalNewUrl, setJournalPromptContext, setJournalPromptPrefill, setJournalReturnUrl } from '@/lib/journal/new-entry-navigation';
import { RotatingThinkingBadge } from './PromptThinkingSkeleton';

interface WritingPromptHeroProps {
  prompt: {
    text: string;
    explanation: string;
  };
  ctaLabel?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const WritingPromptHero: React.FC<WritingPromptHeroProps> = ({ prompt, ctaLabel, onRefresh, isRefreshing = false }) => {
  const router = useRouter();
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  const [showModeDialog, setShowModeDialog] = React.useState(false);
  const [navigatingMode, setNavigatingMode] = React.useState<'write' | 'voice' | null>(null);

  const writeHref = React.useMemo(
    () => buildJournalNewUrl({ source: 'dashboard_prompt', mode: 'write' }),
    []
  );
  const voiceHref = React.useMemo(
    () => buildJournalNewUrl({ source: 'dashboard_prompt', mode: 'voice' }),
    []
  );

  const prefetchDestinationRoutes = React.useCallback(() => {
    try {
      router.prefetch(writeHref);
      router.prefetch(voiceHref);
      router.prefetch('/journal/new');
    } catch {
      // Ignore prefetch errors
    }
  }, [router, writeHref, voiceHref]);

  // Prefetch routes immediately on mount so chunks are cached
  React.useEffect(() => {
    prefetchDestinationRoutes();
  }, [prefetchDestinationRoutes]);

  const handleOpenDialog = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (isRefreshing || navigatingMode !== null) {
      return;
    }
    setShowModeDialog(true);
    prefetchDestinationRoutes();
  };

  const preparePromptNavigation = (mode: 'write' | 'voice') => {
    setNavigatingMode(mode);
    try {
      trackEvent.searchPerformed({
        results_count: 1,
        context: 'journals',
        query_length: 0,
      });
    } catch {
      // Ignore telemetry errors
    }
    setJournalPromptPrefill(prompt.text);
    setJournalPromptContext({ text: prompt.text, explanation: prompt.explanation });
    setJournalReturnUrl('/dashboard');
  };

  React.useEffect(() => {
    if (!showModeDialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModeDialog(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModeDialog]);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-(--radius-hero) cursor-pointer group"
        onClick={handleOpenDialog}
        onMouseEnter={prefetchDestinationRoutes}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleOpenDialog()}
      >
      {/* Background gradient with theme-aware colors */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: isDarkMode
            ? `linear-gradient(135deg, ${currentTheme.primary}20 0%, ${currentTheme.primary}10 50%, transparent 100%)`
            : 'linear-gradient(135deg, rgba(255,251,247,0.98) 0%, rgba(251,241,233,0.92) 55%, rgba(239,228,217,0.86) 100%)',
        }}
      />

      {/* Subtle pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(${currentTheme.primary} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Hover glow effect for better ux */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 80% 50%, rgba(173,109,90,0.2), transparent 60%)`,
        }}
      />

      <div
        className="relative z-10 p-5 sm:p-7 md:p-8 lg:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 lg:gap-8 border rounded-(--radius-hero) backdrop-blur-sm"
        style={{
          borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(159,120,100,0.24)',
          background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255, 249, 244, 0.86)',
          color: elementColors.text,
        }}
      >
        {/* Icon */}
        <motion.div
          whileHover={{ rotate: 12 }}
          className="shrink-0 p-3.5 rounded-2xl"
          style={{
            background: `${currentTheme.primary}18`,
            color: currentTheme.primary,
          }}
        >
          <Pen className="w-6 h-6 sm:w-7 sm:h-7" />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2.5">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: elementColors.accent || currentTheme.primary, letterSpacing: '0.08em' }}
              >
                Today&apos;s Prompt
              </span>
              {isRefreshing && (
                <div
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    background: isDarkMode ? 'rgba(245, 158, 11, 0.16)' : 'rgba(217, 119, 6, 0.12)',
                    border: `1px solid ${isDarkMode ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.28)'}`,
                  }}
                >
                  <RotatingThinkingBadge isDarkMode={isDarkMode} />
                </div>
              )}
            </div>

            {onRefresh && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRefresh();
                }}
                disabled={isRefreshing}
                title="Generate new prompt"
                aria-label="Generate new prompt"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer shadow-xs ${
                  isDarkMode
                    ? 'border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-slate-100 hover:bg-slate-700/90 hover:border-slate-600'
                    : 'border border-[#dcc5b8]/70 bg-[#fff5ee]/90 text-[#7a5148] hover:text-[#3e2a24] hover:bg-[#faeae0] hover:border-[#cfb3a4]'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 transition-transform duration-500 ${
                    isRefreshing ? 'animate-spin text-amber-500' : ''
                  }`}
                />
                <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'New Prompt'}</span>
              </motion.button>
            )}
          </div>
          
          <h2
            className={`text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold leading-snug mb-1.5 transition-opacity duration-300 ${
              isRefreshing ? 'opacity-70' : 'opacity-100'
            }`}
            style={{
              fontFamily: 'var(--dashboard-heading-font, var(--font-serif))',
              color: elementColors.text,
              letterSpacing: '0.03em',
            }}
          >
            {prompt.text}
          </h2>
          
          <p
            className={`text-sm lg:text-base max-w-2xl lg:max-w-3xl transition-opacity duration-300 ${
              isRefreshing ? 'opacity-60' : 'opacity-100'
            }`}
            style={{
              color: currentTheme.medium || (isDarkMode ? 'rgba(255,255,255,0.75)' : '#6f5046'),
              fontFamily: 'var(--dashboard-body-font, inherit)',
              letterSpacing: '0.02em',
            }}
          >
            {prompt.explanation}
          </p>
        </div>

        {/* CTA Button */}
        <motion.button
          whileHover={navigatingMode ? undefined : { scale: 1.04, x: 2 }}
          whileTap={{ scale: 0.97 }}
          animate={{
            backgroundPosition: navigatingMode ? '100% 50%' : ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            backgroundPosition: {
              duration: 5.2,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
          disabled={navigatingMode !== null}
          className="shrink-0 flex font-inter items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full font-medium text-sm sm:text-base text-white shadow-lg transition-shadow hover:shadow-xl hover:saturate-125 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-85 disabled:hover:shadow-lg disabled:hover:saturate-100 disabled:hover:brightness-100 cursor-pointer"
          style={{
            backgroundImage: isDarkMode
              ? `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.secondary || currentTheme.primary} 46%, ${currentTheme.primary} 100%)`
              : 'linear-gradient(135deg, #9f6958 0%, #8f7f62 48%, #7a8f66 100%)',
            backgroundSize: '200% 200%',
            boxShadow: isDarkMode ? '0 8px 18px rgba(0,0,0,0.6)' : '0 8px 18px rgba(121,89,72,0.32)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDialog(e);
          }}
          onMouseEnter={prefetchDestinationRoutes}
        >
          {navigatingMode ? 'Opening...' : (  'Start Exploring')}
          {/* {navigatingMode ? 'Opening...' : (ctaLabel || 'Start Exploring')} */}
          {navigatingMode ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          )}
        </motion.button>
      </div>
    </motion.section>

    {/* Mode Selection Dialog */}
    <AnimatePresence>
      {showModeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!navigatingMode) setShowModeDialog(false);
            }}
          />

          {/* Modal Dialog Content */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-mode-dialog-title"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border backdrop-blur-2xl"
            style={{
              borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(159,120,100,0.28)',
              backgroundColor: isDarkMode ? 'rgba(28, 16, 32, 0.94)' : 'rgba(255, 250, 246, 0.96)',
              boxShadow: isDarkMode
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(236, 72, 153, 0.15)'
                : '0 25px 50px -12px rgba(121, 89, 72, 0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              aria-label="Close dialog"
              disabled={navigatingMode !== null}
              onClick={() => setShowModeDialog(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full transition-colors cursor-pointer"
              style={{
                color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#64748B',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Tag / Badge */}
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: `${currentTheme.primary}18`,
                  color: currentTheme.primary,
                  letterSpacing: '0.08em',
                }}
              >
                {/* <Sparkles className="w-3.5 h-3.5" /> */}
                Journaling Mode
              </span>
            </div>

            {/* Header */}
            <h3
              id="journal-mode-dialog-title"
              className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight"
              style={{
                fontFamily: 'var(--dashboard-heading-font, var(--font-serif))',
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
              }}
            >
              How would you like to journal today?
            </h3>

            <p
              className="mt-2 text-sm sm:text-base leading-relaxed"
              style={{
                color: isDarkMode ? 'rgba(255,255,255,0.72)' : '#64748B',
              }}
            >
              Do you want to express by writing or by speaking?
            </p>

            {/* Prompt Snippet */}
            {prompt.text && (
              <div
                className="mt-4 p-3.5 sm:p-4 rounded-2xl border text-sm"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,245,238,0.7)',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(159,120,100,0.18)',
                  color: isDarkMode ? 'rgba(255,255,255,0.85)' : '#475569',
                }}
              >
                <span className="font-medium italic line-clamp-2">“{prompt.text}”</span>
              </div>
            )}

            {/* Action Buttons: Write vs Speak */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {/* Write Option */}
              <Link
                href={writeHref}
                prefetch={true}
                onClick={(e) => {
                  if (navigatingMode !== null) {
                    e.preventDefault();
                    return;
                  }
                  preparePromptNavigation('write');
                }}
                className="group relative flex flex-col items-start p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:translate-y-0 cursor-pointer"
                style={{
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(159,120,100,0.22)',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${currentTheme.primary}20`,
                    color: currentTheme.primary,
                  }}
                >
                  {navigatingMode === 'write' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <PenLine className="w-5 h-5" />
                  )}
                </div>
                <span
                  className="text-base sm:text-lg font-semibold"
                  style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                >
                  Write
                </span>
                <span
                  className="mt-1 text-xs sm:text-sm leading-relaxed"
                  style={{ color: isDarkMode ? 'rgba(255,255,255,0.65)' : '#64748B' }}
                >
                  Reflect and write freely at your own pace
                </span>
                <div
                  className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold group-hover:gap-2 transition-all"
                  style={{ color: currentTheme.primary }}
                >
                  <span>{navigatingMode === 'write' ? 'Opening...' : 'Start Writing'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              {/* Speak Option */}
              <Link
                href={voiceHref}
                prefetch={true}
                onClick={(e) => {
                  if (navigatingMode !== null) {
                    e.preventDefault();
                    return;
                  }
                  preparePromptNavigation('voice');
                }}
                className="group relative flex flex-col items-start p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:translate-y-0 cursor-pointer"
                style={{
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(159,120,100,0.22)',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${currentTheme.primary}20`,
                    color: currentTheme.primary,
                  }}
                >
                  {navigatingMode === 'voice' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </div>
                <span
                  className="text-base sm:text-lg font-semibold"
                  style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                >
                  Speak
                </span>
                <span
                  className="mt-1 text-xs sm:text-sm leading-relaxed"
                  style={{ color: isDarkMode ? 'rgba(255,255,255,0.65)' : '#64748B' }}
                >
                  Record voice thoughts with automatic transcript
                </span>
                <div
                  className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold group-hover:gap-2 transition-all"
                  style={{ color: currentTheme.primary }}
                >
                  <span>{navigatingMode === 'voice' ? 'Opening...' : 'Start Speaking'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
);
};

export default WritingPromptHero;
