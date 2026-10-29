'use client';

import React, { useState, useCallback } from 'react';
import { 
  Palette, Moon, Sun, RefreshCw, Check, 
  Type, Droplet, Copy,
  Zap, Sliders, Paintbrush
} from 'lucide-react';
import { useTheme, fontOptions, ColorOption } from '@/utilities/context/ThemeContext';
import { backgroundPalettes, gradientBackgrounds } from './ThemePalettes';

// ============================================================================
// THEME STUDIO PANEL - Embedded version for Settings page
// ============================================================================

type TabId = 'themes' | 'colors' | 'fonts' | 'backgrounds';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// Color categories for grouping
const colorCategories = [
  { name: 'Classic & Dark', colors: ['Midnight Ink', 'Deep Ocean', 'Hemingway Blue', 'Fitzgerald Indigo'] },
  { name: 'Warm Tones', colors: ['Crimson Prose', 'Autumn Script', 'Golden Quill', 'Rose Memoir'] },
  { name: 'Cool Tones', colors: ['Emerald Pages', 'Teal Chronicle', 'Cyan Sonnet'] },
  { name: 'Creative', colors: ['Violet Verse', 'Slate Manuscript', 'Sepia Classic'] },
];

// Color Swatch with tooltip
const ColorSwatch: React.FC<{
  color: ColorOption;
  isSelected: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  isDarkMode: boolean;
}> = ({ color, isSelected, onClick, size = 'md', isDarkMode }) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  };
  
  return (
    <button
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-2xl transition-all duration-200 relative group
        hover:scale-105 active:scale-95 focus:outline-none`}
      style={{
        background: `linear-gradient(135deg, ${color.primary} 0%, ${color.hover} 100%)`,
        boxShadow: isSelected 
          ? `0 0 0 3px ${isDarkMode ? '#1F2937' : 'white'}, 0 0 0 5px ${color.primary}, 0 8px 20px ${color.primary}40`
          : `0 4px 12px ${color.primary}30`,
      }}
    >
      {isSelected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Check size={size === 'lg' ? 24 : 18} className="text-white drop-shadow-md" strokeWidth={3} />
        </div>
      )}
      {/* Tooltip */}
      {/* <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 
        transition-opacity whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-lg
        bg-gray-900 text-white pointer-events-none z-20 shadow-lg">
        {color.name}
      </div> */}
    </button>
  );
};

// Font Card
const FontCard: React.FC<{
  font: { name: string; value: string };
  isSelected: boolean;
  onClick: () => void;
  isDarkMode: boolean;
  accentColor: string;
}> = ({ font, isSelected, onClick, isDarkMode, accentColor }) => {
  const fontFamilyMap: Record<string, string> = {
    'inter': 'Inter, sans-serif',
    'roboto': 'Roboto, sans-serif',
    'opensans': 'Open Sans, sans-serif',
    'lato': 'Lato, sans-serif',
    'montserrat': 'Montserrat, sans-serif',
    'poppins': 'Poppins, sans-serif',
    'cormorant': 'Cormorant Garamond, serif',
    'playfair': 'Playfair Display, serif',
    'hydrogen': 'Hydrogen Whiskey, sans-serif',
    'terminalGrotesqueOpen': 'Terminal Grotesque Open, sans-serif',
    'terminalGrotesque': 'Terminal Grotesque, sans-serif',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-2xl transition-all duration-200 text-left
        hover:scale-[1.01] active:scale-[0.99] border-2 ${
        isSelected ? 'shadow-lg' : isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'
      }`}
      style={{
        backgroundColor: isSelected ? `${accentColor}08` : undefined,
        borderColor: isSelected ? accentColor : 'transparent',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div 
            className="text-base font-semibold mb-1" 
            style={{ 
              fontFamily: fontFamilyMap[font.value] || 'inherit',
              color: isSelected ? accentColor : isDarkMode ? '#E5E7EB' : '#374151'
            }}
          >
            {font.name}
          </div>
          <div 
            className="text-sm opacity-50"
            style={{ fontFamily: fontFamilyMap[font.value] || 'inherit' }}
          >
            The quick brown fox jumps over the lazy dog
          </div>
        </div>
        {isSelected && (
          <div 
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-3"
            style={{ backgroundColor: accentColor }}
          >
            <Check size={14} className="text-white" strokeWidth={3} />
          </div>
        )}
      </div>
    </button>
  );
};

// Background Tile
const BackgroundTile: React.FC<{
  background: { name: string; value: string; emoji?: string };
  isSelected: boolean;
  onClick: () => void;
  isGradient?: boolean;
  accentColor: string;
  isDarkMode: boolean;
}> = ({ background, isSelected, onClick, isGradient = false, accentColor, isDarkMode }) => {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl transition-all duration-200 overflow-hidden group
        hover:scale-105 active:scale-95 ${isGradient ? 'h-24' : 'aspect-square'}`}
      style={{
        background: background.value,
        boxShadow: isSelected 
          ? `0 0 0 3px ${isDarkMode ? '#1F2937' : 'white'}, 0 0 0 5px ${accentColor}`
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div 
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: accentColor }}
          >
            <Check size={12} className="text-white" strokeWidth={3} />
          </div>
        </div>
      )}
      {isGradient && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
          {background.name}
        </span>
      )}
      {background.emoji && !isGradient && (
        <span className="absolute inset-0 flex items-center justify-center text-lg opacity-0 group-hover:opacity-100 transition-opacity">
          {background.emoji}
        </span>
      )}
      {/* Tooltip */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 
        transition-opacity whitespace-nowrap text-[10px] font-medium px-2 py-1 rounded-lg
        bg-gray-900 text-white pointer-events-none z-20">
        {background.name}
      </div>
    </button>
  );
};

// Live Preview Mini
const LivePreviewMini: React.FC<{
  elementColors: { button: string; text: string; background: string; accent: string };
  isDarkMode: boolean;
}> = ({ elementColors, isDarkMode }) => {
  return (
    <div 
      className="rounded-2xl p-4 space-y-3 border"
      style={{ 
        backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
        borderColor: isDarkMode ? '#374151' : '#E5E7EB'
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap size={12} style={{ color: elementColors.accent }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-50">
          Preview
        </span>
      </div>
      
      <button
        className="w-full py-2.5 rounded-xl font-semibold text-xs text-white"
        style={{ backgroundColor: elementColors.button }}
      >
        Primary Button
      </button>
      
      <div
        className="p-3 rounded-xl border"
        style={{
          backgroundColor: elementColors.background,
          borderColor: isDarkMode ? '#4B5563' : '#E5E7EB'
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium" style={{ color: elementColors.text }}>Card</span>
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-white"
            style={{ backgroundColor: elementColors.accent }}
          >
            Tag
          </span>
        </div>
        <p className="text-[10px] opacity-60" style={{ color: elementColors.text }}>
          Sample text preview
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// Main Theme Studio Panel Component
// ============================================================================

const ThemeStudioPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('themes');
  const [categoryTab, setCategoryTab] = useState<string>('Classic & Dark');
  const [copiedText, setCopiedText] = useState('');
  
  const {
    colorOptions,
    currentTheme,
    isDarkMode,
    elementColors,
    currentFont,
    pageBackground,
    setCurrentTheme,
    toggleDarkMode,
    updateElementColor,
    setFont,
    setPageBackground,
    resetToDefaults
  } = useTheme();

  const tabs: Tab[] = [
    { id: 'themes', label: 'Color Themes', icon: <Palette size={16} /> },
    { id: 'colors', label: 'Elements', icon: <Sliders size={16} /> },
    { id: 'fonts', label: 'Typography', icon: <Type size={16} /> },
    { id: 'backgrounds', label: 'Background', icon: <Droplet size={16} /> },
  ];

  const handleThemeSelect = useCallback((color: ColorOption) => {
    setCurrentTheme(color);
    updateElementColor('button', color.primary);
    updateElementColor('background', color.light);
    updateElementColor('accent', color.medium);
  }, [setCurrentTheme, updateElementColor]);

  const handleDarkModeToggle = useCallback((dark: boolean) => {
    if (dark !== isDarkMode) {
      toggleDarkMode();
    }
  }, [isDarkMode, toggleDarkMode]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  }, []);

  // Get colors for a category
  const getColorsForCategory = (categoryColors: string[]) => {
    return colorOptions.filter(c => categoryColors.includes(c.name));
  };

  return (
    <div className="space-y-6">
      {/* Header with Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-3 rounded-2xl"
            style={{ backgroundColor: `${elementColors.button}15` }}
          >
            <Paintbrush size={22} style={{ color: elementColors.button }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: isDarkMode ? '#F9FAFB' : '#111827' }}>
              Theme Studio
            </h2>
            <p className="text-xs opacity-50">Personalize your writing space</p>
          </div>
        </div>
        
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl" style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}>
          <button
            onClick={() => handleDarkModeToggle(false)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
              !isDarkMode ? 'text-white shadow-md' : 'opacity-60 hover:opacity-100'
            }`}
            style={{ backgroundColor: !isDarkMode ? elementColors.button : 'transparent' }}
          >
            <Sun size={16} />
            <span className="text-xs font-semibold">Light</span>
          </button>
          <button
            onClick={() => handleDarkModeToggle(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
              isDarkMode ? 'text-white shadow-md' : 'opacity-60 hover:opacity-100'
            }`}
            style={{ backgroundColor: isDarkMode ? elementColors.button : 'transparent' }}
          >
            <Moon size={16} />
            <span className="text-xs font-semibold">Dark</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${
              activeTab === tab.id ? 'text-white shadow-md' : 'hover:scale-105'
            }`}
            style={{
              backgroundColor: activeTab === tab.id 
                ? elementColors.button 
                : isDarkMode ? '#374151' : '#F3F4F6',
              color: activeTab === tab.id ? 'white' : isDarkMode ? '#D1D5DB' : '#4B5563'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Themes Tab */}
          {activeTab === 'themes' && (
            <div className="space-y-6">
              {/* Category Tabs */}
              <div className="flex flex-wrap gap-2">
                {colorCategories.map(category => (
                  <button
                    key={category.name}
                    onClick={() => setCategoryTab(category.name)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${
                      categoryTab === category.name ? 'text-white shadow-md' : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: categoryTab === category.name 
                        ? elementColors.accent 
                        : isDarkMode ? '#374151' : '#F3F4F6',
                      color: categoryTab === category.name ? 'white' : isDarkMode ? '#D1D5DB' : '#4B5563'
                    }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              {/* Selected Category Colors */}
              <div>
                {colorCategories.map(category => {
                  if (categoryTab !== category.name) return null;
                  const categoryColors = getColorsForCategory(category.colors);
                  
                  return (
                    <div key={category.name}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {categoryColors.map(color => (
                          <div key={color.name} className="flex flex-col items-center gap-3">
                            <ColorSwatch
                              color={color}
                              isSelected={currentTheme.name === color.name}
                              onClick={() => handleThemeSelect(color)}
                              size="lg"
                              isDarkMode={isDarkMode}
                            />
                            <span className="text-sm font-medium text-center leading-tight">
                              {color.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Current Theme Info */}
              <div 
                className="p-4 rounded-2xl border"
                style={{ 
                  backgroundColor: `${currentTheme.primary}08`,
                  borderColor: `${currentTheme.primary}30`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.hover} 100%)` }}
                    />
                    <div>
                      <span className="text-sm font-semibold" style={{ color: currentTheme.primary }}>
                        {currentTheme.name}
                      </span>
                      <p className="text-xs opacity-50">Currently active</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: currentTheme.primary }} />
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: currentTheme.hover }} />
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: currentTheme.medium }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <div className="space-y-6">
              {[
                { key: 'button' as const, label: 'Primary / Buttons', desc: 'Main action color', icon: '🎯' },
                { key: 'text' as const, label: 'Text Color', desc: 'Main text appearance', icon: '📝' },
                { key: 'background' as const, label: 'Card Background', desc: 'Content card fills', icon: '🃏' },
                { key: 'accent' as const, label: 'Accent / Tags', desc: 'Highlights & badges', icon: '✨' },
              ].map(element => (
                <div 
                  key={element.key}
                  className="p-4 rounded-2xl border"
                  style={{ 
                    backgroundColor: isDarkMode ? '#1F293750' : '#FFFFFF',
                    borderColor: isDarkMode ? '#374151' : '#E5E7EB'
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="font-semibold text-sm">{element.icon} {element.label}</span>
                      <p className="text-xs opacity-50">{element.desc}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(elementColors[element.key], element.key)}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all hover:scale-105"
                      style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}
                    >
                      {copiedText === element.key ? (
                        <span className="flex items-center gap-1 text-green-500">
                          <Check size={12} /> Copied
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 opacity-70">
                          <Copy size={12} /> {elementColors[element.key]}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-3">
                    {colorOptions.map(color => {
                      const colorValue = element.key === 'background' ? color.light :
                                       element.key === 'accent' ? color.medium :
                                       color.primary;
                      const isSelected = elementColors[element.key] === colorValue;
                      return (
                        <button
                          key={`${element.key}-${color.name}`}
                          onClick={() => updateElementColor(element.key, colorValue)}
                          className="w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95 relative"
                          style={{
                            backgroundColor: colorValue,
                            boxShadow: isSelected 
                              ? `0 0 0 2px ${isDarkMode ? '#1F2937' : 'white'}, 0 0 0 4px ${colorValue}`
                              : `0 2px 6px ${colorValue}30`
                          }}
                          title={color.name}
                        >
                          {isSelected && (
                            <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" strokeWidth={3} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fonts Tab */}
          {activeTab === 'fonts' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fontOptions.map(font => (
                <FontCard
                  key={font.value}
                  font={font}
                  isSelected={currentFont === font.value}
                  onClick={() => setFont(font.value)}
                  isDarkMode={isDarkMode}
                  accentColor={elementColors.button}
                />
              ))}
            </div>
          )}

          {/* Backgrounds Tab */}
          {activeTab === 'backgrounds' && (
            <div className="space-y-6">
              {/* Solid Colors */}
              <div>
                <h3 className="text-sm font-semibold mb-3 opacity-70">Solid Colors</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {(isDarkMode ? backgroundPalettes.dark : backgroundPalettes.light).map(bg => (
                    <BackgroundTile
                      key={bg.value}
                      background={bg}
                      isSelected={pageBackground === bg.value}
                      onClick={() => setPageBackground(bg.value)}
                      accentColor={elementColors.button}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              </div>

              {/* Gradients */}
              <div>
                <h3 className="text-sm font-semibold mb-3 opacity-70">Gradients</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {gradientBackgrounds.map(gradient => (
                    <BackgroundTile
                      key={gradient.name}
                      background={gradient}
                      isSelected={pageBackground === gradient.value}
                      onClick={() => setPageBackground(gradient.value)}
                      isGradient
                      accentColor={elementColors.button}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              </div>

              {/* Custom */}
              <div>
                <h3 className="text-sm font-semibold mb-3 opacity-70">Custom Color</h3>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={pageBackground.startsWith('#') ? pageBackground : '#F7F9FC'}
                    onChange={(e) => setPageBackground(e.target.value)}
                    className="w-14 h-14 rounded-xl cursor-pointer border-2"
                    style={{ borderColor: isDarkMode ? '#4B5563' : '#E5E7EB' }}
                  />
                  <input
                    type="text"
                    value={pageBackground}
                    onChange={(e) => setPageBackground(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border-2 outline-none text-sm"
                    style={{ 
                      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
                      borderColor: isDarkMode ? '#4B5563' : '#E5E7EB'
                    }}
                    placeholder="Hex, RGB, or CSS gradient"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Preview & Actions */}
        <div className="space-y-4">
          <LivePreviewMini 
            elementColors={elementColors}
            isDarkMode={isDarkMode}
          />
          
          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => resetToDefaults('all')}
              className="w-full py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2
                text-sm font-semibold hover:scale-[1.02] active:scale-[0.98]"
              style={{ 
                backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                color: isDarkMode ? '#D1D5DB' : '#4B5563'
              }}
            >
              <RefreshCw size={16} />
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeStudioPanel;
