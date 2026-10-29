"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Heart, Moon, Plane, Dumbbell, Briefcase, User } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { FormData } from './OnboardingForm';

interface Question1Props {
  value: string;
  preferredJournalTypes?: string[];
  handleInputChange: (value: string) => void;
  onUpdateJournalTypes: (types: string[]) => void;
  goToNextSection: () => void;
}

const Question1: React.FC<Question1Props> = ({
  value,
  preferredJournalTypes = [],
  handleInputChange,
  onUpdateJournalTypes,
  goToNextSection
}) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  
  const canProceed = value.trim().length > 0;

  const journalTypes = [
    { value: 'daily', label: 'Daily Journal', icon: BookOpen, description: 'Everyday thoughts and experiences' },
    { value: 'gratitude', label: 'Gratitude', icon: Heart, description: 'Things you\'re thankful for' },
    { value: 'dream', label: 'Dream Journal', icon: Moon, description: 'Record and analyze your dreams' },
    { value: 'travel', label: 'Travel', icon: Plane, description: 'Adventures and travel memories' },
    { value: 'fitness', label: 'Fitness', icon: Dumbbell, description: 'Health and workout tracking' },
    { value: 'work', label: 'Work/Career', icon: Briefcase, description: 'Professional growth and goals' },
    { value: 'personal', label: 'Personal Growth', icon: User, description: 'Self-improvement journey' },
  ];

  const handleTypeToggle = (type: string) => {
    const updated = preferredJournalTypes.includes(type)
      ? preferredJournalTypes.filter(t => t !== type)
      : [...preferredJournalTypes, type];
    onUpdateJournalTypes(updated);
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        What are you hoping to gain from Force?
      </h2>
      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        This helps us personalize your experience and provide the right resources for you.
      </p>
      
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="I want to improve my productivity, find more balance in life..."
          className={`w-full p-4 rounded-lg border transition duration-200 focus:ring-2 focus:outline-none min-h-32 ${
            isDarkMode
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-gray-50 border-gray-300 text-gray-900'
          }`}
          style={{
            borderColor: isFocused ? currentTheme.primary : isDarkMode ? '#4B5563' : '#D1D5DB',
            boxShadow: isFocused ? `0 0 0 3px ${currentTheme.light}` : 'none'
          }}
        />
        
        {/* Word count indicator */}
        <div 
          className={`absolute bottom-3 right-3 text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          {value.length > 0 ? `${value.length} characters` : ''}
        </div>
      </div>

      {/* Journal Types Selection */}
      <div className="mt-8">
        <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          What type of journaling interests you? <span className="text-sm font-normal opacity-70">(Optional - Select all that apply)</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {journalTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = preferredJournalTypes.includes(type.value);
            
            return (
              <motion.button
                key={type.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTypeToggle(type.value)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected ? 'shadow-md' : 'hover:shadow-sm'
                }`}
                style={{
                  borderColor: isSelected ? currentTheme.primary : isDarkMode ? '#374151' : '#D1D5DB',
                  backgroundColor: isSelected 
                    ? `${currentTheme.primary}15` 
                    : isDarkMode ? '#1F2937' : '#FFFFFF'
                }}
              >
                <div className="flex items-start gap-3">
                  <Icon 
                    size={20} 
                    style={{ color: isSelected ? currentTheme.primary : isDarkMode ? '#9CA3AF' : '#6B7280' }}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div 
                      className="font-medium mb-1"
                      style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}
                    >
                      {type.label}
                    </div>
                    <div 
                      className="text-xs"
                      style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                    >
                      {type.description}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
      
      <div className="flex justify-end mt-6">
        <button
          onClick={goToNextSection}
          disabled={!canProceed}
          className="flex items-center px-6 py-2 rounded-lg transition-colors duration-300"
          style={{
            backgroundColor: canProceed ? currentTheme.primary : isDarkMode ? '#4B5563' : '#9CA3AF',
            color: 'white',
            opacity: canProceed ? 1 : 0.6,
            cursor: canProceed ? 'pointer' : 'not-allowed'
          }}
        >
          Next
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </motion.div>
  );
};

export default Question1;