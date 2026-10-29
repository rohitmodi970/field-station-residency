// constants/navigation.ts

import {
  Home,
  ScanLine,
  Shield,
  Settings,
  Bell,
  FileText,
  BookOpen,
  GalleryHorizontal,
  Image as ImageIcon,
  BarChart3,
  Mic,
  TrendingUp,
  PenLine,
  ChartPie,
  LucideIcon,
  Folder,
  CalendarClockIcon,
  ListTodo,
  Zap,
  Sparkles,
  Users,
} from 'lucide-react';

// Type for NavItem (can also import from types/navigation.ts)
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
}

// ============================================
// GLOBAL ITEMS - Always visible in navbar
// ============================================

// Left side of navbar (before context items)
export const GLOBAL_NAV_LEFT: NavItem[] = [
    { 
        id: 'home', 
        label: 'Home', 
        href: '/dashboard', 
        icon: Home 
    },
    { 
        id: 'journal', 
        label: 'Journal', 
        href: '/journal', 
        icon: PenLine 
    },
    { 
        id: 'analysis', 
      label: 'Insights', 
        href: '/analysis', 
        icon: ChartPie 
    },
    {
        id: 'todo',
        label: 'Tasks',
        href: '/todo',
        icon: ListTodo,
    },
    // {
    //     id: 'vault', 
    //     label: 'Vault', 
    //     href: '/vault', 
    //     icon: Folder // Use a folder-like icon, e.g., GalleryHorizontal
    // },
    { 
    id: 'journal-Diary', 
    label: 'My Diary', 
    href: '/journal/my-diary', 
    icon: GalleryHorizontal 
  },
  {
    id: 'agent',
    label: 'Agent',
    href: '/agent',
    icon: Zap,
  },
  // {
  //   id: 'companion',
  //   label: 'Companion',
  //   href: '/companion',
  //   icon: Sparkles,
  // },
  {
    id: 'connections',
    label: 'Connections',
    href: '/connections',
    icon: Users,
  },
];

// Right side of navbar (after context items)
export const GLOBAL_NAV_RIGHT: NavItem[] = [
  // { 
  //   id: 'ocr', 
  //   label: 'OCR', 
  //   href: '/ocr', 
  //   icon: ScanLine 
  // },
  // { 
  //   id: 'security', 
  //   label: 'Security', 
  //   href: '/security', 
  //   icon: Shield 
  // },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    href: '/settings', 
    icon: Settings 
  },
];

// ============================================
// CONTEXT ITEMS - Passed from section layouts
// ============================================

// Journal section navigation
export const JOURNAL_NAV_ITEMS: NavItem[] = [
  { 
    id: 'journal-create', 
    label: 'Create', 
    href: '/journal/new', 
    icon: FileText 
  },
  { 
    id: 'journal-diary', 
    label: 'My Diary', 
    href: '/journal/my-diary', 
    icon: BookOpen 
  },
  
  { 
    id: 'journal-gallery', 
    label: 'Analyze', 
    href: '/journal/gallery', 
    icon: CalendarClockIcon 
  }
];

// Analysis section navigation
export const ANALYSIS_NAV_ITEMS: NavItem[] = [
  {
    id: 'analysis-entries',
    label: 'Thought Threads',
    href: '/analysis/entries',
    icon: TrendingUp,
  },
  { 
    id: 'analysis-advanced', 
    label: 'Pattern Map', 
    href: '/analysis/advanced', 
    icon: BarChart3 
  },
  { 
    id: 'analysis-audio', 
    label: 'Voice Signals', 
    href: '/analysis/audio-analysis', 
    icon: Mic 
  },
];

// ============================================
// HELPER: Get all nav items (for search, etc.)
// ============================================
export const ALL_NAV_ITEMS: NavItem[] = [
  ...GLOBAL_NAV_LEFT,
  ...JOURNAL_NAV_ITEMS,
  ...ANALYSIS_NAV_ITEMS,
  ...GLOBAL_NAV_RIGHT,
];