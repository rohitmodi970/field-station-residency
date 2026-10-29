# Integration Guide - Inner-Self Pattern Card

## Quick Start

### 1. Import the Component

```tsx
import { InnerSelfPatternCard } from '@/components/Landing';
```

### 2. Use in Your Page

```tsx
export default function LandingPage() {
  return (
    <section className="py-12">
      <div className="flex items-center justify-center">
        <InnerSelfPatternCard />
      </div>
    </section>
  );
}
```

## Component Location

```
apps/web/components/Landing/
├── InnerSelfPatternCard.tsx      # Main component
├── InnerSelfPatternCard.demo.tsx # Demo/example
├── index.ts                       # Export
└── README.md                      # Documentation
```

## Customization Guide

### Modify Pattern Tags

To change the pattern tags displayed, edit the `PatternTag` components in the JSX:

```tsx
<PatternTag text="your custom tag" left="100px" top="50px" />
```

### Change Colors

Modify the Tailwind classes:

```tsx
// Change background color
bg-[#fffaf8]  →  bg-[#your-color]

// Change header/footer color
bg-[#e5e5e5]  →  bg-[#your-color]

// Change text color
text-black  →  text-[#your-color]
```

### Adjust Sizing

All dimensions use fixed pixel values:

```tsx
// Change overall card size
w-[386px] h-[464px]  →  w-[500px] h-[600px]

// Change border radius
rounded-[16px]  →  rounded-[12px]

// Change element positions
left-[24px] top-[100px]  →  left-[30px] top-[120px]
```

### Update Images

Replace Figma asset URLs with your own:

```tsx
const imgImage250 = "your-image-url";
```

Or download them locally and use relative paths:

```tsx
const imgImage250 = "/images/pattern-1.jpg";
```

## Making It Dynamic

### Accept Props for Content

```tsx
interface InnerSelfPatternCardProps {
  patterns?: PatternData[];
  title?: string;
  description?: string;
}

const PatternData = {
  text: string;
  image: string;
  position: { left: string; top: string };
};

export default function InnerSelfPatternCard({ 
  patterns = DEFAULT_PATTERNS,
  title = "Discover yourself",
  description = "Force reveals patterns..."
}: InnerSelfPatternCardProps) {
  // Implementation
}
```

### Example Usage with Dynamic Data

```tsx
const patternData = [
  {
    text: "morning run",
    image: "/patterns/running.jpg",
    position: { left: "144px", top: "114px" }
  },
  {
    text: "photography",
    image: "/patterns/camera.jpg",
    position: { left: "62px", top: "66px" }
  },
  // ... more patterns
];

<InnerSelfPatternCard patterns={patternData} />
```

## Performance Considerations

### Image Optimization

1. **Figma CDN (Current)**
   - Pros: No build time, updates in real-time
   - Cons: 7-day expiry, external dependency

2. **Local Hosting (Recommended)**
   ```bash
   # Download images from Figma CDN
   # Place in: apps/web/public/images/patterns/
   
   const images = {
     pattern1: "/images/patterns/pattern-1.jpg",
     pattern2: "/images/patterns/pattern-2.jpg",
   };
   ```

3. **Optimization Steps**
   ```tsx
   import Image from 'next/image';
   
   <Image
     src={imgImage250}
     alt="pattern"
     width={42}
     height={67}
     quality={80}
   />
   ```

## Testing

### Unit Test Example

```tsx
import { render, screen } from '@testing-library/react';
import { InnerSelfPatternCard } from '@/components/Landing';

describe('InnerSelfPatternCard', () => {
  it('renders the card with title', () => {
    render(<InnerSelfPatternCard />);
    expect(screen.getByText('Discover yourself')).toBeInTheDocument();
  });

  it('displays all pattern tags', () => {
    render(<InnerSelfPatternCard />);
    expect(screen.getByText('morning run')).toBeInTheDocument();
    expect(screen.getByText('photography')).toBeInTheDocument();
    expect(screen.getByText('meditation')).toBeInTheDocument();
  });

  it('renders pattern images', () => {
    render(<InnerSelfPatternCard />);
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
  });
});
```

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers

## Accessibility

The component includes:
- Semantic HTML elements
- Alternative text for images
- Proper heading hierarchy
- ARIA labels where applicable

To enhance accessibility:

```tsx
<div 
  className="..."
  role="region"
  aria-label="Pattern analysis visualization"
>
  {/* content */}
</div>
```

## Troubleshooting

### Images Not Loading

**Issue**: Figma CDN images showing 404
**Solution**: Download and host images locally

```tsx
// Replace this:
const imgImage250 = "https://www.figma.com/api/mcp/asset/...";

// With this:
const imgImage250 = "/images/patterns/image-250.jpg";
```

### Layout Issues

**Issue**: Elements overlapping or misaligned
**Solution**: Check that Tailwind CSS is properly configured

```bash
# Verify tailwind config includes the component file
# In tailwind.config.ts:
content: [
  "./apps/web/components/**/*.{js,ts,jsx,tsx}",
  // ...
]
```

### Font Not Rendering

**Issue**: Terminal Grotesque font not showing
**Solution**: Ensure font is loaded in layout

```tsx
// In apps/web/app/layout.tsx
import { terminalGrotesqueOpen } from '@/components/providers';

export default function RootLayout({ children }) {
  return (
    <html className={terminalGrotesqueOpen.variable}>
      {/* ... */}
    </html>
  );
}
```

## Deployment Notes

1. **Image Assets**: Replace Figma CDN URLs before production
2. **CSS Classes**: Ensure Tailwind purging doesn't remove custom classes
3. **Fonts**: Verify Terminal Grotesque font loads correctly
4. **Performance**: Consider lazy-loading images for performance

## Support

For issues or questions:
1. Check the README.md in the component directory
2. Review the demo implementation
3. Consult the Figma design file for reference
