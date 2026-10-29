/**
 * Progress Reminder Strategy
 * 
 * Highlights unfinished work (unanalyzed entries, drafts) to pull users back.
 * Best for: Users with pending work, curiosity-driven return.
 */

import { v4 as uuid } from 'uuid';
import type { ReengagementData, SpotlightInsight } from '../../types';
import type { ReengagementStrategyHandler, InsightTemplate } from '../types';
import { fillTemplate, STRATEGY_REQUIREMENTS } from '../types';

const TEMPLATES: InsightTemplate[] = [
  {
    titleTemplate: "{{unanalyzed}} entries waiting for insights",
    bodyTemplate: "Your unanalyzed entries might reveal interesting patterns. Let's explore them.",
    icon: "🔍",
    actionLabel: "Analyze Now",
    actionTarget: "/journal?filter=unanalyzed",
  },
  {
    titleTemplate: "Discover what you missed",
    bodyTemplate: "{{unanalyzed}} journal entries haven't been analyzed yet. Unlock their insights.",
    icon: "✨",
    actionLabel: "View Entries",
    actionTarget: "/journal?filter=unanalyzed",
  },
  {
    titleTemplate: "Your drafts are waiting",
    bodyTemplate: "You have {{drafts}} unfinished entries. Ready to complete them?",
    icon: "📝",
    actionLabel: "Continue Writing",
    actionTarget: "/journal?filter=drafts",
  },
  {
    titleTemplate: "{{totalAnalyses}} insights discovered so far",
    bodyTemplate: "Each analysis reveals new patterns. Add more entries to deepen understanding.",
    icon: "📊",
    actionLabel: "New Entry",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Uncover hidden patterns",
    bodyTemplate: "With {{totalEntries}} entries, there's likely patterns you haven't seen yet.",
    icon: "🧩",
    actionLabel: "Explore",
    actionTarget: "/journal",
  },
];

export const progressReminderStrategy: ReengagementStrategyHandler = {
  type: 'progress_reminder',
  name: 'Progress Reminder',
  
  priorities: {
    none: 99,
    mild: 4,
    moderate: 5,
    critical: 5,
  },
  
  canGenerate(data: ReengagementData): boolean {
    const req = STRATEGY_REQUIREMENTS.progress_reminder;
    return (
      data.totalEntries >= req.minEntries &&
      (data.unanalyzedCount >= req.minUnanalyzed || data.draftCount > 0)
    );
  },
  
  generate(data: ReengagementData): SpotlightInsight | null {
    let template: InsightTemplate;
    
    // Has drafts - most urgent incomplete work
    if (data.draftCount > 0) {
      template = TEMPLATES[2]!;
    }
    // Many unanalyzed entries
    else if (data.unanalyzedCount >= 3) {
      template = TEMPLATES[0]!;
    }
    // Some unanalyzed entries
    else if (data.unanalyzedCount > 0) {
      template = TEMPLATES[1]!;
    }
    // Has good analysis history - encourage more
    else if (data.totalAnalyses >= 5) {
      template = TEMPLATES[3]!;
    }
    // Fallback
    else {
      template = TEMPLATES[4]!;
    }

    const vars = {
      unanalyzed: data.unanalyzedCount,
      drafts: data.draftCount,
      totalAnalyses: data.totalAnalyses,
      totalEntries: data.totalEntries,
    };

    return {
      id: uuid(),
      type: 'reengagement',
      strategyType: 'progress_reminder',
      title: fillTemplate(template.titleTemplate, vars),
      body: fillTemplate(template.bodyTemplate, vars),
      icon: template.icon,
      actionLabel: template.actionLabel,
      actionTarget: template.actionTarget,
      priority: this.priorities.moderate,
    };
  },
};
