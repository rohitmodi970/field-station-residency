"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  PartyPopper,
  XCircle,
} from 'lucide-react';
import type { BulkCreateResults, JournalResultItem } from './ConfirmStep';

// ─── Props ───────────────────────────────────────────────────────────

interface ResultStepProps {
  results: BulkCreateResults;
  /** Navigate to the journal list / dashboard */
  onGoToJournals: () => void;
  /** Start a new bulk import */
  onStartNew: () => void;
}

// ─── Component ───────────────────────────────────────────────────────

const ResultStep: React.FC<ResultStepProps> = ({
  results,
  onGoToJournals,
  onStartNew,
}) => {
  const { currentTheme, isDarkMode } = useTheme();

  const { totalCreated, totalFailed, created, failed } = results;
  const total = totalCreated + totalFailed;
  const allSuccess = totalFailed === 0;
  const allFailed = totalCreated === 0;
  const totalImages = created.reduce((sum, c) => sum + c.imagesAttached, 0);

  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50';

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="text-center space-y-3 py-6"
      >
        {allSuccess ? (
          <motion.div
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full"
            style={{ backgroundColor: `${currentTheme.primary}15` }}
          >
            <PartyPopper size={40} style={{ color: currentTheme.primary }} />
          </motion.div>
        ) : allFailed ? (
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10">
            <XCircle size={40} className="text-red-400" />
          </div>
        ) : (
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/10">
            <AlertTriangle size={40} className="text-yellow-500" />
          </div>
        )}

        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className={`text-2xl font-bold ${textPrimary}`}
        >
          {allSuccess
            ? 'You did it!'
            : allFailed
              ? 'Import Failed'
              : 'Almost There'}
        </motion.h2>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`${textSecondary} max-w-sm mx-auto`}
        >
          {allSuccess
            ? `${totalCreated} journal${totalCreated !== 1 ? 's have' : ' has'} been safely imported from your handwritten pages.`
            : allFailed
              ? 'We couldn\'t save your journals this time. Please try again.'
              : `${totalCreated} of ${total} saved successfully. You can retry the rest later.`}
        </motion.p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <FileText size={18} className="text-green-500" />, value: totalCreated, label: 'Saved', delay: 0.22 },
          { icon: <ImageIcon size={18} style={{ color: currentTheme.primary }} />, value: totalImages, label: 'Photos', delay: 0.26 },
          {
            icon: totalFailed > 0
              ? <XCircle size={18} className="text-red-400" />
              : <CheckCircle size={18} className="text-green-500" />,
            value: totalFailed,
            label: totalFailed > 0 ? 'Failed' : 'Errors',
            delay: 0.3,
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: stat.delay }}
            className={`${cardBg} rounded-xl p-4 text-center`}
          >
            <div className="mx-auto mb-1.5 flex justify-center">{stat.icon}</div>
            <div className={`text-2xl font-bold ${textPrimary}`}>{stat.value}</div>
            <div className={`text-xs ${textSecondary}`}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Created journals list */}
      {created.length > 0 && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="space-y-2"
        >
          <h3 className={`text-sm font-semibold ${textPrimary}`}>
            Your New Journals
          </h3>
          <div className="space-y-1.5 max-h-50 overflow-y-auto pr-1">
            {created.map((item: JournalResultItem, i: number) => (
              <motion.div
                key={item.journal_id}
                initial={{ x: -8, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.38 + i * 0.04 }}
                className={`${cardBg} rounded-xl px-4 py-2.5 flex items-center gap-3`}
              >
                <CheckCircle size={14} className="text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${textPrimary}`}>
                    {item.title_plain || item.date || 'Untitled'}
                  </div>
                  {item.title_plain && item.date && (
                    <div className={`text-xs ${textSecondary}`}>
                      <Calendar size={10} className="inline mr-1 opacity-60" />
                      {item.date}
                    </div>
                  )}
                </div>
                {item.imagesAttached > 0 && (
                  <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                    <ImageIcon size={12} />
                    {item.imagesAttached}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Failed journals list */}
      {failed.length > 0 && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-2"
        >
          <h3 className="text-sm font-semibold text-red-400">
            Couldn&apos;t Save
          </h3>
          <div className="space-y-1.5 max-h-38 overflow-y-auto pr-1">
            {failed.map((item: JournalResultItem) => (
              <div
                key={item.journal_id}
                className={`rounded-xl px-4 py-2.5 flex items-center gap-3 ${
                  isDarkMode
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <XCircle size={14} className="text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${textPrimary}`}>
                    {item.date || 'No date'}
                  </div>
                  {item.error && (
                    <div className="text-xs text-red-400">{item.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex items-center justify-between pt-2"
      >
        <button
          onClick={onStartNew}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isDarkMode
              ? 'text-gray-300 hover:bg-gray-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Import More
        </button>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onGoToJournals}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
          style={{ backgroundColor: currentTheme.primary }}
        >
          View My Journals
          <ArrowRight size={16} />
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ResultStep;
