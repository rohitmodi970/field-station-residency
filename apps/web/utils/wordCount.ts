/**
 * Word Count Utilities for Encrypted Journals
 * 
 * Since journals are encrypted before storage, word count must be calculated
 * on the client side before encryption and sent to the server.
 */

/**
 * Calculate word count from text content
 * Handles multiple spaces, newlines, and empty strings properly
 * 
 * @param content - The text content to count words from
 * @returns The number of words in the content
 */
export function calculateWordCount(content: string | null | undefined): number {
  if (!content || content.trim() === '') {
    return 0;
  }

  // Remove extra whitespace and split by whitespace
  const words = content
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .split(' ')
    .filter(word => word.length > 0); // Filter out empty strings

  return words.length;
}

/**
 * Calculate estimated reading time in minutes
 * Based on average reading speed of 200 words per minute
 * 
 * @param wordCount - The number of words
 * @param wordsPerMinute - Average reading speed (default: 200)
 * @returns Estimated reading time in minutes (minimum 1 for non-empty content)
 */
export function calculateReadingTime(
  wordCount: number,
  wordsPerMinute: number = 200
): number {
  if (wordCount === 0) {
    return 0;
  }

  // Calculate reading time and round up
  const readingTime = Math.ceil(wordCount / wordsPerMinute);
  
  // Minimum 1 minute for any content
  return Math.max(readingTime, 1);
}

/**
 * Calculate both word count and reading time
 * Convenience function for journal processing
 * 
 * @param content - The text content to analyze
 * @returns Object with word_count and reading_time_minutes
 */
export function calculateJournalMetrics(content: string | null | undefined): {
  word_count: number;
  reading_time_minutes: number;
} {
  const word_count = calculateWordCount(content);
  const reading_time_minutes = calculateReadingTime(word_count);

  return {
    word_count,
    reading_time_minutes,
  };
}

/**
 * Format word count for display
 * 
 * @param wordCount - The number of words
 * @returns Formatted string (e.g., "1,234 words")
 */
export function formatWordCount(wordCount: number): string {
  if (wordCount === 0) {
    return '0 words';
  }

  const formatted = wordCount.toLocaleString();
  return `${formatted} ${wordCount === 1 ? 'word' : 'words'}`;
}

/**
 * Format reading time for display
 * 
 * @param minutes - Reading time in minutes
 * @returns Formatted string (e.g., "5 min read", "1 hr 23 min read")
 */
export function formatReadingTime(minutes: number): string {
  if (minutes === 0) {
    return '0 min read';
  }

  if (minutes < 60) {
    return `${minutes} min read`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? 'hr' : 'hrs'} read`;
  }

  return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${remainingMinutes} min read`;
}

/**
 * Get journal metadata display string
 * Combines word count and reading time
 * 
 * @param wordCount - Number of words
 * @param readingTime - Reading time in minutes
 * @returns Formatted string (e.g., "1,234 words · 6 min read")
 */
export function getJournalMetadataDisplay(
  wordCount: number,
  readingTime: number
): string {
  if (wordCount === 0) {
    return 'No content';
  }

  const wordCountStr = formatWordCount(wordCount);
  const readingTimeStr = formatReadingTime(readingTime);

  return `${wordCountStr} · ${readingTimeStr}`;
}

/**
 * Example Usage:
 * 
 * // Before encrypting and saving journal:
 * import { calculateJournalMetrics } from '@/utils/wordCount';
 * 
 * const content = "This is my journal entry...";
 * const { word_count, reading_time_minutes } = calculateJournalMetrics(content);
 * 
 * // Send to API with metrics:
 * await fetch('/api/journal', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     content: encryptedContent,
 *     word_count,
 *     reading_time_minutes
 *   })
 * });
 * 
 * // Display in UI:
 * import { getJournalMetadataDisplay } from '@/utils/wordCount';
 * 
 * <div>{getJournalMetadataDisplay(journal.word_count, journal.reading_time_minutes)}</div>
 */
