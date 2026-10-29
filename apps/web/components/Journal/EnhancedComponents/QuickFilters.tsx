// apps/web/components/Journal/EnhancedComponents/QuickFilters.tsx
"use client";

import React from 'react';
import { Filter, Calendar, Star, Tag, TrendingUp, Smile } from 'lucide-react';
import { Card } from '@/components/ui/quilted-gallery/ui/card';
import { useTheme } from '@/utilities/context/ThemeContext';

interface QuickFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  counts?: {
    all: number;
    today: number;
    favorites: number;
    tagged: number;
  };
}

const filters = [
  { id: 'all', label: 'All Entries', icon: Calendar, color: '#6B7280' },
  { id: 'today', label: 'Today', icon: Smile, color: '#10B981' },
  { id: 'favorites', label: 'Favorites', icon: Star, color: '#F59E0B' },
  { id: 'tagged', label: 'Tagged', icon: Tag, color: '#8B5CF6' },
  { id: 'trending', label: 'Trending', icon: TrendingUp, color: '#EC4899' },
];

export default function QuickFilters({ activeFilter, onFilterChange, counts }: QuickFiltersProps) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
  };

  const getCount = (filterId: string) => {
    if (!counts) return null;
    switch (filterId) {
      case 'all': return counts.all;
      case 'today': return counts.today;
      case 'favorites': return counts.favorites;
      case 'tagged': return counts.tagged;
      default: return null;
    }
  };

  return (
    <Card className="p-3" style={containerStyle}>
      <div className="flex items-center gap-2 mb-3">
        <Filter size={16} style={{ color: currentTheme.primary }} />
        <span className="text-sm font-semibold">Quick Filters</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.id;
          const count = getCount(filter.id);
          const Icon = filter.icon;
          
          return (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-105 font-medium text-sm"
              style={{
                backgroundColor: isActive 
                  ? `${filter.color}20`
                  : isDarkMode ? '#374151' : '#F3F4F6',
                color: isActive ? filter.color : elementColors.text,
                border: isActive ? `2px solid ${filter.color}` : 'none',
              }}
            >
              <Icon size={16} />
              <span>{filter.label}</span>
              {count !== null && count > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: isActive ? filter.color : isDarkMode ? '#1F2937' : '#E5E7EB',
                    color: isActive ? '#FFFFFF' : elementColors.text,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
