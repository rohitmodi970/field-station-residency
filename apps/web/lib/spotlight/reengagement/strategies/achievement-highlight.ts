/**
 * Achievement Highlight Strategy
 * 
 * Celebrates user achievements and milestones to encourage return.
 * Best for: Users with established history, moderate to critical urgency.
 */

import { v4 as uuid } from 'uuid';
import type { ReengagementData, SpotlightInsight } from '../../types';
import type { ReengagementStrategyHandler, InsightTemplate } from '../types';
import { fillTemplate, STRATEGY_REQUIREMENTS } from '../types';

const TEMPLATES: InsightTemplate[] = [
  {
    titleTemplate: "Your {{peakStreak}}-day streak was a strong run",
    bodyTemplate: "You once journaled for {{peakStreak}} days straight. Ready to start a new streak?",
    icon: "🏆",
    actionLabel: "Start New Streak",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "{{totalEntries}} stories and counting",
    bodyTemplate: "You've written {{totalEntries}} journal entries. Each one captured a moment worth remembering.",
    icon: "📚",
    actionLabel: "Add Another",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "{{milestone}} entries milestone ahead!",
    bodyTemplate: "Just {{entriesToNextMilestone}} more entries to reach {{milestone}}. You're close.",
    icon: "🎯",
    actionLabel: "Write Entry #{{nextEntry}}",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Remember your writing journey?",
    bodyTemplate: "{{totalAnalyses}} of your entries have been analyzed. Your growth patterns are fascinating.",
    icon: "📊",
    actionLabel: "Explore Insights",
    actionTarget: "/journal",
  },
  {
    titleTemplate: "You're among the most consistent journalers",
    bodyTemplate: "With {{totalEntries}} entries, you've built a meaningful practice. Keep the momentum going.",
    icon: "⭐",
    actionLabel: "Continue",
    actionTarget: "/journal/new",
  },
];

function getMilestoneTarget(total: number): number {
  const milestones = [10, 25, 50, 100, 150, 200, 250, 300, 500, 750, 1000];
  return milestones.find(m => m > total) ?? total + 50;
}

export const achievementHighlightStrategy: ReengagementStrategyHandler = {
  type: 'achievement_highlight',
  name: 'Achievement Highlight',
  
  priorities: {
    none: 99,
    mild: 4,
    moderate: 1, // Top priority for moderate
    critical: 1, // Top priority for critical
  },
  
  canGenerate(data: ReengagementData): boolean {
    const req = STRATEGY_REQUIREMENTS.achievement_highlight;
    return (
      data.totalEntries >= req.minEntries &&
      (data.peakStreak >= req.minStreak || data.totalEntries >= 10)
    );
  },
  
  generate(data: ReengagementData): SpotlightInsight | null {
    let template: InsightTemplate;
    
    // Select based on what's most impressive
    if (data.peakStreak >= 7) {
      // Impressive streak to highlight
      template = TEMPLATES[0]!;
    } else if (data.entriesToNextMilestone <= 5) {
      // Close to milestone
      template = TEMPLATES[2]!;
    } else if (data.totalAnalyses >= 5) {
      // Has analysis history
      template = TEMPLATES[3]!;
    } else if (data.totalEntries >= 20) {
      // Solid entry count
      template = TEMPLATES[4]!;
    } else {
      // Default to entries count
      template = TEMPLATES[1]!;
    }

    const milestone = getMilestoneTarget(data.totalEntries);
    const vars = {
      peakStreak: data.peakStreak,
      totalEntries: data.totalEntries,
      totalAnalyses: data.totalAnalyses,
      entriesToNextMilestone: data.entriesToNextMilestone,
      milestone: milestone,
      nextEntry: data.totalEntries + 1,
    };

    return {
      id: uuid(),
      type: 'reengagement',
      strategyType: 'achievement_highlight',
      title: fillTemplate(template.titleTemplate, vars),
      body: fillTemplate(template.bodyTemplate, vars),
      icon: template.icon,
      actionLabel: fillTemplate(template.actionLabel ?? 'Continue', vars),
      actionTarget: template.actionTarget,
      priority: this.priorities.moderate,
    };
  },
};
