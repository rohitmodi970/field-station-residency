/**
 * Emotion Mapping Utility
 * Maps Hume AI's 48+ detailed emotions to 12 enriched emotion categories
 * More nuanced than Ekman's 6 basics, yet still easy to understand
 */

export enum BasicEmotion {
  JOY = 'Joy',
  SADNESS = 'Sadness',
  ANGER = 'Anger',
  FEAR = 'Fear',
  SURPRISE = 'Surprise',
  DISGUST = 'Disgust',
}

/**
 * Enriched emotion categories — 12 intuitive, engaging groups
 * Provides more depth than the 6 basic emotions without overwhelming detail
 */
export enum EnrichedEmotion {
  HAPPINESS = 'Happiness',
  LOVE_WARMTH = 'Love & Warmth',
  WONDER = 'Wonder & Awe',
  SERENITY = 'Serenity',
  CURIOSITY = 'Curiosity',
  SURPRISE = 'Surprise',
  SADNESS = 'Sadness',
  ANXIETY = 'Anxiety',
  FEAR = 'Fear',
  FRUSTRATION = 'Frustration',
  DISCOMFORT = 'Discomfort',
  DISGUST = 'Disgust',
}

/** Emoji for each enriched emotion */
export const ENRICHED_EMOTION_EMOJI: Record<EnrichedEmotion, string> = {
  [EnrichedEmotion.HAPPINESS]: '😊',
  [EnrichedEmotion.LOVE_WARMTH]: '💕',
  [EnrichedEmotion.WONDER]: '✨',
  [EnrichedEmotion.SERENITY]: '🧘',
  [EnrichedEmotion.CURIOSITY]: '🔍',
  [EnrichedEmotion.SURPRISE]: '😲',
  [EnrichedEmotion.SADNESS]: '😢',
  [EnrichedEmotion.ANXIETY]: '😰',
  [EnrichedEmotion.FEAR]: '😨',
  [EnrichedEmotion.FRUSTRATION]: '😤',
  [EnrichedEmotion.DISCOMFORT]: '😣',
  [EnrichedEmotion.DISGUST]: '🤢',
};

/** Gradient color classes for each enriched emotion */
export const ENRICHED_EMOTION_GRADIENT: Record<EnrichedEmotion, string> = {
  [EnrichedEmotion.HAPPINESS]: 'from-yellow-400 to-orange-400',
  [EnrichedEmotion.LOVE_WARMTH]: 'from-pink-400 to-rose-400',
  [EnrichedEmotion.WONDER]: 'from-amber-400 to-yellow-300',
  [EnrichedEmotion.SERENITY]: 'from-teal-400 to-cyan-400',
  [EnrichedEmotion.CURIOSITY]: 'from-sky-400 to-blue-400',
  [EnrichedEmotion.SURPRISE]: 'from-cyan-400 to-teal-400',
  [EnrichedEmotion.SADNESS]: 'from-blue-400 to-indigo-400',
  [EnrichedEmotion.ANXIETY]: 'from-orange-400 to-amber-500',
  [EnrichedEmotion.FEAR]: 'from-purple-400 to-violet-400',
  [EnrichedEmotion.FRUSTRATION]: 'from-red-400 to-rose-400',
  [EnrichedEmotion.DISCOMFORT]: 'from-slate-400 to-gray-400',
  [EnrichedEmotion.DISGUST]: 'from-green-400 to-emerald-400',
};

/** Sentiment polarity for each enriched emotion */
export const ENRICHED_EMOTION_POLARITY: Record<EnrichedEmotion, 'positive' | 'negative' | 'neutral'> = {
  [EnrichedEmotion.HAPPINESS]: 'positive',
  [EnrichedEmotion.LOVE_WARMTH]: 'positive',
  [EnrichedEmotion.WONDER]: 'positive',
  [EnrichedEmotion.SERENITY]: 'positive',
  [EnrichedEmotion.CURIOSITY]: 'neutral',
  [EnrichedEmotion.SURPRISE]: 'neutral',
  [EnrichedEmotion.SADNESS]: 'negative',
  [EnrichedEmotion.ANXIETY]: 'negative',
  [EnrichedEmotion.FEAR]: 'negative',
  [EnrichedEmotion.FRUSTRATION]: 'negative',
  [EnrichedEmotion.DISCOMFORT]: 'negative',
  [EnrichedEmotion.DISGUST]: 'negative',
};

/**
 * Mapping of Hume emotions → Enriched 12-category system
 */
export const HUME_TO_ENRICHED_EMOTION_MAP: Record<string, EnrichedEmotion> = {
  // HAPPINESS — upbeat, high-energy positive
  'Joy': EnrichedEmotion.HAPPINESS,
  'Amusement': EnrichedEmotion.HAPPINESS,
  'Excitement': EnrichedEmotion.HAPPINESS,
  'Ecstasy': EnrichedEmotion.HAPPINESS,
  'Satisfaction': EnrichedEmotion.HAPPINESS,
  'Triumph': EnrichedEmotion.HAPPINESS,
  'Enthusiasm': EnrichedEmotion.HAPPINESS,
  'Pride': EnrichedEmotion.HAPPINESS,

  // LOVE & WARMTH — connection, affection, appreciation
  'Love': EnrichedEmotion.LOVE_WARMTH,
  'Romance': EnrichedEmotion.LOVE_WARMTH,
  'Adoration': EnrichedEmotion.LOVE_WARMTH,
  'Admiration': EnrichedEmotion.LOVE_WARMTH,
  'Gratitude': EnrichedEmotion.LOVE_WARMTH,
  'Sympathy': EnrichedEmotion.LOVE_WARMTH,
  'Empathic Pain': EnrichedEmotion.LOVE_WARMTH,

  // WONDER & AWE — amazement, beauty, transcendence
  'Awe': EnrichedEmotion.WONDER,
  'Amazement': EnrichedEmotion.WONDER,
  'Entrancement': EnrichedEmotion.WONDER,
  'Aesthetic Appreciation': EnrichedEmotion.WONDER,

  // SERENITY — calm, peaceful, restful
  'Calmness': EnrichedEmotion.SERENITY,
  'Relief': EnrichedEmotion.SERENITY,
  'Contentment': EnrichedEmotion.SERENITY,
  'Nostalgia': EnrichedEmotion.SERENITY,

  // CURIOSITY — mental engagement, exploration
  'Interest': EnrichedEmotion.CURIOSITY,
  'Contemplation': EnrichedEmotion.CURIOSITY,
  'Realization': EnrichedEmotion.CURIOSITY,
  'Concentration': EnrichedEmotion.CURIOSITY,
  'Determination': EnrichedEmotion.CURIOSITY,

  // SURPRISE — unexpected events
  'Surprise': EnrichedEmotion.SURPRISE,
  'Shock': EnrichedEmotion.SURPRISE,

  // SADNESS — loss, low energy, grief
  'Sadness': EnrichedEmotion.SADNESS,
  'Disappointment': EnrichedEmotion.SADNESS,
  'Grief': EnrichedEmotion.SADNESS,
  'Distress': EnrichedEmotion.SADNESS,
  'Pain': EnrichedEmotion.SADNESS,
  'Longing': EnrichedEmotion.SADNESS,

  // ANXIETY — worry, stress, nervousness
  'Anxiety': EnrichedEmotion.ANXIETY,
  'Nervousness': EnrichedEmotion.ANXIETY,
  'Worry': EnrichedEmotion.ANXIETY,
  'Tenseness': EnrichedEmotion.ANXIETY,
  'Doubt': EnrichedEmotion.ANXIETY,

  // FEAR — threat, dread, terror
  'Fear': EnrichedEmotion.FEAR,
  'Horror': EnrichedEmotion.FEAR,
  'Terror': EnrichedEmotion.FEAR,
  'Panic': EnrichedEmotion.FEAR,

  // FRUSTRATION — anger, annoyance, resentment
  'Anger': EnrichedEmotion.FRUSTRATION,
  'Annoyance': EnrichedEmotion.FRUSTRATION,
  'Irritation': EnrichedEmotion.FRUSTRATION,
  'Sarcasm': EnrichedEmotion.FRUSTRATION,
  'Envy': EnrichedEmotion.FRUSTRATION,

  // DISCOMFORT — embarrassment, awkwardness, unease
  'Embarrassment': EnrichedEmotion.DISCOMFORT,
  'Awkwardness': EnrichedEmotion.DISCOMFORT,
  'Shame': EnrichedEmotion.DISCOMFORT,
  'Guilt': EnrichedEmotion.DISCOMFORT,
  'Confusion': EnrichedEmotion.DISCOMFORT,
  'Boredom': EnrichedEmotion.DISCOMFORT,
  'Tiredness': EnrichedEmotion.DISCOMFORT,
  'Craving': EnrichedEmotion.DISCOMFORT,
  'Desire': EnrichedEmotion.DISCOMFORT,

  // DISGUST — aversion, repulsion, contempt
  'Disgust': EnrichedEmotion.DISGUST,
  'Contempt': EnrichedEmotion.DISGUST,
  'Repulsion': EnrichedEmotion.DISGUST,
  'Aversion': EnrichedEmotion.DISGUST,
  'Disapproval': EnrichedEmotion.DISGUST,
};

/**
 * Comprehensive mapping of Hume emotions to basic emotion categories (legacy)
 * Each Hume emotion is mapped to one of the 6 basic emotions
 */
export const HUME_TO_BASIC_EMOTION_MAP: Record<string, BasicEmotion> = {
  // JOY category - positive, pleasant emotions
  'Joy': BasicEmotion.JOY,
  'Amusement': BasicEmotion.JOY,
  'Excitement': BasicEmotion.JOY,
  'Ecstasy': BasicEmotion.JOY,
  'Satisfaction': BasicEmotion.JOY,
  'Relief': BasicEmotion.JOY,
  'Admiration': BasicEmotion.JOY,
  'Adoration': BasicEmotion.JOY,
  'Aesthetic Appreciation': BasicEmotion.JOY,
  'Calmness': BasicEmotion.JOY,
  'Contentment': BasicEmotion.JOY,
  'Love': BasicEmotion.JOY,
  'Romance': BasicEmotion.JOY,
  'Triumph': BasicEmotion.JOY,
  'Pride': BasicEmotion.JOY,
  'Interest': BasicEmotion.JOY,
  'Entrancement': BasicEmotion.JOY,
  'Nostalgia': BasicEmotion.JOY,
  'Awe': BasicEmotion.JOY,
  'Desire': BasicEmotion.JOY,
  'Contemplation': BasicEmotion.JOY,
  'Enthusiasm': BasicEmotion.JOY,
  'Gratitude': BasicEmotion.JOY,
  
  // SADNESS category - low energy negative emotions
  'Sadness': BasicEmotion.SADNESS,
  'Disappointment': BasicEmotion.SADNESS,
  'Disapproval': BasicEmotion.SADNESS,
  'Distress': BasicEmotion.SADNESS,
  'Pain': BasicEmotion.SADNESS,
  'Sympathy': BasicEmotion.SADNESS,
  'Empathic Pain': BasicEmotion.SADNESS,
  'Awkwardness': BasicEmotion.SADNESS,
  'Shame': BasicEmotion.SADNESS,
  'Guilt': BasicEmotion.SADNESS,
  'Boredom': BasicEmotion.SADNESS,
  'Tiredness': BasicEmotion.SADNESS,
  'Confusion': BasicEmotion.SADNESS,
  'Doubt': BasicEmotion.SADNESS,
  'Contempt': BasicEmotion.SADNESS,
  'Craving': BasicEmotion.SADNESS,
  'Grief': BasicEmotion.SADNESS,
  'Longing': BasicEmotion.SADNESS,
  
  // ANGER category - high energy negative emotions, frustration
  'Anger': BasicEmotion.ANGER,
  'Annoyance': BasicEmotion.ANGER,
  'Irritation': BasicEmotion.ANGER,
  'Determination': BasicEmotion.ANGER,
  'Concentration': BasicEmotion.ANGER,
  'Envy': BasicEmotion.ANGER,
  'Anxiety': BasicEmotion.ANGER,
  'Tenseness': BasicEmotion.ANGER,
  'Sarcasm': BasicEmotion.ANGER,
  
  // FEAR category - threat-related emotions
  'Fear': BasicEmotion.FEAR,
  'Horror': BasicEmotion.FEAR,
  'Nervousness': BasicEmotion.FEAR,
  'Worry': BasicEmotion.FEAR,
  'Embarrassment': BasicEmotion.FEAR,
  'Terror': BasicEmotion.FEAR,
  'Panic': BasicEmotion.FEAR,
  
  // SURPRISE category - unexpected events
  'Surprise': BasicEmotion.SURPRISE,
  'Realization': BasicEmotion.SURPRISE,
  'Shock': BasicEmotion.SURPRISE,
  'Amazement': BasicEmotion.SURPRISE,
  
  // DISGUST category - aversion, rejection
  'Disgust': BasicEmotion.DISGUST,
  'Repulsion': BasicEmotion.DISGUST,
  'Aversion': BasicEmotion.DISGUST,
};

/**
 * Map a Hume emotion name to a basic emotion category (legacy)
 */
export function mapToBasicEmotion(humeEmotion: string): BasicEmotion {
  const mapped = HUME_TO_BASIC_EMOTION_MAP[humeEmotion];
  if (mapped) return mapped;
  
  const lowerName = humeEmotion.toLowerCase();
  if (lowerName.includes('joy') || lowerName.includes('happy') || 
      lowerName.includes('delight') || lowerName.includes('pleasure') ||
      lowerName.includes('bliss') || lowerName.includes('cheer')) {
    return BasicEmotion.JOY;
  }
  if (lowerName.includes('sad') || lowerName.includes('depress') || 
      lowerName.includes('melanchol') || lowerName.includes('sorrow') ||
      lowerName.includes('gloom') || lowerName.includes('despair')) {
    return BasicEmotion.SADNESS;
  }
  if (lowerName.includes('anger') || lowerName.includes('rage') || 
      lowerName.includes('fury') || lowerName.includes('hostil') ||
      lowerName.includes('frustrat') || lowerName.includes('resent')) {
    return BasicEmotion.ANGER;
  }
  if (lowerName.includes('fear') || lowerName.includes('anxious') || 
      lowerName.includes('dread') || lowerName.includes('terror') ||
      lowerName.includes('scared') || lowerName.includes('afraid')) {
    return BasicEmotion.FEAR;
  }
  if (lowerName.includes('surprise') || lowerName.includes('shock') || 
      lowerName.includes('astonish') || lowerName.includes('amaze') ||
      lowerName.includes('startle')) {
    return BasicEmotion.SURPRISE;
  }
  if (lowerName.includes('disgust') || lowerName.includes('repuls') || 
      lowerName.includes('revolv') || lowerName.includes('nausea') ||
      lowerName.includes('loath')) {
    return BasicEmotion.DISGUST;
  }
  console.warn(`[EmotionMapping] Unmapped emotion: "${humeEmotion}" - assigning to Joy as fallback`);
  return BasicEmotion.JOY;
}

/**
 * Map a Hume emotion name to an enriched emotion category
 */
export function mapToEnrichedEmotion(humeEmotion: string): EnrichedEmotion {
  const mapped = HUME_TO_ENRICHED_EMOTION_MAP[humeEmotion];
  if (mapped) return mapped;

  const lower = humeEmotion.toLowerCase();
  if (lower.includes('joy') || lower.includes('happy') || lower.includes('delight') || lower.includes('cheer')) return EnrichedEmotion.HAPPINESS;
  if (lower.includes('love') || lower.includes('affection') || lower.includes('gratitude')) return EnrichedEmotion.LOVE_WARMTH;
  if (lower.includes('awe') || lower.includes('wonder') || lower.includes('amaze')) return EnrichedEmotion.WONDER;
  if (lower.includes('calm') || lower.includes('peace') || lower.includes('relief') || lower.includes('content')) return EnrichedEmotion.SERENITY;
  if (lower.includes('interest') || lower.includes('curious') || lower.includes('contemplat')) return EnrichedEmotion.CURIOSITY;
  if (lower.includes('surprise') || lower.includes('shock') || lower.includes('startle')) return EnrichedEmotion.SURPRISE;
  if (lower.includes('sad') || lower.includes('grief') || lower.includes('sorrow') || lower.includes('despair')) return EnrichedEmotion.SADNESS;
  if (lower.includes('anxious') || lower.includes('anxiety') || lower.includes('worry') || lower.includes('nervous')) return EnrichedEmotion.ANXIETY;
  if (lower.includes('fear') || lower.includes('terror') || lower.includes('dread') || lower.includes('panic')) return EnrichedEmotion.FEAR;
  if (lower.includes('anger') || lower.includes('rage') || lower.includes('frustrat') || lower.includes('annoy')) return EnrichedEmotion.FRUSTRATION;
  if (lower.includes('embarrass') || lower.includes('shame') || lower.includes('guilt') || lower.includes('awkward')) return EnrichedEmotion.DISCOMFORT;
  if (lower.includes('disgust') || lower.includes('repuls') || lower.includes('contempt') || lower.includes('loath')) return EnrichedEmotion.DISGUST;

  console.warn(`[EmotionMapping] Unmapped emotion for enriched: "${humeEmotion}" - assigning to Discomfort as fallback`);
  return EnrichedEmotion.DISCOMFORT;
}

/**
 * Aggregate detailed Hume emotions into 12 enriched emotion categories
 * Returns normalized percentages that sum to ~1.0
 */
export function aggregateToEnrichedEmotions(
  humeEmotions: Record<string, number>
): Record<EnrichedEmotion, number> {
  const sums: Record<EnrichedEmotion, number> = {
    [EnrichedEmotion.HAPPINESS]: 0,
    [EnrichedEmotion.LOVE_WARMTH]: 0,
    [EnrichedEmotion.WONDER]: 0,
    [EnrichedEmotion.SERENITY]: 0,
    [EnrichedEmotion.CURIOSITY]: 0,
    [EnrichedEmotion.SURPRISE]: 0,
    [EnrichedEmotion.SADNESS]: 0,
    [EnrichedEmotion.ANXIETY]: 0,
    [EnrichedEmotion.FEAR]: 0,
    [EnrichedEmotion.FRUSTRATION]: 0,
    [EnrichedEmotion.DISCOMFORT]: 0,
    [EnrichedEmotion.DISGUST]: 0,
  };

  Object.entries(humeEmotions).forEach(([name, score]) => {
    if (typeof score === 'number' && score > 0) {
      const enriched = mapToEnrichedEmotion(name);
      sums[enriched] += score;
    }
  });

  const total = Object.values(sums).reduce((a, b) => a + b, 0);
  const result = { ...sums };
  if (total > 0) {
    Object.keys(result).forEach((k) => {
      result[k as EnrichedEmotion] = result[k as EnrichedEmotion] / total;
    });
  }
  return result;
}

/**
 * Derive sentiment scores from enriched emotions
 */
export function getSentimentFromEnriched(
  enriched: Record<EnrichedEmotion, number>
): { positive: number; negative: number; neutral: number; overall: string; score: number } {
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  Object.entries(enriched).forEach(([emotion, score]) => {
    const polarity = ENRICHED_EMOTION_POLARITY[emotion as EnrichedEmotion];
    if (polarity === 'positive') positive += score;
    else if (polarity === 'negative') negative += score;
    else neutral += score;
  });

  const overall = positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral';
  // Score: 0 = fully negative, 0.5 = neutral, 1 = fully positive
  const rawScore = positive > negative
    ? 0.5 + positive * 0.5
    : negative > positive
      ? 0.5 - negative * 0.5
      : 0.5;
  const score = Math.max(0, Math.min(1, rawScore));

  return { positive, negative, neutral, overall, score };
}

/**
 * Aggregate detailed Hume emotions into 6 basic emotion categories (legacy)
 */
export function aggregateToBasicEmotions(
  humeEmotions: Record<string, number>
): Record<BasicEmotion, number> {
  const basicEmotionSums: Record<BasicEmotion, number> = {
    [BasicEmotion.JOY]: 0,
    [BasicEmotion.SADNESS]: 0,
    [BasicEmotion.ANGER]: 0,
    [BasicEmotion.FEAR]: 0,
    [BasicEmotion.SURPRISE]: 0,
    [BasicEmotion.DISGUST]: 0,
  };

  Object.entries(humeEmotions).forEach(([emotionName, score]) => {
    if (typeof score === 'number' && score > 0) {
      const basicEmotion = mapToBasicEmotion(emotionName);
      basicEmotionSums[basicEmotion] += score;
    }
  });

  const totalSum = Object.values(basicEmotionSums).reduce((acc, sum) => acc + sum, 0);
  const aggregated: Record<BasicEmotion, number> = {
    [BasicEmotion.JOY]: 0,
    [BasicEmotion.SADNESS]: 0,
    [BasicEmotion.ANGER]: 0,
    [BasicEmotion.FEAR]: 0,
    [BasicEmotion.SURPRISE]: 0,
    [BasicEmotion.DISGUST]: 0,
  };

  if (totalSum > 0) {
    Object.entries(basicEmotionSums).forEach(([emotion, sum]) => {
      aggregated[emotion as BasicEmotion] = sum / totalSum;
    });
  }

  return aggregated;
}

/**
 * Get the dominant (highest scoring) basic emotion (legacy)
 */
export function getDominantEmotion(
  basicEmotions: Record<BasicEmotion, number>
): { emotion: BasicEmotion; score: number } | null {
  let maxEmotion: BasicEmotion | null = null;
  let maxScore = 0;

  Object.entries(basicEmotions).forEach(([emotion, score]) => {
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion as BasicEmotion;
    }
  });

  if (maxEmotion && maxScore > 0) {
    return { emotion: maxEmotion, score: maxScore };
  }

  return null;
}

/**
 * Get the dominant enriched emotion
 */
export function getDominantEnrichedEmotion(
  enriched: Record<EnrichedEmotion, number>
): { emotion: EnrichedEmotion; score: number } | null {
  let maxEmotion: EnrichedEmotion | null = null;
  let maxScore = 0;

  Object.entries(enriched).forEach(([emotion, score]) => {
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion as EnrichedEmotion;
    }
  });

  if (maxEmotion && maxScore > 0) {
    return { emotion: maxEmotion, score: maxScore };
  }
  return null;
}

/**
 * Convert basic emotions object to sorted array for display (legacy)
 */
export function sortBasicEmotionsByScore(
  basicEmotions: Record<BasicEmotion, number>
): Array<{ emotion: BasicEmotion; score: number }> {
  return Object.entries(basicEmotions)
    .map(([emotion, score]) => ({ emotion: emotion as BasicEmotion, score }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Valence weights for 12 enriched emotions (-1.0 negative to +1.0 positive)
export const ENRICHED_EMOTION_VALENCE: Record<EnrichedEmotion, number> = {
  [EnrichedEmotion.HAPPINESS]: 1.0,
  [EnrichedEmotion.LOVE_WARMTH]: 0.9,
  [EnrichedEmotion.WONDER]: 0.8,
  [EnrichedEmotion.SERENITY]: 0.7,
  [EnrichedEmotion.CURIOSITY]: 0.4,
  [EnrichedEmotion.SURPRISE]: 0.1,
  [EnrichedEmotion.DISCOMFORT]: -0.4,
  [EnrichedEmotion.SADNESS]: -0.7,
  [EnrichedEmotion.ANXIETY]: -0.8,
  [EnrichedEmotion.FRUSTRATION]: -0.85,
  [EnrichedEmotion.DISGUST]: -0.9,
  [EnrichedEmotion.FEAR]: -1.0,
};

// Arousal weights for 12 enriched emotions (0.0 low to 1.0 high energy)
export const ENRICHED_EMOTION_AROUSAL: Record<EnrichedEmotion, number> = {
  [EnrichedEmotion.FEAR]: 0.95,
  [EnrichedEmotion.SURPRISE]: 0.9,
  [EnrichedEmotion.FRUSTRATION]: 0.85,
  [EnrichedEmotion.HAPPINESS]: 0.8,
  [EnrichedEmotion.ANXIETY]: 0.75,
  [EnrichedEmotion.WONDER]: 0.7,
  [EnrichedEmotion.DISCOMFORT]: 0.6,
  [EnrichedEmotion.CURIOSITY]: 0.55,
  [EnrichedEmotion.LOVE_WARMTH]: 0.5,
  [EnrichedEmotion.DISGUST]: 0.5,
  [EnrichedEmotion.SADNESS]: 0.3,
  [EnrichedEmotion.SERENITY]: 0.15,
};

/**
 * Convert enriched emotions to sorted array for display
 */
export function sortEnrichedEmotionsByScore(
  enriched: Record<EnrichedEmotion, number>
): Array<{ emotion: EnrichedEmotion; score: number; emoji: string }> {
  return Object.entries(enriched)
    .map(([emotion, score]) => ({
      emotion: emotion as EnrichedEmotion,
      score,
      emoji: ENRICHED_EMOTION_EMOJI[emotion as EnrichedEmotion] || '',
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Calculate emotional valence (-1.0 to +1.0) from enriched emotion distribution
 */
export function calculateValenceFromEnriched(
  enriched: Record<EnrichedEmotion, number>
): number {
  let weightedSum = 0;
  let totalScore = 0;

  Object.entries(enriched || {}).forEach(([emotionKey, score]) => {
    const val = ENRICHED_EMOTION_VALENCE[emotionKey as EnrichedEmotion] ?? 0;
    weightedSum += val * Number(score);
    totalScore += Number(score);
  });

  return totalScore > 0 ? Number((weightedSum / totalScore).toFixed(3)) : 0;
}

/**
 * Calculate emotional arousal (0.0 to 1.0) from enriched emotion distribution
 */
export function calculateArousalFromEnriched(
  enriched: Record<EnrichedEmotion, number>
): number {
  let weightedSum = 0;
  let totalScore = 0;

  Object.entries(enriched || {}).forEach(([emotionKey, score]) => {
    const aro = ENRICHED_EMOTION_AROUSAL[emotionKey as EnrichedEmotion] ?? 0.5;
    weightedSum += aro * Number(score);
    totalScore += Number(score);
  });

  return totalScore > 0 ? Number((weightedSum / totalScore).toFixed(3)) : 0.5;
}


