"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MoreVertical, X, Eye, EyeOff, LogOut, LayoutGrid, ChevronUp, Plus, Pin, PinOff } from 'lucide-react';
import { useNavContext } from '@/utilities/context/NavContext';
import { useTheme } from '@/utilities/context/ThemeContext';
import { GLOBAL_NAV_LEFT, GLOBAL_NAV_RIGHT } from '@/constants/navigation';
import type { NavItem, NavPosition } from '@/types/navigation';
import { logoutWithCleanup } from '@/utils/auth/logout';
import { NotificationBell } from '@/components/notifications';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { setJournalReturnUrl } from '@/lib/journal/new-entry-navigation';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const MOBILE_MAX_VISIBLE = 4;
const DESKTOP_MAX_VISIBLE = 5;
const PIN_STORAGE_KEY = 'nav_pinned_v1';
const ANALYTICS_STORAGE_KEY = 'nav_analytics_v1';

// ─────────────────────────────────────────────────────────────
// Frecency: frequency × recency decay (half-life 7 days)
// ─────────────────────────────────────────────────────────────
function frecencyScore(count: number, lastVisit: number): number {
  const ageDays = (Date.now() - lastVisit) / (1000 * 60 * 60 * 24);
  return count * Math.pow(0.5, ageDays / 7);
}

// ─────────────────────────────────────────────────────────────
// NavLink — label is ALWAYS rendered but width is 0 when inactive
// This prevents the pill from shifting/jumping on active change
// ─────────────────────────────────────────────────────────────
const NavLink: React.FC<{
  item: NavItem;
  isActive: boolean;
  isMobile: boolean;
  isVertical: boolean;
  primary: string;
  isDark: boolean;
  onClick?: () => void;
}> = React.memo(({ item, isActive, isMobile, isVertical, primary, isDark, onClick }) => {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={true}
      onClick={onClick}
      className={`
        nav-link group relative flex items-center justify-center gap-0
        ${isVertical ? 'px-2.5 py-2.5' : 'p-2.5'}
        rounded-full transition-all duration-300 ease-in-out
        ${isActive ? '' : 'hover:scale-110 active:scale-95'}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${isDark ? 'focus-visible:ring-blue-400' : 'focus-visible:ring-blue-500'}
      `}
      style={{
        backgroundColor: isActive ? `${primary}25` : 'transparent',
        // FIX: Reserve fixed padding when active so pill width never shifts
        paddingLeft: isActive && !isVertical ? '14px' : undefined,
        paddingRight: isActive && !isVertical ? '14px' : undefined,
      }}
    >
      {isActive && (
        <span
          className="absolute inset-0 rounded-full animate-glow"
          style={{ backgroundColor: `${primary}12`, boxShadow: `0 0 20px ${primary}20` }}
        />
      )}
      <Icon
        size={20}
        className={`relative z-10 shrink-0 transition-colors duration-300 ${
          isActive ? '' : isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-600'
        }`}
        style={{ color: isActive ? primary : undefined }}
        strokeWidth={isActive ? 2.2 : 1.8}
      />
      {/* Label — always rendered, width animates 0 → auto. No layout shift. */}
      {!isVertical && (
        <span
          className="relative z-10 text-[11px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxWidth: isActive ? '80px' : '0px',
            opacity: isActive ? 1 : 0,
            marginLeft: isActive ? '6px' : '0px',
            color: isActive ? primary : undefined,
          }}
        >
          {item.label}
        </span>
      )}
      {item.badge && (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white rounded-full bg-red-500 shadow-lg z-20">
          {item.badge}
        </span>
      )}
      {/* Tooltip */}
      {(isVertical || !isActive) && (
        <span className={`
          absolute ${isVertical ? 'left-full ml-3' : '-top-10 left-1/2 -translate-x-1/2'}
          px-2.5 py-1.5 text-[11px] font-medium rounded-lg
          opacity-0 group-hover:opacity-100 pointer-events-none
          transition-all duration-200 whitespace-nowrap z-50
          ${isVertical ? 'translate-x-1 group-hover:translate-x-0' : 'translate-y-1 group-hover:translate-y-0'}
          ${isDark ? 'bg-gray-800 text-gray-200 shadow-xl' : 'bg-white text-gray-800 shadow-xl border border-gray-200'}
        `}>
          {item.label}
        </span>
      )}
    </Link>
  );
});
NavLink.displayName = 'NavLink';

// ─────────────────────────────────────────────────────────────
// NavDivider
// ─────────────────────────────────────────────────────────────
const NavDivider: React.FC<{ isVertical: boolean; isDark: boolean }> = ({ isVertical, isDark }) => (
  <div className={`${isVertical ? 'h-px w-6 my-1.5' : 'w-px h-6 mx-1'} relative shrink-0`}>
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background: `linear-gradient(${isVertical ? '90deg' : '180deg'}, transparent, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}, transparent)`,
      }}
    />
  </div>
);

// ─────────────────────────────────────────────────────────────
// OverflowGrid — shared grid used by BOTH mobile drawer & desktop popover
// ─────────────────────────────────────────────────────────────
const OverflowGrid: React.FC<{
  items: NavItem[];
  contextItems: NavItem[];
  isActive: (href: string) => boolean;
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
  primary: string;
  isDark: boolean;
  onClose: () => void;
}> = ({ items, contextItems, isActive, pinnedIds, onTogglePin, primary, isDark, onClose }) => (
  <div>
    {/* Context section */}
    {contextItems.length > 0 && (
      <>
        <p className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 px-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          This Section
        </p>
        <div className="grid grid-cols-4 gap-1.5 mb-3 pb-3 border-b border-gray-500/20">
          {contextItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link 
                key={item.id} 
                href={item.href} 
                onClick={onClose}
                className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-200 active:scale-95 ${
                  active 
                    ? '' 
                    : isDark 
                      ? 'hover:bg-white/10 text-gray-200 hover:text-white' 
                      : 'hover:bg-black/5 text-gray-700 hover:text-gray-900'
                }`}
                style={{ 
                  backgroundColor: active ? `${primary}25` : undefined,
                  border: active ? `1px solid ${primary}40` : '1px solid transparent'
                }}
              >
                <Icon 
                  size={22} 
                  style={{ color: active ? primary : isDark ? '#e5e7eb' : '#374151' }} 
                  strokeWidth={active ? 2.3 : 2} 
                />
                <span 
                  className={`text-[11px] text-center leading-tight ${active ? 'font-bold' : 'font-medium'}`}
                  style={{ color: active ? primary : isDark ? '#e5e7eb' : '#1f2937' }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </>
    )}

    {/* All pages */}
    <p className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 px-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
      All Pages
    </p>
    <div className="grid grid-cols-4 gap-1.5">
      {items.map(item => {
        const Icon = item.icon;
        const active = isActive(item.href);
        const pinned = pinnedIds.has(item.id);
        return (
          <div key={item.id} className="relative group/item">
            <Link 
              href={item.href} 
              onClick={onClose}
              className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-200 active:scale-95 w-full ${
                active 
                  ? '' 
                  : isDark 
                    ? 'hover:bg-white/10 text-gray-200 hover:text-white' 
                    : 'hover:bg-black/5 text-gray-700 hover:text-gray-900'
              }`}
              style={{ 
                backgroundColor: active ? `${primary}25` : undefined,
                border: active ? `1px solid ${primary}40` : '1px solid transparent'
              }}
            >
              <Icon 
                size={22} 
                style={{ color: active ? primary : isDark ? '#e5e7eb' : '#374151' }} 
                strokeWidth={active ? 2.3 : 2} 
              />
              <span 
                className={`text-[11px] text-center leading-tight ${active ? 'font-bold' : 'font-medium'}`}
                style={{ color: active ? primary : isDark ? '#e5e7eb' : '#1f2937' }}
              >
                {item.label}
              </span>
              {item.badge && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white rounded-full bg-red-500 shadow">
                  {item.badge}
                </span>
              )}
            </Link>
            {/* Pin toggle — appears on hover or when pinned */}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(item.id); }}
              className={`
                absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center
                transition-all duration-150 z-10
                opacity-0 group-hover/item:opacity-100
                ${pinned ? 'opacity-100' : ''}
                ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'}
                border ${isDark ? 'border-gray-700' : 'border-gray-300'} shadow-sm
              `}
              aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
            >
              {pinned
                ? <PinOff size={10} style={{ color: primary }} strokeWidth={2.5} />
                : <Pin size={10} strokeWidth={2.5} />
              }
            </button>
          </div>
        );
      })}
    </div>

    {pinnedIds.size > 0 && (
      <p className={`text-[10px] font-medium mt-3 px-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        📌 Pinned items always appear in the main bar
      </p>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
// Mobile slide-up drawer
// ─────────────────────────────────────────────────────────────
const MobileDrawer: React.FC<{
  items: NavItem[];
  contextItems: NavItem[];
  isActive: (href: string) => boolean;
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
  primary: string;
  isDark: boolean;
  drawerGlassStyle: string;
  onClose: () => void;
}> = ({ items, contextItems, isActive, pinnedIds, onTogglePin, primary, isDark, drawerGlassStyle, onClose }) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div 
        ref={drawerRef}
        className={`fixed bottom-20 left-3 right-3 z-50 ${drawerGlassStyle} border rounded-2xl p-4 shadow-2xl animate-slide-up max-h-[80vh] overflow-y-auto`}
      >
        <div className="flex flex-col mb-3 pb-2 border-b border-gray-500/20">
          <div className={`w-10 h-1.5 rounded-full mx-auto mb-2.5 ${isDark ? 'bg-white/30' : 'bg-black/20'}`} />
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              <LayoutGrid size={17} style={{ color: primary }} />
              <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Navigation</span>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors ${
                isDark 
                  ? 'hover:bg-white/15 text-gray-300 hover:text-white' 
                  : 'hover:bg-black/10 text-gray-600 hover:text-gray-900'
              }`}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <OverflowGrid
          items={items}
          contextItems={contextItems}
          isActive={isActive}
          pinnedIds={pinnedIds}
          onTogglePin={onTogglePin}
          primary={primary}
          isDark={isDark}
          onClose={onClose}
        />
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Desktop popover — same grid design as mobile, just positioned above pill
// ─────────────────────────────────────────────────────────────
const DesktopPopover: React.FC<{
  items: NavItem[];
  contextItems: NavItem[];
  isActive: (href: string) => boolean;
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
  primary: string;
  isDark: boolean;
  drawerGlassStyle: string;
  position: NavPosition;
  onClose: () => void;
}> = ({ items, contextItems, isActive, pinnedIds, onTogglePin, primary, isDark, drawerGlassStyle, position, onClose }) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={popoverRef}
        className={`
          absolute z-50 p-4 rounded-2xl border shadow-2xl animate-popover-in
          ${drawerGlassStyle}
          ${position === 'bottom' ? 'bottom-full mb-3 right-0' : position === 'left' ? 'left-full ml-3 bottom-0' : 'right-full mr-3 bottom-0'}
        `}
        style={{ width: '290px' }}
      >
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-500/20">
          <div className="flex items-center gap-2">
            <LayoutGrid size={15} style={{ color: primary }} />
            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Navigation</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${
              isDark 
                ? 'hover:bg-white/15 text-gray-400 hover:text-white' 
                : 'hover:bg-black/10 text-gray-500 hover:text-gray-900'
            }`}
            aria-label="Close navigation"
          >
            <X size={14} />
          </button>
        </div>
        <OverflowGrid
          items={items}
          contextItems={contextItems}
          isActive={isActive}
          pinnedIds={pinnedIds}
          onTogglePin={onTogglePin}
          primary={primary}
          isDark={isDark}
          onClose={onClose}
        />
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Floating + button — fixed position RIGHT BESIDE the nav pill
// Uses a wrapper div that mirrors nav position exactly
// ─────────────────────────────────────────────────────────────
const FloatingCreateButton: React.FC<{
  primary: string;
  isDark: boolean;
  isMobile: boolean;
  position: NavPosition;
  isNavVisible: boolean;
}> = ({ primary, isDark, isMobile, position, isNavVisible }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  // Pre-warm the /journal/new route so chunk is downloaded before user clicks
  useEffect(() => {
    try {
      router.prefetch('/journal/new');
    } catch {
      // Ignore
    }
  }, [router]);

  // On mobile bottom, the + button is rendered directly inside the nav's row container for same-row alignment
  if (isMobile && position === 'bottom') {
    return null;
  }

  // Mirror the nav's own positioning logic, then offset to sit right beside it
  let posClass = '';
  if (position === 'bottom') {
    posClass = 'fixed z-50 bottom-5 left-1/2 mx-12 my-1';        // desktop: we'll shift it via translateX
  } else if (position === 'left') {
    posClass = 'fixed z-50 left-4 bottom-6';
  } else {
    posClass = 'fixed z-50 right-4 bottom-6';
  }

  // For desktop bottom: pill is centered, + button goes to its right.
  // We use a calc that nudges past the pill's half-width (~180px) + gap
  const desktopBottomStyle = position === 'bottom' && !isMobile
    ? { transform: 'translateX(calc(50% + 10px + 180px))' }  // center + half-pill-width + gap
    : {};

  const handleMouseEnter = () => {
    setHovered(true);
    try {
      router.prefetch('/journal/new');
    } catch {
      // Ignore
    }
  };

  const handleClick = () => {
    try {
      if (pathname && !pathname.startsWith('/journal/new')) {
        setJournalReturnUrl(pathname);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <Link
      href="/journal/new"
      prefetch={true}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={`
        ${posClass}
        grid place-items-center rounded-full
        transition-all duration-300 active:scale-90 
        ${isNavVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}
      `}
      style={{
        width: 44,
        height: 44,
        minWidth: 44,
        minHeight: 44,
        display: 'grid',
        placeItems: 'center',
        background: `linear-gradient(135deg, ${primary}ee, ${primary}aa)`,
        boxShadow: `0 4px 20px ${primary}55, 0 1px 4px ${primary}30`,
        ...desktopBottomStyle,
      }}
      onMouseLeave={() => setHovered(false)}
      aria-label="New journal entry"
    >
      <Plus
        size={20}
        strokeWidth={2.5}
        className="text-white transition-transform duration-300 origin-center shrink-0 block m-auto"
        style={{ transformOrigin: 'center', transform: hovered ? 'rotate(90deg)' : 'rotate(0deg)' }}
      />
      {/* Tooltip */}
      <span className={`
        absolute bottom-full mb-2 left-1/2 -translate-x-1/2
        px-2.5 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap
        pointer-events-none transition-all duration-200 z-50
        ${hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
        ${isDark ? 'bg-gray-800 text-gray-200 shadow-xl' : 'bg-white text-gray-800 shadow-xl border border-gray-200'}
      `}>
        New Journal Entry
      </span>
    </Link>
  );
};

// ─────────────────────────────────────────────────────────────
// Main WaterNavBar
// ─────────────────────────────────────────────────────────────
export const WaterNavBar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { elementColors, isDarkMode } = useTheme();
  const primary = elementColors.button;
  const isDark = isDarkMode;
  const { contextItems } = useNavContext();

  const [isVisible, setIsVisible] = useState(true);
  const [isAutoHide, setIsAutoHide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [position, setPosition] = useState<NavPosition>('bottom');
  const [isMobile, setIsMobile] = useState(false);

  const isJournalNewPage = pathname === '/journal/new' || pathname?.startsWith('/journal/new/');
  const isOnboardingPage = pathname === '/onboarding' || pathname?.startsWith('/onboarding/');
  const shouldHideNav = isJournalNewPage || isOnboardingPage;
  const effectivePosition: NavPosition = isJournalNewPage && position === 'bottom' ? 'left' : position;

  // Pinned item IDs — stored in localStorage
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const navRef = useRef<HTMLElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-warm the /journal/new route so it opens instantly when clicked
  useEffect(() => {
    try {
      router.prefetch('/journal/new');
    } catch {}
  }, [router]);

  // Close menus on route change
  useEffect(() => {
    setShowMore(false);
    setShowSettings(false);
  }, [pathname]);

  // Close settings on Escape
  useEffect(() => {
    if (!showSettings) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSettings]);

  // ── Load pinned ids ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      if (raw) {
        setPinnedIds(new Set(JSON.parse(raw)));
      } else {
        // First visit: default-pin the Home page so it's always visible
        const defaults = new Set(['home']);
        setPinnedIds(defaults);
        localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...defaults]));
      }
    } catch {}
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // ── Frecency analytics ──────────────────────────────────────
  const allStaticItems = useMemo(() => [...GLOBAL_NAV_LEFT, ...GLOBAL_NAV_RIGHT], []);
  const [navVisits, setNavVisits] = useState<Record<string, { count: number; lastVisit: number }>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
      if (raw) setNavVisits(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!pathname) return;
    setNavVisits(prev => {
      const updated = { ...prev, [pathname]: { count: (prev[pathname]?.count ?? 0) + 1, lastVisit: Date.now() } };
      try { localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [pathname]);

  const frecencySortedItems = useMemo(() => {
    return [...allStaticItems].sort((a, b) => {
      const va = navVisits[a.href], vb = navVisits[b.href];
      return (vb ? frecencyScore(vb.count, vb.lastVisit) : 0) - (va ? frecencyScore(va.count, va.lastVisit) : 0);
    });
  }, [allStaticItems, navVisits]);

  const topVisitedItems = useMemo(() => {
    return allStaticItems
      .map(item => ({ item, count: navVisits[item.href]?.count ?? 0 }))
      .filter(x => x.count > 0)
      .sort((a, b) => {
        const va = navVisits[a.item.href], vb = navVisits[b.item.href];
        return frecencyScore(vb?.count ?? 0, vb?.lastVisit ?? 0) - frecencyScore(va?.count ?? 0, va?.lastVisit ?? 0);
      });
  }, [navVisits, allStaticItems]);

  // ── Responsive ──────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Auto-hide ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAutoHide) { setIsVisible(true); return; }
    const handleMouse = (e: MouseEvent) => {
      const t = 80;
      const near = effectivePosition === 'bottom'
        ? window.innerHeight - e.clientY < t
        : effectivePosition === 'left'
          ? e.clientX < t
          : window.innerWidth - e.clientX < t;
      if (near) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setIsVisible(true);
        hideTimer.current = setTimeout(() => setIsVisible(false), 2500);
      }
    };
    window.addEventListener('mousemove', handleMouse);
    return () => { window.removeEventListener('mousemove', handleMouse); if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [isAutoHide, effectivePosition]);

  const isActive = useCallback((href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname === href || pathname?.startsWith(href + '/');
  }, [pathname]);

  // ── Smart bucketing with pins + frecency ────────────────────
  const { visibleItems, overflowItems } = useMemo(() => {
    const isVerticalNav = effectivePosition === 'left' || effectivePosition === 'right';
    if (isVerticalNav) return { visibleItems: [...GLOBAL_NAV_LEFT, ...GLOBAL_NAV_RIGHT], overflowItems: [] };

    const allItems = [...GLOBAL_NAV_LEFT, ...GLOBAL_NAV_RIGHT];

    if (isMobile) {
      // On mobile: strictly 2 visible items in the pill bar (Home + Current/Relevant),
      // resulting in exactly 4 total icons in the navbar: [Home, Current/Relevant, More, Logout]
      const homeItem = allItems.find(i => i.id === 'home') ?? allItems[0];
      const activeItem = allItems.find(i => isActive(i.href) && i.id !== 'home');
      
      let secondItem = activeItem;
      if (!secondItem) {
        // If user is currently on home, pick the top frecency item or first non-home item
        secondItem = frecencySortedItems.find(i => i.id !== 'home') || allItems.find(i => i.id !== 'home');
      }

      const visible: NavItem[] = [];
      if (homeItem) {
        visible.push(homeItem);
      }
      if (secondItem && (!homeItem || secondItem.id !== homeItem.id)) {
        visible.push(secondItem);
      }

      const visibleIdSet = new Set(visible.map(v => v.id));
      const overflow = allItems.filter(item => !visibleIdSet.has(item.id));

      return {
        visibleItems: visible,
        overflowItems: overflow,
      };
    }

    // Desktop bucketing
    const pinned = new Set<string>();
    const visible: NavItem[] = [];

    // 1. Pinned items always come first
    for (const item of allItems) {
      if (pinnedIds.has(item.id) && visible.length < DESKTOP_MAX_VISIBLE) {
        visible.push(item);
        pinned.add(item.id);
      }
    }

    // 2. Active item (if not already pinned)
    const activeItem = frecencySortedItems.find(i => isActive(i.href) && !pinned.has(i.id));
    if (activeItem && visible.length < DESKTOP_MAX_VISIBLE) {
      visible.push(activeItem);
      pinned.add(activeItem.id);
    }

    // 3. Fill remaining by frecency
    for (const item of frecencySortedItems) {
      if (visible.length >= DESKTOP_MAX_VISIBLE) break;
      if (!pinned.has(item.id)) { visible.push(item); pinned.add(item.id); }
    }

    // 4. Fallback fill for new users
    for (const item of allItems) {
      if (visible.length >= DESKTOP_MAX_VISIBLE) break;
      if (!pinned.has(item.id)) { visible.push(item); pinned.add(item.id); }
    }

    return {
      visibleItems: visible,
      overflowItems: allItems.filter(item => !pinned.has(item.id)),
    };
  }, [isMobile, effectivePosition, frecencySortedItems, isActive, pinnedIds]);

  // ── Position styles ─────────────────────────────────────────
  const positionStyles = useMemo(() => {
    const base = 'fixed z-50 transition-all duration-300 ease-out';
    const hid = 'opacity-0 pointer-events-none';
    const vis = 'opacity-100';
    if (effectivePosition === 'bottom') return {
      nav: `${base} ${isMobile ? 'left-3 right-3 flex items-center gap-2.5' : 'left-1/2 -translate-x-1/2'} ${isVisible ? `${vis} translate-y-0` : `${hid} translate-y-20`}`,
      style: isMobile ? { bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' } : { bottom: '1.25rem' },
      container: isMobile
        ? 'flex-row rounded-full px-4 py-1.5 justify-around items-center w-full'
        : 'flex-row rounded-full px-2 py-1.5 gap-0.5',
      isVertical: false,
    };
    if (effectivePosition === 'left') return {
      nav: `${base} left-4 top-1/2 -translate-y-1/2 ${isVisible ? `${vis} translate-x-0` : `${hid} -translate-x-20`}`,
      style: undefined,
      container: 'flex-col rounded-2xl px-2 py-3 gap-1', isVertical: true,
    };
    return {
      nav: `${base} right-4 top-1/2 -translate-y-1/2 ${isVisible ? `${vis} translate-x-0` : `${hid} translate-x-20`}`,
      style: undefined,
      container: 'flex-col rounded-2xl px-2 py-3 gap-1', isVertical: true,
    };
  }, [effectivePosition, isVisible, isMobile]);

  const pillGlassStyle = isDark
    ? 'bg-gray-900/40 backdrop-blur-3xl backdrop-saturate-200 border-white/[0.15]'
    : 'bg-white/70 backdrop-blur-3xl backdrop-saturate-200 border-white/[0.65]';

  const drawerGlassStyle = isDark
    ? 'bg-gray-950/95 backdrop-blur-2xl border-gray-800 text-gray-100'
    : 'bg-white/95 backdrop-blur-2xl border-gray-200 text-gray-900';

  const isVertical = positionStyles.isVertical;
  const hasOverflow = overflowItems.length > 0 || (contextItems.length > 0 && !isVertical);
  const overflowCount = overflowItems.length + (!isVertical ? contextItems.length : 0);

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLogoutLoading(true);
    setLogoutError(null);

    try {
      await logoutWithCleanup();
      setShowLogoutDialog(false);
      router.push('/login');
    } catch (e) {
      console.error('Logout failed:', e);
      setLogoutError('Logout failed. Please try again.');
    } finally {
      setLogoutLoading(false);
    }
  };

  if (shouldHideNav) {
    return null;
  }

  return (
    <>
      {/* ── Floating + button — beside the nav pill ── */}
      <FloatingCreateButton
        primary={primary}
        isDark={isDark}
        isMobile={isMobile}
        position={effectivePosition}
        isNavVisible={isVisible}
      />

      {/* ── Mobile slide-up drawer ── */}
      {showMore && isMobile && effectivePosition === 'bottom' && (
        <MobileDrawer
          items={overflowItems}
          contextItems={contextItems}
          isActive={isActive}
          pinnedIds={pinnedIds}
          onTogglePin={togglePin}
          primary={primary}
          isDark={isDark}
          drawerGlassStyle={drawerGlassStyle}
          onClose={() => setShowMore(false)}
        />
      )}

      <nav
        ref={navRef}
        role="navigation"
        aria-label="Main navigation"
        className={positionStyles.nav}
        style={positionStyles.style}
        onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); setIsVisible(true); }}
        onMouseLeave={() => { if (isAutoHide && !showSettings) { hideTimer.current = setTimeout(() => setIsVisible(false), 600); } }}
      >
        {/* Ambient glows */}
        <div className="absolute inset-0 -z-10 blur-3xl opacity-50" style={{ background: `radial-gradient(ellipse, ${primary}40 0%, ${primary}15 55%, transparent 80%)` }} />
        <div className="absolute inset-0 -z-10 blur-xl opacity-20" style={{ background: `linear-gradient(135deg, ${primary}25, transparent 65%)` }} />

        {/* Pill container */}
        <div className={`${isMobile && effectivePosition === 'bottom' ? 'flex-1 min-w-0' : ''} ${pillGlassStyle} border ${positionStyles.container} flex items-center relative shadow-2xl`}>
          {/* Top shine */}
          <div className="absolute inset-x-3 top-0 h-px pointer-events-none rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.95)'}, transparent)` }} />

          {/* ── VERTICAL SIDEBAR — show everything ── */}
          {isVertical ? (
            <>
              {GLOBAL_NAV_LEFT.map(item => <NavLink key={item.id} item={item} isActive={isActive(item.href)} isMobile={isMobile} isVertical={true} primary={primary} isDark={isDark} />)}
              {contextItems.length > 0 && (
                <>
                  <NavDivider isVertical={true} isDark={isDark} />
                  {contextItems.map(item => <NavLink key={item.id} item={item} isActive={isActive(item.href)} isMobile={isMobile} isVertical={true} primary={primary} isDark={isDark} />)}
                  <NavDivider isVertical={true} isDark={isDark} />
                </>
              )}
              {GLOBAL_NAV_RIGHT.map(item => <NavLink key={item.id} item={item} isActive={isActive(item.href)} isMobile={isMobile} isVertical={true} primary={primary} isDark={isDark} />)}
              <NotificationBell size={20} compact navPosition={effectivePosition} />
            </>
          ) : (
            /* ── BOTTOM PILL — frecency + pin bucketed ── */
            <>
              {visibleItems.map(item => (
                <NavLink
                  key={item.id}
                  item={item}
                  isActive={isActive(item.href)}
                  isMobile={isMobile}
                  isVertical={false}
                  primary={primary}
                  isDark={isDark}
                />
              ))}

              {/* More button */}
              {hasOverflow && (
                <>
                  {!isMobile && <NavDivider isVertical={false} isDark={isDark} />}
                  <div className="relative">
                    <button
                      onClick={() => setShowMore(prev => !prev)}
                      aria-label="Show all navigation"
                      aria-expanded={showMore}
                      className="group relative flex items-center justify-center p-2.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                      style={{ backgroundColor: showMore ? `${primary}25` : 'transparent' }}
                    >
                      {showMore
                        ? <ChevronUp size={18} style={{ color: primary }} strokeWidth={2} />
                        : <LayoutGrid size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} strokeWidth={1.8} />
                      }
                      {!showMore && overflowCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white rounded-full shadow" style={{ backgroundColor: primary }}>
                          {overflowCount}
                        </span>
                      )}
                      {!showMore && (
                        <span className={`absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50 translate-y-1 group-hover:translate-y-0 ${isDark ? 'bg-gray-800 text-gray-200 shadow-xl' : 'bg-white text-gray-800 shadow-xl border border-gray-200'}`}>
                          More
                        </span>
                      )}
                    </button>

                    {/* Desktop popover (same grid as mobile) */}
                    {showMore && !isMobile && (
                      <DesktopPopover
                        items={overflowItems}
                        contextItems={contextItems}
                        isActive={isActive}
                        pinnedIds={pinnedIds}
                        onTogglePin={togglePin}
                        primary={primary}
                        isDark={isDark}
                        drawerGlassStyle={drawerGlassStyle}
                        position={effectivePosition}
                        onClose={() => setShowMore(false)}
                      />
                    )}
                  </div>
                </>
              )}

              {/* Notification bell in bottom bar on desktop only */}
              {!isMobile && (
                <NotificationBell size={20} compact navPosition={effectivePosition} />
              )}
            </>
          )}

          {/* Logout */}
          <ConfirmDialog
            open={showLogoutDialog}
            onOpenChange={(open) => {
              setShowLogoutDialog(open);
              if (open) setLogoutError(null);
            }}
            title="Log out of Force?"
            description="Are you sure you want to log out? You can sign back in anytime."
            confirmLabel="Log out"
            confirmLoadingLabel="Logging out..."
            onConfirm={handleLogout}
            loading={logoutLoading}
            error={logoutError}
            confirmTone="danger"
            trigger={(
              <button
                type="button"
                className={`group relative flex items-center justify-center ${isVertical ? 'px-2.5 py-2.5' : 'p-2.5'} rounded-full transition-all duration-300 hover:scale-110 active:scale-95 hover:bg-red-500/15`}
                aria-label="Logout"
              >
                {logoutLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border border-current border-t-transparent" />
                ) : (
                  <LogOut size={20} strokeWidth={1.8} className={`transition-colors duration-300 ${isDark ? 'text-gray-500 group-hover:text-red-400' : 'text-gray-400 group-hover:text-red-500'}`} />
                )}
                <span className={`absolute ${isVertical ? 'left-full ml-3' : '-top-10 left-1/2 -translate-x-1/2'} px-2.5 py-1.5 text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50 ${isVertical ? 'translate-x-1 group-hover:translate-x-0' : 'translate-y-1 group-hover:translate-y-0'} ${isDark ? 'bg-gray-800 text-gray-200 shadow-xl' : 'bg-white text-gray-800 shadow-xl border border-gray-200'}`}>
                  Logout
                </span>
              </button>
            )}
          />

          {/* Settings — on desktop only */}
          {!isMobile && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                aria-label="Navigation settings"
                aria-expanded={showSettings}
                className="flex items-center justify-center p-2.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                style={{ backgroundColor: showSettings ? `${primary}20` : 'transparent' }}
              >
                <MoreVertical
                  size={20}
                  className={`transition-transform duration-200 ${showSettings ? 'rotate-90' : ''}`}
                  style={{ color: showSettings ? primary : isDark ? '#e5e7eb' : '#374151' }}
                />
              </button>

              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div
                    className={`absolute z-50 w-64 p-3.5 rounded-2xl border shadow-2xl max-h-[80vh] overflow-y-auto settings-dropdown
                      ${effectivePosition === 'bottom' ? 'bottom-full mb-2 right-0' : effectivePosition === 'left' ? 'left-full ml-2 bottom-0' : 'right-full mr-2 bottom-0'}
                      ${drawerGlassStyle}`}
                    style={{ maxWidth: '270px', ['--scrollbar-thumb' as any]: isDark ? '#4b5563' : '#d1d5db', ['--scrollbar-thumb-hover' as any]: isDark ? '#6b7280' : '#9ca3af' }}
                  >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-500/20">
                    <span className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Nav Settings</span>
                    <button onClick={() => setShowSettings(false)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/15 text-gray-400 hover:text-white' : 'hover:bg-black/10 text-gray-500 hover:text-gray-900'}`} aria-label="Close settings">
                      <X size={14} />
                    </button>
                  </div>

                  {/* Auto-hide */}
                  <button onClick={() => setIsAutoHide(!isAutoHide)} className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                    <div className="flex items-center gap-2.5">
                      {isAutoHide ? <EyeOff size={16} style={{ color: primary }} /> : <Eye size={16} className={isDark ? 'text-gray-300' : 'text-gray-700'} />}
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Auto-hide</span>
                    </div>
                    <div className="w-10 h-5 rounded-full relative transition-colors duration-200" style={{ backgroundColor: isAutoHide ? primary : isDark ? '#4b5563' : '#d1d5db' }}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${isAutoHide ? 'left-5.5' : 'left-0.5'}`} />
                    </div>
                  </button>

                  {/* Position */}
                  <div className="mt-3 pt-3 border-t border-gray-500/20">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Position</span>
                    <div className="mt-2 space-y-1">
                      {(isJournalNewPage ? (['left', 'right'] as const) : (['bottom', 'left', 'right'] as const)).map(pos => (
                        <button key={pos} onClick={() => { setPosition(pos); setShowSettings(false); }}
                          className={`w-full flex items-center gap-3 p-2 rounded-xl text-sm capitalize transition-all duration-150 ${effectivePosition === pos ? 'font-bold' : isDark ? 'hover:bg-white/10 font-medium' : 'hover:bg-black/5 font-medium'}`}
                          style={{ backgroundColor: effectivePosition === pos ? `${primary}20` : 'transparent', color: effectivePosition === pos ? primary : isDark ? '#f3f4f6' : '#1f2937' }}
                          aria-pressed={effectivePosition === pos}
                        >
                          <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: effectivePosition === pos ? primary : isDark ? '#9ca3af' : '#6b7280' }}>
                            {effectivePosition === pos && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primary }} />}
                          </div>
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frecency shortcuts */}
                  {topVisitedItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>⚡ Frequent Pages</span>
                        <button
                          onClick={() => { try { localStorage.removeItem(ANALYTICS_STORAGE_KEY); } catch {} setNavVisits({}); }}
                          className={`text-[10px] font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                          reset
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {topVisitedItems.slice(0, 4).map(({ item, count }) => {
                          const ShortcutIcon = item.icon;
                          return (
                            <Link key={item.id} href={item.href} onClick={() => setShowSettings(false)}
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/10 text-gray-200 hover:text-white' : 'hover:bg-black/5 text-gray-700 hover:text-gray-900'}`}
                            >
                              <ShortcutIcon size={15} style={{ color: primary }} />
                              <span className="flex-1 text-sm font-medium">{item.label}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>{count}×</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* On mobile bottom: Floating + button in the EXACT same row, beside the nav pill */}
      {isMobile && effectivePosition === 'bottom' && (
        <Link
          href="/journal/new"
          prefetch={true}
          onClick={() => {
            try {
              if (pathname && !pathname.startsWith('/journal/new')) {
                setJournalReturnUrl(pathname);
              }
            } catch {}
          }}
          onTouchStart={() => {
            try {
              router.prefetch('/journal/new');
            } catch {}
          }}
          className="shrink-0 rounded-full transition-all duration-300 active:scale-90"
          style={{
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
            display: 'grid',
            placeItems: 'center',
            background: `linear-gradient(135deg, ${primary}ee, ${primary}aa)`,
            boxShadow: `0 4px 20px ${primary}55, 0 1px 4px ${primary}30`,
          }}
          aria-label="New journal entry"
        ><Plus size={20} strokeWidth={2.5} className="text-white origin-center shrink-0 block m-auto" style={{ transformOrigin: 'center' }} /></Link>
      )}
    </nav>

      <style jsx global>{`
        @keyframes glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes popover-in { from { transform: translateY(6px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-glow { animation: glow 3s ease-in-out infinite; }
        .animate-slide-up { animation: slide-up 0.22s ease-out forwards; }
        .animate-popover-in { animation: popover-in 0.18s ease-out forwards; }
        .nav-link { will-change: transform, background-color; }
        @media (prefers-reduced-motion: reduce) {
          .animate-glow, .animate-slide-up, .animate-popover-in { animation: none; }
          .nav-link { transition-duration: 0ms !important; }
        }
        .settings-dropdown::-webkit-scrollbar { width: 6px; }
        .settings-dropdown::-webkit-scrollbar-track { background: transparent; }
        .settings-dropdown::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, #d1d5db); border-radius: 3px; }
        .settings-dropdown::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover, #9ca3af); }
      `}</style>
    </>
  );
};

export default WaterNavBar;