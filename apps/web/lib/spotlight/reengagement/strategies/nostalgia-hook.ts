/**
 * Nostalgia Hook Strategy
 * 
 * Connects users with their past positive entries and topics.
 * Best for: Users with rich history, creating emotional connection.
 */

import { v4 as uuid } from 'uuid';
import type { ReengagementData, SpotlightInsight } from '../../types';
import type { ReengagementStrategyHandler, InsightTemplate } from '../types';
import { fillTemplate, STRATEGY_REQUIREMENTS } from '../types';

const TEMPLATES: InsightTemplate[] = [
  {
    titleTemplate: "Remember writing about {{topic}}?",
    bodyTemplate: "{{topic}} was one of your favorite themes. Has anything new happened with it?",
    icon: "💭",
    actionLabel: "Revisit",
    actionTarget: "/journal/new?topic={{topicEncoded}}",
  },
  {
    titleTemplate: "Your thoughts on {{topic}}",
    bodyTemplate: "You've explored {{topic}} in your journals before. Time for an update?",
    icon: "📖",
    actionLabel: "Continue Story",
    actionTarget: "/journal/new?topic={{topicEncoded}}",
  },
  {
    titleTemplate: "That {{daysAgo}}-day-ago entry was uplifting",
    bodyTemplate: "You wrote something positive recently. How are you feeling now?",
    icon: "☀️",
    actionLabel: "Check In",
    actionTarget: "/journal/new?mode=mood",
  },
  {
    titleTemplate: "Your journey with {{topic}}",
    bodyTemplate: "Looking back at your entries about {{topic}} shows real growth. Keep documenting.",
    icon: "🌱",
    actionLabel: "Add Chapter",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "What made you smile last time",
    bodyTemplate: "Your last positive entry was about {{topic}}. Capture another bright moment.",
    icon: "😊",
    actionLabel: "New Entry",
    actionTarget: "/journal/new",
  },
];

function getDaysAgo(date: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const nostalgiaHookStrategy: ReengagementStrategyHandler = {
  type: 'nostalgia_hook',
  name: 'Nostalgia Hook',
  
  priorities: {
    none: 99,
    mild: 3,
    moderate: 3,
    critical: 2,
  },
  
  canGenerate(data: ReengagementData): boolean {
    const req = STRATEGY_REQUIREMENTS.nostalgia_hook;
    return (
      data.totalEntries >= req.minEntries &&
      (data.favoriteTopics.length >= req.minTopics || data.lastPositiveEntry !== null)
    );
  },
  
  generate(data: ReengagementData): SpotlightInsight | null {
    let template: InsightTemplate;
    let topic = data.favoriteTopics[0] ?? 'reflection';
    
    // Check if we have a recent positive entry
    const hasPositiveEntry = data.lastPositiveEntry !== null;
    const positiveDaysAgo = hasPositiveEntry 
      ? getDaysAgo(data.lastPositiveEntry!.date) 
      : 0;
    
    if (hasPositiveEntry && data.lastPositiveEntry!.topTopic) {
      topic = data.lastPositiveEntry!.topTopic;
    }
    
    // Select template based on what data we have
    if (hasPositiveEntry && positiveDaysAgo <= 30) {
      // Recent positive entry - reference it
      if (data.lastPositiveEntry!.sentiment > 0.7) {
        template = TEMPLATES[4]!;
      } else {
        template = TEMPLATES[2]!;
      }
    } else if (data.favoriteTopics.length > 0) {
      // Has favorite topics
      const randomChoice = Math.random();
      if (randomChoice < 0.4) {
        template = TEMPLATES[0]!;
      } else if (randomChoice < 0.7) {
        template = TEMPLATES[1]!;
      } else {
        template = TEMPLATES[3]!;
      }
    } else {
      // Fallback
      template = TEMPLATES[2]!;
    }

    const vars = {
      topic: capitalizeFirst(topic),
      topicEncoded: encodeURIComponent(topic),
      daysAgo: positiveDaysAgo,
    };

    return {
      id: uuid(),
      type: 'reengagement',
      strategyType: 'nostalgia_hook',
      title: fillTemplate(template.titleTemplate, vars),
      body: fillTemplate(template.bodyTemplate, vars),
      icon: template.icon,
      actionLabel: template.actionLabel,
      actionTarget: fillTemplate(template.actionTarget ?? '/journal/new', vars),
      priority: this.priorities.moderate,
    };
  },
};
