/**
 * Type definitions for Inner-Self Pattern Card component
 */

/**
 * Represents a pattern visualization element
 */
export interface PatternElement {
  /** Text label for the pattern */
  text: string;
  /** CSS left position */
  left: string;
  /** CSS top position */
  top: string;
  /** Image URL for pattern visualization */
  image?: string;
  /** Optional color/styling */
  color?: string;
}

/**
 * Image positioning and styling properties
 */
export interface PatternImageProps {
  /** Image source URL */
  src: string;
  /** CSS width value */
  width: string;
  /** CSS height value */
  height: string;
  /** CSS left position */
  left: string;
  /** CSS top position */
  top: string;
  /** Optional clip path */
  clipPath?: string;
  /** Additional Tailwind classes */
  className?: string;
}

/**
 * Pattern tag component props
 */
export interface PatternTagProps {
  /** Tag text content */
  text: string;
  /** CSS left position */
  left: string;
  /** CSS top position */
  top: string;
}

/**
 * Color scheme for the card
 */
export interface ColorScheme {
  /** Background color (default: #fffaf8) */
  background: string;
  /** Header/footer color (default: #e5e5e5) */
  headerFooter: string;
  /** Border color (default: #c9c9c9) */
  border: string;
  /** Text color (default: #000000) */
  text: string;
}

/**
 * Dimensions for the card
 */
export interface Dimensions {
  /** Card width in pixels (default: 386) */
  width: number;
  /** Card height in pixels (default: 464) */
  height: number;
  /** Border radius in pixels (default: 16) */
  borderRadius: number;
  /** Header height in pixels (default: 36) */
  headerHeight: number;
  /** Footer height in pixels (default: 36) */
  footerHeight: number;
}

/**
 * Pattern data for dynamic card rendering
 */
export interface PatternData {
  /** Unique identifier for the pattern */
  id: string;
  /** Display text for the pattern */
  text: string;
  /** Image URL */
  image: string;
  /** Position in the visualization area */
  position: {
    left: string;
    top: string;
  };
  /** Optional description or additional info */
  description?: string;
  /** Optional category */
  category?: string;
}

/**
 * Props for a dynamic/configurable Inner-Self Pattern Card
 */
export interface InnerSelfPatternCardProps {
  /** Array of pattern data to display */
  patterns?: PatternData[];
  /** Title text for the header */
  title?: string;
  /** Description text for the card body */
  description?: string;
  /** Card color scheme */
  colors?: Partial<ColorScheme>;
  /** Card dimensions */
  dimensions?: Partial<Dimensions>;
  /** Indicator dots config */
  indicators?: {
    active: number;
    total: number;
  };
  /** Optional callback when indicator is clicked */
  onIndicatorClick?: (index: number) => void;
  /** Optional CSS class name */
  className?: string;
  /** Optional aria-label for accessibility */
  ariaLabel?: string;
}

/**
 * Connection line between pattern elements
 */
export interface ConnectionLine {
  /** Starting pattern ID */
  from: string;
  /** Ending pattern ID */
  to: string;
  /** Optional styling class */
  className?: string;
}

/**
 * Insight data that can be displayed
 */
export interface PatternInsight {
  /** Main insight text */
  title: string;
  /** Detailed explanation */
  description: string;
  /** Related patterns */
  relatedPatterns: string[];
  /** Confidence score (0-1) */
  confidence?: number;
  /** Timestamp of analysis */
  timestamp?: Date;
}

/**
 * Default color scheme values
 */
export const DEFAULT_COLOR_SCHEME: ColorScheme = {
  background: '#fffaf8',
  headerFooter: '#e5e5e5',
  border: '#c9c9c9',
  text: '#000000',
};

/**
 * Default dimensions
 */
export const DEFAULT_DIMENSIONS: Dimensions = {
  width: 386,
  height: 464,
  borderRadius: 16,
  headerHeight: 36,
  footerHeight: 36,
};

/**
 * Default pattern data (for the current card)
 */
export const DEFAULT_PATTERNS: PatternData[] = [
  {
    id: 'morning-run',
    text: 'morning run',
    image: '/landing/discover_yourself/morning_run.png',
    position: { left: '144px', top: '114px' },
    category: 'activity',
  },
  {
    id: 'photography',
    text: 'photography',
    image: '/landing/discover_yourself/photograph.png',
    position: { left: '62px', top: '66px' },
    category: 'hobby',
  },
  {
    id: 'house',
    text: 'house',
    image: '/landing/discover_yourself/house.png',
    position: { left: '278px', top: '162px' },
    category: 'location',
  },
  {
    id: 'meditation',
    text: 'meditation',
    image: '/landing/discover_yourself/meditation.png',
    position: { left: '189px', top: '219px' },
    category: 'practice',
  },
  {
    id: 'coffee-shop',
    text: 'coffee shop',
    image: '/landing/discover_yourself/coffee_shop.png',
    position: { left: '83px', top: '207px' },
    category: 'location',
  },
  {
    id: 'gratitude',
    text: 'gratitude',
    image: '/landing/discover_yourself/gratitude.png',
    position: { left: '270px', top: '66px' },
    category: 'emotion',
  },
];
