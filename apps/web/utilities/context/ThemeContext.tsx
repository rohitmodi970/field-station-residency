"use client"
import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ColorOption {
  name: string;
  primary: string;
  hover: string;
  active: string;
  light: string;
  medium: string;
  secondary?: string;
  accent?: string;
}

interface SavedTheme {
  colorName: string;
  darkMode: boolean;
  elementColors?: Partial<ElementColors>;
  font?: string;
  pageBackground?: string;
  isCustomTextColor?: boolean;
  isCustomPageBackground?: boolean;
}

interface ElementColors {
  button: string;
  background: string;
  text: string;
  accent: string;
}

interface ThemeContextType {
  // State
  colorOptions: ColorOption[];
  currentTheme: ColorOption;
  isDarkMode: boolean;
  elementColors: ElementColors;
  currentFont: string;
  pageBackground: string;
  isInitialized: boolean;
  
  // Actions
  setCurrentTheme: (color: ColorOption) => void;
  toggleDarkMode: () => void;
  resetToDefaults: (scope?: 'elements' | 'all') => void;
  updateElementColor: (element: keyof ElementColors, color: string) => void;
  setFont: (font: string) => void;
  setPageBackground: (color: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'appTheme';
const THEME_APPLY_DEBOUNCE = 50; // ms

// Color palette with aesthetic writer-style names
export const colorOptions: ColorOption[] = [
  // Classic & Popular
  { name: 'Midnight Ink', primary: '#1A1A2E', hover: '#16213E', active: '#0F0F1A', light: 'rgba(26, 26, 46, 0.1)', medium: 'rgba(26, 26, 46, 0.3)' },
  { name: 'Deep Ocean', primary: '#0D3B66', hover: '#0A2F52', active: '#06203A', light: 'rgba(13, 59, 102, 0.1)', medium: 'rgba(13, 59, 102, 0.3)' },
  { name: 'Hemingway Blue', primary: '#4299E1', hover: '#3182CE', active: '#2B6CB0', light: 'rgba(66, 153, 225, 0.1)', medium: 'rgba(66, 153, 225, 0.3)' },
  { name: 'Fitzgerald Indigo', primary: '#667EEA', hover: '#5A67D8', active: '#4C51BF', light: 'rgba(102, 126, 234, 0.1)', medium: 'rgba(102, 126, 234, 0.3)' },
  
  // Warm Tones  
  { name: 'Crimson Prose', primary: '#E53E3E', hover: '#C53030', active: '#9B2C2C', light: 'rgba(229, 62, 62, 0.1)', medium: 'rgba(229, 62, 62, 0.3)' },
  { name: 'Autumn Script', primary: '#ED8936', hover: '#DD6B20', active: '#C05621', light: 'rgba(237, 137, 54, 0.1)', medium: 'rgba(237, 137, 54, 0.3)' },
  { name: 'Golden Quill', primary: '#ECC94B', hover: '#D69E2E', active: '#B7791F', light: 'rgba(236, 201, 75, 0.1)', medium: 'rgba(236, 201, 75, 0.3)' },
  { name: 'Rose Memoir', primary: '#ED64A6', hover: '#D53F8C', active: '#B83280', light: 'rgba(237, 100, 166, 0.1)', medium: 'rgba(237, 100, 166, 0.3)' },
  
  // Cool Tones
  { name: 'Emerald Pages', primary: '#48BB78', hover: '#38A169', active: '#2F855A', light: 'rgba(72, 187, 120, 0.1)', medium: 'rgba(72, 187, 120, 0.3)' },
  { name: 'Teal Chronicle', primary: '#38B2AC', hover: '#319795', active: '#2C7A7B', light: 'rgba(56, 178, 172, 0.1)', medium: 'rgba(56, 178, 172, 0.3)' },
  { name: 'Cyan Sonnet', primary: '#0BC5EA', hover: '#00B5D8', active: '#00A3C4', light: 'rgba(11, 197, 234, 0.1)', medium: 'rgba(11, 197, 234, 0.3)' },
  
  // Creative Tones
  { name: 'Violet Verse', primary: '#9F7AEA', hover: '#805AD5', active: '#6B46C1', light: 'rgba(159, 122, 234, 0.1)', medium: 'rgba(159, 122, 234, 0.3)' },
  { name: 'Slate Manuscript', primary: '#64748B', hover: '#475569', active: '#334155', light: 'rgba(100, 116, 139, 0.1)', medium: 'rgba(100, 116, 139, 0.3)' },
  { name: 'Sepia Classic', primary: '#8B7355', hover: '#6B5344', active: '#544233', light: 'rgba(139, 115, 85, 0.1)', medium: 'rgba(139, 115, 85, 0.3)' },
];

// Font options with Google Fonts support
export const fontOptions = [
  { name: 'Inter', value: 'inter', import: 'Inter:wght@300;400;500;600;700' },
  { name: 'Roboto', value: 'roboto', import: 'Roboto:wght@300;400;500;700' },
  { name: 'Open Sans', value: 'opensans', import: 'Open+Sans:wght@300;400;600;700' },
  { name: 'Lato', value: 'lato', import: 'Lato:wght@300;400;700' },
  { name: 'Montserrat', value: 'montserrat', import: 'Montserrat:wght@300;400;500;600;700' },
  { name: 'Poppins', value: 'poppins', import: 'Poppins:wght@300;400;500;600;700' },
  { name: 'Cormorant Garamond', value: 'cormorant', import: 'Cormorant+Garamond:wght@300;400;500;600;700' },
  { name: 'Playfair Display', value: 'playfair', import: 'Playfair+Display:wght@400;500;600;700' },
  // Local font (Hydrogen Whiskey) — handled via injected @font-face (no Google import)
  { name: 'Hydrogen Whiskey', value: 'hydrogen', import: '' },
  { name: 'Terminal Grotesque Open', value: 'terminalGrotesqueOpen', import: '' },
  { name: 'Terminal Grotesque', value: 'terminalGrotesque', import: '' },
];

export const hydrogenFontFace = `
@font-face {
  font-family: 'Hydrogen Whiskey';
  src: url('/fonts/Hydrogen_Whiskey.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;

export const terminalGrotesqueOpenFontFace = `
@font-face {
  font-family: 'Terminal Grotesque Open';
  src: url('/fonts/terminal-grotesque_open.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;

export const terminalGrotesqueFontFace = `
@font-face {
  font-family: 'Terminal Grotesque';
  src: url('/fonts/terminal-grotesque.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;


// Default theme values — use the current dashboard aesthetic (Sepia) as default
const DEFAULT_THEME: ColorOption = colorOptions.find(c => c.name === 'Sepia Classic') ?? colorOptions[2]!;
const DEFAULT_FONT = 'cormorant';
const LIGHT_MODE_TEXT = '#111827';
const DARK_MODE_TEXT = '#F9FAFB';
const LIGHT_MODE_TEXT_SECONDARY = '#6B7280';
const DARK_MODE_TEXT_SECONDARY = '#D1D5DB';
const LIGHT_MODE_PAGE_BG = '#F7F9FC';
const DARK_MODE_PAGE_BG = '#1F2937';

const getDefaultElementColors = (theme: ColorOption): ElementColors => ({
  button: theme.primary,
  background: theme.light,
  text: LIGHT_MODE_TEXT,
  accent: theme.medium,
});

// ============================================================================
// CONTEXT CREATION
// ============================================================================

export const ThemeContext = createContext<ThemeContextType>({
  colorOptions,
  currentTheme: DEFAULT_THEME,
  isDarkMode: false,
  elementColors: getDefaultElementColors(DEFAULT_THEME),
  currentFont: DEFAULT_FONT,
  pageBackground: LIGHT_MODE_PAGE_BG,
  isInitialized: false,
  setCurrentTheme: () => {},
  toggleDarkMode: () => {},
  resetToDefaults: () => {},
  updateElementColor: () => {},
  setFont: () => {},
  setPageBackground: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert hex color to HSL format for CSS variables
 */
const hexToHsl = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

const isHexColor = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);

/**
 * Load Google Font dynamically
 */
const loadGoogleFont = (fontValue: string) => {
  if (typeof window === 'undefined') return;
  
  const font = fontOptions.find(f => f.value === fontValue);
  if (!font) return;

  const linkId = `google-font-${fontValue}`;
  
  // Remove existing font link if present
  const existingLink = document.getElementById(linkId);
  if (existingLink) return;

  // Create and append new font link
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.import}&display=swap`;
  document.head.appendChild(link);
};

/**
 * Get font family CSS value
 */
export const getFontFamily = (fontValue: string): string => {
  const fontMap: Record<string, string> = {
    inter: "'Inter', sans-serif",
    roboto: "'Roboto', sans-serif",
    opensans: "'Open Sans', sans-serif",

    lato: "'Lato', sans-serif",
    montserrat: "'Montserrat', sans-serif",
    poppins: "'Poppins', sans-serif",
    cormorant: "'Cormorant Garamond', serif",
    playfair: "'Playfair Display', serif",
    hydrogen: "'Hydrogen Whiskey', sans-serif",
    terminalGrotesqueOpen: "'Terminal Grotesque Open', sans-serif",
    terminalGrotesque: "'Terminal Grotesque', sans-serif",
  };
  return fontMap[fontValue] ?? "'Inter', sans-serif";
};

/**
 * Debounce utility
 */
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// ============================================================================
// THEME PROVIDER
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // State management
  const [currentTheme, setCurrentTheme] = useState<ColorOption>(DEFAULT_THEME);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [elementColors, setElementColors] = useState<ElementColors>(
    getDefaultElementColors(DEFAULT_THEME)
  );
  const [currentFont, setCurrentFont] = useState(DEFAULT_FONT);
  const [pageBackground, setPageBackgroundState] = useState(LIGHT_MODE_PAGE_BG);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCustomTextColor, setIsCustomTextColor] = useState(false);
  const [isCustomPageBackground, setIsCustomPageBackground] = useState(false);

  const prevDarkModeRef = useRef<boolean | null>(null);

  /**
   * Apply theme to DOM and save to localStorage
   */
  const applyTheme = useCallback((
    theme: ColorOption,
    darkMode: boolean,
    elements: ElementColors,
    font: string,
    pageBg: string,
    customText: boolean = false,
    customBg: boolean = false
  ) => {
    if (typeof window === 'undefined' || !theme) return;
    
    const root = document.documentElement;

    // Apply theme color variables
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-primary-hover', theme.hover);
    root.style.setProperty('--theme-primary-active', theme.active);
    root.style.setProperty('--theme-primary-light', theme.light);
    root.style.setProperty('--theme-primary-medium', theme.medium);
    
    // Apply element-specific colors
    root.style.setProperty('--element-button', elements.button);
    root.style.setProperty('--element-background', elements.background);
    root.style.setProperty('--element-accent', elements.accent);
    root.style.setProperty('--bg-page', pageBg);

    // Dashboard / Analysis specific variables (connect UI to theme)
    // Heading font for dashboard sections (falls back to serif when appropriate)
    const dashboardHeadingFont = getFontFamily(font) || "Georgia, serif";
    root.style.setProperty('--dashboard-heading-font', dashboardHeadingFont);

    // Analysis card/shell colors used across analysis and dashboard components
    root.style.setProperty('--analysis-card', elements.background);
    root.style.setProperty('--analysis-shell-bg', darkMode ? 'rgba(10,12,14,0.6)' : 'rgba(255,255,255,0.9)');
    root.style.setProperty('--analysis-text', elements.text);
    root.style.setProperty('--analysis-muted', theme.medium);
    root.style.setProperty('--analysis-soft', theme.light);

    // Cream / neutral tokens used by some security and small-card components
    root.style.setProperty('--cream-card', elements.background);
    root.style.setProperty('--cream-border', 'rgba(0,0,0,0.06)');

    // Dashboard-specific color tokens
    root.style.setProperty('--dashboard-heading-color', elements.text);
    root.style.setProperty('--dashboard-accent', elements.accent);
    root.style.setProperty('--primary-color', theme.primary);
    root.style.setProperty('--border-color', darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)');
    root.style.setProperty('--analysis-overlay', darkMode ? 'radial-gradient(circle at 10% 10%, rgba(0,0,0,0.18), transparent 30%)' : 'radial-gradient(circle at 10% 10%, rgba(255,255,255,0.6), transparent 30%)');

    const pageBackgroundIsImage = pageBg.includes('gradient') || pageBg.includes('url(');
    const sharedPageStyles = {
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: pageBackgroundIsImage ? 'cover' : '',
    } as const;

    root.style.backgroundColor = pageBackgroundIsImage ? '' : pageBg;
    root.style.backgroundImage = pageBackgroundIsImage ? pageBg : '';
    root.style.backgroundAttachment = sharedPageStyles.backgroundAttachment;
    root.style.backgroundRepeat = sharedPageStyles.backgroundRepeat;
    root.style.backgroundPosition = sharedPageStyles.backgroundPosition;
    root.style.backgroundSize = sharedPageStyles.backgroundSize;

    document.body.style.backgroundColor = pageBackgroundIsImage ? '' : pageBg;
    document.body.style.backgroundImage = pageBackgroundIsImage ? pageBg : '';
    document.body.style.backgroundAttachment = sharedPageStyles.backgroundAttachment;
    document.body.style.backgroundRepeat = sharedPageStyles.backgroundRepeat;
    document.body.style.backgroundPosition = sharedPageStyles.backgroundPosition;
    document.body.style.backgroundSize = sharedPageStyles.backgroundSize;

    // Handle text color with auto dark/light mode support
    const textColor = customText 
      ? elements.text
      : (darkMode ? DARK_MODE_TEXT : LIGHT_MODE_TEXT);
    const textSecondaryColor = darkMode ? DARK_MODE_TEXT_SECONDARY : LIGHT_MODE_TEXT_SECONDARY;
    root.style.setProperty('--element-text', textColor);
    root.style.setProperty('--text-primary', textColor);
    root.style.setProperty('--text-secondary', textSecondaryColor);
    root.style.setProperty('--color-text-primary', textColor);
    root.style.setProperty('--color-text-secondary', textSecondaryColor);
    root.style.setProperty('--foreground', textColor);
    root.style.setProperty('--muted-foreground', textSecondaryColor);
    document.body.style.color = textColor;

    // Load and apply font
    loadGoogleFont(font);
    const fontFamily = getFontFamily(font);
    root.style.setProperty('--font-family', fontFamily);
    document.body.style.fontFamily = fontFamily;

    // Apply dark mode classes and CSS variables
    const [h, s, l] = hexToHsl(theme.primary);

    const [backgroundH, backgroundS, backgroundL] = isHexColor(pageBg)
      ? hexToHsl(pageBg)
      : [h, Math.min(s, 25), 97];
    const primaryForeground = l >= 62 ? '25 15% 18%' : '0 0% 100%';

    // Keep Tailwind semantic classes in sync with the user-selected Journal theme.
    // Without these mappings, bg-card/bg-background fall back to the static CSS palette.
    const semanticColors = darkMode
      ? {
          background: `${h} 18% 12%`,
          foreground: '25 10% 92%',
          card: `${h} 18% 16%`,
          cardForeground: '25 10% 92%',
          muted: `${h} 15% 22%`,
          mutedForeground: '25 10% 70%',
          secondary: `${h} 15% 22%`,
          secondaryForeground: '25 10% 92%',
          border: `${h} 15% 25%`,
          input: `${h} 15% 25%`,
          accent: `${h} 30% 27%`,
          accentForeground: '25 10% 92%',
        }
      : {
          background: `${backgroundH} ${Math.min(backgroundS, 25)}% ${Math.max(95, backgroundL)}%`,
          foreground: '25 15% 25%',
          card: `${h} ${Math.min(s, 22)}% 99%`,
          cardForeground: '25 15% 25%',
          muted: `${h} ${Math.min(s, 28)}% 92%`,
          mutedForeground: '25 15% 55%',
          secondary: `${h} ${Math.min(s, 35)}% 92%`,
          secondaryForeground: '25 25% 35%',
          border: `${h} 20% 88%`,
          input: `${h} 20% 88%`,
          accent: `${h} ${Math.min(s, 45)}% 90%`,
          accentForeground: '25 20% 20%',
        };

    root.style.setProperty('--background', semanticColors.background);
    root.style.setProperty('--foreground', semanticColors.foreground);
    root.style.setProperty('--card', semanticColors.card);
    root.style.setProperty('--card-foreground', semanticColors.cardForeground);
    root.style.setProperty('--popover', semanticColors.card);
    root.style.setProperty('--popover-foreground', semanticColors.cardForeground);
    root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
    root.style.setProperty('--primary-foreground', primaryForeground);
    root.style.setProperty('--secondary', semanticColors.secondary);
    root.style.setProperty('--secondary-foreground', semanticColors.secondaryForeground);
    root.style.setProperty('--muted', semanticColors.muted);
    root.style.setProperty('--muted-foreground', semanticColors.mutedForeground);
    root.style.setProperty('--accent', semanticColors.accent);
    root.style.setProperty('--accent-foreground', semanticColors.accentForeground);
    root.style.setProperty('--border', semanticColors.border);
    root.style.setProperty('--input', semanticColors.input);
    root.style.setProperty('--ring', `${h} ${s}% ${l}%`);

    if (darkMode) {
      document.body.classList.add('dark-mode', 'dark');
    } else {
      document.body.classList.remove('dark-mode', 'dark');
    }

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        colorName: theme.name,
        darkMode,
        elementColors: elements,
        font,
        pageBackground: pageBg,
        isCustomTextColor: customText,
        isCustomPageBackground: customBg,
      } as SavedTheme));
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  }, []);

  // Debounced version of applyTheme for performance
  const debouncedApplyTheme = useMemo(
    () => debounce(applyTheme, THEME_APPLY_DEBOUNCE),
    [applyTheme]
  );

  /**
   * Load saved theme from localStorage on mount
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY);
      
      if (savedTheme) {
        const parsed = JSON.parse(savedTheme) as SavedTheme;
        const foundTheme = colorOptions.find(c => c.name === parsed.colorName) ?? DEFAULT_THEME;

        const defaultTextForMode = parsed.darkMode ? DARK_MODE_TEXT : LIGHT_MODE_TEXT;
        const hasCustomText = parsed.isCustomTextColor !== undefined
          ? parsed.isCustomTextColor
          : Boolean(parsed.elementColors?.text && parsed.elementColors.text !== defaultTextForMode);

        const defaultPageBgForMode = parsed.darkMode ? DARK_MODE_PAGE_BG : LIGHT_MODE_PAGE_BG;
        const hasCustomPageBg = parsed.isCustomPageBackground !== undefined
          ? parsed.isCustomPageBackground
          : Boolean(parsed.pageBackground && parsed.pageBackground !== defaultPageBgForMode);

        // Ensure foundTheme is always ColorOption
        const safeTheme: ColorOption = foundTheme ?? DEFAULT_THEME;

        const loadedElements: ElementColors = {
          button: parsed.elementColors?.button ?? safeTheme.primary,
          background: parsed.elementColors?.background ?? safeTheme.light,
          text: parsed.elementColors?.text ?? defaultTextForMode,
          accent: parsed.elementColors?.accent ?? safeTheme.medium,
        };

        const loadedFont = parsed.font ?? DEFAULT_FONT;
        const loadedPageBg = parsed.pageBackground ?? defaultPageBgForMode;

        setCurrentTheme(safeTheme);
        setIsDarkMode(parsed.darkMode);
        setElementColors(loadedElements);
        setCurrentFont(loadedFont);
        setPageBackgroundState(loadedPageBg);
        setIsCustomTextColor(!!hasCustomText);
        setIsCustomPageBackground(!!hasCustomPageBg);

        applyTheme(
          safeTheme,
          parsed.darkMode,
          loadedElements,
          loadedFont,
          loadedPageBg,
          !!hasCustomText,
          !!hasCustomPageBg
        );
      } else {
        // No saved theme, apply defaults
        applyTheme(
          DEFAULT_THEME,
          false,
          getDefaultElementColors(DEFAULT_THEME),
          DEFAULT_FONT,
          LIGHT_MODE_PAGE_BG,
          false,
          false
        );
      }
    } catch (error) {
      console.error('Failed to load theme from localStorage:', error);
      applyTheme(
        DEFAULT_THEME,
        false,
        getDefaultElementColors(DEFAULT_THEME),
        DEFAULT_FONT,
        LIGHT_MODE_PAGE_BG,
        false,
        false
      );
    } finally {
      setIsInitialized(true);
    }
  }, [applyTheme]);

  /**
   * Auto-update theme defaults when dark mode changes.
   * Uses prevDarkModeRef to never overwrite custom/loaded colors on initial mount.
   */
  useEffect(() => {
    if (!isInitialized) return;

    if (prevDarkModeRef.current === null) {
      prevDarkModeRef.current = isDarkMode;
      return;
    }

    if (prevDarkModeRef.current !== isDarkMode) {
      prevDarkModeRef.current = isDarkMode;
      const autoTextColor = isDarkMode ? DARK_MODE_TEXT : LIGHT_MODE_TEXT;
      const autoPageBg = isDarkMode ? DARK_MODE_PAGE_BG : LIGHT_MODE_PAGE_BG;
      
      if (!isCustomTextColor) {
        setElementColors(prev => ({ ...prev, text: autoTextColor }));
      }
      if (!isCustomPageBackground) {
        setPageBackgroundState(autoPageBg);
      }
    }
  }, [isDarkMode, isInitialized, isCustomTextColor, isCustomPageBackground]);

  /**
   * Apply theme whenever any theme value changes
   */
  useEffect(() => {
    if (isInitialized) {
      debouncedApplyTheme(
        currentTheme,
        isDarkMode,
        elementColors,
        currentFont,
        pageBackground,
        isCustomTextColor,
        isCustomPageBackground
      );
    }
  }, [
    currentTheme,
    isDarkMode,
    elementColors,
    currentFont,
    pageBackground,
    isCustomTextColor,
    isCustomPageBackground,
    isInitialized,
    debouncedApplyTheme,
  ]);

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const handleColorChange = useCallback((color: ColorOption) => {
    setCurrentTheme(color);
    
    // Auto-update element colors to match new theme (unless customized)
    setElementColors(prev => ({
      button: prev.button === currentTheme.primary ? color.primary : prev.button,
      background: prev.background === currentTheme.light ? color.light : prev.background,
      text: prev.text,
      accent: prev.accent === currentTheme.medium ? color.medium : prev.accent,
    }));
  }, [currentTheme]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const updateElementColor = useCallback((element: keyof ElementColors, color: string) => {
    if (element === 'text') {
      setIsCustomTextColor(true);
    }
    setElementColors(prev => ({ ...prev, [element]: color }));
  }, []);

  const setFont = useCallback((font: string) => {
    setCurrentFont(font);
  }, []);

  const setPageBackground = useCallback((color: string) => {
    setIsCustomPageBackground(true);
    setPageBackgroundState(color);
  }, []);

  const resetToDefaults = useCallback((scope: 'elements' | 'all' = 'all') => {
    if (scope === 'elements') {
      const resetElements: ElementColors = {
        button: currentTheme.primary,
        background: currentTheme.light,
        text: isDarkMode ? DARK_MODE_TEXT : LIGHT_MODE_TEXT,
        accent: currentTheme.medium,
      };
      setElementColors(resetElements);
      setIsCustomTextColor(false);
      setIsCustomPageBackground(false);
      setPageBackgroundState(isDarkMode ? DARK_MODE_PAGE_BG : LIGHT_MODE_PAGE_BG);
    } else {
      setCurrentTheme(DEFAULT_THEME);
      setIsDarkMode(false);
      setElementColors(getDefaultElementColors(DEFAULT_THEME));
      setCurrentFont(DEFAULT_FONT);
      setPageBackgroundState(LIGHT_MODE_PAGE_BG);
      setIsCustomTextColor(false);
      setIsCustomPageBackground(false);
    }
  }, [currentTheme, isDarkMode]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      colorOptions,
      currentTheme,
      isDarkMode,
      elementColors,
      currentFont,
      pageBackground,
      isInitialized,
      setCurrentTheme: handleColorChange,
      toggleDarkMode,
      resetToDefaults,
      updateElementColor,
      setFont,
      setPageBackground,
    }),
    [
      currentTheme,
      isDarkMode,
      elementColors,
      currentFont,
      pageBackground,
      isInitialized,
      handleColorChange,
      toggleDarkMode,
      resetToDefaults,
      updateElementColor,
      setFont,
      setPageBackground,
    ]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};