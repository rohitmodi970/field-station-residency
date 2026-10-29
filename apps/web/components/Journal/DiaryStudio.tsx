"use client"
import { useState, useEffect, useCallback, useRef } from "react";
import { 
  X, Upload, Palette, Zap, 
  Check, BookOpen, Type, Star, Clock, Hash, Heart, 
  Feather, Quote, GripVertical, Flame, CloudSun,
  Target, Stamp, Sun, Compass, CircleDot, Undo2, Save
} from "lucide-react";
import { Button } from "@/components/ui/button2";
import { createClient } from "@/utils/supabase/client";

// ΓöÇΓöÇ Types ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export type GradientBackground = {
  type: "gradient";
  name: string;
  value: string;
  className?: string;
};

export type SolidBackground = {
  type: "solid";
  name: string;
  value: string;
};

export type ImageBackground = {
  type: "image";
  name: string;
  value: string;
};

export type CustomGradientBackground = {
  type: "customGradient";
  name: string;
  value: {
    color1: string;
    color2: string;
    direction: string;
  };
};

export type BackgroundOption =
  | GradientBackground
  | SolidBackground
  | ImageBackground
  | CustomGradientBackground;

export type CoverStyle = {
  id: string;
  name: string;
  variant: 'leather' | 'themed' | 'custom' | 'template';
  imageUrl?: string;
  color?: string;
  template?: string;
  accentColor?: string;
  // Template-specific rendering data
  gradient?: string;
  overlayPattern?: string;
  textColor?: string;
  borderStyle?: string;
};

export type CoverWidgetType = 'diary-title' | 'display-name' | 'username' | 'date' | 'monogram' | 'entry-count' | 'quote' | 'icon' | 'divider' | 'mood-ring' | 'weather' | 'streak' | 'constellation' | 'wax-seal' | 'progress-ring' | 'season' | 'zodiac' | 'stamp' | 'custom-text' | 'bookmark' | 'affirmation';

export type CoverWidget = {
  id: string;
  type: CoverWidgetType;
  label: string;
  enabled: boolean;
  config?: Record<string, string>;
};

export type DiaryFont = {
  id: string;
  name: string;
  family: string;
  category: 'serif' | 'sans-serif' | 'handwriting' | 'display' | 'monospace';
  previewText?: string;
  googleFont?: boolean; // loaded from Google Fonts
};

// Tab identifiers
type StudioTab = 'page-bg' | 'cover' | 'book-bg';

// ΓöÇΓöÇ Constants ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const tailwindToCssDirection = (dir: string): string => {
  const map: Record<string, string> = {
    "to-r": "to right", "to-l": "to left",
    "to-t": "to top", "to-b": "to bottom",
    "to-tr": "to top right", "to-tl": "to top left",
    "to-br": "to bottom right", "to-bl": "to bottom left",
  };
  return map[dir] || "to right";
};

// Page background presets (applied to the journal background / Layout)
const PAGE_BG_PRESETS: BackgroundOption[] = [
  { type: "gradient", name: "Sunset", value: "linear-gradient(to bottom right, #fed7aa, #fda4af)", className: "bg-gradient-to-br from-orange-200 to-rose-300" },
  { type: "gradient", name: "Ocean", value: "linear-gradient(to bottom right, #7dd3fc, #3b82f6)", className: "bg-gradient-to-br from-sky-300 to-blue-500" },
  { type: "gradient", name: "Forest", value: "linear-gradient(to bottom right, #86efac, #22c55e)", className: "bg-gradient-to-br from-green-300 to-green-500" },
  { type: "gradient", name: "Lavender", value: "linear-gradient(to bottom right, #c4b5fd, #a78bfa)", className: "bg-gradient-to-br from-violet-300 to-violet-400" },
  { type: "gradient", name: "Rose", value: "linear-gradient(to bottom right, #fda4af, #fb7185)", className: "bg-gradient-to-br from-rose-300 to-rose-400" },
  { type: "gradient", name: "Amber", value: "linear-gradient(to bottom right, #fcd34d, #f59e0b)", className: "bg-gradient-to-br from-yellow-300 to-amber-500" },
  { type: "image", name: "Rainbow Blur 1", value: "https://images.unsplash.com/photo-1707742984673-ae30d982bdec?q=80&w=2532&auto=format&fit=crop" },
  { type: "image", name: "Rainbow Blur 2", value: "https://images.unsplash.com/photo-1729575846511-f499d2e17d79?q=80&w=2532&auto=format&fit=crop" },
  { type: "image", name: "Rainbow Blur 3", value: "https://images.unsplash.com/photo-1729601648807-3c45ee96343d?q=80&w=2532&auto=format&fit=crop" },
  { type: "image", name: "Risograph 1", value: "/Risograph1.png" },
  { type: "image", name: "Risograph 2", value: "/Risograph2.png" },
  { type: "image", name: "Risograph 3", value: "/Risograph3.png" },
  { type: "image", name: "Risograph 4", value: "/Risograph4.png" },
];

// Book background (in-page book bg) presets
const BOOK_BG_PRESETS = [
  { id: 'transparent', name: 'Transparent', gradient: 'transparent', isTransparent: true },
  { id: 'theme-default', name: 'Theme', gradient: 'linear-gradient(135deg, hsl(var(--background)), hsl(var(--card)))' },
  { id: 'cream', name: 'Cream', gradient: 'linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%)' },
  { id: 'sunset', name: 'Sunset', gradient: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)' },
  { id: 'ocean', name: 'Ocean', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { id: 'lavender', name: 'Lavender', gradient: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { id: 'mint', name: 'Mint', gradient: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)' },
  { id: 'peach', name: 'Peach', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: 'sky', name: 'Sky', gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
  { id: 'forest', name: 'Forest', gradient: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' },
  { id: 'rose', name: 'Rose', gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' },
  { id: 'autumn', name: 'Autumn', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
];

// Cover styles ΓÇö expanded with fancy templates
const COVER_STYLES: CoverStyle[] = [
  // Classic leather variants
  { id: 'leather', name: 'Classic Leather', variant: 'leather' },
  { id: 'midnight', name: 'Midnight Blue', variant: 'leather', color: '#1a1a3e' },
  { id: 'burgundy', name: 'Burgundy', variant: 'leather', color: '#4a0020' },
  { id: 'forest-green', name: 'Forest Green', variant: 'leather', color: '#0a3d2a' },
  { id: 'charcoal', name: 'Charcoal', variant: 'leather', color: '#2a2a2a' },
  // Template-based covers
  {
    id: 'velvet-rose', name: 'Velvet Ros├⌐', variant: 'template', template: 'velvet-rose',
    gradient: 'linear-gradient(135deg, #3d0c1a 0%, #6b1d3a 30%, #4a1028 60%, #6b1d3a 100%)',
    accentColor: '#e8b4b8', textColor: '#fce4ec', borderStyle: 'double',
  },
  {
    id: 'marble-luxe', name: 'Marble Luxe', variant: 'template', template: 'marble-luxe',
    gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 25%, #f0f0f0 50%, #d5d5d5 75%, #eeeeee 100%)',
    accentColor: '#c9a84c', textColor: '#1a1a1a', borderStyle: 'solid',
  },
  {
    id: 'celestial', name: 'Celestial Night', variant: 'template', template: 'celestial',
    gradient: 'linear-gradient(160deg, #0d0d2b 0%, #1a1a4e 30%, #0f0f35 60%, #161646 100%)',
    accentColor: '#ffd700', textColor: '#e8e8ff', borderStyle: 'solid',
  },
  {
    id: 'botanical', name: 'Vintage Botanical', variant: 'template', template: 'botanical',
    gradient: 'linear-gradient(135deg, #f5f0e6 0%, #ede5d4 50%, #f0ead8 100%)',
    accentColor: '#4a6741', textColor: '#2d3a28', borderStyle: 'solid',
  },
  {
    id: 'art-deco', name: 'Art Deco', variant: 'template', template: 'art-deco',
    gradient: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 50%, #0d0d0d 100%)',
    accentColor: '#d4af37', textColor: '#f0e6c8', borderStyle: 'double',
  },
  {
    id: 'minimalist', name: 'Minimalist', variant: 'template', template: 'minimalist',
    gradient: 'linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)',
    accentColor: '#333333', textColor: '#111111', borderStyle: 'solid',
  },
  {
    id: 'royal-crest', name: 'Royal Crest', variant: 'template', template: 'royal-crest',
    gradient: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b69 40%, #1e0e45 70%, #2d1b69 100%)',
    accentColor: '#ffd700', textColor: '#f0e6ff', borderStyle: 'double',
  },
  {
    id: 'ocean-wave', name: 'Ocean Breeze', variant: 'template', template: 'ocean-wave',
    gradient: 'linear-gradient(160deg, #0c3547 0%, #1a6b7a 30%, #0e4a5c 60%, #1d7f91 100%)',
    accentColor: '#7ee8fa', textColor: '#e0f7fa', borderStyle: 'solid',
  },
  {
    id: 'sakura', name: 'Sakura', variant: 'template', template: 'sakura',
    gradient: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 30%, #fce4ec 60%, #f48fb1 100%)',
    accentColor: '#ad1457', textColor: '#4a0e2a', borderStyle: 'solid',
  },
  {
    id: 'noir', name: 'Noir', variant: 'template', template: 'noir',
    gradient: 'linear-gradient(180deg, #0a0a0a 0%, #1c1c1c 50%, #0f0f0f 100%)',
    accentColor: '#c0c0c0', textColor: '#e0e0e0', borderStyle: 'solid',
  },
  // New templates
  {
    id: 'aurora', name: 'Aurora', variant: 'template', template: 'aurora',
    gradient: 'linear-gradient(160deg, #050d1a 0%, #0a1f3a 30%, #0d2a35 60%, #071020 100%)',
    accentColor: '#00f5d4', textColor: '#e0f7fa', borderStyle: 'solid',
  },
  {
    id: 'parchment', name: 'Ancient Parchment', variant: 'template', template: 'parchment',
    gradient: 'linear-gradient(135deg, #e8d5b0 0%, #d4b896 25%, #e2c99b 50%, #c9a97a 75%, #dcc59e 100%)',
    accentColor: '#6b3a1f', textColor: '#2c1a0e', borderStyle: 'solid',
  },
  {
    id: 'cyberpunk', name: 'Neon Cyberpunk', variant: 'template', template: 'cyberpunk',
    gradient: 'linear-gradient(180deg, #050108 0%, #100020 40%, #0a0018 70%, #080015 100%)',
    accentColor: '#f72585', textColor: '#e0e0ff', borderStyle: 'solid',
  },
  {
    id: 'spring', name: 'Spring Meadow', variant: 'template', template: 'spring',
    gradient: 'linear-gradient(135deg, #f8ffed 0%, #e8f5e9 30%, #f0fff4 60%, #fff9e6 100%)',
    accentColor: '#2e7d32', textColor: '#1b3a1e', borderStyle: 'solid',
  },
  {
    id: 'watercolor', name: 'Watercolor Dream', variant: 'template', template: 'watercolor',
    gradient: 'linear-gradient(135deg, #fef9f0 0%, #fce4f2 30%, #e8f4fe 60%, #f0fef9 100%)',
    accentColor: '#7b5ea7', textColor: '#2d1b4e', borderStyle: 'solid',
  },
];

// Default widgets
export const DEFAULT_WIDGETS: CoverWidget[] = [
  { id: 'w-title', type: 'diary-title', label: 'Diary Title', enabled: true },
  { id: 'w-display-name', type: 'display-name', label: 'Display Name', enabled: true },
  { id: 'w-username', type: 'username', label: 'Username', enabled: true },
  { id: 'w-date', type: 'date', label: 'Date Display', enabled: true },
  { id: 'w-monogram', type: 'monogram', label: 'Monogram', enabled: false, config: { style: 'circle' } },
  { id: 'w-entries', type: 'entry-count', label: 'Entry Counter', enabled: false },
  { id: 'w-quote', type: 'quote', label: 'Cover Quote', enabled: true, config: { text: 'Every page holds a piece of my soul.' } },
  { id: 'w-icon', type: 'icon', label: 'Decorative Icon', enabled: false, config: { icon: 'feather' } },
  { id: 'w-divider', type: 'divider', label: 'Ornamental Divider', enabled: true, config: { style: 'flourish' } },
  { id: 'w-mood', type: 'mood-ring', label: 'Mood Ring', enabled: false, config: { mood: 'calm' } },
  { id: 'w-weather', type: 'weather', label: 'Weather Vibe', enabled: false, config: { weather: 'sunny' } },
  { id: 'w-streak', type: 'streak', label: 'Writing Streak', enabled: false, config: { count: '7' } },
  { id: 'w-constellation', type: 'constellation', label: 'Constellation', enabled: false, config: { pattern: 'orion' } },
  { id: 'w-seal', type: 'wax-seal', label: 'Wax Seal', enabled: false, config: { color: 'crimson' } },
  { id: 'w-progress', type: 'progress-ring', label: 'Goal Progress', enabled: false, config: { goal: '100', current: '0' } },
  { id: 'w-season', type: 'season', label: 'Season Badge', enabled: true },
  { id: 'w-zodiac', type: 'zodiac', label: 'Zodiac Sign', enabled: false, config: { sign: 'pisces' } },
  { id: 'w-stamp', type: 'stamp', label: 'Vintage Stamp', enabled: false, config: { style: 'postmark' } },
  { id: 'w-custom-text', type: 'custom-text', label: 'Custom Label', enabled: false, config: { text: 'My Story' } },
  { id: 'w-bookmark', type: 'bookmark', label: 'Bookmark', enabled: false },
  { id: 'w-affirmation', type: 'affirmation', label: 'Daily Affirmation', enabled: false, config: { text: 'I am enough, I am worthy, I am loved.' } },
];

// Available fonts
const DIARY_FONTS: DiaryFont[] = [
  { id: 'default', name: 'Default', family: 'inherit', category: 'sans-serif' },
  { id: 'cormorant', name: 'Cormorant Garamond', family: "'Cormorant Garamond', Georgia, serif", category: 'serif', googleFont: true },
  { id: 'playfair', name: 'Playfair Display', family: "'Playfair Display', Georgia, serif", category: 'serif', googleFont: true },
  { id: 'lora', name: 'Lora', family: "'Lora', Georgia, serif", category: 'serif', googleFont: true },
  { id: 'merriweather', name: 'Merriweather', family: "'Merriweather', Georgia, serif", category: 'serif', googleFont: true },
  { id: 'eb-garamond', name: 'EB Garamond', family: "'EB Garamond', Georgia, serif", category: 'serif', googleFont: true },
  { id: 'dancing-script', name: 'Dancing Script', family: "'Dancing Script', cursive", category: 'handwriting', googleFont: true },
  { id: 'great-vibes', name: 'Great Vibes', family: "'Great Vibes', cursive", category: 'handwriting', googleFont: true },
  { id: 'caveat', name: 'Caveat', family: "'Caveat', cursive", category: 'handwriting', googleFont: true },
  { id: 'patrick-hand', name: 'Patrick Hand', family: "'Patrick Hand', cursive", category: 'handwriting', googleFont: true },
  { id: 'indie-flower', name: 'Indie Flower', family: "'Indie Flower', cursive", category: 'handwriting', googleFont: true },
  { id: 'satisfy', name: 'Satisfy', family: "'Satisfy', cursive", category: 'handwriting', googleFont: true },
  { id: 'inter', name: 'Inter', family: "'Inter', system-ui, sans-serif", category: 'sans-serif', googleFont: true },
  { id: 'source-code', name: 'Source Code Pro', family: "'Source Code Pro', monospace", category: 'monospace', googleFont: true },
  { id: 'spectral', name: 'Spectral', family: "'Spectral', Georgia, serif", category: 'serif', googleFont: true },
];

// ΓöÇΓöÇ Props ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

interface DiaryStudioProps {
  isOpen: boolean;
  onClose: () => void;
  // Page background (Layout bg)
  onApplyPageBackground: (bg: BackgroundOption) => void;
  currentPageBackground: BackgroundOption;
  // Book background (diary page bg inside the flipbook)
  onApplyBookBackground: (type: string, value: string) => void;
  currentBookBackground: { type: string; value: string };
  // Cover style
  onApplyCoverStyle: (style: CoverStyle) => void;
  currentCoverStyle: CoverStyle;
  // Cover widgets
  onApplyWidgets: (widgets: CoverWidget[]) => void;
  currentWidgets: CoverWidget[];
  // Font
  onApplyFont: (font: DiaryFont) => void;
  currentFont: DiaryFont;
  // Images from journal entries (for page bg tab)
  entryImages?: string[];
  // Diary identity
  diaryTitle: string;
  diaryDisplayName: string;
  showUsername: boolean;
  onDiaryTitleChange: (title: string) => void;
  onDiaryDisplayNameChange: (name: string) => void;
  onShowUsernameChange: (enabled: boolean) => void;
  // Cloud save
  onSaveToCloud: () => Promise<void>;
  isSaving?: boolean;
}

// ΓöÇΓöÇ Component ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const DiaryStudio = ({
  isOpen,
  onClose,
  onApplyPageBackground,
  currentPageBackground,
  onApplyBookBackground,
  currentBookBackground,
  onApplyCoverStyle,
  currentCoverStyle,
  onApplyWidgets,
  currentWidgets,
  onApplyFont,
  currentFont,
  entryImages = [],
  diaryTitle,
  diaryDisplayName,
  showUsername,
  onDiaryTitleChange,
  onDiaryDisplayNameChange,
  onShowUsernameChange,
  onSaveToCloud,
  isSaving = false,
}: DiaryStudioProps) => {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('page-bg');
  
  // Shared upload state
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [journalImages, setJournalImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Cover tab sub-sections
  const [coverSection, setCoverSection] = useState<'templates' | 'widgets' | 'upload'>('templates');
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  
  // Page bg sub-sections
  const [pageBgSection, setPageBgSection] = useState<'presets' | 'uploads' | 'solid' | 'gradient'>('presets');
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [gradientColor1, setGradientColor1] = useState("#FFFFFF");
  const [gradientColor2, setGradientColor2] = useState("#EEEEEE");
  const [gradientDirection, setGradientDirection] = useState("to-br");
  
  // Google Fonts loading
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
  // Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // ΓöÇΓöÇ Undo / Snapshot ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  type SettingsSnapshot = {
    pageBg: BackgroundOption;
    bookBg: { type: string; value: string };
    coverStyle: CoverStyle;
    font: DiaryFont;
    widgets: CoverWidget[];
    title: string;
    displayName: string;
    showUsername: boolean;
  };
  const [undoStack, setUndoStack] = useState<SettingsSnapshot[]>([]);

  /** Capture current settings into the undo stack (called before saving) */
  const captureSnapshot = useCallback(() => {
    const snap: SettingsSnapshot = {
      pageBg: currentPageBackground,
      bookBg: currentBookBackground,
      coverStyle: currentCoverStyle,
      font: currentFont,
      widgets: currentWidgets.map(w => ({ ...w })),
      title: diaryTitle,
      displayName: diaryDisplayName,
      showUsername,
    };
    setUndoStack(prev => [...prev.slice(-9), snap]); // keep last 10
  }, [currentPageBackground, currentBookBackground, currentCoverStyle, currentFont, currentWidgets, diaryTitle, diaryDisplayName, showUsername]);

  /** Wrapped apply helpers that auto-capture before changing */
  const applyPageBg = useCallback((bg: typeof currentPageBackground) => { captureSnapshot(); onApplyPageBackground(bg); }, [captureSnapshot, onApplyPageBackground]);
  const applyCover = useCallback((s: typeof currentCoverStyle) => { captureSnapshot(); onApplyCoverStyle(s); }, [captureSnapshot, onApplyCoverStyle]);
  const applyBookBg = useCallback((t: string, v: string) => { captureSnapshot(); onApplyBookBackground(t, v); }, [captureSnapshot, onApplyBookBackground]);
  const applyFontWrapped = useCallback((f: typeof currentFont) => { captureSnapshot(); onApplyFont(f); }, [captureSnapshot, onApplyFont]);

  /** Pop last snapshot and restore */
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const snap = undoStack[undoStack.length - 1];
    if (!snap) return;
    setUndoStack(prev => prev.slice(0, -1));
    onApplyPageBackground(snap.pageBg);
    onApplyBookBackground(snap.bookBg.type, snap.bookBg.value);
    onApplyCoverStyle(snap.coverStyle);
    onApplyFont(snap.font);
    onApplyWidgets(snap.widgets);
    onDiaryTitleChange(snap.title);
    onDiaryDisplayNameChange(snap.displayName);
    onShowUsernameChange(snap.showUsername);
  }, [undoStack, onApplyPageBackground, onApplyBookBackground, onApplyCoverStyle, onApplyFont, onApplyWidgets, onDiaryTitleChange, onDiaryDisplayNameChange, onShowUsernameChange]);

  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);

  // Fetch uploaded images
  useEffect(() => {
    if (!isOpen) return;
    fetchUploadedImages();
    fetchJournalImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load Google Font on demand
  const loadGoogleFont = useCallback((font: DiaryFont) => {
    if (!font.googleFont || loadedFonts.has(font.id)) return;
    const fontName = font.name.replace(/ /g, '+');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    setLoadedFonts(prev => new Set(prev).add(font.id));
  }, [loadedFonts]);

  // Pre-load all Google Fonts for the font picker
  useEffect(() => {
    if (!isOpen) return;
    const families = DIARY_FONTS
      .filter(f => f.googleFont && !loadedFonts.has(f.id))
      .map(f => f.name.replace(/ /g, '+') + ':wght@400;700')
      .join('&family=');
    if (!families) return;
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    setLoadedFonts(new Set(DIARY_FONTS.filter(f => f.googleFont).map(f => f.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchUploadedImages = async () => {
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: files, error } = await supabase.storage
        .from('users_cloud')
        .list(`backgrounds/${user.id}`, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

      if (!error && files) {
        const urls = files
          .filter(f => !f.name.startsWith('.'))
          .map(f => {
            const { data } = supabase.storage.from('users_cloud').getPublicUrl(`backgrounds/${user.id}/${f.name}`);
            return data.publicUrl;
          });
        setUploadedImages(urls);
      }
    } catch (err) {
      console.error('[DiaryStudio] fetchUploadedImages error:', err);
    }
  };

  const fetchJournalImages = async () => {
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('journal_media')
        .select('public_url')
        .eq('user_id', user.id)
        .eq('media_type', 'image')
        .limit(30);

      if (!error && data) {
        setJournalImages(data.map(m => m.public_url).filter(Boolean));
      }
    } catch (err) {
      console.error('[DiaryStudio] fetchJournalImages error:', err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10MB'); return; }

    setUploading(true);
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `bg_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `backgrounds/${user.id}/${fileName}`;
      const { error } = await supabase.storage.from('users_cloud').upload(filePath, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('users_cloud').getPublicUrl(filePath);
      setUploadedImages(prev => [publicUrl, ...prev]);
      
      // Apply based on which tab we're on
      if (activeTab === 'page-bg') {
        applyPageBg({ type: 'image', name: file.name, value: publicUrl });
      } else if (activeTab === 'book-bg') {
        applyBookBg('image', publicUrl);
      } else if (activeTab === 'cover') {
        applyCover({ id: 'custom', name: 'Custom Cover', variant: 'custom', imageUrl: publicUrl });
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Page bg helpers
  const isPageBgSelected = (bg: BackgroundOption) => {
    if (currentPageBackground.type !== bg.type) return false;
    if (bg.type === "customGradient" && currentPageBackground.type === "customGradient") {
      return JSON.stringify(currentPageBackground.value) === JSON.stringify(bg.value);
    }
    return currentPageBackground.value === bg.value;
  };

  const getPageBgStyle = (bg: BackgroundOption): React.CSSProperties => {
    if (bg.type === "image") return { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' as const };
    if (bg.type === "solid") return { backgroundColor: bg.value };
    if (bg.type === "gradient") return { backgroundImage: bg.value };
    if (bg.type === "customGradient") {
      const { color1, color2, direction } = bg.value;
      return { backgroundImage: `linear-gradient(${tailwindToCssDirection(direction)}, ${color1}, ${color2})` };
    }
    return {};
  };

  // ΓöÇΓöÇ Tab Content Renderers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderPageBgTab = () => (
    <div className="space-y-5">
      {/* Sub-sections */}
      <div className="flex flex-wrap gap-1.5">
        {(['presets', 'uploads', 'solid', 'gradient'] as const).map(s => (
          <button
            key={s}
            onClick={() => setPageBgSection(s)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize"
            style={{
              fontFamily: 'Georgia, serif',
              backgroundColor: pageBgSection === s ? '#8b7355' : '#f0e8d8',
              color: pageBgSection === s ? '#faf6ef' : '#7a6543',
              border: `1px solid ${pageBgSection === s ? '#8b7355' : '#c9b896'}`,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {pageBgSection === 'presets' && (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>Gradients</h4>
          <div className="grid grid-cols-3 gap-2.5">
            {PAGE_BG_PRESETS.filter(b => b.type === 'gradient').map((bg, i) => (
              <button
                key={i}
                onClick={() => applyPageBg(bg)}
                className={`aspect-square rounded-xl transition-all duration-200 border-2 overflow-hidden ${
                  isPageBgSelected(bg) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95 border-primary' : 'border-border/40 hover:border-primary/50 hover:scale-[0.97]'
                }`}
                style={getPageBgStyle(bg)}
              >
                <div className="h-full w-full flex items-end p-1.5">
                  <span className="text-[10px] font-bold text-white drop-shadow-md px-1.5 py-0.5 rounded bg-black/30 backdrop-blur-sm">
                    {bg.name}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <h4 className="text-xs font-semibold uppercase tracking-wide pt-2" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>Images</h4>
          <div className="grid grid-cols-3 gap-2.5">
            {PAGE_BG_PRESETS.filter(b => b.type === 'image').map((bg, i) => (
              <button
                key={i}
                onClick={() => applyPageBg(bg)}
                className={`aspect-square rounded-xl transition-all duration-200 border-2 overflow-hidden ${
                  isPageBgSelected(bg) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95 border-primary' : 'border-border/40 hover:border-primary/50 hover:scale-[0.97]'
                }`}
                style={getPageBgStyle(bg)}
              />
            ))}
          </div>

          {/* Journal images */}
          {(entryImages.length > 0 || journalImages.length > 0) && (
            <>
              <h4 className="text-xs font-semibold uppercase tracking-wide pt-2" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>From Your Entries</h4>
              <div className="grid grid-cols-3 gap-2.5 max-h-48 overflow-y-auto">
                {[...new Set([...entryImages, ...journalImages])].map((url, i) => (
                  <button
                    key={i}
                    onClick={() => applyPageBg({ type: 'image', name: `Entry ${i + 1}`, value: url })}
                    className={`aspect-square rounded-xl transition-all duration-200 border-2 overflow-hidden ${
                      currentPageBackground.type === 'image' && currentPageBackground.value === url ? 'ring-2 ring-primary scale-95 border-primary' : 'border-border/40 hover:border-primary/50 hover:scale-[0.97]'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {pageBgSection === 'uploads' && (
        <div className="space-y-4">
          <label className="block cursor-pointer">
            <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl text-sm transition-colors" style={{ borderColor: '#c9b896', color: '#7a6543' }}>
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload Background Image'}
            </div>
          </label>
          {uploadedImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-2.5 max-h-64 overflow-y-auto">
              {uploadedImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => applyPageBg({ type: 'image', name: `Upload ${i + 1}`, value: url })}
                  className={`aspect-square rounded-xl transition-all duration-200 border-2 overflow-hidden ${
                    currentPageBackground.type === 'image' && currentPageBackground.value === url ? 'ring-2 ring-primary scale-95 border-primary' : 'border-border/40 hover:scale-[0.97]'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: '#9a8b72' }}>
              <Upload className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>No uploads yet</p>
            </div>
          )}
        </div>
      )}

      {pageBgSection === 'solid' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0">
              <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)} className="w-12 h-12 cursor-pointer -translate-x-0.5 -translate-y-0.5" />
            </div>
            <input type="text" value={customColor} onChange={e => setCustomColor(e.target.value)} placeholder="#FFFFFF" className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
          <div className="h-24 rounded-xl border-2 border-border/40" style={{ backgroundColor: customColor }} />
          <Button className="w-full rounded-xl" onClick={() => applyPageBg({ type: 'solid', name: 'Custom', value: customColor })}>
            Apply Color
          </Button>
        </div>
      )}

      {pageBgSection === 'gradient' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">Color 1</label>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded overflow-hidden border border-border shrink-0">
                  <input type="color" value={gradientColor1} onChange={e => setGradientColor1(e.target.value)} className="w-10 h-10 cursor-pointer -translate-x-0.5 -translate-y-0.5" />
                </div>
                <input type="text" value={gradientColor1} onChange={e => setGradientColor1(e.target.value)} className="flex-1 px-2 py-1.5 border border-border rounded text-xs bg-background" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Color 2</label>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded overflow-hidden border border-border shrink-0">
                  <input type="color" value={gradientColor2} onChange={e => setGradientColor2(e.target.value)} className="w-10 h-10 cursor-pointer -translate-x-0.5 -translate-y-0.5" />
                </div>
                <input type="text" value={gradientColor2} onChange={e => setGradientColor2(e.target.value)} className="flex-1 px-2 py-1.5 border border-border rounded text-xs bg-background" />
              </div>
            </div>
          </div>
          <select value={gradientDirection} onChange={e => setGradientDirection(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
            <option value="to-r">Left ΓåÆ Right</option>
            <option value="to-b">Top ΓåÆ Bottom</option>
            <option value="to-br">Top-Left ΓåÆ Bottom-Right</option>
            <option value="to-tr">Bottom-Left ΓåÆ Top-Right</option>
          </select>
          <div className="h-24 rounded-xl border-2 border-border/40" style={{ backgroundImage: `linear-gradient(${tailwindToCssDirection(gradientDirection)}, ${gradientColor1}, ${gradientColor2})` }} />
          <Button className="w-full rounded-xl" onClick={() => applyPageBg({ type: 'customGradient', name: 'Custom', value: { color1: gradientColor1, color2: gradientColor2, direction: gradientDirection } })}>
            Apply Gradient
          </Button>
        </div>
      )}
    </div>
  );

  const renderCoverTab = () => {
    // --- Helper: toggle a widget ---
    const toggleWidget = (widgetId: string) => {
      const updated = currentWidgets.map(w =>
        w.id === widgetId ? { ...w, enabled: !w.enabled } : w
      );
      onApplyWidgets(updated);
    };

    // --- Helper: update widget config ---
    const updateWidgetConfig = (widgetId: string, key: string, value: string) => {
      const updated = currentWidgets.map(w =>
        w.id === widgetId ? { ...w, config: { ...w.config, [key]: value } } : w
      );
      onApplyWidgets(updated);
    };

    // --- Widget icon mapping ---
    const getWidgetIcon = (type: CoverWidgetType) => {
      switch (type) {
        case 'diary-title': return <BookOpen className="h-4 w-4" />;
        case 'display-name': return <Type className="h-4 w-4" />;
        case 'username': return <Hash className="h-4 w-4" />;
        case 'date': return <Clock className="h-4 w-4" />;
        case 'monogram': return <Type className="h-4 w-4" />;
        case 'entry-count': return <Hash className="h-4 w-4" />;
        case 'quote': return <Quote className="h-4 w-4" />;
        case 'icon': return <Feather className="h-4 w-4" />;
        case 'divider': return <GripVertical className="h-4 w-4" />;
        case 'mood-ring': return <Heart className="h-4 w-4" />;
        case 'weather': return <CloudSun className="h-4 w-4" />;
        case 'streak': return <Flame className="h-4 w-4" />;
        case 'constellation': return <Star className="h-4 w-4" />;
        case 'wax-seal': return <CircleDot className="h-4 w-4" />;
        case 'progress-ring': return <Target className="h-4 w-4" />;
        case 'season': return <Sun className="h-4 w-4" />;
        case 'zodiac': return <Compass className="h-4 w-4" />;
        case 'stamp': return <Stamp className="h-4 w-4" />;
        default: return <Star className="h-4 w-4" />;
      }
    };

    // --- Template preview renderer ---
    const getTemplatePreviewStyle = (style: CoverStyle): React.CSSProperties => {
      if (style.variant === 'custom' && style.imageUrl) {
        return { backgroundImage: `url(${style.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
      }
      if (style.variant === 'template' && style.gradient) {
        return { backgroundImage: style.gradient };
      }
      if (style.variant === 'leather') {
        const base = style.color || '#2d1f14';
        return { backgroundImage: `linear-gradient(135deg, ${base} 0%, ${adjustBrightness(base, 30)} 50%, ${base} 100%)` };
      }
      return { backgroundImage: 'linear-gradient(135deg, #2d1f14 0%, #4a3728 50%, #2d1f14 100%)' };
    };

    return (
      <div className="space-y-5">
        {/* Sub-section tabs */}
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ backgroundColor: '#ebe3d4' }}>
          {([
            { key: 'templates' as const, label: 'Templates', icon: <Zap className="h-3.5 w-3.5" /> },
            { key: 'widgets' as const, label: 'Widgets', icon: <Star className="h-3.5 w-3.5" /> },
            { key: 'upload' as const, label: 'Custom', icon: <Upload className="h-3.5 w-3.5" /> },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => setCoverSection(s.key)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                fontFamily: 'Georgia, serif',
                backgroundColor: coverSection === s.key ? '#faf6ef' : 'transparent',
                color: coverSection === s.key ? '#4a3a28' : '#9a8b72',
                boxShadow: coverSection === s.key ? '0 1px 3px rgba(80,60,30,0.1)' : 'none',
              }}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* ΓöÇΓöÇ Templates Section ΓöÇΓöÇ */}
        {coverSection === 'templates' && (
          <div className="space-y-4">
            {/* Leather Classics */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>
                <BookOpen className="h-3 w-3" />
                Classic Leather
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {COVER_STYLES.filter(s => s.variant === 'leather').map(style => (
                  <button
                    key={style.id}
                    onClick={() => applyCover(style)}
                    className={`group relative aspect-3/4 rounded-xl overflow-hidden transition-all duration-200 border-2 ${
                      currentCoverStyle.id === style.id
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95 border-primary'
                        : 'border-border/30 hover:scale-[0.97] hover:border-primary/40 hover:shadow-lg'
                    }`}
                    style={getTemplatePreviewStyle(style)}
                  >
                    {/* Texture overlay */}
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
                    }} />
                    {/* Gold accent line */}
                    <div className="absolute inset-2 rounded-lg border border-amber-600/30" />
                    {/* Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                      <span className="text-[9px] font-semibold text-white/90 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm">
                        {style.name}
                      </span>
                    </div>
                    {currentCoverStyle.id === style.id && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Fancy Templates */}
            <div className="space-y-2.5 pt-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>
                <Zap className="h-3 w-3" />
                Designer Templates
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                {COVER_STYLES.filter(s => s.variant === 'template').map(style => (
                  <button
                    key={style.id}
                    onClick={() => applyCover(style)}
                    className={`group relative h-36 rounded-xl overflow-hidden transition-all duration-200 border-2 ${
                      currentCoverStyle.id === style.id
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[0.96] border-primary'
                        : 'border-border/30 hover:scale-[0.97] hover:border-primary/40 hover:shadow-xl'
                    }`}
                    style={getTemplatePreviewStyle(style)}
                  >
                    {/* Template-specific decorative overlay */}
                    {style.template === 'celestial' && (
                      <div className="absolute inset-0 overflow-hidden">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="absolute rounded-full bg-white" style={{
                            width: `${2 + (i % 3)}px`, height: `${2 + (i % 3)}px`,
                            top: `${10 + (i * 11) % 80}%`, left: `${5 + (i * 13) % 90}%`,
                            opacity: 0.3 + (i % 4) * 0.15,
                          }} />
                        ))}
                      </div>
                    )}
                    {style.template === 'art-deco' && (
                      <div className="absolute inset-3 border border-amber-500/30 rounded-sm">
                        <div className="absolute inset-1 border border-amber-500/15 rounded-sm" />
                      </div>
                    )}
                    {style.template === 'sakura' && (
                      <div className="absolute inset-0 overflow-hidden opacity-40">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="absolute text-pink-600" style={{
                            top: `${10 + i * 18}%`, left: `${15 + (i * 19) % 70}%`,
                            fontSize: `${10 + i * 2}px`, transform: `rotate(${i * 45}deg)`,
                          }}>Γ¥Ç</div>
                        ))}
                      </div>
                    )}
                    {style.template === 'botanical' && (
                      <div className="absolute inset-3 border border-green-800/20 rounded-lg">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-green-800/30 text-[10px]">Γ¥º</div>
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-green-800/30 text-[10px] rotate-180">Γ¥º</div>
                      </div>
                    )}
                    {style.template === 'marble-luxe' && (
                      <div className="absolute inset-0 opacity-[0.15]" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.015' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)'/%3E%3C/svg%3E")`
                      }} />
                    )}
                    {style.template === 'minimalist' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-px bg-gray-400/40" />
                      </div>
                    )}
                    {style.template === 'ocean-wave' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-20" style={{
                        background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(126,232,250,0.3) 4px, rgba(126,232,250,0.3) 6px)',
                      }} />
                    )}
                    {style.template === 'velvet-rose' && (
                      <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='v'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23v)'/%3E%3C/svg%3E")`
                      }} />
                    )}
                    {/* Border accent */}
                    {style.accentColor && (
                      <div className="absolute inset-2 rounded-lg" style={{
                        border: `1px ${style.borderStyle || 'solid'} ${style.accentColor}33`,
                      }} />
                    )}
                    {/* Name & accent indicator */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{
                        backgroundColor: `${style.accentColor}22`,
                        border: `1px solid ${style.accentColor}44`,
                      }}>
                        <Zap className="h-3 w-3" style={{ color: style.accentColor }} />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm" style={{
                        color: style.textColor,
                        backgroundColor: style.template === 'minimalist' || style.template === 'botanical' || style.template === 'marble-luxe'
                          ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.35)',
                      }}>
                        {style.name}
                      </span>
                    </div>
                    {currentCoverStyle.id === style.id && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ΓöÇΓöÇ Widgets Section ΓöÇΓöÇ */}
        {coverSection === 'widgets' && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              Toggle widgets to display on your diary cover. Tap a widget to configure it.
            </p>

            <div className="space-y-2">
              {currentWidgets.map(widget => (
                <div key={widget.id} className="rounded-xl overflow-hidden transition-all duration-200" style={{ border: '1px solid #d4c5a9', backgroundColor: '#faf6ef' }}>
                  {/* Widget row */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{
                      backgroundColor: widget.enabled ? 'rgba(139,115,85,0.12)' : '#ebe3d4',
                      color: widget.enabled ? '#7a6543' : '#9a8b72',
                    }}>
                      {getWidgetIcon(widget.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{widget.label}</span>
                      <span className="text-[10px] capitalize" style={{ color: '#9a8b72' }}>{widget.type.replace('-', ' ')}</span>
                    </div>
                    {/* Config button */}
                    {(widget.type === 'quote' || widget.type === 'icon' || widget.type === 'monogram' || widget.type === 'mood-ring' || widget.type === 'divider' || widget.type === 'weather' || widget.type === 'streak' || widget.type === 'constellation' || widget.type === 'wax-seal' || widget.type === 'progress-ring' || widget.type === 'zodiac' || widget.type === 'stamp') && (
                      <button
                        onClick={() => setEditingWidget(editingWidget === widget.id ? null : widget.id)}
                        className="p-1.5 rounded-md transition-colors shrink-0" style={{ color: '#9a8b72' }}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                        </svg>
                      </button>
                    )}
                    {/* Toggle */}
                    <button
                      onClick={() => toggleWidget(widget.id)}
                      className="relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0"
                      style={{ backgroundColor: widget.enabled ? '#7a6543' : '#c9b896' }}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        widget.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Expanded config panel */}
                  {editingWidget === widget.id && (
                    <div className="px-3 pb-3 pt-1 space-y-2.5" style={{ borderTop: '1px solid #d4c5a9', backgroundColor: '#f5ede0' }}>
                      {widget.type === 'quote' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Quote Text</label>
                          <textarea
                            value={widget.config?.text || ''}
                            onChange={e => updateWidgetConfig(widget.id, 'text', e.target.value)}
                            rows={2}
                            className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                            placeholder="Enter your cover quote..."
                          />
                        </div>
                      )}
                      {widget.type === 'icon' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Icon Style</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: 'feather', icon: '≡ƒ¬╢', label: 'Feather' },
                              { id: 'star', icon: 'Γ¡É', label: 'Star' },
                              { id: 'heart', icon: 'Γ¥ñ∩╕Å', label: 'Heart' },
                              { id: 'moon', icon: '≡ƒîÖ', label: 'Moon' },
                              { id: 'flower', icon: '≡ƒî╕', label: 'Flower' },
                              { id: 'diamond', icon: '≡ƒÆÄ', label: 'Diamond' },
                              { id: 'butterfly', icon: '≡ƒªï', label: 'Butterfly' },
                              { id: 'crown', icon: '≡ƒææ', label: 'Crown' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'icon', opt.id)}
                                className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 transition-colors ${
                                  widget.config?.icon === opt.id
                                    ? 'bg-primary/15 border border-primary/30 text-foreground'
                                    : 'border border-transparent'
                                }`}
                              >
                                <span>{opt.icon}</span>
                                <span className="text-[10px]">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'monogram' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Monogram Style</label>
                          <div className="flex gap-1.5">
                            {[
                              { id: 'circle', label: 'Circle' },
                              { id: 'diamond', label: 'Diamond' },
                              { id: 'square', label: 'Square' },
                              { id: 'plain', label: 'Plain' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'style', opt.id)}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                  widget.config?.style === opt.id
                                    ? 'bg-primary/15 border border-primary/30 text-foreground'
                                    : 'border border-transparent'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'mood-ring' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Mood</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: 'calm', color: '#7ec8e3', label: '≡ƒÿî Calm' },
                              { id: 'happy', color: '#ffd700', label: '≡ƒÿè Happy' },
                              { id: 'focus', color: '#9b59b6', label: '≡ƒºá Focus' },
                              { id: 'creative', color: '#ff6b6b', label: 'Γ£¿ Creative' },
                              { id: 'grateful', color: '#2ecc71', label: '≡ƒÖÅ Grateful' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'mood', opt.id)}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                  widget.config?.mood === opt.id
                                    ? 'bg-primary/15 border border-primary/30'
                                    : 'bg-muted/40 border border-transparent'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'divider' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Divider Style</label>
                          <div className="flex gap-1.5">
                            {[
                              { id: 'flourish', label: 'Γ¥º Flourish' },
                              { id: 'line', label: 'ΓöÇΓöÇ Line' },
                              { id: 'dots', label: 'ΓÇó ΓÇó ΓÇó Dots' },
                              { id: 'stars', label: 'Γ£ª Stars' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'style', opt.id)}
                                className={`flex-1 px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                  widget.config?.style === opt.id
                                    ? 'bg-primary/15 border border-primary/30'
                                    : 'bg-muted/40 border border-transparent'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'weather' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Weather</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: 'sunny', icon: 'ΓÿÇ∩╕Å', label: 'Sunny' },
                              { id: 'cloudy', icon: 'Γÿü∩╕Å', label: 'Cloudy' },
                              { id: 'rainy', icon: '≡ƒîº∩╕Å', label: 'Rainy' },
                              { id: 'stormy', icon: 'Γ¢ê∩╕Å', label: 'Stormy' },
                              { id: 'snowy', icon: 'Γ¥ä∩╕Å', label: 'Snowy' },
                              { id: 'starry', icon: '≡ƒîÖ', label: 'Starry' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'weather', opt.id)}
                                className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 transition-colors ${
                                  widget.config?.weather === opt.id
                                    ? 'bg-primary/15 border border-primary/30 text-foreground'
                                    : 'border border-transparent'
                                }`}
                              >
                                <span>{opt.icon}</span>
                                <span className="text-[10px]">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'streak' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Streak Days</label>
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={widget.config?.count || '7'}
                            onChange={e => updateWidgetConfig(widget.id, 'count', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                      )}
                      {widget.type === 'constellation' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Pattern</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: 'orion', label: 'Γ£ª Orion' },
                              { id: 'big-dipper', label: 'Γ£ª Big Dipper' },
                              { id: 'cassiopeia', label: 'Γ£ª Cassiopeia' },
                              { id: 'lyra', label: 'Γ£ª Lyra' },
                              { id: 'random', label: 'Γ£ª Random' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'pattern', opt.id)}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                  widget.config?.pattern === opt.id
                                    ? 'bg-primary/15 border border-primary/30'
                                    : 'bg-muted/40 border border-transparent'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'wax-seal' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Seal Color</label>
                          <div className="flex gap-1.5">
                            {[
                              { id: 'crimson', color: '#8b0000', label: 'Crimson' },
                              { id: 'gold', color: '#b8860b', label: 'Gold' },
                              { id: 'navy', color: '#1a1a5e', label: 'Navy' },
                              { id: 'emerald', color: '#005c3a', label: 'Emerald' },
                              { id: 'bronze', color: '#6b4423', label: 'Bronze' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'color', opt.id)}
                                className={`flex-1 px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                  widget.config?.color === opt.id
                                    ? 'bg-primary/15 border border-primary/30'
                                    : 'bg-muted/40 border border-transparent'
                                }`}
                              >
                                <div className="w-3 h-3 rounded-full mx-auto mb-0.5" style={{ backgroundColor: opt.color }} />
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'progress-ring' && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Goal (entries)</label>
                            <input
                              type="number"
                              min="1"
                              max="9999"
                              value={widget.config?.goal || '100'}
                              onChange={e => updateWidgetConfig(widget.id, 'goal', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                          </div>
                        </div>
                      )}
                      {widget.type === 'zodiac' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Sign</label>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { id: 'aries', label: 'ΓÖê' }, { id: 'taurus', label: 'ΓÖë' },
                              { id: 'gemini', label: 'ΓÖè' }, { id: 'cancer', label: 'ΓÖï' },
                              { id: 'leo', label: 'ΓÖî' }, { id: 'virgo', label: 'ΓÖì' },
                              { id: 'libra', label: 'ΓÖÄ' }, { id: 'scorpio', label: 'ΓÖÅ' },
                              { id: 'sagittarius', label: 'ΓÖÉ' }, { id: 'capricorn', label: 'ΓÖæ' },
                              { id: 'aquarius', label: 'ΓÖÆ' }, { id: 'pisces', label: 'ΓÖô' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'sign', opt.id)}
                                className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors ${
                                  widget.config?.sign === opt.id
                                    ? 'bg-primary/15 border border-primary/30'
                                    : 'bg-muted/40 border border-transparent hover:bg-muted/60'
                                }`}
                                title={opt.id}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'stamp' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Stamp Style</label>
                          <div className="flex gap-1.5">
                            {[
                              { id: 'postmark', label: 'Postmark' },
                              { id: 'passport', label: 'Passport' },
                              { id: 'library', label: 'Library' },
                              { id: 'confidential', label: 'Secret' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => updateWidgetConfig(widget.id, 'style', opt.id)}
                                className={`flex-1 px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                  widget.config?.style === opt.id
                                    ? 'bg-primary/15 border border-primary/30'
                                    : 'bg-muted/40 border border-transparent'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {widget.type === 'custom-text' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Label Text</label>
                          <input
                            type="text"
                            maxLength={40}
                            value={widget.config?.text || 'My Story'}
                            onChange={e => updateWidgetConfig(widget.id, 'text', e.target.value)}
                            placeholder="My Story"
                            className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                      )}
                      {widget.type === 'affirmation' && (
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Affirmation Text</label>
                          <textarea
                            maxLength={100}
                            rows={2}
                            value={widget.config?.text || 'I am enough, I am worthy, I am loved.'}
                            onChange={e => updateWidgetConfig(widget.id, 'text', e.target.value)}
                            placeholder="I am enough..."
                            className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ΓöÇΓöÇ Custom Upload Section ΓöÇΓöÇ */}
        {coverSection === 'upload' && (
          <div className="space-y-4">
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-xl transition-colors" style={{ borderColor: '#c9b896', color: '#7a6543', backgroundColor: '#faf6ef' }}>
                <Upload className="h-6 w-6 opacity-50" />
                <span className="text-sm font-medium" style={{ fontFamily: 'Georgia, serif' }}>{uploading ? 'Uploading...' : 'Upload Cover Image'}</span>
                <span className="text-[10px]" style={{ color: '#9a8b72' }}>JPG, PNG, WebP ΓÇö max 10MB</span>
              </div>
            </label>

            {uploadedImages.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>Your Uploads</h4>
                <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                  {uploadedImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => applyCover({ id: `custom-${i}`, name: 'Custom', variant: 'custom', imageUrl: url })}
                      className={`aspect-3/4 rounded-lg overflow-hidden border-2 transition-all ${
                        currentCoverStyle.variant === 'custom' && currentCoverStyle.imageUrl === url ? 'ring-2 ring-primary scale-95 border-primary' : 'border-border/40 hover:scale-[0.97]'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderBookBgTab = () => (
    <div className="space-y-5">

      {/* ΓöÇΓöÇ Diary Identity ΓöÇΓöÇ */}
      <div className="space-y-3 p-3 rounded-xl" style={{ backgroundColor: '#f5ede0', border: '1px solid #c9b896' }}>
        <h4 className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#4a3a28', fontFamily: 'Georgia, serif' }}>
          <Type className="h-3.5 w-3.5" style={{ color: '#7a6543' }} />
          Diary Identity
        </h4>
        <div className="space-y-2.5">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Cover Title</label>
            <input
              type="text"
              maxLength={40}
              value={diaryTitle}
              onChange={e => onDiaryTitleChange(e.target.value)}
              placeholder="Personal Diary"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ border: '1px solid #c9b896', backgroundColor: '#faf6ef', color: '#4a3a28', fontFamily: 'Georgia, serif' }}
            />
            <p className="text-[10px] mt-0.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Shown at the top of your cover page</p>
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Display Name</label>
            <input
              type="text"
              maxLength={40}
              value={diaryDisplayName}
              onChange={e => onDiaryDisplayNameChange(e.target.value)}
              placeholder="Your Name"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ border: '1px solid #c9b896', backgroundColor: '#faf6ef', color: '#4a3a28', fontFamily: 'Georgia, serif' }}
            />
            <p className="text-[10px] mt-0.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Name shown on the nameplate (leave blank to use your account name)</p>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-[#d4c5a9] bg-[#faf6ef] px-3 py-2">
            <span>
              <span className="block text-[10px] font-medium uppercase tracking-wider" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Username</span>
              <span className="block text-[10px] mt-0.5" style={{ color: '#9a8b72', fontFamily: 'Georgia, serif' }}>Hide your @username from the cover</span>
            </span>
            <input
              type="checkbox"
              checked={showUsername}
              onChange={e => onShowUsernameChange(e.target.checked)}
              className="h-4 w-4 rounded border-[#c9b896] text-primary focus:ring-primary/40"
            />
          </label>
        </div>
        <button
          onClick={async () => {
            captureSnapshot();
            setSaveStatus('saving');
            try {
              await onSaveToCloud();
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2500);
            } catch {
              setSaveStatus('error');
              setTimeout(() => setSaveStatus('idle'), 2500);
            }
          }}
          disabled={saveStatus === 'saving' || isSaving}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
          style={{
            backgroundColor: '#7a6543',
            color: '#faf6ef',
            fontFamily: 'Georgia, serif',
            border: '1px solid #5a4a33',
            boxShadow: '0 2px 6px rgba(80,60,30,0.2)',
          }}
        >
          {saveStatus === 'saving' || isSaving ? (
            <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
          ) : saveStatus === 'saved' ? (
            <><Check className="h-3.5 w-3.5" />Saved to Cloud!</>
          ) : saveStatus === 'error' ? (
            <><X className="h-3.5 w-3.5" />Save failed ΓÇö try again</>
          ) : (
            <><Save className="h-3.5 w-3.5" />Save All to Cloud</>
          )}
        </button>
      </div>
      {/* Book page presets */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>Book Page Background</h4>
        <div className="grid grid-cols-2 gap-2.5">
          {BOOK_BG_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => applyBookBg('preset', preset.gradient)}
              className={`group relative h-20 rounded-xl overflow-hidden transition-all duration-200 ${
                currentBookBackground.type === 'preset' && currentBookBackground.value === preset.gradient
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95'
                  : 'hover:scale-[0.97] hover:shadow-md'
              }`}
              style={{
                background: preset.isTransparent
                  ? 'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 16px 16px'
                  : preset.gradient,
              }}
            >
              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/90 text-gray-800 shadow-sm">
                  {preset.name}
                </span>
              </div>
              {currentBookBackground.type === 'preset' && currentBookBackground.value === preset.gradient && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upload for book bg */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>Custom Image</h4>
        <label className="block cursor-pointer">
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl text-sm transition-colors" style={{ borderColor: '#c9b896', color: '#7a6543' }}>
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload Image'}
          </div>
        </label>
        {uploadedImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {uploadedImages.map((url, i) => (
              <button
                key={i}
                onClick={() => applyBookBg('image', url)}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  currentBookBackground.type === 'image' && currentBookBackground.value === url ? 'ring-2 ring-primary scale-95 border-primary' : 'border-border/40 hover:scale-[0.97]'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Selection */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#8b7355', fontFamily: 'Georgia, serif' }}>
          <Type className="h-3.5 w-3.5" />
          Diary Font
        </h4>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {DIARY_FONTS.map(font => (
            <button
              key={font.id}
              onClick={() => {
                loadGoogleFont(font);
                applyFontWrapped(font);
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 flex items-center justify-between"
              style={{
                backgroundColor: currentFont.id === font.id ? 'rgba(139,115,85,0.12)' : 'transparent',
                border: currentFont.id === font.id ? '1px solid #c9b896' : '1px solid transparent',
                color: '#4a3a28',
              }}
            >
              <div>
                <span className="text-sm font-medium block" style={{ fontFamily: font.family }}>
                  {font.name}
                </span>
                <span className="text-[10px] capitalize" style={{ color: '#9a8b72' }}>{font.category}</span>
              </div>
              <span className="text-base" style={{ fontFamily: font.family }}>
                Aa
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ΓöÇΓöÇ Main Render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const TABS: { id: StudioTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'page-bg', label: 'Wallpaper', shortLabel: 'Wall', icon: <Palette className="h-3.5 w-3.5" /> },
    { id: 'cover', label: 'Cover', shortLabel: 'Cover', icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: 'book-bg', label: 'Studio', shortLabel: 'Studio', icon: <Zap className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      className={`fixed right-0 top-0 h-full w-full sm:w-[26rem] z-50 flex flex-col transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{
        backgroundImage: 'linear-gradient(180deg, #faf6ef 0%, #f5ede0 40%, #f0e8d8 100%)',
        borderLeft: '1px solid #d4c5a9',
        boxShadow: '-4px 0 24px rgba(80, 60, 30, 0.15)',
      }}
    >
        {/* ΓöÇΓöÇ Nostalgic Header ΓöÇΓöÇ */}
        <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: '2px solid #c9b896' }}>
          {/* Ornamental top line */}
          <div className="flex items-center justify-center mb-2 opacity-40" style={{ color: '#8b7355' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.3em' }}>Γ£ª ΓöÇΓöÇΓöÇ Γ£ª ΓöÇΓöÇΓöÇ Γ£ª</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{
                border: '1.5px solid #b8a07a',
                backgroundColor: '#f5ede0',
              }}>
                <BookOpen className="h-4 w-4" style={{ color: '#7a6543' }} />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-wide" style={{ color: '#4a3a28', fontFamily: 'Georgia, serif', letterSpacing: '0.05em' }}>
                  Diary Studio
                </h2>
                <p style={{ color: '#9a8b72', fontSize: '10px', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
                  Craft your journal&apos;s character
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Undo button */}
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title={undoStack.length > 0 ? `Undo (${undoStack.length} steps)` : 'Nothing to undo'}
                className="h-8 w-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{
                  border: '1px solid #c9b89688',
                  backgroundColor: undoStack.length > 0 ? '#f5ede0' : 'transparent',
                  color: '#7a6543',
                }}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full flex items-center justify-center transition-colors"
                style={{ border: '1px solid #c9b89688', color: '#7a6543' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ΓöÇΓöÇ Vintage Tabs ΓöÇΓöÇ */}
        <div className="flex shrink-0" style={{ borderBottom: '1px solid #d4c5a9', backgroundColor: '#f0e8d8' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2.5 px-2 text-xs font-medium transition-all relative"
              style={{
                color: activeTab === tab.id ? '#4a3a28' : '#9a8b72',
                fontFamily: 'Georgia, serif',
                fontWeight: activeTab === tab.id ? 700 : 400,
                backgroundColor: activeTab === tab.id ? '#faf6ef' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #8b7355' : '2px solid transparent',
              }}
            >
              <div className="flex items-center justify-center gap-1.5">
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </div>
            </button>
          ))}
        </div>

        {/* ΓöÇΓöÇ Content ΓöÇΓöÇ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5" style={{ color: '#4a3a28' }}>
          {activeTab === 'page-bg' && renderPageBgTab()}
          {activeTab === 'cover' && renderCoverTab()}
          {activeTab === 'book-bg' && renderBookBgTab()}
        </div>

        {/* ΓöÇΓöÇ Bottom Ornament ΓöÇΓöÇ */}
        <div className="shrink-0 py-2 text-center opacity-30" style={{ borderTop: '1px solid #d4c5a9', color: '#8b7355' }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.4em', fontFamily: 'Georgia, serif' }}>Γ¥º DIARY STUDIO Γ¥º</span>
        </div>
    </div>
  );
};

export default DiaryStudio;

// ΓöÇΓöÇ Helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
