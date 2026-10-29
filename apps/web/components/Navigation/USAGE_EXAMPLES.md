# Usage Examples

## Example 1: Add to a Single Page

```tsx
// app/(user)/dashboard/page.tsx
import { WaterNavBar } from '@/components/Navigation';

export default function Dashboard() {
  return (
    <div className="min-h-screen pb-28">
      {/* Your existing content */}
      <div className="container mx-auto px-4 py-8">
        <h1>Dashboard</h1>
        <p>Your content here...</p>
      </div>
      
      {/* Add the water nav */}
      <WaterNavBar />
    </div>
  );
}
```

## Example 2: Use the Layout Wrapper

```tsx
// app/(user)/journal-entry/page.tsx
import { WaterNavLayout } from '@/components/Navigation';

export default function JournalEntry() {
  return (
    <WaterNavLayout>
      <div className="container mx-auto px-4 py-8">
        <h1>Journal Entry</h1>
        <p>Your content here...</p>
      </div>
    </WaterNavLayout>
  );
}
```

## Example 3: Add to User Layout (Recommended)

Add the navigation to all pages in the `(user)` folder:

```tsx
// app/(user)/layout.tsx
import { WaterNavBar } from '@/components/Navigation';

export default function UserLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <div className="min-h-screen">
      {/* Add padding to prevent content from hiding behind nav */}
      <div className="pb-28">
        {children}
      </div>
      
      {/* Water navigation bar */}
      <WaterNavBar />
    </div>
  );
}
```

## Example 4: Conditional Navigation

Show navigation only on certain pages:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { WaterNavBar } from '@/components/Navigation';

export default function ConditionalNav() {
  const pathname = usePathname();
  
  // Only show on user pages
  const showNav = pathname?.startsWith('/user/');
  
  return showNav ? <WaterNavBar /> : null;
}
```

## Example 5: Custom Navigation Items

Create a customized version with your own navigation items:

```tsx
// components/Navigation/CustomWaterNav.tsx
import React from 'react';
import { Home, Mail, Calendar, Settings } from 'lucide-react';
// ... copy WaterNavBar.tsx and modify NAV_ITEMS

const NAV_ITEMS = [
  { id: 'home', label: 'Home', href: '/', icon: Home },
  { id: 'messages', label: 'Messages', href: '/messages', icon: Mail },
  { id: 'calendar', label: 'Calendar', href: '/calendar', icon: Calendar },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];
```

## Testing the Navigation

1. **Auto-Hide Mode (Default)**:
   - Move your mouse to the bottom of the screen
   - The nav should slide up with a wave animation
   - After 2 seconds of inactivity, it hides again

2. **Pinned Mode**:
   - Click the eye icon to disable auto-hide
   - The nav stays visible at all times
   - Click the eye-off icon to re-enable auto-hide

3. **Keyboard Navigation**:
   - Press Tab to focus the nav items
   - Use Arrow keys to move between items
   - Press Enter to navigate

4. **Active State**:
   - Navigate to different pages
   - The active page should have:
     - Colored icon (theme primary color)
     - Background tint
     - Glowing effect
     - Pulsing indicator dot

## Quick Start Checklist

- [ ] Import `WaterNavBar` or `WaterNavLayout`
- [ ] Add to your page or layout
- [ ] Ensure `useTheme` context is available
- [ ] Add bottom padding (`pb-28`) to your content
- [ ] Test auto-hide by moving mouse to bottom
- [ ] Test navigation between pages
- [ ] Verify responsive behavior on mobile

## Troubleshooting

**Nav doesn't show:**
- Check if auto-hide is enabled (try toggling the eye icon)
- Move mouse to bottom edge or press Tab

**Wrong colors:**
- Verify `ThemeContext` is wrapping your app
- Check `currentTheme` has a `primary` color defined

**Content hidden behind nav:**
- Add `pb-28` (or use `WaterNavLayout`)
- Adjust padding based on your nav height

**Animations not smooth:**
- Check if `prefers-reduced-motion` is enabled
- Verify browser supports `backdrop-filter`
