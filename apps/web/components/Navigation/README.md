# Water Navigation Bar

A beautiful, immersive navigation bar with glassmorphism effect, auto-hide functionality, smooth wave animations, and **flexible positioning** (bottom, left sidebar, right sidebar).

## Features

✨ **Glassmorphism Design**
- Translucent water-like appearance
- Backdrop blur effect
- Theme-aware coloring (dark/light mode)
- Soft shadows and glows

🌊 **Wave Animation**
- Gentle wave motion on show (2 seconds)
- Smooth transitions with easing
- Respects `prefers-reduced-motion`

📍 **Flexible Positioning**
- **Bottom** (full-width or centered pill)
- **Left sidebar** (vertical layout)
- **Right sidebar** (vertical layout)
- Position saved to localStorage
- Smooth transitions when switching

🎯 **Auto-Hide Mode**
- Automatically hides when not needed
- Shows on mouse proximity to edge (bottom/left/right based on position)
- Shows on keyboard focus
- Toggle on/off with persistent localStorage

⚙️ **Settings Menu**
- Three-dot menu button
- Toggle auto-hide on/off
- Switch between bottom/left/right positions
- All preferences saved to localStorage

📱 **Enhanced Navigation**
- 8 navigation items:
  - 🏠 Home (Dashboard)
  - 📖 Journal Entry
  - 🖼️ Gallery (Quilted Gallery)
  - 📊 Analysis
  - ✨ Assistant (AI)
  - 🔔 Notifications
  - 👤 Profile
  - ⚙️ Settings

🎨 **Theme Integration**
- Uses `useTheme` context for colors
- Active item highlighted with theme color
- Smooth color transitions
- Dark/light mode support

📱 **Fully Responsive**
- Optimized for mobile, tablet, and desktop
- Touch-friendly on mobile devices
- Adapts spacing and sizing
- Full-width on mobile, compact on desktop

♿ **Accessible**
- Full keyboard navigation
- ARIA labels and roles
- `aria-current` for active page
- Focus indicators
- Reduced motion support

## Installation

The component is already created in:
```
apps/web/components/Navigation/
├── WaterNavBar.tsx        # Main navigation component
├── WaterNavLayout.tsx     # Layout wrapper
└── index.ts               # Exports
```

## Usage

### Option 1: Use the Layout Wrapper (Recommended)

Wrap your page content with `WaterNavLayout`:

```tsx
import { WaterNavLayout } from '@/components/Navigation';

export default function Dashboard() {
  return (
    <WaterNavLayout>
      <div>
        {/* Your page content here */}
        <h1>Dashboard</h1>
        {/* ... */}
      </div>
    </WaterNavLayout>
  );
}
```

### Option 2: Use Navigation Directly

Import and use the component anywhere:

```tsx
import { WaterNavBar } from '@/components/Navigation';

export default function MyLayout({ children }) {
  return (
    <div>
      {children}
      <WaterNavBar />
    </div>
  );
}
```

### Option 3: Add to Root Layout

For app-wide navigation, add to your main layout:

```tsx
// app/layout.tsx or app/(user)/layout.tsx
import { WaterNavBar } from '@/components/Navigation';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <WaterNavBar />
      </body>
    </html>
  );
}
```

## Configuration

### Customizing Navigation Items

Edit the `NAV_ITEMS` array in `WaterNavBar.tsx`:

```tsx
const NAV_ITEMS: NavItem[] = [
  { 
    id: 'home', 
    label: 'Home', 
    href: '/user/dashboard', 
    icon: Home 
  },
  // Add more items...
];
```

### Auto-Hide Behavior

Users can toggle auto-hide by clicking the eye icon. The preference is saved to localStorage.

**Default**: Auto-hide is ON

To change the default, modify:
```tsx
const [isAutoHide, setIsAutoHide] = useState(false); // Change to false
```

### Proximity Threshold

Adjust how close the mouse needs to be to the bottom edge:

```tsx
const threshold = 100; // pixels from bottom (default: 100)
```

### Hide Delay

Change how long the nav stays visible:

```tsx
hideTimeoutRef.current = setTimeout(() => {
  setIsVisible(false);
}, 2000); // milliseconds (default: 2000)
```

## Styling

### Glass Effect

Customize the glassmorphism in `glassStyles`:

```tsx
const glassStyles = isDarkMode
  ? 'bg-gray-900/40 backdrop-blur-xl border-gray-700/50'
  : 'bg-white/40 backdrop-blur-xl border-gray-300/50';
```

### Shadows

Adjust shadows in `shadowStyles`:

```tsx
const shadowStyles = isDarkMode
  ? 'shadow-[0_-4px_24px_rgba(0,0,0,0.4)]'
  : 'shadow-[0_-4px_24px_rgba(0,0,0,0.15)]';
```

### Active Item Glow

The active item has a glowing effect using the theme's primary color. Customize the intensity:

```tsx
backgroundColor: `${currentTheme.primary}40`, // 40 = opacity (00-FF)
```

## Animations

### Wave Animation

The wave animation is defined in the global styles:

```css
@keyframes water-wave {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-4px) scale(1.01); }
  50% { transform: translateY(0) scale(1); }
  75% { transform: translateY(-2px) scale(1.005); }
}
```

### Shimmer Effect

The water ripple shimmer:

```css
@keyframes shimmer {
  0% { transform: translateX(-100%); opacity: 0; }
  50% { opacity: 0.3; }
  100% { transform: translateX(100%); opacity: 0; }
}
```

Both animations respect `prefers-reduced-motion`.

## Responsive Behavior

### Mobile (< 768px)
- Wider bar: `w-[calc(100%-2rem)]`
- Larger icons: 24px
- More rounded: `rounded-3xl`
- Touch-optimized spacing

### Desktop (>= 768px)
- Compact pill shape: `rounded-full`
- Smaller icons: 22px
- Centered positioning

## Accessibility

### Keyboard Navigation
- Tab through items
- Enter/Space to navigate
- Focus shows nav bar (auto-hide mode)

### Screen Readers
- `role="navigation"`
- `aria-label="Main navigation"`
- `aria-current="page"` on active item
- Descriptive button labels

### Reduced Motion
- Disables wave animation
- Disables shimmer effect
- Disables pulse on active indicator

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

Requires:
- CSS backdrop-filter support
- ES6+ JavaScript
- React 18+
- Next.js 13+ (App Router)

## Tips & Best Practices

1. **Content Spacing**: The layout adds `pb-28` to prevent content from hiding behind the nav

2. **Z-Index**: The nav uses `z-50`. Ensure other fixed elements use lower z-index values

3. **Pointer Events**: The nav uses `pointer-events-none` when hidden to allow clicking content below

4. **Performance**: Animations use CSS transforms for GPU acceleration

5. **Touch Devices**: Auto-hide works with touch - the nav shows on touch near bottom

6. **Virtual Keyboard**: On mobile, consider the virtual keyboard behavior - the nav stays accessible

## Troubleshooting

**Nav not showing:**
- Check if auto-hide is enabled (eye icon should show eye-off)
- Move mouse to bottom of screen or press Tab to focus

**Animations not working:**
- Check browser support for `backdrop-filter`
- Verify `prefers-reduced-motion` is not enabled in OS

**Icons wrong color:**
- Ensure `useTheme` context is available
- Check theme provider wraps your app

**Nav covering content:**
- Add bottom padding to your content: `pb-28` or use `WaterNavLayout`

## License

Part of the FORCE project.
