import React, { useMemo } from 'react';
import { useTheme } from '@/utilities/context/ThemeContext';

interface DecorativePageProps {
  isEven: boolean;
  backgroundClass?: string;
  backgroundStyle?: React.CSSProperties;
  pageType?: 'cover' | 'back' | 'decorative';
  decorationType?: string;
  userInfo?: {
    name: string;
    email: string;
    username: string;
    totalEntries?: number;
  };
}

/** Simple seeded pseudo-random to stabilize positions across re-renders. */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const DecorativePage = ({ 
  isEven, 
  backgroundClass, 
  backgroundStyle, 
  pageType = 'decorative',
  decorationType: decorationTypeProp,
  userInfo 
}: DecorativePageProps) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  // Random decorative elements to show on the page
  const decorativeTypes = [
    "floral", "geometric", "quotes", "doodles", "pattern"
  ];
  
  // Use prop if provided, otherwise fallback to predictable selection
  const decorationType = decorationTypeProp || decorativeTypes[isEven ? 0 : 2];

  // Stable random positions for dots and floating elements
  const stablePositions = useMemo(() => {
    const rng = seededRandom(isEven ? 42 : 137);
    const dots = Array.from({ length: 50 }, () => ({
      left: `${rng() * 100}%`,
      top: `${rng() * 100}%`,
      delay: `${rng() * 2}s`,
      duration: `${2 + rng() * 2}s`,
    }));
    const floating = Array.from({ length: 15 }, () => ({
      left: `${rng() * 100}%`,
      top: `${rng() * 100}%`,
      delay: `${rng() * 3}s`,
      duration: `${3 + rng() * 2}s`,
    }));
    return { dots, floating };
  }, [isEven]);
  
  // Theme-aware styling with enhanced dark mode for covers
  const getThemeColors = () => {
    if (pageType === 'cover' || pageType === 'back') {
      // Enhanced dark theme for authentic diary/journal look
      return {
        background: `linear-gradient(135deg, 
          #0a0a0a 0%, 
          #1a1a1a 25%, 
          #2a2a2a 50%, 
          #1a1a1a 75%, 
          #0a0a0a 100%
        ), 
        linear-gradient(45deg, 
          ${currentTheme.primary}08 0%, 
          transparent 30%, 
          ${currentTheme.primary}05 60%, 
          transparent 100%
        )`,
        textPrimary: '#ffffff',
        textSecondary: '#e5e5e5',
        textTertiary: '#cccccc',
        accent: currentTheme.primary,
        decorative: `${currentTheme.primary}60`,
        border: `${currentTheme.primary}30`,
        cardBg: `rgba(0, 0, 0, 0.6)`,
        cardBorder: `${currentTheme.primary}40`,
        shadowColor: `${currentTheme.primary}20`,
        isDark: true
      };
    } else {
      // Use theme context for regular decorative pages
      return {
        background: isDarkMode 
          ? `linear-gradient(135deg, 
              #1a1a1a 0%, 
              #2d2d2d 25%, 
              #3a3a3a 50%, 
              #2d2d2d 75%, 
              #1a1a1a 100%
            ), 
            linear-gradient(45deg, 
              ${currentTheme.primary}10 0%, 
              transparent 50%, 
              ${currentTheme.primary}08 100%
            )`
          : `linear-gradient(135deg, 
              ${currentTheme.light} 0%, 
              #ffffff 25%, 
              ${currentTheme.medium} 50%, 
              #ffffff 75%, 
              ${currentTheme.light} 100%
            )`,
        textPrimary: elementColors.text,
        textSecondary: isDarkMode ? '#e0e0e0' : '#4a5568',
        textTertiary: isDarkMode ? '#b0b0b0' : '#718096',
        accent: currentTheme.primary,
        decorative: `${currentTheme.primary}40`,
        border: `${currentTheme.primary}20`,
        cardBg: isDarkMode ? `rgba(0, 0, 0, 0.3)` : `${currentTheme.primary}05`,
        cardBorder: `${currentTheme.primary}30`,
        shadowColor: `${currentTheme.primary}15`,
        isDark: isDarkMode
      };
    }
  };

  const themeColors = getThemeColors();

  // Default background if none provided
  const defaultBackgroundClass = `diary-page h-full w-full`;

  // Get quotes for quote type
  const quotes = [
    "The only way to do great work is to love what you do. - Steve Jobs",
    "Write it on your heart that every day is the best day in the year. - Ralph Waldo Emerson",
    "Life is what happens when you're busy making other plans. - John Lennon",
    "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt"
  ];
   
  // Personal quotes for user
  const personalQuotes = [
    `"Every story you write, ${userInfo?.name?.split(' ')[0] || 'Friend'}, becomes part of your legacy."`,
    `"Your thoughts today, ${userInfo?.name?.split(' ')[0] || 'Friend'}, shape your tomorrow."`,
    `"In these pages, ${userInfo?.name?.split(' ')[0] || 'Friend'}, your dreams take flight."`,
    `"Each word you capture, ${userInfo?.name?.split(' ')[0] || 'Friend'}, is a moment preserved forever."`
  ];

  const renderCoverPage = () => {
    const currentDate = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Enhanced dark background with leather-like texture */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              ${themeColors.background},
              radial-gradient(circle at 25% 25%, rgba(255,255,255,0.03) 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, rgba(255,255,255,0.02) 0%, transparent 50%),
              linear-gradient(45deg, transparent 49%, rgba(255,255,255,0.01) 50%, transparent 51%)
            `
          }}
        />

        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating geometric shapes with enhanced visibility */}
          <div 
            className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-20 animate-pulse"
            style={{ 
              background: `linear-gradient(45deg, ${themeColors.accent}40, transparent)`,
              border: `2px solid ${themeColors.decorative}`,
              boxShadow: `0 0 30px ${themeColors.shadowColor}`
            }}
          ></div>
          <div 
            className="absolute bottom-20 right-10 w-24 h-24 rotate-45 opacity-15 animate-bounce"
            style={{ 
              background: `linear-gradient(135deg, ${themeColors.accent}30, transparent)`,
              border: `1px solid ${themeColors.decorative}`,
              animationDuration: '3s',
              boxShadow: `0 0 20px ${themeColors.shadowColor}`
            }}
          ></div>
          <div 
            className="absolute top-1/3 right-20 w-16 h-16 rounded-full opacity-25"
            style={{ 
              background: `radial-gradient(circle, ${themeColors.accent}60, transparent)`,
              border: `1px solid ${themeColors.decorative}`,
              boxShadow: `0 0 15px ${themeColors.shadowColor}`
            }}
          ></div>
          <div 
            className="absolute bottom-1/3 left-16 w-20 h-20 rotate-12 opacity-20"
            style={{ 
              background: `linear-gradient(60deg, ${themeColors.accent}40, transparent)`,
              border: `1px solid ${themeColors.decorative}`,
              borderRadius: '20%',
              boxShadow: `0 0 25px ${themeColors.shadowColor}`
            }}
          ></div>
          
          {/* Enhanced decorative dots pattern */}
          <div className="absolute inset-0 opacity-10">
            {stablePositions.dots.map((pos, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full animate-pulse"
                style={{
                  left: pos.left,
                  top: pos.top,
                  backgroundColor: themeColors.accent,
                  boxShadow: `0 0 4px ${themeColors.accent}`,
                  animationDelay: pos.delay,
                  animationDuration: pos.duration
                }}
              />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="text-center z-10 space-y-8">
          {/* Elegant title section */}
          <div className="space-y-6">
            {/* Top decorative line */}
            <div className="flex items-center justify-center space-x-6">
              <div 
                className="w-20 h-0.5 opacity-80"
                style={{ 
                  backgroundColor: themeColors.accent,
                  boxShadow: `0 0 10px ${themeColors.accent}40`
                }}
              ></div>
              <div className="relative">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                     style={{ color: themeColors.accent, filter: `drop-shadow(0 0 8px ${themeColors.accent}40)` }} 
                     className="opacity-90">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <div className="absolute inset-0 animate-ping">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                       style={{ color: themeColors.accent }} className="opacity-30">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <div 
                className="w-20 h-0.5 opacity-80"
                style={{ 
                  backgroundColor: themeColors.accent,
                  boxShadow: `0 0 10px ${themeColors.accent}40`
                }}
              ></div>
            </div>
            
            {/* Main title with enhanced typography */}
            <div className="space-y-2">
              <h1 
                className="font-serif text-3xl sm:text-5xl font-light tracking-wider leading-tight"
                style={{ 
                  color: themeColors.textPrimary,
                  textShadow: `0 2px 4px rgba(0,0,0,0.5), 0 0 20px ${themeColors.accent}20`
                }}
              >
                My Personal
              </h1>
              <h1 
                className="font-serif text-4xl sm:text-6xl font-bold tracking-wide"
                style={{ 
                  color: themeColors.accent,
                  textShadow: `0 0 30px ${themeColors.accent}60, 0 2px 8px rgba(0,0,0,0.7)`
                }}
              >
                Journal
              </h1>
            </div>
            
            {/* Subtitle decorative line */}
            <div className="flex items-center justify-center space-x-4">
              <div 
                className="w-12 h-0.5 opacity-60"
                style={{ 
                  backgroundColor: themeColors.accent,
                  boxShadow: `0 0 6px ${themeColors.accent}30`
                }}
              ></div>
              <div className="flex space-x-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-1 rounded-full animate-pulse"
                    style={{ 
                      backgroundColor: themeColors.accent,
                      boxShadow: `0 0 4px ${themeColors.accent}`,
                      animationDelay: `${i * 0.2}s`
                    }}
                  />
                ))}
              </div>
              <div 
                className="w-12 h-0.5 opacity-60"
                style={{ 
                  backgroundColor: themeColors.accent,
                  boxShadow: `0 0 6px ${themeColors.accent}30`
                }}
              ></div>
            </div>
          </div>

          {/* Enhanced user information card */}
          <div 
            className="backdrop-blur-sm rounded-2xl p-8 max-w-sm mx-auto border shadow-2xl"
            style={{ 
              backgroundColor: themeColors.cardBg,
              borderColor: themeColors.cardBorder,
              boxShadow: `0 25px 50px rgba(0,0,0,0.5), 0 0 30px ${themeColors.shadowColor}, inset 0 1px 0 rgba(255,255,255,0.1)`
            }}
          >
            <div className="space-y-4">
              <div className="relative">
                <div 
                  className="w-20 h-20 rounded-full mx-auto border-4 flex items-center justify-center"
                  style={{ 
                    borderColor: themeColors.accent,
                    backgroundColor: `${themeColors.accent}20`,
                    boxShadow: `0 0 20px ${themeColors.accent}30, inset 0 2px 4px rgba(0,0,0,0.3)`
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                       style={{ color: themeColors.accent, filter: `drop-shadow(0 0 6px ${themeColors.accent}40)` }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div 
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                  style={{ 
                    backgroundColor: themeColors.accent,
                    borderColor: themeColors.textPrimary,
                    boxShadow: `0 0 12px ${themeColors.accent}50`
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 
                  className="font-serif text-2xl font-semibold"
                  style={{ 
                    color: themeColors.textPrimary,
                    textShadow: `0 1px 2px rgba(0,0,0,0.5)`
                  }}
                >
                  {userInfo?.name || 'Your Name'}
                </h2>
                <p 
                  className="font-mono text-sm opacity-90"
                  style={{ 
                    color: themeColors.textSecondary,
                    textShadow: `0 1px 2px rgba(0,0,0,0.3)`
                  }}
                >
                  @{userInfo?.username || 'username'}
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced inspirational quote */}
          <div className="max-w-md mx-auto">
            <div className="relative">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                   className="mx-auto mb-4 opacity-70" 
                   style={{ 
                     color: themeColors.accent,
                     filter: `drop-shadow(0 0 10px ${themeColors.accent}40)`
                   }}>
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
              </svg>
              <p 
                className="font-serif text-lg italic leading-relaxed"
                style={{ 
                  color: themeColors.textSecondary,
                  textShadow: `0 1px 2px rgba(0,0,0,0.4)`
                }}
              >
                {personalQuotes[0]}
              </p>
            </div>
          </div>

          {/* Enhanced date and location */}
          <div 
            className="pt-6 border-t space-y-3"
            style={{ 
              borderColor: themeColors.border,
              borderImage: `linear-gradient(90deg, transparent, ${themeColors.border}, transparent) 1`
            }}
          >
            <p 
              className="font-serif text-xl font-medium"
              style={{ 
                color: themeColors.textPrimary,
                textShadow: `0 1px 2px rgba(0,0,0,0.5)`
              }}
            >
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </p>
            <p 
              className="text-sm opacity-80"
              style={{ 
                color: themeColors.textTertiary,
                textShadow: `0 1px 2px rgba(0,0,0,0.3)`
              }}
            >
              A journey of thoughts and dreams
            </p>
          </div>

          {/* Enhanced bottom decorative element */}
          <div className="flex items-center justify-center space-x-3 pt-4">
            {[8, 12, 16, 12, 8].map((px, i) => (
              <div
                key={i}
                className="rounded-full animate-pulse"
                style={{ 
                  width: px,
                  height: px,
                  backgroundColor: themeColors.accent,
                  boxShadow: `0 0 8px ${themeColors.accent}50`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '2s'
                }}
              />
            ))}
          </div>
        </div>

        {/* Enhanced corner decorative elements */}
        <div className="absolute top-6 left-6 opacity-40">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
               style={{ 
                 color: themeColors.accent,
                 filter: `drop-shadow(0 0 8px ${themeColors.accent}30)`
               }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <div className="absolute top-6 right-6 opacity-40">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
               style={{ 
                 color: themeColors.accent,
                 filter: `drop-shadow(0 0 8px ${themeColors.accent}30)`
               }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className="absolute bottom-6 left-6 opacity-40">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
               style={{ 
                 color: themeColors.accent,
                 filter: `drop-shadow(0 0 8px ${themeColors.accent}30)`
               }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <path d="M9 9h.01" />
            <path d="M15 9h.01" />
          </svg>
        </div>
        <div className="absolute bottom-6 right-6 opacity-40">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
               style={{ 
                 color: themeColors.accent,
                 filter: `drop-shadow(0 0 8px ${themeColors.accent}30)`
               }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
      </div>
    );
  };

  const renderBackPage = () => {
    const currentDate = new Date();
    const totalEntries = userInfo?.totalEntries || 0;
    
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Enhanced dark background */}
        <div 
          className="absolute inset-0"
          style={{
            background: themeColors.background,
            backgroundImage: `
              radial-gradient(circle at 30% 30%, rgba(255,255,255,0.03) 0%, transparent 50%),
              radial-gradient(circle at 70% 70%, rgba(255,255,255,0.02) 0%, transparent 50%),
              linear-gradient(135deg, transparent 49%, rgba(255,255,255,0.01) 50%, transparent 51%)
            `
          }}
        />

        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Enhanced subtle grid pattern */}
          <div className="absolute inset-0 opacity-8">
            <div className="grid grid-cols-8 grid-rows-10 h-full">
              {Array.from({ length: 80 }).map((_, i) => (
                <div 
                  key={i} 
                  className="border-[0.5px]"
                  style={{ 
                    borderColor: themeColors.decorative,
                    boxShadow: i % 16 === 0 ? `inset 0 0 4px ${themeColors.shadowColor}` : 'none'
                  }}
                >
                  {i % 12 === 0 && (
                    <div 
                      className="w-2 h-2 rounded-full mx-auto mt-2 animate-pulse"
                      style={{ 
                        backgroundColor: themeColors.accent,
                        boxShadow: `0 0 6px ${themeColors.accent}40`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '3s'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Enhanced floating elements */}
          <div className="absolute inset-0">
            {stablePositions.floating.map((pos, i) => (
              <div
                key={i}
                className="absolute animate-pulse"
                style={{
                  left: pos.left,
                  top: pos.top,
                  animationDelay: pos.delay,
                  animationDuration: pos.duration
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                     className="opacity-30" 
                     style={{ 
                       color: themeColors.accent,
                       filter: `drop-shadow(0 0 4px ${themeColors.accent}30)`
                     }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center z-10 space-y-8">
          {/* Enhanced thank you message */}
          <div className="space-y-6">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div 
                className="w-16 h-0.5 opacity-80"
                style={{ 
                  backgroundColor: themeColors.accent,
                  boxShadow: `0 0 8px ${themeColors.accent}40`
                }}
              ></div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                   style={{ 
                     color: themeColors.accent,
                     filter: `drop-shadow(0 0 8px ${themeColors.accent}40)`
                   }} 
                   className="opacity-90">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <div 
                className="w-16 h-0.5 opacity-80"
                style={{ 
                  backgroundColor: themeColors.accent,
                  boxShadow: `0 0 8px ${themeColors.accent}40`
                }}
              ></div>
            </div>
            
            <h2 
              className="font-serif text-3xl sm:text-4xl font-light"
              style={{ 
                color: themeColors.textPrimary,
                textShadow: `0 2px 4px rgba(0,0,0,0.5)`
              }}
            >
              Thank You for
            </h2>
            <h2 
              className="font-serif text-4xl sm:text-5xl font-bold"
              style={{ 
                color: themeColors.accent,
                textShadow: `0 0 25px ${themeColors.accent}60, 0 2px 6px rgba(0,0,0,0.7)`
              }}
            >
              Writing
            </h2>
            <p 
              className="font-serif text-lg max-w-md mx-auto leading-relaxed mt-6"
              style={{ 
                color: themeColors.textSecondary,
                textShadow: `0 1px 2px rgba(0,0,0,0.4)`
              }}
            >
              {userInfo?.name?.split(' ')[0] || 'Friend'}, every page you've filled is a step in your journey of self-discovery and growth.
            </p>
          </div>

          {/* Enhanced stats card */}
          <div 
            className="backdrop-blur-sm rounded-2xl p-8 max-w-sm mx-auto border shadow-2xl"
            style={{ 
              backgroundColor: themeColors.cardBg,
              borderColor: themeColors.cardBorder,
              boxShadow: `0 25px 50px rgba(0,0,0,0.5), 0 0 30px ${themeColors.shadowColor}, inset 0 1px 0 rgba(255,255,255,0.1)`
            }}
          >
            <h3 
              className="font-serif text-2xl font-semibold mb-6"
              style={{ 
                color: themeColors.textPrimary,
                textShadow: `0 1px 2px rgba(0,0,0,0.5)`
              }}
            >
              Your Journey
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span 
                  className="font-serif text-sm"
                  style={{ color: themeColors.textSecondary }}
                >
                  Entries Written:
                </span>
                <span 
                  className="font-bold text-lg"
                  style={{ color: themeColors.accent }}
                >
                  {totalEntries}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span 
                  className="font-serif text-sm"
                  style={{ color: themeColors.textSecondary }}
                >
                  Started:
                </span>
                <span 
                  className="font-semibold"
                  style={{ color: themeColors.textPrimary }}
                >
                  {currentDate.toLocaleDateString()}
                </span>
              </div>
              <div 
                className="pt-4 border-t"
                style={{ borderColor: themeColors.border }}
              >
                <p 
                  className="font-serif text-sm italic"
                  style={{ color: themeColors.accent }}
                >
                  Your story continues...
                </p>
              </div>
            </div>
          </div>

          {/* Inspirational quote */}
          <div className="max-w-md mx-auto">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                 className="mx-auto mb-4 opacity-60" style={{ color: themeColors.accent }}>
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
            </svg>
            <p 
              className="font-serif text-lg italic leading-relaxed"
              style={{ color: themeColors.textSecondary }}
            >
              "The story you're writing today becomes the wisdom you'll cherish tomorrow."
            </p>
          </div>

          {/* Contact info */}
          <div 
            className="pt-6 border-t"
            style={{ borderColor: themeColors.border }}
          >
            <p 
              className="font-mono text-sm opacity-70"
              style={{ color: themeColors.textTertiary }}
            >
              {userInfo?.email || 'your.email@example.com'}
            </p>
          </div>
        </div>
      </div>
    );
  };
  
  const renderDecorativeContent = () => {
    // Handle special page types
    if (pageType === 'cover') {
      return renderCoverPage();
    }
    
    if (pageType === 'back') {
      return renderBackPage();
    }
   
    // Regular decorative content with theme integration
    switch (decorationType) {
      case "quotes":
        return (
          <div className="h-full w-full flex items-center justify-center p-10">
            <div className="text-center max-w-sm">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                   className="mx-auto mb-4 opacity-60" style={{ color: themeColors.accent }}>
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
              </svg>
              <p 
                className="font-serif text-lg italic mb-4 leading-relaxed"
                style={{ color: themeColors.textPrimary }}
              >
                {personalQuotes[isEven ? 1 : 2]}
              </p>
              <div 
                className="w-16 h-1 mx-auto mt-6"
                style={{ backgroundColor: themeColors.accent }}
              ></div>
            </div>
          </div>
        );
      
      case "geometric":
        return (
          <div className="h-full w-full relative">
            <div className="grid grid-cols-4 grid-rows-4 h-full">
              {Array.from({ length: 16 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`flex items-center justify-center ${
                    i % 3 === 0 ? 'opacity-10' : ''
                  }`}
                  style={{ 
                    border: `1px solid ${themeColors.border}`,
                    backgroundColor: i % 3 === 0 ? themeColors.cardBg : 'transparent'
                  }}
                >
                  {i % 5 === 0 && (
                    <div 
                      className="w-8 h-8 rounded-full"
                      style={{ border: `1px solid ${themeColors.decorative}` }}
                    ></div>
                  )}
                  {i % 7 === 0 && (
                    <div 
                      className="w-10 h-10 rotate-45"
                      style={{ border: `1px solid ${themeColors.decorative}` }}
                    ></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      
      
      case "doodles":
        return (
          <div className="h-full w-full p-8">
            <div className="border-b border-primary/20 pb-4 mb-6">
              <h3 className="font-journal text-xl text-primary/70 text-center">
                {userInfo?.name?.split(' ')[0] || 'Your'} Journal Notes
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary/40 mb-2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l2 2" />
                </svg>
                <p className="font-journal text-sm text-center">Take time to reflect</p>
              </div>
              <div className="flex flex-col items-center">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary/40 mb-2">
                  <path d="M12 2a9 9 0 0 0-9 9c0 3.4 3.1 6.8 4.4 8.2.3.3.6.5.9.8.9.7 1.8 1 3.7 1s2.8-.3 3.7-1c.3-.2.6-.5.9-.8 1.3-1.4 4.4-4.8 4.4-8.2a9 9 0 0 0-9-9z" />
                  <circle cx="12" cy="8.5" r="2" />
                </svg>
                <p className="font-journal text-sm text-center">Remember the journey</p>
              </div>
              <div className="flex flex-col items-center">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary/40 mb-2">
                  <path d="M16 18l2-2-4-4-4 4 2 2" />
                  <path d="M10 6h4v4" />
                  <path d="M12 2v4" />
                  <path d="M22 12h-4" />
                  <path d="M6 12H2" />
                </svg>
                <p className="font-journal text-sm text-center">Capture moments</p>
              </div>
              <div className="flex flex-col items-center">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary/40 mb-2">
                  <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z" />
                  <path d="M12 18c3.3 0 6-2.7 6-6s-2.7-6-6-6-6 2.7-6 6 2.7 6 6 6zM12 14c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
                </svg>
                <p className="font-journal text-sm text-center">Focus on what matters</p>
              </div>
            </div>
            <div className="mt-10 border-t border-primary/20 pt-4">
              <p className="font-journal text-center text-xs text-primary/60">
                Your thoughts deserve a beautiful home, {userInfo?.name?.split(' ')[0] || 'friend'}
              </p>
            </div>
          </div>
        );
      
      case "pattern":
        return (
          <div className="h-full w-full overflow-hidden">
            <div className="grid grid-cols-8 grid-rows-12 h-full opacity-20">
              {Array.from({ length: 96 }).map((_, i) => (
                <div key={i} className="border-[0.5px] border-primary/20 flex items-center justify-center">
                  {i % 4 === 0 && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary/30">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  )}
                  {i % 7 === 0 && (
                    <div className="w-2 h-2 rounded-full bg-primary/20"></div>
                  )}
                  {i % 11 === 0 && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary/30">
                      <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="font-journal text-3xl text-primary/60 mb-2">
                  {userInfo?.name?.split(' ')[0] || 'Your'} Journal
                </p>
                <p className="font-journal text-sm text-primary/40">Capture Life's Moments</p>
              </div>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="h-full w-full flex items-center justify-center">
            <p className="font-journal text-2xl text-primary/50">
              {userInfo?.name?.split(' ')[0] || 'Your'} Journal
            </p>
          </div>
        );
    }
  };

  return (
    <div 
      className={`h-full w-full overflow-hidden ${backgroundClass || defaultBackgroundClass}`}
      style={{
        ...backgroundStyle,
        position: 'relative',
      }}
    >
      {renderDecorativeContent()}
    </div>
  );
};

export default DecorativePage;