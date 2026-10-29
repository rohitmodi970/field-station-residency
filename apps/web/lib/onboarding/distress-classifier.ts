/**
 * Force V2 — Capture-Time Distress Classifier
 * Fast, lightweight client & server regex safety net for acute distress,
 * self-harm language, or crisis indicators in conversational onboarding answers.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

export interface DistressCheckResult {
  isDistress: boolean;
  severity: 'none' | 'high_distress' | 'acute_crisis';
  supportPromptRequired: boolean;
}

// Regex patterns for acute crisis, self-harm, or severe emergency disclosures
const ACUTE_CRISIS_PATTERNS = [
  /\b(want to die|kill myself|end it all|suicide|suicidal|harm myself|self[-\s]?harm|take my own life)\b/i,
  /\b(no reason to live|better off dead|don't want to wake up|can't go on anymore)\b/i,
  /\b(severe abuse|physically hurting me|in immediate danger|help me please emergency)\b/i,
];

// Patterns for heavy emotional transition (soft acknowledgment in tone, but non-crisis)
const HIGH_DISTRESS_PATTERNS = [
  /\b(extreme grief|lost my (mom|dad|child|spouse|husband|wife|partner)|funeral)\b/i,
  /\b(severe panic attack|debilitating anxiety|acute trauma|hopeless)\b/i,
  /\b(terrible breakup|divorce|everything is falling apart|complete burnout)\b/i,
];

/**
 * Checks an onboarding answer for acute crisis or high distress markers.
 */
export function checkDistressLanguage(text: string): DistressCheckResult {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { isDistress: false, severity: 'none', supportPromptRequired: false };
  }

  const normalized = text.toLowerCase();

  // 1. Acute crisis check
  for (const pattern of ACUTE_CRISIS_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isDistress: true,
        severity: 'acute_crisis',
        supportPromptRequired: true,
      };
    }
  }

  // 2. High distress check
  for (const pattern of HIGH_DISTRESS_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isDistress: true,
        severity: 'high_distress',
        supportPromptRequired: false,
      };
    }
  }

  return { isDistress: false, severity: 'none', supportPromptRequired: false };
}
