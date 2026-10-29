/**
 * Strategy Index
 * 
 * Exports all re-engagement strategies.
 */

export { lowEffortPromptStrategy } from './low-effort-prompt';
export { achievementHighlightStrategy } from './achievement-highlight';
export { patternTriggerStrategy } from './pattern-trigger';
export { nostalgiaHookStrategy } from './nostalgia-hook';
export { gamificationNudgeStrategy } from './gamification-nudge';
export { progressReminderStrategy } from './progress-reminder';
export { moodCallbackStrategy } from './mood-callback';

import type { ReengagementStrategyHandler } from '../types';
import { lowEffortPromptStrategy } from './low-effort-prompt';
import { achievementHighlightStrategy } from './achievement-highlight';
import { patternTriggerStrategy } from './pattern-trigger';
import { nostalgiaHookStrategy } from './nostalgia-hook';
import { gamificationNudgeStrategy } from './gamification-nudge';
import { progressReminderStrategy } from './progress-reminder';
import { moodCallbackStrategy } from './mood-callback';

/**
 * All registered strategy handlers.
 * Order doesn't matter - selection is based on priority scores.
 */
export const ALL_STRATEGIES: ReengagementStrategyHandler[] = [
  lowEffortPromptStrategy,
  achievementHighlightStrategy,
  patternTriggerStrategy,
  nostalgiaHookStrategy,
  gamificationNudgeStrategy,
  progressReminderStrategy,
  moodCallbackStrategy,
];

/**
 * Get a strategy handler by type.
 */
export function getStrategy(type: string): ReengagementStrategyHandler | undefined {
  return ALL_STRATEGIES.find(s => s.type === type);
}
