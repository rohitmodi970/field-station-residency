"use client"

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';

interface MoodOption {
  emoji: string;
  label: string;
  color: string;
  darkColor: string;
}
// Define the available moods and their properties
const moods: MoodOption[] = [
  { emoji: '😊', label: 'Happy', color: '#5f9f93', darkColor: '#5f9f93' },
  { emoji: '😌', label: 'Calm', color: '#7a8f66', darkColor: '#7a8f66' },
  { emoji: '😐', label: 'Neutral', color: '#ad6d5a', darkColor: '#ad6d5a' },
  { emoji: '😔', label: 'Sad', color: '#8a6a58', darkColor: '#8a6a58' },
  { emoji: '😤', label: 'Frustrated', color: '#6f4f43', darkColor: '#6f4f43' },
  { emoji: '🤔', label: 'Thoughtful', color: '#a38172', darkColor: '#a38172' },
  { emoji: '😴', label: 'Tired', color: '#b09587', darkColor: '#b09587' },
  { emoji: '🥳', label: 'Excited', color: '#6f9a8e', darkColor: '#6f9a8e' },
];

interface MoodCheckinProps {
  onMoodSelect?: (mood: string) => void;
}

const MoodCheckin: React.FC<MoodCheckinProps> = ({ onMoodSelect }) => {
  const { isDarkMode } = useTheme();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleMoodSelect = useCallback((mood: MoodOption) => {
    setSelectedMood(mood.label);
    setShowConfirmation(true);
    onMoodSelect?.(mood.label);
    
    // Auto-dismiss confirmation after 2.5s
    setTimeout(() => setShowConfirmation(false), 2500);
  }, [onMoodSelect]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[28px] border border-[#d9c1b5]/60 bg-[#fff8f2]/90 p-5 shadow-[0_10px_26px_rgba(103,72,53,0.12)]"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[#7a5045]" style={{ fontFamily: 'var(--dashboard-heading-font, var(--font-serif))', letterSpacing: '0.04em' }}>
          How are you feeling right now?
        </p>

        <div className="flex flex-wrap gap-2 sm:gap-3 lg:gap-4">
          {moods.map((mood, index) => {
            const isSelected = selectedMood === mood.label;
            const accentColor = isDarkMode ? mood.darkColor : mood.color;

            return (
              <motion.button
                key={mood.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * index, type: 'spring', stiffness: 300, damping: 20 }}
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleMoodSelect(mood)}
                className={`
                  relative flex flex-col items-center gap-1 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 lg:py-3.5
                  rounded-2xl transition-all duration-200 cursor-pointer
                  border-2 select-none
                  ${isSelected
                    ? 'border-current shadow-lg'
                    : 'border-transparent hover:border-border/50'
                  }
                `}
                style={{
                  background: isSelected
                    ? `${accentColor}18`
                    : isDarkMode ? 'hsl(var(--muted)/0.3)' : '#fff1e7',
                  borderColor: isSelected ? accentColor : undefined,
                  boxShadow: isSelected ? `0 4px 16px ${accentColor}30` : undefined,
                }}
              >
                <span className="text-xl sm:text-2xl lg:text-3xl leading-none" role="img" aria-label={mood.label}>
                  {mood.emoji}
                </span>
                <span className="text-[10px] sm:text-xs font-medium text-[#765247]" style={{ letterSpacing: '0.02em' }}>
                  {mood.label}
                </span>

                {/* Selection indicator dot */}
                {isSelected && (
                  <motion.div
                    layoutId="mood-indicator"
                    className="absolute -bottom-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: accentColor }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Confirmation feedback */}
      <AnimatePresence>
        {showConfirmation && selectedMood && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: isDarkMode ? 'hsl(var(--muted)/0.4)' : '#fff1e7',
              color: isDarkMode ? undefined : '#6f5046',
              border: isDarkMode ? undefined : '1px solid rgba(159,120,100,0.24)',
            }}
          >
            Feeling <strong>{selectedMood.toLowerCase()}</strong> , noted! ✨ This helps personalize your experience.
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

export default MoodCheckin;
