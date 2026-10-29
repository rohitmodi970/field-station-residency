// apps/web/components/Journal/EnhancedComponents/StatsCard.tsx
"use client";

import React from 'react';
import { BookOpen, Calendar, Flame, TrendingUp, Star } from 'lucide-react';
import { Card } from '@/components/ui/quilted-gallery/ui/card';
import { useTheme } from '@/utilities/context/ThemeContext';
import { JournalEntry } from '../types';

interface StatsCardProps {
  entries: JournalEntry[];
}

export default function StatsCard({ entries }: StatsCardProps) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  // Calculate streak
  const calculateStreak = () => {
    if (!entries.length) return 0;
    const dates = entries
      .map((e) => new Date(e.date).setHours(0, 0, 0, 0))
      .sort((a, b) => b - a);
    
    let streak = 1;
    let currentDate = dates[0];

    for (let i = 1; i < dates.length; i++) {
      const nextDate = dates[i];
      if (currentDate && nextDate) {
        if (currentDate - nextDate === 86400000) {
          streak++;
          currentDate = nextDate;
        } else if (currentDate !== nextDate) {
          break;
        }
      }
    }
    return streak;
  };

  // Calculate this week's entries
  const getWeeklyEntries = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return entries.filter((e) => new Date(e.date) >= oneWeekAgo).length;
  };

  // Get favorite count
  const favoriteCount = entries.filter((e) => e.isFavorite).length;

  // Calculate average words per entry
  const avgWords = entries.length > 0
    ? Math.round(
        entries.reduce((sum, e) => sum + (e.content?.split(/\s+/).length || 0), 0) / entries.length
      )
    : 0;

  const stats = [
    {
      icon: BookOpen,
      label: 'Total Entries',
      value: entries.length,
      color: currentTheme.primary,
      bgColor: `${currentTheme.primary}20`,
    },
    {
      icon: Flame,
      label: 'Current Streak',
      value: `${calculateStreak()} days`,
      color: '#F59E0B',
      bgColor: '#FEF3C720',
    },
    {
      icon: Calendar,
      label: 'This Week',
      value: getWeeklyEntries(),
      color: '#10B981',
      bgColor: '#D1FAE520',
    },
    {
      icon: Star,
      label: 'Favorites',
      value: favoriteCount,
      color: '#F59E0B',
      bgColor: '#FEF3C720',
    },
  ];

  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
  };

  return (
    <Card className="p-6" style={containerStyle}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Journal Stats</h3>
        <TrendingUp size={20} style={{ color: currentTheme.primary }} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="p-4 rounded-lg transition-all hover:scale-105 cursor-pointer"
              style={{
                backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.bgColor }}
                >
                  <Icon size={20} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold mb-1" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-sm opacity-70">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Additional Stats */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xl font-bold" style={{ color: currentTheme.primary }}>
              {avgWords}
            </p>
            <p className="text-xs opacity-70">Avg. Words</p>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: currentTheme.primary }}>
              {entries.length > 0 ? Math.round((entries.filter(e => e.isFavorite).length / entries.length) * 100) : 0}%
            </p>
            <p className="text-xs opacity-70">Favorite Rate</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
