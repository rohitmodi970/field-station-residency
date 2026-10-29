/**
 * Pattern Trigger Strategy
 * 
 * Uses detected writing patterns to trigger contextual prompts.
 * Best for: Users with established routines who've drifted.
 */

import { v4 as uuid } from 'uuid';
import type { ReengagementData, SpotlightInsight } from '../../types';
import type { ReengagementStrategyHandler, InsightTemplate } from '../types';
import { fillTemplate, STRATEGY_REQUIREMENTS } from '../types';

const TEMPLATES: InsightTemplate[] = [
  {
    titleTemplate: "It's {{dayName}} - your writing day",
    bodyTemplate: "You usually journal on {{dayName}}s. Continue your routine?",
    icon: "📅",
    actionLabel: "Write Now",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Your {{timeOfDay}} journaling time",
    bodyTemplate: "You often write around this time. The habit's still there.",
    icon: "⏰",
    actionLabel: "Continue Routine",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Missing your {{dayName}} ritual",
    bodyTemplate: "{{dayName}}s were your most consistent writing days. Bring it back?",
    icon: "🔄",
    actionLabel: "Resume Routine",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "{{avgMinutes}} mins used to be your sweet spot",
    bodyTemplate: "Your typical session was {{avgMinutes}} minutes. Perfect for a quick reflection.",
    icon: "⏱️",
    actionLabel: "Quick Session",
    actionTarget: "/journal/new?mode=quick",
  },
  {
    titleTemplate: "Your writing rhythm awaits",
    bodyTemplate: "Based on your history, now is usually when you'd reflect. Ready?",
    icon: "🎵",
    actionLabel: "Let's Go",
    actionTarget: "/journal/new",
  },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getCurrentDayName(): string {
  return DAYS[new Date().getDay()] ?? 'Monday';
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function isCurrentTimeNearPreferred(preferredHours: number[]): boolean {
  const currentHour = new Date().getHours();
  return preferredHours.some(h => Math.abs(h - currentHour) <= 2);
}

export const patternTriggerStrategy: ReengagementStrategyHandler = {
  type: 'pattern_trigger',
  name: 'Pattern Trigger',
  
  priorities: {
    none: 99,
    mild: 2,
    moderate: 2,
    critical: 4,
  },
  
  canGenerate(data: ReengagementData): boolean {
    const req = STRATEGY_REQUIREMENTS.pattern_trigger;
    const patterns = data.writingPatterns;
    
    return (
      data.totalEntries >= req.minEntries &&
      data.daysInactive >= req.minDaysInactive &&
      (patterns.preferredDays.length > 0 || patterns.preferredHours.length > 0)
    );
  },
  
  generate(data: ReengagementData): SpotlightInsight | null {
    const patterns = data.writingPatterns;
    const currentDay = getCurrentDayName();
    let template: InsightTemplate;
    
    // Check if today is a preferred writing day
    const isTodayPreferred = patterns.preferredDays.includes(currentDay);
    const isTimePreferred = isCurrentTimeNearPreferred(patterns.preferredHours);
    
    if (isTodayPreferred && isTimePreferred) {
      // Perfect timing - both day and time match
      template = TEMPLATES[0]!;
    } else if (isTimePreferred) {
      // Time matches their usual pattern
      template = TEMPLATES[1]!;
    } else if (isTodayPreferred) {
      // Day matches
      template = TEMPLATES[2]!;
    } else if (patterns.avgSessionMinutes > 0) {
      // Fall back to session length
      template = TEMPLATES[3]!;
    } else {
      // Generic pattern message
      template = TEMPLATES[4]!;
    }

    const vars = {
      dayName: patterns.mostActiveDay ?? currentDay,
      timeOfDay: getTimeOfDay(),
      avgMinutes: Math.round(patterns.avgSessionMinutes),
    };

    return {
      id: uuid(),
      type: 'reengagement',
      strategyType: 'pattern_trigger',
      title: fillTemplate(template.titleTemplate, vars),
      body: fillTemplate(template.bodyTemplate, vars),
      icon: template.icon,
      actionLabel: template.actionLabel,
      actionTarget: template.actionTarget,
      priority: this.priorities.moderate,
    };
  },
};
