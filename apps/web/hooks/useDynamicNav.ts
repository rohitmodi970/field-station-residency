
"use client";

import { useEffect, useMemo } from 'react';
import { useNavContext } from '../utilities/context/NavContext';
import { NavItem } from '../types/navigation';

interface UseDynamicNavOptions {
  items: NavItem[];
  label?: string;
  /** If true, merges with existing context items instead of replacing */
  merge?: boolean;
}

export const useDynamicNav = ({ items, label, merge = false }: UseDynamicNavOptions) => {
  const { contextItems, setContextNav, clearContextNav } = useNavContext();

  // Memoize items to prevent unnecessary re-renders
  const stableItems = useMemo(() => items, [JSON.stringify(items)]);

  useEffect(() => {
    if (merge) {
      // Merge new items with existing, avoiding duplicates
      const existingIds = new Set(contextItems.map(i => i.id));
      const newItems = stableItems.filter(i => !existingIds.has(i.id));
      setContextNav([...contextItems, ...newItems], label);
    } else {
      setContextNav(stableItems, label);
    }

    return () => {
      if (!merge) {
        clearContextNav();
      }
    };
  }, [stableItems, label, merge, setContextNav, clearContextNav]);
};