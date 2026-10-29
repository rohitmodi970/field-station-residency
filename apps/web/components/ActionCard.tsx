'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, X } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';

interface ActionCardProps {
  icon: string;
  title: string;
  reason: string;
  duration: string;
  category: 'health' | 'productivity' | 'social' | 'wellbeing';
  onAccept?: () => void;
  onDismiss?: () => void;
}

export function ActionCard({ 
  icon, 
  title, 
  reason, 
  duration, 
  category,
  onAccept,
  onDismiss 
}: ActionCardProps) {
  const { isDarkMode } = useTheme();
  
  const categoryColors = {
    health: { 
      bg: 'from-green-50 to-emerald-50', 
      bgDark: 'from-green-900/20 to-emerald-900/20',
      border: 'border-green-200', 
      borderDark: 'border-green-800/50',
      button: 'bg-green-600 hover:bg-green-700' 
    },
    productivity: { 
      bg: 'from-blue-50 to-indigo-50', 
      bgDark: 'from-blue-900/20 to-indigo-900/20',
      border: 'border-blue-200', 
      borderDark: 'border-blue-800/50',
      button: 'bg-blue-600 hover:bg-blue-700' 
    },
    social: { 
      bg: 'from-purple-50 to-pink-50', 
      bgDark: 'from-purple-900/20 to-pink-900/20',
      border: 'border-purple-200', 
      borderDark: 'border-purple-800/50',
      button: 'bg-purple-600 hover:bg-purple-700' 
    },
    wellbeing: { 
      bg: 'from-amber-50 to-orange-50', 
      bgDark: 'from-amber-900/20 to-orange-900/20',
      border: 'border-amber-200', 
      borderDark: 'border-amber-800/50',
      button: 'bg-amber-600 hover:bg-amber-700' 
    },
  };
  
  const colors = categoryColors[category];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`bg-gradient-to-br ${isDarkMode ? colors.bgDark : colors.bg} rounded-xl p-5 border-2 ${isDarkMode ? colors.borderDark : colors.border} hover:shadow-lg transition-shadow`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="text-4xl flex-shrink-0">
          {icon}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className={`font-semibold text-lg mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {title}
          </h4>
          
          {/* Reason */}
          <p className={`text-sm mb-3 leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {reason}
          </p>
          
          {/* Duration */}
          <div className={`flex items-center gap-2 text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <Clock className="w-4 h-4" />
            <span>{duration}</span>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className={`flex-1 ${colors.button} text-white rounded-lg px-4 py-2.5 font-medium transition-all flex items-center justify-center gap-2 text-sm`}
            >
              <CheckCircle className="w-4 h-4" />
              I&apos;ll try this
            </button>
            <button
              onClick={onDismiss}
              className={`px-4 py-2.5 rounded-lg transition-colors border ${
                isDarkMode 
                  ? 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50' 
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
