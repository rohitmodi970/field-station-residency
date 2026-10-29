// apps/web/utils/ai/aiProcessingService.ts
/**
 * AI Processing Service
 * Provides sentiment analysis, topic extraction, and keyword extraction
 * Can be configured to use OpenAI API, Hugging Face, or rule-based approaches
 */

export interface SentimentResult {
  score: number; // -1 to 1 (negative to positive)
  label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  confidence: number; // 0 to 1
}

export interface TopicResult {
  topic: string;
  confidence: number;
  context?: string[];
}

export interface KeywordResult {
  keyword: string;
  frequency: number;
  relevance: number; // 0 to 1
}

export interface AIAnalysisResult {
  sentiment: SentimentResult;
  topics: TopicResult[];
  keywords: KeywordResult[];
  summary?: string;
}

// Stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it',
  'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these',
  'they', 'this', 'to', 'was', 'will', 'with', 'i', 'me', 'my', 'myself', 'we', 'our', 'you',
  'your', 'he', 'him', 'his', 'she', 'her', 'its', 'am', 'been', 'has', 'have', 'had', 'do',
  'does', 'did', 'can', 'could', 'should', 'would', 'may', 'might', 'must', 'shall', 'will'
]);

// Sentiment lexicon (simplified version)
const POSITIVE_WORDS = new Set([
  'happy', 'joy', 'love', 'excellent', 'good', 'great', 'wonderful', 'fantastic', 'amazing',
  'beautiful', 'excited', 'grateful', 'thankful', 'blessed', 'peaceful', 'calm', 'relaxed',
  'content', 'satisfied', 'pleased', 'delighted', 'thrilled', 'ecstatic', 'awesome', 'brilliant',
  'lovely', 'perfect', 'pleasant', 'positive', 'success', 'achieve', 'accomplished', 'proud',
  'inspired', 'motivated', 'energized', 'hopeful', 'optimistic', 'cheerful', 'joyful', 'smile',
  'laugh', 'fun', 'enjoy', 'appreciate', 'warm', 'cozy', 'comfortable', 'friendly'
]);

const NEGATIVE_WORDS = new Set([
  'sad', 'angry', 'hate', 'bad', 'terrible', 'awful', 'horrible', 'disappointed', 'frustrated',
  'annoyed', 'upset', 'depressed', 'anxious', 'worried', 'stressed', 'tired', 'exhausted',
  'lonely', 'hurt', 'pain', 'sick', 'difficult', 'hard', 'struggle', 'problem', 'issue',
  'wrong', 'mistake', 'fail', 'failure', 'lose', 'lost', 'miss', 'regret', 'sorry', 'fear',
  'scared', 'afraid', 'nervous', 'uncomfortable', 'awkward', 'boring', 'dull', 'miserable',
  'unhappy', 'negative', 'dark', 'gloomy', 'cold', 'harsh', 'cruel'
]);

// Intensifiers
const INTENSIFIERS = new Set([
  'very', 'extremely', 'incredibly', 'really', 'so', 'too', 'quite', 'absolutely', 'totally',
  'completely', 'utterly', 'highly', 'deeply', 'profoundly'
]);

// Negations
const NEGATIONS = new Set(['not', 'no', 'never', 'nothing', "n't", 'neither', 'nobody', 'nowhere']);

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Rule-based sentiment analysis
 */
export function analyzeSentiment(text: string): SentimentResult {
  const words = tokenize(text);
  let sentimentScore = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let intensifierMultiplier = 1;
  let isNegated = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : '';

    // Check for intensifiers
    if (prevWord && INTENSIFIERS.has(prevWord)) {
      intensifierMultiplier = 1.5;
    }

    // Check for negations
    if (prevWord && NEGATIONS.has(prevWord)) {
      isNegated = true;
    }

    // Check sentiment
    if (word && POSITIVE_WORDS.has(word)) {
      const value = intensifierMultiplier * (isNegated ? -1 : 1);
      sentimentScore += value;
      if (value > 0) positiveCount++;
      else negativeCount++;
    } else if (word && NEGATIVE_WORDS.has(word)) {
      const value = intensifierMultiplier * (isNegated ? 1 : -1);
      sentimentScore += value;
      if (value < 0) negativeCount++;
      else positiveCount++;
    }

    // Reset flags
    if (word && !INTENSIFIERS.has(word) && !NEGATIONS.has(word)) {
      intensifierMultiplier = 1;
      isNegated = false;
    }
  }

  // Normalize score to -1 to 1
  const totalSentimentWords = positiveCount + negativeCount;
  const normalizedScore = totalSentimentWords > 0 
    ? Math.max(-1, Math.min(1, sentimentScore / totalSentimentWords))
    : 0;

  // Determine label
  let label: SentimentResult['label'];
  if (normalizedScore >= 0.5) label = 'very_positive';
  else if (normalizedScore >= 0.2) label = 'positive';
  else if (normalizedScore <= -0.5) label = 'very_negative';
  else if (normalizedScore <= -0.2) label = 'negative';
  else label = 'neutral';

  // Calculate confidence based on number of sentiment words found
  const confidence = Math.min(1, totalSentimentWords / 10);

  return {
    score: parseFloat(normalizedScore.toFixed(2)),
    label,
    confidence: parseFloat(confidence.toFixed(2))
  };
}

/**
 * Extract keywords from text using TF (Term Frequency)
 */
export function extractKeywords(text: string, limit: number = 10): KeywordResult[] {
  const words = tokenize(text);
  const wordFrequency: Map<string, number> = new Map();

  // Count word frequencies (excluding stop words)
  words.forEach(word => {
    if (!STOP_WORDS.has(word) && word.length > 2) {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    }
  });

  // Calculate relevance (normalized frequency)
  const maxFrequency = Math.max(...Array.from(wordFrequency.values()));
  const keywords: KeywordResult[] = Array.from(wordFrequency.entries())
    .map(([keyword, frequency]) => ({
      keyword,
      frequency,
      relevance: parseFloat((frequency / maxFrequency).toFixed(2))
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);

  return keywords;
}

/**
 * Extract topics using keyword clustering and co-occurrence
 */
export function extractTopics(text: string, limit: number = 5): TopicResult[] {
  const keywords = extractKeywords(text, 20);
  
  // Define topic categories with related keywords
  const topicCategories: { [key: string]: Set<string> } = {
    'work': new Set(['work', 'job', 'office', 'meeting', 'project', 'deadline', 'boss', 'colleague', 'career', 'professional']),
    'family': new Set(['family', 'mom', 'dad', 'mother', 'father', 'parent', 'child', 'kid', 'brother', 'sister', 'home']),
    'relationships': new Set(['friend', 'relationship', 'love', 'date', 'partner', 'boyfriend', 'girlfriend', 'husband', 'wife']),
    'health': new Set(['health', 'exercise', 'workout', 'gym', 'fit', 'diet', 'sleep', 'doctor', 'medicine', 'sick', 'pain']),
    'emotions': new Set(['feel', 'feeling', 'emotion', 'mood', 'happy', 'sad', 'angry', 'anxious', 'excited', 'depressed']),
    'hobbies': new Set(['hobby', 'reading', 'music', 'art', 'painting', 'drawing', 'writing', 'gaming', 'sports', 'cooking']),
    'travel': new Set(['travel', 'trip', 'vacation', 'journey', 'visit', 'explore', 'adventure', 'destination', 'flight', 'hotel']),
    'goals': new Set(['goal', 'plan', 'dream', 'future', 'achieve', 'success', 'accomplish', 'ambition', 'aspire', 'hope']),
    'education': new Set(['study', 'school', 'college', 'university', 'learn', 'class', 'teacher', 'exam', 'course', 'degree']),
    'money': new Set(['money', 'financial', 'budget', 'salary', 'income', 'expense', 'saving', 'spending', 'investment', 'debt']),
    'nature': new Set(['nature', 'outdoor', 'park', 'walk', 'hike', 'mountain', 'beach', 'forest', 'garden', 'weather']),
    'creativity': new Set(['create', 'creative', 'idea', 'inspiration', 'imagine', 'design', 'project', 'build', 'make'])
  };

  // Score each topic based on keyword matches
  const topicScores: Map<string, { score: number; matchedKeywords: string[] }> = new Map();

  keywords.forEach(({ keyword, relevance }) => {
    Object.entries(topicCategories).forEach(([topic, relatedWords]) => {
      if (relatedWords.has(keyword)) {
        const current = topicScores.get(topic) || { score: 0, matchedKeywords: [] };
        current.score += relevance;
        current.matchedKeywords.push(keyword);
        topicScores.set(topic, current);
      }
    });
  });

  // Convert to array and sort by score
  const topics: TopicResult[] = Array.from(topicScores.entries())
    .map(([topic, { score, matchedKeywords }]) => ({
      topic,
      confidence: parseFloat(Math.min(1, score).toFixed(2)),
      context: matchedKeywords
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);

  return topics;
}

/**
 * Generate a brief summary of the text
 */
export function generateSummary(text: string, maxLength: number = 800): string {
  // Simple extractive summarization: take first sentence or up to maxLength chars
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length === 0) return '';
  
  let summary = sentences[0]?.trim() || '';
  
  if (!summary) return '';
  
  // If first sentence is too short, add more sentences
  let i = 1;
  while (summary.length < maxLength && i < sentences.length) {
    const nextSentence = sentences[i]?.trim();
    if (nextSentence && summary.length + nextSentence.length + 2 <= maxLength) {
      summary += '. ' + nextSentence;
      i++;
    } else {
      break;
    }
  }
  
  // Truncate if still too long
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength - 3) + '...';
  }
  
  return summary;
}

/**
 * Main function to analyze text and return comprehensive AI insights
 */
export async function analyzeText(text: string): Promise<AIAnalysisResult> {
  const sentiment = analyzeSentiment(text);
  const topics = extractTopics(text);
  const keywords = extractKeywords(text);
  const summary = generateSummary(text);

  return {
    sentiment,
    topics,
    keywords,
    summary
  };
}

/**
 * Configuration for using external AI services (future enhancement)
 */
export interface AIServiceConfig {
  provider: 'openai' | 'huggingface' | 'rule-based';
  apiKey?: string;
  model?: string;
}

/**
 * Future: Analyze using external AI service (OpenAI, Hugging Face, etc.)
 */
export async function analyzeWithExternalService(
  text: string,
  config: AIServiceConfig
): Promise<AIAnalysisResult> {
  // Placeholder for future implementation
  // For now, fall back to rule-based analysis
  return analyzeText(text);
}
