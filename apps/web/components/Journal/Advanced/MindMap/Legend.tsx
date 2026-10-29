"use client"
import React from 'react';

// Softer, energy-aligned colors for soothing experience (more saturated for visibility)
const categories = [
  { key: 'people', label: 'People', color: '#FF8FA3' },
  { key: 'work', label: 'Work', color: '#7FB3D5' },
  { key: 'health', label: 'Health', color: '#81D4AF' },
  { key: 'emotions', label: 'Emotions', color: '#C89FD8' },
  { key: 'learning', label: 'Learning', color: '#FFD54F' },
  { key: 'hobbies', label: 'Hobbies', color: '#80DEEA' },
  { key: 'places', label: 'Places', color: '#9FA8DA' },
  { key: 'goals', label: 'Goals', color: '#FFF176' },
  { key: 'events', label: 'Events', color: '#FFAB91' },
  { key: 'daily', label: 'Daily Life', color: '#A5D6A7' }
];

interface LegendProps {
  selectedCategory?: string | null;
  onCategoryClick?: (category: string) => void;
}

export const Legend: React.FC<LegendProps> = ({ selectedCategory, onCategoryClick }) => {
  return (
    <div className="absolute bottom-6 left-6 bg-[#fff8ee]/95 border border-[#d5b493]/65 rounded-xl p-4 shadow-lg">
      <h4 className="text-sm font-semibold text-[#2e2012] mb-3">
        Categories {selectedCategory && <span className="text-xs font-normal">(click to deselect)</span>}
      </h4>
      <div className="flex flex-col gap-2">
        {categories.map((cat) => (
          <div 
            key={cat.key} 
            className={`flex items-center gap-2.5 cursor-pointer hover:bg-[#f5e8d9] p-1.5 rounded transition-all ${
              selectedCategory === cat.key ? 'bg-[#f1dfcb] ring-2 ring-offset-1 ring-[#8b5d36]/40' : ''
            }`}
            onClick={() => onCategoryClick?.(selectedCategory === cat.key ? '' : cat.key)}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ 
                backgroundColor: cat.color,
                boxShadow: `0 0 10px ${cat.color}50`
              }}
            />
            <span className={`text-xs ${selectedCategory === cat.key ? 'font-semibold text-[#2e2012]' : 'text-[#6f4a2e]'}`}>
              {cat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Legend;
