/**
 * Gamification Nudge Strategy
 * 
 * Uses streak recovery, points, and achievements to motivate return.
 * Best for: Competitive users, streak recovery scenarios.
 */

import { v4 as uuid } from 'uuid';
import type { ReengagementData, SpotlightInsight } from '../../types';
import type { ReengagementStrategyHandler, InsightTemplate } from '../types';
import { fillTemplate, STRATEGY_REQUIREMENTS } from '../types';

const TEMPLATES: InsightTemplate[] = [
  {
    titleTemplate: "Your {{currentStreak}}-day streak is at risk",
    bodyTemplate: "Write today to keep your streak alive. Don't let it slip away.",
    icon: "🔥",
    actionLabel: "Save Streak",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Streak broken? Start fresh",
    bodyTemplate: "Your {{peakStreak}}-day record is waiting to be beaten. Day 1 starts now.",
    icon: "💪",
    actionLabel: "New Streak",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "{{peakStreak}} days was your best",
    bodyTemplate: "Can you beat your personal record? Today could be the start of something bigger.",
    icon: "🏅",
    actionLabel: "Start Challenge",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Level up your journaling",
    bodyTemplate: "With {{totalEntries}} entries, you're making progress. Keep climbing.",
    icon: "📈",
    actionLabel: "Continue",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Day 1 of your comeback",
    bodyTemplate: "Every streak starts with a single entry. Begin your next chapter.",
    icon: "🚀",
    actionLabel: "Start Day 1",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Only {{toMilestone}} entries to {{milestone}}!",
    bodyTemplate: "You're so close to a milestone. Push through!",
    icon: "🎯",
    actionLabel: "Write Now",
    actionTarget: "/journal/new",
  },
];

function getMilestoneInfo(total: number): { milestone: number; toMilestone: number } {
  const milestones = [10, 25, 50, 75, 100, 150, 200, 250, 300, 500, 750, 1000];
  const nextMilestone = milestones.find(m => m > total) ?? total + 50;
  return {
    milestone: nextMilestone,
    toMilestone: nextMilestone - total,
  };
}

export const gamificationNudgeStrategy: ReengagementStrategyHandler = {
  type: 'gamification_nudge',
  name: 'Gamification Nudge',
  
  priorities: {
    none: 99,
    mild: 5,
    moderate: 4,
    critical: 3,
  },
  
  canGenerate(data: ReengagementData): boolean {
    const req = STRATEGY_REQUIREMENTS.gamification_nudge;
    return data.totalEntries >= req.minEntries;
  },
  
  generate(data: ReengagementData): SpotlightInsight | null {
    let template: InsightTemplate;
    
    // Active streak at risk (only 1-2 days inactive with existing streak)
    if (data.currentStreak > 0 && data.daysInactive <= 2) {
      template = TEMPLATES[0]!;
    } 
    // Just lost streak (3-7 days, had a good streak)
    else if (data.daysInactive <= 7 && data.peakStreak >= 5) {
      template = TEMPLATES[1]!;
    }
    // Longer absence but had impressive streak
    else if (data.peakStreak >= 10) {
      template = TEMPLATES[2]!;
    }
    // Close to milestone
    else if (data.entriesToNextMilestone <= 5) {
      template = TEMPLATES[5]!;
    }
    // Has some history
    else if (data.totalEntries >= 5) {
      template = TEMPLATES[3]!;
    }
    // Fresh start messaging
    else {
      template = TEMPLATES[4]!;
    }

    const { milestone, toMilestone } = getMilestoneInfo(data.totalEntries);
    const vars = {
      currentStreak: data.currentStreak,
      peakStreak: data.peakStreak,
      totalEntries: data.totalEntries,
      milestone: milestone,
      toMilestone: toMilestone,
    };

    return {
      id: uuid(),
      type: 'reengagement',
      strategyType: 'gamification_nudge',
      title: fillTemplate(template.titleTemplate, vars),
      body: fillTemplate(template.bodyTemplate, vars),
      icon: template.icon,
      actionLabel: template.actionLabel,
      actionTarget: template.actionTarget,
      priority: this.priorities.moderate,
    };
  },
};
