/**
 * Waitlist Insights Generator
 * 
 * Generates personalized insights for new users based on their onboarding data.
 * Focuses on getting-started guidance, goal-oriented prompts, and feature discovery.
 */

import { createAdminClient } from '@/utils/supabase/admin';
import type { SpotlightInsight } from '../types';
import type { WaitlistInsightData, WaitlistInsightOptions } from './types';
import { maybeRewriteInsightsWithLLM, sanitizeInsightCopy } from './copy-style';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_OPTIONS: Required<WaitlistInsightOptions> = {
  maxInsights: 3,
  personalizationLevel: 'moderate',
  includeGoalPrompts: true,
  includeOnboarding: true,
  useAI: false,
  aiProvider: 'claude',
};

// Insight template type for waitlist
interface WaitlistInsightTemplate {
  id: string;
  condition: (data: WaitlistInsightData) => boolean;
  generate: (data: WaitlistInsightData) => Omit<SpotlightInsight, 'id' | 'type'>;
  priority: number;
}

// ============================================
// GOAL-BASED TEMPLATES
// ============================================

const GOAL_TEMPLATES: Record<string, Omit<SpotlightInsight, 'id' | 'type'>> = {
  'mental-health': {
    title: 'Start your mental wellness practice',
    body: 'Use your next entry to check in honestly with how you feel today.',
    icon: '🧠',
    priority: 80,
    strategyType: 'waitlist_goal',
    actionLabel: 'Write your first entry',
    actionTarget: '/journal/new?prompt=mental-health',
  },
  'self-reflection': {
    title: 'Begin a simple reflection practice',
    body: 'Start with one question: what felt meaningful today, and why?',
    icon: '🔍',
    priority: 80,
    strategyType: 'waitlist_goal',
    actionLabel: 'Start reflecting',
    actionTarget: '/journal/new?prompt=reflection',
  },
  'stress-management': {
    title: 'Use journaling to lower stress',
    body: 'Name what feels heavy right now, then write one small next step you can take.',
    icon: '🌿',
    priority: 80,
    strategyType: 'waitlist_goal',
    actionLabel: 'Unload your thoughts',
    actionTarget: '/journal/new?prompt=stress',
  },
  'gratitude': {
    title: 'Build a gratitude habit',
    body: 'Write down three things you appreciate today, even if they seem small.',
    icon: '🙏',
    priority: 80,
    strategyType: 'waitlist_goal',
    actionLabel: 'Practice gratitude',
    actionTarget: '/journal/new?prompt=gratitude',
  },
  'goal-tracking': {
    title: 'Track your goals through writing',
    body: 'Clarify what you are working toward and what progress would look like this week.',
    icon: '🎯',
    priority: 80,
    strategyType: 'waitlist_goal',
    actionLabel: 'Set your goals',
    actionTarget: '/journal/new?prompt=goals',
  },
  'creativity': {
    title: 'Open up creative thinking',
    body: 'Try five minutes of freewriting without editing to surface new ideas.',
    icon: '✨',
    priority: 80,
    strategyType: 'waitlist_goal',
    actionLabel: 'Get creative',
    actionTarget: '/journal/new?prompt=creativity',
  },
  'memory-keeping': {
    title: 'Capture moments you want to keep',
    body: 'Write one moment from today that you want to remember later.',
    icon: '📓',
    priority: 80,
    strategyType: 'waitlist_goal',
    actionLabel: 'Capture today',
    actionTarget: '/journal/new',
  },
  'personal-growth': {
    title: 'Grow through reflection',
    body: 'What have you learned about yourself recently, and how can you build on it?',
    icon: '🌱',
    priority: 80,
    strategyType: 'waitlist_goal',
    actionLabel: 'Reflect and grow',
    actionTarget: '/journal/new?prompt=growth',
  },
};

// ============================================
// WAITLIST INSIGHT TEMPLATES
// ============================================

const WAITLIST_INSIGHT_TEMPLATES: WaitlistInsightTemplate[] = [
  // Brand new user (day 1)
  {
    id: 'welcome-day-one',
    condition: (data) => data.daysSinceSignup <= 1 && data.entryCount === 0,
    generate: (data) => ({
      title: `Welcome to FORCE, ${data.name || 'there'}`,
      body: 'Your journaling journey starts here. Take two minutes to write a first entry.',
      icon: '👋',
      priority: 100,
      strategyType: 'waitlist_welcome' as const,
      actionLabel: 'Write first entry',
      actionTarget: '/journal/new?onboarding=true',
    }),
    priority: 100,
  },

  // Goal-based insight (personalized to user's goal)
  {
    id: 'goal-personalized',
    condition: (data) => (data.goals?.length ?? 0) > 0 && data.entryCount < 3,
    generate: (data) => {
      const goal = (data.goals?.[0] ?? '').toLowerCase();
      // Try to match to a known goal template
      const matchedTemplate = Object.entries(GOAL_TEMPLATES).find(([key]) => 
        goal.includes(key) || key.split('-').some(part => goal.includes(part))
      );
      
      if (matchedTemplate) {
        return matchedTemplate[1];
      }
      
      // Generic goal-based fallback
      return {
        title: `Let's focus on "${data.goals?.[0] ?? 'your goal'}"`,
        body: `You mentioned you want to ${goal || 'make progress'}. Start by writing why this matters to you now.`,
        icon: '🎯',
        priority: 85,
        strategyType: 'waitlist_goal' as const,
        actionLabel: 'Get started',
        actionTarget: '/journal/new',
      };
    },
    priority: 90,
  },

  // Interest-based exploration
  {
    id: 'interest-explore',
    condition: (data) => (data.interests?.length ?? 0) > 0 && data.entryCount < 5,
    generate: (data) => {
      const interest = data.interests?.[0] ?? 'your interests';
      return {
        title: `Explore your interest in ${interest}`,
        body: `You mentioned ${interest}. Write about how it fits into your life right now.`,
        icon: '💡',
        priority: 70,
        strategyType: 'waitlist_interest' as const,
        actionLabel: 'Explore this',
        actionTarget: `/journal/new?topic=${encodeURIComponent(interest)}`,
      };
    },
    priority: 70,
  },

  // Welcome message for brand new users (first 2 days, no entries)
  {
    id: 'welcome-early',
    condition: (data) => data.daysSinceSignup < 3 && data.entryCount === 0,
    generate: (data) => ({
      title: `Welcome${data.name ? `, ${data.name}` : ''}`,
      body: 'This is your space to think clearly and write honestly. No pressure, just a place to begin.',
      icon: '🌟',
      priority: 95, // Highest priority for new users
      strategyType: 'waitlist_onboarding' as const,
      actionLabel: 'Write your first entry',
      actionTarget: '/journal/new',
    }),
    priority: 95,
  },

  // First week milestone
  {
    id: 'first-week',
    condition: (data) => data.daysSinceSignup >= 3 && data.daysSinceSignup <= 7 && data.entryCount === 0,
    generate: (data) => ({
      title: `You've been here ${data.daysSinceSignup} days`,
      body: 'Ready to start journaling? Even a single sentence counts. Your future self will thank you.',
      icon: '📅',
      priority: 88,
      strategyType: 'waitlist_milestone' as const,
      actionLabel: 'Start now',
      actionTarget: '/journal/new',
    }),
    priority: 88,
  },

  // Second week nudge (day 8-13, no entries)
  {
    id: 'second-week-nudge',
    condition: (data) => data.daysSinceSignup >= 8 && data.daysSinceSignup < 14 && data.entryCount === 0,
    generate: () => ({
      title: 'Your journal is waiting',
      body: "No rush, no judgment. Whenever you're ready, even a few words can be a powerful start.",
      icon: '✍️',
      priority: 70,
      strategyType: 'waitlist_reengagement' as const,
      actionLabel: 'Maybe today?',
      actionTarget: '/journal/new',
    }),
    priority: 70,
  },

  // Has started journaling - encourage continuation
  {
    id: 'continue-momentum',
    condition: (data) => data.entryCount >= 1 && data.entryCount < 5,
    generate: (data) => ({
      title: `${data.entryCount} ${data.entryCount === 1 ? 'entry' : 'entries'} and counting`,
      body: 'Great start! Keep the momentum going. Consistent journaling builds powerful habits.',
      icon: '🚀',
      priority: 75,
      strategyType: 'waitlist_momentum' as const,
      actionLabel: 'Keep going',
      actionTarget: '/journal/new',
    }),
    priority: 75,
  },

  // Feature discovery: AI analysis
  {
    id: 'discover-analysis',
    condition: (data) => data.entryCount >= 2 && data.daysSinceSignup >= 2,
    generate: () => ({
      title: 'Review patterns in your entries',
      body: 'Your entries can surface useful patterns in mood, stress, and focus over time.',
      icon: '📊',
      priority: 60,
      strategyType: 'waitlist_feature' as const,
      actionLabel: 'View patterns',
      actionTarget: '/journal',
    }),
    priority: 60,
  },

  // Feature discovery: voice journaling
  {
    id: 'discover-voice',
    condition: (data) => data.entryCount >= 1,
    generate: () => ({
      title: 'Try voice journaling',
      body: 'If typing feels slow, speak your thoughts and let the app turn them into text.',
      icon: '🎙️',
      priority: 55,
      strategyType: 'waitlist_feature' as const,
      actionLabel: 'Try voice entry',
      actionTarget: '/journal/new?mode=voice',
    }),
    priority: 55,
  },

  // Gentle re-engagement (inactive but signed up)
  {
    id: 'gentle-nudge',
    condition: (data) => data.daysSinceSignup >= 14 && data.entryCount === 0,
    generate: (data) => ({
      title: `Still here for you, ${data.name || 'friend'}`,
      body: 'Whenever you are ready, your journal is waiting. No pressure, just possibility.',
      icon: '💙',
      priority: 65,
      strategyType: 'waitlist_reengagement' as const,
      actionLabel: 'Maybe today?',
      actionTarget: '/journal/new',
    }),
    priority: 65,
  },

  // Onboarding completion prompt
  {
    id: 'complete-profile',
    condition: (data) => !data.profileComplete && data.daysSinceSignup >= 1,
    generate: () => ({
      title: 'Complete your profile',
      body: 'Help us personalize your experience. A few details go a long way.',
      icon: '⚙️',
      priority: 50,
      strategyType: 'waitlist_onboarding' as const,
      actionLabel: 'Complete profile',
      actionTarget: '/settings/profile',
    }),
    priority: 50,
  },
];

// ============================================
// DATA FETCHING
// ============================================

export async function fetchWaitlistData(userId: string): Promise<WaitlistInsightData | null> {
  const adminClient = createAdminClient();

  // Fetch base user data
  const { data: user, error: userError } = await adminClient
    .from('users')
    .select('id, created_at, name, profile_image')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    console.error('[Waitlist Generator] Failed to fetch user:', userError);
    return null;
  }

  // Fetch optional extended profile data
  const { data: userProfile } = await adminClient
    .from('user_profiles')
    .select('interests')
    .eq('user_id', userId)
    .maybeSingle();

  // Count journal entries
  const { count: entryCount, error: countError } = await adminClient
    .from('journals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    console.error('[Waitlist Generator] Failed to count entries:', countError);
  }

  // Calculate days since signup
  const createdAt = new Date(user.created_at);
  const now = new Date();
  const daysSinceSignup = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // Check if profile is complete
  const profileComplete = !!(user.name && user.profile_image);

  return {
    name: user.name?.split(' ')[0] || undefined,
    goals: [],
    interests: (userProfile?.interests as string[]) || [],
    daysSinceSignup,
    entryCount: entryCount || 0,
    profileComplete,
    hasStartedJournaling: (entryCount || 0) > 0,
  };
}

// ============================================
// MAIN GENERATOR
// ============================================

export async function generateWaitlistInsights(
  userId: string,
  options?: WaitlistInsightOptions
): Promise<SpotlightInsight[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Fetch waitlist data
  const waitlistData = await fetchWaitlistData(userId);
  
  if (!waitlistData) {
    // Return default welcome insight if we couldn't fetch data
    return [getDefaultWelcomeInsight()];
  }

  // Find matching templates
  const matchingTemplates = WAITLIST_INSIGHT_TEMPLATES
    .filter(template => template.condition(waitlistData))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, opts.maxInsights);

  // Generate insights
  const insights: SpotlightInsight[] = matchingTemplates.map(template => ({
    ...template.generate(waitlistData),
    id: `waitlist-${template.id}-${Date.now()}`,
    type: 'waitlist' as const,
  }));

  // If no templates matched, return default welcome insight
  if (insights.length === 0) {
    return [getDefaultWelcomeInsight()];
  }

  const sanitizedInsights = insights.map(sanitizeInsightCopy);

  return maybeRewriteInsightsWithLLM(sanitizedInsights, {
    useAI: opts.useAI,
    aiProvider: opts.aiProvider,
  }, {
    segment: 'waitlist',
    facts: [
      `daysSinceSignup=${waitlistData.daysSinceSignup}`,
      `entryCount=${waitlistData.entryCount}`,
      `profileComplete=${Boolean(waitlistData.profileComplete)}`,
      `firstName=${waitlistData.name || 'unknown'}`,
    ],
  });
}

/**
 * Default welcome insight for when no templates match or data fetch fails
 */
function getDefaultWelcomeInsight(): SpotlightInsight {
  return {
    id: `waitlist-default-welcome-${Date.now()}`,
    type: 'waitlist',
    title: 'Start your journaling journey',
    body: 'Welcome to your personal journal. This is your space to reflect, process, and grow.',
    icon: '🌟',
    priority: 90,
    strategyType: 'waitlist_onboarding',
    actionLabel: 'Begin writing',
    actionTarget: '/journal/new',
  };
}

export default generateWaitlistInsights;
