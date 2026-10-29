/**
 * Mood Callback Strategy
 * 
 * References previous positive emotional entries to create connection.
 * Best for: Emotional anchoring, building on positive experiences.
 */

import { v4 as uuid } from 'uuid';
import type { ReengagementData, SpotlightInsight } from '../../types';
import type { ReengagementStrategyHandler, InsightTemplate } from '../types';
import { fillTemplate, STRATEGY_REQUIREMENTS } from '../types';

const TEMPLATES: InsightTemplate[] = [
  {
    titleTemplate: "How are you feeling today?",
    bodyTemplate: "Last time you wrote about {{topic}}, you seemed {{mood}}. Check in with yourself.",
    icon: "💫",
    actionLabel: "Mood Check",
    actionTarget: "/journal/new?mode=mood",
  },
  {
    titleTemplate: "That positive energy from {{daysAgo}} days ago",
    bodyTemplate: "You captured a great moment recently. Let's see how today compares.",
    icon: "☀️",
    actionLabel: "Compare Now",
    actionTarget: "/journal/new?mode=mood",
  },
  {
    titleTemplate: "Your emotional journey continues",
    bodyTemplate: "Tracking your moods over time reveals powerful patterns. Add today's entry.",
    icon: "📈",
    actionLabel: "Track Mood",
    actionTarget: "/journal/new?mode=mood",
  },
  {
    titleTemplate: "Remember that {{mood}} feeling?",
    bodyTemplate: "You wrote about feeling {{mood}} when discussing {{topic}}. What's changed?",
    icon: "🎭",
    actionLabel: "Reflect",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Continue your emotional log",
    bodyTemplate: "Your mood entries help build a picture of your well-being over time.",
    icon: "📊",
    actionLabel: "New Entry",
    actionTarget: "/journal/new?mode=mood",
  },
];

function sentimentToMood(sentiment: number): string {
  if (sentiment >= 0.7) return 'great';
  if (sentiment >= 0.5) return 'good';
  if (sentiment >= 0.3) return 'okay';
  if (sentiment >= 0.1) return 'thoughtful';
  return 'reflective';
}

function getDaysAgo(date: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export const moodCallbackStrategy: ReengagementStrategyHandler = {
  type: 'mood_callback',
  name: 'Mood Callback',
  
  priorities: {
    none: 99,
    mild: 5,
    moderate: 4,
    critical: 4,
  },
  
  canGenerate(data: ReengagementData): boolean {
    const req = STRATEGY_REQUIREMENTS.mood_callback;
    
    // Need sufficient entries
    if (data.totalEntries < req.minEntries) return false;
    
    // Ideally have a positive entry to reference
    if (req.requiresPositiveEntry && !data.lastPositiveEntry) {
      // Can still generate with enough entries
      return data.totalEntries >= 10;
    }
    
    return true;
  },
  
  generate(data: ReengagementData): SpotlightInsight | null {
    let template: InsightTemplate;
    
    const hasPositive = data.lastPositiveEntry !== null;
    const daysAgo = hasPositive ? getDaysAgo(data.lastPositiveEntry!.date) : 0;
    const topic = hasPositive 
      ? data.lastPositiveEntry!.topTopic 
      : (data.favoriteTopics[0] ?? 'life');
    const mood = hasPositive 
      ? sentimentToMood(data.lastPositiveEntry!.sentiment)
      : 'positive';
    
    // Select template based on context
    if (hasPositive && daysAgo <= 14) {
      // Recent positive entry
      if (data.lastPositiveEntry!.sentiment >= 0.6) {
        template = TEMPLATES[1]!;
      } else {
        template = TEMPLATES[0]!;
      }
    } else if (hasPositive) {
      // Older positive entry
      template = TEMPLATES[3]!;
    } else if (data.totalEntries >= 10) {
      // Has history but no positive entry reference
      template = TEMPLATES[2]!;
    } else {
      // Fallback
      template = TEMPLATES[4]!;
    }

    const vars = {
      topic: capitalizeFirst(topic),
      mood: mood,
      daysAgo: daysAgo,
    };

    return {
      id: uuid(),
      type: 'reengagement',
      strategyType: 'mood_callback',
      title: fillTemplate(template.titleTemplate, vars),
      body: fillTemplate(template.bodyTemplate, vars),
      icon: template.icon,
      actionLabel: template.actionLabel,
      actionTarget: template.actionTarget,
      priority: this.priorities.moderate,
    };
  },
};
