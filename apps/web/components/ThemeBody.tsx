"use client";

import { ReactNode, useEffect } from 'react';
import { useTheme } from '@/utilities/context/ThemeContext';

interface ThemeBodyProps {
  children: ReactNode;
}

/**
 * ThemeBody - Applies theme-aware styles to the entire application
 * This component wraps the app content and applies:
 * - Page background color
 * - Text color
 * - Font family
 * All from the ThemeContext
 */
export function ThemeBody({ children }: ThemeBodyProps) {
  const { pageBackground, elementColors } = useTheme();

  const pageBackgroundIsImage = pageBackground?.includes('gradient') || pageBackground?.includes('url(');

  // Removed useEffect - theme is already applied by ThemeContext
  // This prevents circular re-render issues during compilation

  return (
    <div 
      className="min-h-screen transition-colors duration-200"
      style={{
        backgroundColor: pageBackgroundIsImage ? undefined : pageBackground,
        backgroundImage: pageBackgroundIsImage ? pageBackground : undefined,
        backgroundRepeat: pageBackgroundIsImage ? 'no-repeat' : undefined,
        backgroundPosition: pageBackgroundIsImage ? 'center' : undefined,
        backgroundSize: pageBackgroundIsImage ? 'cover' : undefined,
        color: elementColors.text,
      }}
    >
      {children}
    </div>
  );
}
