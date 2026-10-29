// apps/web/components/Journal/EnhancedComponents/EmptyState.tsx
"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/quilted-gallery/ui/card';
import { useTheme } from '@/utilities/context/ThemeContext';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
  };

  return (
    <Card className="p-12" style={containerStyle}>
      <div className="text-center space-y-6 max-w-md mx-auto">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: `${currentTheme.primary}20` }}
        >
          <Icon size={40} style={{ color: currentTheme.primary }} />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-sm opacity-70 leading-relaxed">{description}</p>
        </div>

        {/* Action Button */}
        {action && (
          <button
            onClick={action.onClick}
            className="px-6 py-3 rounded-lg font-medium transition-all hover:shadow-lg hover:scale-105"
            style={{
              backgroundColor: currentTheme.primary,
              color: '#FFFFFF',
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </Card>
  );
}
