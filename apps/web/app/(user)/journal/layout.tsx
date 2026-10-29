// app/journal/layout.tsx - Journal Section Layout

"use client";
import { useSetNavItems } from '@/utilities/context/NavContext';
import { JOURNAL_NAV_ITEMS } from '@/constants/navigation';

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This hook sets the context nav items when this layout mounts
  // and clears them when it unmounts
  useSetNavItems(JOURNAL_NAV_ITEMS, 'Journal');

  return (
    <div className="journal-layout">
      {/* Optional: Add journal-specific header or sidebar here */}
      {children}
    </div>
  );
}