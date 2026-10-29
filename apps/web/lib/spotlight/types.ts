/**
 * AI Spotlight Personalization V2 - Type Definitions
 * 
 * Core types for activity score calculation, blend ratios,
 * and re-engagement strategies.
 */

// ============================================
// RAW DATA TYPES
// ============================================

export interface JournalEntry {
  id: string;
  createdAt: Date;
  wordCount: number;
  hasAnalysis: boolean;
  editCount?: number;
  sentiment?: number;
}

export interface UserOnboardingData {
  goal?: string;
  interests?: string[];
  preferredJournalTypes?: string[];
  energyLevel?: string;
  commitment?: boolean;
  reflection?: string;
}

export interface WaitlistData {
  firstName?: string;
  goals?: string[];
  interests?: string[];
  energyLevel?: string;
  reflection?: string;
}

export interface SessionLog {
  date: Date;
  timeSpentMs: number;
  interactions: number;
}

// ============================================
// METRIC TYPES
// ============================================

export interface CoreMetrics {
  /** Time-decayed entry frequency (0-1) */
  baseActivity: number;
  /** Analysis rate + word depth + edit effort (0-1) */
  engagementDepth: number;
  /** Streak health + day coverage (0-1) */
  consistencyIndex: number;
}

export interface MetricBreakdown {
  // Base Activity components
  decayedEntrySum: number;
  expectedEntries: number;
  
  // Engagement Depth components
  analysisRate: number;
  wordDepth: number;
  editEffort: number;
  
  // Consistency Index components
  activeDaysCoverage: number;
  streakHealth: number;
}

// ============================================
// MODIFIER TYPES
// ============================================

export interface DynamicModifiers {
  /** Activity trend multiplier (0.8 → 1.2) */
  momentumMultiplier: number;
  /** Tiered boost based on last activity (+0.02 to +0.10) */
  recencyBoost: number;
  /** Logarithmic streak bonus (+0.05 to +0.25) */
  streakBonus: number;
  /** Behavioral shift detection (±0.05) */
  microSignalAdjust: number;
}

export interface MomentumData {
  velocity: number;
  acceleration: number;
  multiplier: number;
}

export type MicroSignalType = 
  | 'word_increase' 
  | 'word_decrease' 
  | 'analysis_increase' 
  | 'analysis_decrease' 
  | 'time_shift';

export interface MicroSignal {
  type: MicroSignalType;
  detected: boolean;
  adjustment: number;
}

// ============================================
// SCORE TYPES
// ============================================

export interface ScoreBreakdown {
  // Core metrics
  baseActivity: number;
  engagementDepth: number;
  consistencyIndex: number;
  
  // Modifiers
  momentumMultiplier: number;
  recencyBoost: number;
  streakBonus: number;
  microSignalAdjust: number;
  
  // Intermediate values
  rawScore: number;
  adjustedScore: number;
}

export type Trend = 'rising' | 'stable' | 'declining';
export type Urgency = 'none' | 'mild' | 'moderate' | 'critical';

// Aliases for backwards compatibility
export type ActivityTrend = Trend;
export type UserTrend = Trend;
export type ReengagementUrgency = Urgency;

// Activity snapshot for momentum calculation
export interface ActivitySnapshot {
  date: Date;
  score: number;
  journalCount: number;
  analysisCount: number;
}

export interface ActivityScoreResult {
  /** Final activity score (0-1) */
  score: number;
  /** Detailed score breakdown */
  breakdown: ScoreBreakdown;
  /** Activity trend direction */
  trend: Trend;
  /** Re-engagement urgency level */
  urgency: Urgency;
  /** Timestamp of calculation */
  calculatedAt: Date;
  /** Computation time in ms */
  computationMs: number;
}

// ============================================
// BLEND TYPES
// ============================================

export interface BlendRatios {
  /** Weight for waitlist/onboarding-based insights */
  waitlist: number;
  /** Weight for journal analysis-based insights */
  journal: number;
  /** Weight for re-engagement strategies */
  reengagement: number;
}

export interface BlendResult {
  ratios: BlendRatios;
  primarySource: 'waitlist' | 'journal' | 'reengagement';
  reasoning: string;
}

// ============================================
// RE-ENGAGEMENT TYPES
// ============================================

export type ReengagementStrategy = 
  | 'achievement_highlight'
  | 'progress_reminder'
  | 'nostalgia_hook'
  | 'gamification_nudge'
  | 'pattern_trigger'
  | 'low_effort_prompt'
  | 'mood_callback'
  // Journal insight strategies
  | 'journal_sentiment'
  | 'journal_trend'
  | 'journal_topic'
  | 'journal_stress'
  | 'journal_emotion'
  | 'journal_growth'
  | 'journal_pattern'
  | 'journal_insight'
  // Waitlist insight strategies
  | 'waitlist_welcome'
  | 'waitlist_goal'
  | 'waitlist_interest'
  | 'waitlist_milestone'
  | 'waitlist_momentum'
  | 'waitlist_feature'
  | 'waitlist_reengagement'
  | 'waitlist_onboarding';

export interface WritingPatterns {
  /** Days user typically writes (e.g., ['Monday', 'Wednesday']) */
  preferredDays: string[];
  /** Hours user typically writes (0-23) */
  preferredHours: number[];
  /** Average session duration in minutes */
  avgSessionMinutes: number;
  /** Most active day of week */
  mostActiveDay?: string;
  /** Most active hour (0-23) */
  mostActiveHour?: number;
}

export interface LastPositiveEntry {
  date: Date;
  sentiment: number;
  topTopic: string;
}

export interface ReengagementData {
  // Timing
  daysInactive: number;
  lastActiveAt: Date | null;
  
  // Achievements
  peakStreak: number;
  currentStreak: number;
  totalEntries: number;
  totalAnalyses: number;
  entriesToNextMilestone: number;
  
  // Patterns
  writingPatterns: WritingPatterns;
  
  // Content hooks
  favoriteTopics: string[];
  lastPositiveEntry: LastPositiveEntry | null;
  
  // Unfinished business
  unanalyzedCount: number;
  draftCount: number;
}

// ============================================
// INSIGHT TYPES
// ============================================

export type InsightType = 'waitlist' | 'journal' | 'reengagement';

export interface SpotlightInsight {
  id: string;
  type: InsightType;
  strategyType?: ReengagementStrategy;
  title: string;
  body: string;
  icon?: string;
  actionLabel?: string;
  actionTarget?: string;
  priority: number;
  expiresAt?: Date;
}

export interface SpotlightCacheData {
  userId: string;
  activityScore: number;
  scoreBreakdown: ScoreBreakdown;
  trend: Trend;
  urgency: Urgency;
  blendRatios: BlendRatios;
  insights: SpotlightInsight[];
  generatedAt: Date;
  expiresAt: Date;
  computationMs: number;
}

// ============================================
// INPUT TYPES FOR CALCULATION
// ============================================

export interface ActivityScoreInput {
  journals: JournalEntry[];
  onboarding?: UserOnboardingData;
  waitlist?: WaitlistData;
  sessions?: SessionLog[];
  currentStreak: number;
  longestStreak: number;
  accountAgeDays: number;
}

export interface UserActivityData {
  // Journal metrics
  journalCount: number;
  analysisCount: number;
  totalWordCount: number;
  avgWordCount: number;
  
  // Time metrics
  accountAgeDays: number;
  daysActive: number;
  lastEntryAt: Date | null;
  
  // Streak metrics
  currentStreak: number;
  longestStreak: number;
  
  // Recent activity
  entriesLast7Days: number;
  entriesPrev7Days: number;
  analysesLast7Days: number;
  
  // Edit metrics
  avgEditCount: number;
}

// ============================================
// CACHE TYPES
// ============================================

export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 6 hours) */
  ttlMs: number;
  /** Force refresh even if cache is valid */
  forceRefresh?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  generatedAt: Date;
  expiresAt: Date;
  invalidatedAt?: Date;
  invalidationReason?: string;
}
