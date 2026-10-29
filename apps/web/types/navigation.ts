// apps/web/types/navigation.ts

import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;  // Optional notification badge
}

export interface NavContextValue {
  contextItems: NavItem[];
  contextLabel?: string;
  setContextNav: (items: NavItem[], label?: string) => void;
  clearContextNav: () => void;
}

export type NavPosition = 'bottom' | 'left' | 'right';

export interface NavSettings {
  position: NavPosition;
  autoHide: boolean;
  reducedMotion: boolean;
}