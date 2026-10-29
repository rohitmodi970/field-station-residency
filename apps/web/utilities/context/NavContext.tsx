// apps/web/utilities/context/NavContext.tsx

"use client";

import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useMemo,
  useEffect,
  useRef
} from 'react';
import type { NavItem } from '@/types/navigation';

interface NavContextValue {
  contextItems: NavItem[];
  contextLabel?: string;
  setContextNav: (items: NavItem[], label?: string) => void;
  clearContextNav: () => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export const NavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contextItems, setContextItems] = useState<NavItem[]>([]);
  const [contextLabel, setContextLabel] = useState<string | undefined>();

  const setContextNav = useCallback((items: NavItem[], label?: string) => {
    setContextItems(items);
    setContextLabel(label);
  }, []);

  const clearContextNav = useCallback(() => {
    setContextItems([]);
    setContextLabel(undefined);
  }, []);

  const value = useMemo(() => ({
    contextItems,
    contextLabel,
    setContextNav,
    clearContextNav,
  }), [contextItems, contextLabel, setContextNav, clearContextNav]);

  return (
    <NavContext.Provider value={value}>
      {children}
    </NavContext.Provider>
  );
};

// Hook to access nav context
export const useNavContext = (): NavContextValue => {
  const context = useContext(NavContext);
  if (!context) {
    throw new Error('useNavContext must be used within NavProvider');
  }
  return context;
};

// Hook for layouts to set their navigation items
export const useSetNavItems = (items: NavItem[], label?: string) => {
  const { setContextNav, clearContextNav } = useNavContext();
  
  // Use ref to track if this is the active setter
  const isActiveRef = useRef(true);
  
  // Memoize items to prevent unnecessary updates
  const itemsKey = useMemo(() => JSON.stringify(items.map(i => i.id)), [items]);

  useEffect(() => {
    isActiveRef.current = true;
    setContextNav(items, label);
    
    return () => {
      isActiveRef.current = false;
      // Small delay to allow new layout to set items first
      // This prevents flash of empty nav during transitions
      setTimeout(() => {
        if (!isActiveRef.current) {
          clearContextNav();
        }
      }, 50);
    };
  }, [itemsKey, label, setContextNav, clearContextNav]);
};