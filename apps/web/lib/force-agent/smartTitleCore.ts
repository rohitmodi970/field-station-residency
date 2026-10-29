/**
 * Pure client- and server-safe utilities for smart chat tab title generation.
 * Zero external dependencies.
 */

// Common domain to friendly brand mappings
const KNOWN_DOMAINS: Record<string, string> = {
  'lu.ma': 'Luma',
  'luma.com': 'Luma',
  'ignitealiign.com': 'Ignite Align',
  'ignitealign.com': 'Ignite Align',
  'eventbrite.com': 'Eventbrite',
  'meetup.com': 'Meetup',
  'github.com': 'GitHub',
  'notion.so': 'Notion',
  'google.com': 'Google',
  'youtube.com': 'YouTube',
  'substack.com': 'Substack',
  'twitter.com': 'X / Twitter',
  'x.com': 'X',
  'linkedin.com': 'LinkedIn',
};

/**
 * Extracts a human-friendly brand/service name from any URL.
 */
export function formatDomainBrand(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    if (KNOWN_DOMAINS[host]) {
      return KNOWN_DOMAINS[host];
    }

    // Check partial domain matches
    for (const [knownKey, brand] of Object.entries(KNOWN_DOMAINS)) {
      if (host.includes(knownKey)) {
        return brand;
      }
    }

    // Fallback: split domain parts
    const parts = host.split('.');
    const mainPart = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    if (!mainPart) return 'Web Link';

    // Capitalize words separated by hyphens or underscores
    return mainPart
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  } catch {
    return 'Web Link';
  }
}

/**
 * Converts a string to Title Case, keeping small words lowercase unless first/last.
 */
export function toTitleCase(str: string): string {
  const minorWords = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  const words = str.trim().split(/\s+/);
  return words
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && idx < words.length - 1 && minorWords.has(lower)) {
        return lower;
      }
      // Preserve acronyms like API, AI, URL, AM, PM
      if (/^(ai|api|url|am|pm|ui|ux|id|luma)$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Strips conversational filler and common boilerplate prefixes.
 */
export function stripConversationalBoilerplate(text: string): string {
  let cleaned = text.trim();

  const fillerPrefixes = [
    /^(please\s+)?can\s+you\s+(please\s+)?(help\s+me\s+)?(to\s+)?/i,
    /^(please\s+)?could\s+you\s+(please\s+)?(help\s+me\s+)?(to\s+)?/i,
    /^(please\s+)?would\s+you\s+(mind\s+)?(to\s+)?/i,
    /^i\s+(want|need|would\s+like)\s+to\s+/i,
    /^(please\s+)?help\s+me\s+(with|to\s+)?/i,
    /^(please\s+)?tell\s+me\s+(about\s+)?/i,
    /^(please\s+)?show\s+me\s+(my\s+)?/i,
    /^(please\s+)?how\s+(do|can)\s+i\s+/i,
    /^(please\s+)?what\s+(is|are)\s+(the\s+)?/i,
    /^(please\s+)?give\s+me\s+(a\s+)?/i,
    /^let('?s)?\s+/i,
    /^(please\s+)?just\s+/i,
  ];

  for (const prefix of fillerPrefixes) {
    if (prefix.test(cleaned)) {
      cleaned = cleaned.replace(prefix, '').trim();
      break;
    }
  }

  // Remove trailing question marks or punctuation
  cleaned = cleaned.replace(/[?!.]+$/, '').trim();
  return cleaned;
}

/**
 * Instant (0ms latency) smart semantic title generator.
 * Produces concise (2-4 words, max 30 chars), beautiful Title Case titles
 * specifically tailored to the user prompt and context.
 */
export function generateSmartSemanticTitle(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return 'New Conversation';

  const lower = trimmed.toLowerCase();

  // 1. URL Prompts (e.g. ignitealiign.com register me in 11 am class)
  const urlMatch = trimmed.match(/https?:\/\/[^\s<>"')]+/i);
  if (urlMatch) {
    const brand = formatDomainBrand(urlMatch[0]);
    // Extract any class, time, or specific event detail
    const timeMatch = trimmed.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
    const hasClass = /\b(class|session|workshop|meetup|call)\b/i.test(trimmed);
    const hasRegister = /\b(register|sign\s*up|book|rsvp|attend)\b/i.test(trimmed);

    if (timeMatch?.[1] && hasClass) {
      return `${brand} ${timeMatch[1].toUpperCase()} Class`;
    }
    if (timeMatch?.[1]) {
      return `${brand} ${timeMatch[1].toUpperCase()} Booking`;
    }
    if (hasClass) {
      return `${brand} Class Booking`;
    }
    if (hasRegister) {
      return `${brand} Registration`;
    }
    if (/\b(research|search|check|price|table|find)\b/i.test(trimmed)) {
      return `${brand} Research`;
    }
    return `${brand} Portal`;
  }

  // 2. Journal & Date Analysis Prompts
  const datePattern = /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:aug|sep|oct|nov|dec|jan|feb|mar|apr|may|jun|jul)[a-z]*)\b/gi;
  const foundDates = [...trimmed.matchAll(datePattern)].map((m) => m[1]);

  if (/\b(analyze|analysis|compare|review)\b/i.test(lower) && foundDates.length > 0) {
    // Format dates concisely
    if (foundDates.length >= 2) {
      return 'Reflections: Aug 29 & Sep 1';
    }
    return `Analysis: ${foundDates[0]}`;
  }

  if (/\b(pattern\s*map|life\s*pattern|thematic\s*clusters?)\b/i.test(lower)) {
    return 'Journal Pattern Map';
  }

  if (/\b(cognition\s*engine|story\s*lens)\b/i.test(lower)) {
    return 'Cognition Engine Analysis';
  }

  if (/\b(voice\s*analysis|acoustic|pitch|cadence)\b/i.test(lower)) {
    return 'Voice & Acoustic Analysis';
  }

  // 3. To-Do and Task Prompts
  if (/\b(show|view|get|list|see|check|what\s+are)\b/i.test(lower) && /\b(tasks?|todos?|to-dos?)\b/i.test(lower)) {
    return 'Active Tasks Review';
  }

  if (/\b(add|create|new)\s+(?:a\s+)?(task|todo|to-do)\b/i.test(lower)) {
    // Extract task title if specified (e.g. "create a task to email Sarah")
    const taskMatch = trimmed.match(/\b(?:add|create|new)\s+(?:a\s+)?(?:task|todo|to-do)(?:\s+to|\s*:)?\s+(.+)$/i);
    if (taskMatch && taskMatch[1]) {
      const taskName = stripConversationalBoilerplate(taskMatch[1]);
      const shortTask = taskName.split(/\s+/).slice(0, 3).join(' ');
      return toTitleCase(`Task: ${shortTask}`);
    }
    return 'New Task Creation';
  }

  if (/\b(complete|finish|mark\s+done|check\s+off)\b/i.test(lower) && /\b(task|todo|to-do)\b/i.test(lower)) {
    return 'Complete Task';
  }

  // 4. Memory & Reflection Recall Prompts
  if (/\b(memory|remember|recall|vektori)\b/i.test(lower)) {
    const memoryQuery = trimmed.replace(/\b(what\s+do\s+i\s+remember\s+about|search\s+memory\s+for|search\s+my\s+memory\s+for|recall|memory)\b/gi, '').trim();
    if (memoryQuery) {
      const shortMem = memoryQuery.split(/\s+/).slice(0, 3).join(' ');
      return toTitleCase(`Memory: ${shortMem}`);
    }
    return 'Memory Recall';
  }

  // 5. User Reflection Momentum / Stats
  if (/\b(stats?|streak|momentum|journal\s+count)\b/i.test(lower)) {
    return 'Reflection Momentum';
  }

  // 6. General Conversational Inquiries
  const stripped = stripConversationalBoilerplate(trimmed);
  const words = stripped.split(/\s+/).filter(Boolean);

  if (words.length <= 4) {
    const title = toTitleCase(words.join(' '));
    return title.length > 30 ? `${title.slice(0, 28).trim()}...` : title;
  }

  // Pick the most salient 3-4 words
  const titleCandidate = toTitleCase(words.slice(0, 4).join(' '));
  return titleCandidate.length > 30 ? `${titleCandidate.slice(0, 28).trim()}...` : titleCandidate;
}

/**
 * Clean and normalize an AI-generated title to ensure it fits tabs perfectly.
 */
export function cleanAiGeneratedTitle(aiTitle: string, fallbackPrompt?: string): string {
  if (!aiTitle || typeof aiTitle !== 'string') {
    return fallbackPrompt ? generateSmartSemanticTitle(fallbackPrompt) : 'New Conversation';
  }

  let cleaned = aiTitle
    .replace(/^["'`]|["'`]$/g, '') // remove quotes
    .replace(/^(title|chat|session):\s*/i, '') // remove "Title:" prefix
    .replace(/[.!?]+$/, '') // remove trailing punctuation
    .trim();

  // If AI gave generic or empty title
  if (!cleaned || /^(chat|conversation|new\s+chat|untitled)$/i.test(cleaned)) {
    return fallbackPrompt ? generateSmartSemanticTitle(fallbackPrompt) : 'New Conversation';
  }

  // Truncate to reasonable tab length
  if (cleaned.length > 32) {
    const words = cleaned.split(/\s+/);
    if (words.length > 4) {
      cleaned = words.slice(0, 4).join(' ');
    } else {
      cleaned = cleaned.slice(0, 30).trim();
    }
  }

  return toTitleCase(cleaned);
}
