// apps/web/components/Journal/EnhancedComponents/DateNavigator.tsx
"use client";

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/quilted-gallery/ui/card';
import { useTheme } from '@/utilities/context/ThemeContext';

interface DateNavigatorProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  entriesCount?: number;
}

export default function DateNavigator({ selectedDate, onDateSelect, entriesCount = 0 }: DateNavigatorProps) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
  };

  const today = new Date();
  const isToday = selectedDate && 
    selectedDate.getDate() === today.getDate() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getFullYear() === today.getFullYear();

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select a date';
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(undefined, options);
  };

  const goToPrevDay = () => {
    if (selectedDate) {
      const prevDay = new Date(selectedDate);
      prevDay.setDate(prevDay.getDate() - 1);
      onDateSelect(prevDay);
    }
  };

  const goToNextDay = () => {
    if (selectedDate) {
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      onDateSelect(nextDay);
    }
  };

  const goToToday = () => {
    onDateSelect(new Date());
  };

  return (
    <Card className="p-4" style={containerStyle}>
      <div className="flex items-center justify-between gap-4">
        {/* Previous Day Button */}
        <button
          onClick={goToPrevDay}
          disabled={!selectedDate}
          className="p-2 rounded-lg transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            backgroundColor: selectedDate ? `${currentTheme.primary}20` : 'transparent',
            color: selectedDate ? currentTheme.primary : elementColors.text,
          }}
          title="Previous Day"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Date Display */}
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Calendar size={18} style={{ color: currentTheme.primary }} />
            <h3 className="font-semibold text-lg">{formatDate(selectedDate)}</h3>
          </div>
          
          {selectedDate && (
            <div className="flex items-center justify-center gap-2 text-sm opacity-70">
              {isToday ? (
                <span
                  className="px-2 py-0.5 rounded-full font-medium text-xs"
                  style={{
                    backgroundColor: `${currentTheme.primary}20`,
                    color: currentTheme.primary,
                  }}
                >
                  Today
                </span>
              ) : null}
              <span>{entriesCount} {entriesCount === 1 ? 'entry' : 'entries'}</span>
            </div>
          )}
        </div>

        {/* Next Day Button */}
        <button
          onClick={goToNextDay}
          disabled={!selectedDate || !!isToday}
          className="p-2 rounded-lg transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            backgroundColor: selectedDate && !isToday ? `${currentTheme.primary}20` : 'transparent',
            color: selectedDate && !isToday ? currentTheme.primary : elementColors.text,
          }}
          title="Next Day"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Quick Navigation */}
      {!isToday && selectedDate && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
          <button
            onClick={goToToday}
            className="w-full py-2 px-4 rounded-lg font-medium transition-all hover:shadow-md"
            style={{
              backgroundColor: `${currentTheme.primary}15`,
              color: currentTheme.primary,
            }}
          >
            Jump to Today
          </button>
        </div>
      )}
    </Card>
  );
}
