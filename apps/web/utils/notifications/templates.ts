// apps/web/utils/notifications/templates.ts
// Template variable replacement utilities for notifications

import type { NotificationTemplate } from '@/types/notifications';

interface TemplateVariables {
  [key: string]: string | number | undefined;
}

/**
 * Replace template variables in a string
 * Variables are in the format {{variableName}}
 */
export function replaceTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Process a notification template with variables
 */
export function processTemplate(
  template: NotificationTemplate,
  variables: TemplateVariables
): { title: string; body: string } {
  return {
    title: replaceTemplateVariables(template.default_title, variables),
    body: replaceTemplateVariables(template.default_body, variables),
  };
}

/**
 * Format relative time for reminder notifications
 */
export function formatTimeUntil(targetDate: Date): string {
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  
  if (diffMins < 0) {
    return formatTimeAgo(targetDate);
  }
  
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'}`;
  }
  
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  }
  
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
}

/**
 * Format time ago for notifications
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  
  if (diffMins < 1) {
    return 'just now';
  }
  
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  }
  
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Default notification templates
 */
export const defaultTemplates = {
  action_reminder: {
    key: 'action_reminder',
    title: 'Reminder: {{title}}',
    body: 'You set a reminder for "{{title}}" - {{reason}}',
  },
  todo_due_soon: {
    key: 'todo_due_soon',
    title: 'Task Due Soon',
    body: 'Your task "{{title}}" is due in {{time_until}}',
  },
  todo_overdue: {
    key: 'todo_overdue',
    title: 'Overdue Task',
    body: 'Your task "{{title}}" was due {{time_ago}}',
  },
  action_completed: {
    key: 'action_completed',
    title: 'Goal Completed! 🎉',
    body: 'Great job completing "{{title}}"!',
  },
  weekly_summary: {
    key: 'weekly_summary',
    title: 'Your Weekly Summary',
    body: 'You completed {{completed_count}} tasks this week!',
  },
  journal_analysis_ready: {
    key: 'journal_analysis_ready',
    title: 'Analysis Ready',
    body: 'Your journal entry has been analyzed with new insights.',
  },
  streak_achievement: {
    key: 'streak_achievement',
    title: 'Streak Achievement! 🔥',
    body: 'You\'ve maintained a {{streak_count}} day journaling streak!',
  },
} as const;

export type TemplateKey = keyof typeof defaultTemplates;

/**
 * Get a default template by key
 */
export function getDefaultTemplate(key: TemplateKey): { key: string; title: string; body: string } {
  return defaultTemplates[key];
}

/**
 * Sanitize template variables to prevent injection
 */
export function sanitizeVariables(variables: TemplateVariables): TemplateVariables {
  const sanitized: TemplateVariables = {};
  
  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined || value === null) continue;
    
    // Convert to string and sanitize
    const strValue = String(value);
    // Remove any potential script tags or HTML
    sanitized[key] = strValue.replace(/<[^>]*>/g, '').trim();
  }
  
  return sanitized;
}
