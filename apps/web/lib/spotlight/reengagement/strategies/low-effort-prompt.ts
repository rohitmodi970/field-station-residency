/**
 * Low Effort Prompt Strategy
 * 
 * Generates simple, low-friction prompts to get users writing again.
 * Best for: Mild urgency, users who may feel overwhelmed.
 */

import { v4 as uuid } from 'uuid';
import type { ReengagementData, SpotlightInsight } from '../../types';
import type { ReengagementStrategyHandler, InsightTemplate } from '../types';
import { fillTemplate, STRATEGY_REQUIREMENTS } from '../types';

const TEMPLATES: InsightTemplate[] = [
  {
    titleTemplate: "Just one sentence today?",
    bodyTemplate: "No pressure to write a full entry. Sometimes starting with just one thought helps you reconnect.",
    icon: "✏️",
    actionLabel: "Quick Entry",
    actionTarget: "/journal/new?mode=quick",
  },
  {
    titleTemplate: "30 seconds is all you need",
    bodyTemplate: "Capture what's on your mind right now. A short reflection can be just as meaningful.",
    icon: "⏱️",
    actionLabel: "Start Writing",
    actionTarget: "/journal/new?mode=quick",
  },
  {
    titleTemplate: "How are you feeling?",
    bodyTemplate: "Just a quick check-in with yourself. One word or many - whatever feels right.",
    icon: "💭",
    actionLabel: "Check In",
    actionTarget: "/journal/new?mode=mood",
  },
  {
    titleTemplate: "Pick up where you left off",
    bodyTemplate: "It's been {{daysInactive}} days. No judgment - just space to share what's new.",
    icon: "🔄",
    actionLabel: "Continue",
    actionTarget: "/journal/new",
  },
  {
    titleTemplate: "Voice note instead?",
    bodyTemplate: "Don't feel like typing? Record a quick voice entry and use automatic transcription.",
    icon: "🎙️",
    actionLabel: "Record",
    actionTarget: "/journal/new?mode=voice",
  },
];

export const lowEffortPromptStrategy: ReengagementStrategyHandler = {
  type: 'low_effort_prompt',
  name: 'Low Effort Prompt',
  
  priorities: {
    none: 99, // Not used when no urgency
    mild: 1,  // Top priority for mild
    moderate: 3,
    critical: 2, // Still high for critical
  },
  
  canGenerate(data: ReengagementData): boolean {
    const req = STRATEGY_REQUIREMENTS.low_effort_prompt;
    return data.daysInactive >= req.minDaysInactive;
  },
  
  generate(data: ReengagementData): SpotlightInsight | null {
    // Select template based on context
    let template: InsightTemplate;
    
    if (data.daysInactive <= 3) {
      // Short absence - gentle prompt
      template = TEMPLATES[0]!;
    } else if (data.daysInactive <= 7) {
      // Medium absence - time-focused
      template = TEMPLATES[1]!;
    } else if (data.daysInactive > 14) {
      // Long absence - welcoming back
      template = TEMPLATES[3]!;
    } else {
      // Random selection for variety
      const randomIndex = Math.floor(Math.random() * TEMPLATES.length);
      template = TEMPLATES[randomIndex]!;
    }

    const vars = {
      daysInactive: data.daysInactive,
    };

    return {
      id: uuid(),
      type: 'reengagement',
      strategyType: 'low_effort_prompt',
      title: fillTemplate(template.titleTemplate, vars),
      body: fillTemplate(template.bodyTemplate, vars),
      icon: template.icon,
      actionLabel: template.actionLabel,
      actionTarget: template.actionTarget,
      priority: this.priorities.mild,
    };
  },
};
