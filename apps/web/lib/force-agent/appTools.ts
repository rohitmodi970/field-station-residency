import { forceMemoryService } from './memoryService';
import { anthropicAdapter } from './toolAdapters/anthropic';
import type { ClaudeToolDefinition } from './types';
import { searchVektoriMemory } from '@/utils/vektori/client';
import { buildSearchPlan, scoreTextMatch, scoreVektoriResult } from '@/utils/vektori/query.js';
import {
  collectCandidateMemories,
  mergeSearchCandidates,
  type ParsedJournalMemory,
} from '@/utils/vektori/parseJournalMemory';
import { repairVektoriIndex } from '@/utils/vektori/repairMemory';
import { buildFallbackSynthesis, synthesizeMemoryResults } from '@/utils/vektori/synthesizeMemory';

async function getAdminClient() {
  try {
    // Next.js runtime path
    const mod = await import('@/utils/supabase/admin');
    return mod.createAdminClient();
  } catch {
    // Standalone test/Node runtime fallback
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
    );
  }
}

async function getReminderScheduler() {
  try {
    const mod = await import('@/utils/notifications/reminderScheduler');
    return mod.reminderScheduler;
  } catch {
    return {
      schedule: async () => {},
    };
  }
}

export interface NormalizedJournalEntry {
  id: string;
  journalId: string;
  title: string;
  content: string;
  date: string;
  displayDate?: string;
  mood?: string | null;
  tags?: string[];
  hasVoice?: boolean;
  voiceTranscript?: string;
  mediaType?: string[];
  audioUrls?: string[];
  journalType?: string;
}

export interface JournalMediaInspection {
  isTextOnly: boolean;
  hasVoice: boolean;
  entries: Array<{
    id: string;
    title: string;
    date: string;
    hasVoice: boolean;
    preview: string;
  }>;
  dates: string[];
  availableModes: Array<{
    id: 'cognition_engine' | 'pattern_map' | 'voice_analysis';
    title: string;
    subtitle: string;
    badge: string;
    icon: string;
  }>;
}

export interface JournalAnalysisData {
  analyzedEntries: Array<{ id: string; title: string; date: string; preview: string }>;
  dates: string[];
  summary: string;
  overallSentiment: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  emotionalShift?: string;
  keyInsights: Array<{ insight: string; evidence?: string[]; significance?: string }>;
  recommendations: Array<{ area: string; suggestion: string; rationale: string }>;
  taskCandidates?: Array<{
    title: string;
    priority?: 'high' | 'medium' | 'low';
    category?: string;
    due_date?: string | null;
  }>;
}

export type CognitionEngineAnalysisData = JournalAnalysisData;

export interface PatternMapAnalysisData {
  analyzedEntries: Array<{ id: string; journalId?: string; title: string; date: string; preview: string }>;
  entryIds?: string[];
  dates: string[];
  summary: string;
  keywords: Array<{ text: string; value: number; category?: string }>;
  topicHierarchy: string[];
  topicInsight: string;
  mindmapClusters: Array<{
    clusterTitle: string;
    theme: string;
    patternFlow: string[];
    insight: string;
  }>;
  lifePatterns: Array<{
    mirror: string;
    meaning: string;
    movement: string;
  }>;
  emotionalTrajectory: string;
  growthEdge: string;
  weeklyInsight?: string;
  reflectionSummary?: string;
  energyWellbeingInsight?: string;
  happinessSources?: Array<{ source: string; strength: number; moments: string[]; quote: string; color: string }>;
  sentimentScore?: number;
}

export interface VoiceAnalysisData {
  analyzedEntries: Array<{ id: string; title: string; date: string }>;
  dates: string[];
  summary: string;
  dominantEmotions: Array<{ emotion: string; score: number; indicator: string }>;
  speechCadence: {
    wordsPerMinute: number;
    paceCategory: 'deliberate' | 'measured' | 'rapid' | 'varied';
    rhythmNote: string;
  };
  vocalAcoustics: {
    pitchStability: string;
    energyLevel: 'grounded' | 'elevated' | 'fatigued' | 'balanced';
    vocalTension: 'low' | 'moderate' | 'high';
  };
  harmonySynthesis: string;
  recommendations: Array<{ suggestion: string; rationale: string }>;
}

export function inspectJournalMedia(entries: NormalizedJournalEntry[]): JournalMediaInspection {
  const hasVoice = entries.some(
    (e) =>
      Boolean(e.hasVoice) ||
      Boolean(e.voiceTranscript && e.voiceTranscript.trim()) ||
      (Array.isArray(e.mediaType) && e.mediaType.includes('audio')) ||
      (Array.isArray(e.audioUrls) && e.audioUrls.length > 0) ||
      e.journalType === 'voice'
  );
  const isTextOnly = !hasVoice;

  const availableModes: JournalMediaInspection['availableModes'] = [
    {
      id: 'cognition_engine',
      title: 'Cognition Engine Analysis',
      subtitle: 'Story Lens: Core insights, tensions, narrative shifts, and actionable task synthesis.',
      badge: 'Story Lens',
      icon: 'brain',
    },
    {
      id: 'pattern_map',
      title: 'Pattern Map Analysis',
      subtitle: 'Advanced Analysis: Thematic topics, emotional trajectory, mindmap clusters, and life patterns.',
      badge: 'Advanced Atlas',
      icon: 'map',
    },
  ];

  if (hasVoice) {
    availableModes.push({
      id: 'voice_analysis',
      title: 'Voice Analysis',
      subtitle: 'Acoustic Signals: Vocal sentiment, pitch variation, speaking cadence, and energy patterns.',
      badge: 'Acoustic Signals',
      icon: 'mic',
    });
  }

  const normalizedList = entries.map((e) => ({
    id: e.journalId || e.id,
    title: e.title || `Entry from ${e.date ? new Date(e.date).toLocaleDateString() : 'recent'}`,
    date: e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    hasVoice: Boolean(
      e.hasVoice ||
      (e.voiceTranscript && e.voiceTranscript.trim()) ||
      (Array.isArray(e.mediaType) && e.mediaType.includes('audio')) ||
      e.journalType === 'voice'
    ),
    preview: (e.content || '').slice(0, 100),
  }));

  const dates = [
    ...new Set(
      entries
        .map((e) => (e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''))
        .filter(Boolean)
    ),
  ];

  return {
    isTextOnly,
    hasVoice,
    entries: normalizedList,
    dates,
    availableModes,
  };
}

// ── Date parsing utilities ──────────────────────────────────────────────────
export function parseRequestedDatePatterns(text: string): string[] {
  const dates: string[] = [];
  const lower = text.toLowerCase();

  const monthMap: Record<string, string> = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sept: '09', sep: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  };

  // e.g. "29th August" or "29 august"
  const dayMonthRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = dayMonthRegex.exec(lower)) !== null) {
    const dayStr = match[1];
    const monthStr = match[2];
    if (dayStr && monthStr) {
      const day = dayStr.padStart(2, '0');
      const month = monthMap[monthStr.toLowerCase()];
      if (month) dates.push(`${month}-${day}`);
    }
  }

  // e.g. "August 29th" or "August 29"
  const monthDayRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;
  while ((match = monthDayRegex.exec(lower)) !== null) {
    const monthStr = match[1];
    const dayStr = match[2];
    if (monthStr && dayStr) {
      const month = monthMap[monthStr.toLowerCase()];
      const day = dayStr.padStart(2, '0');
      if (month) dates.push(`${month}-${day}`);
    }
  }

  // e.g. ISO format "2026-08-29" or "08-29"
  const isoRegex = /\b(?:\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g;
  while ((match = isoRegex.exec(lower)) !== null) {
    dates.push(`${match[1]}-${match[2]}`);
  }

  return [...new Set(dates)];
}

function entryMatchesDatePattern(entryDateStr: string, patterns: string[]): boolean {
  if (!entryDateStr || patterns.length === 0) return false;
  return patterns.some((p) => entryDateStr.includes(p));
}

// ── 1. Fetch Journals ───────────────────────────────────────────────────────
export async function fetchJournals(params: {
  userId: string;
  dates?: string[];
  startDate?: string;
  endDate?: string;
  query?: string;
  limit?: number;
  clientEntries?: any[];
}): Promise<{ entries: NormalizedJournalEntry[]; source: 'client_cache' | 'database' }> {
  const { userId, dates, startDate, endDate, query, limit = 10, clientEntries } = params;

  // 1. If client provided decrypted entries, check them first for plaintext
  if (clientEntries && Array.isArray(clientEntries) && clientEntries.length > 0) {
    let filtered: NormalizedJournalEntry[] = clientEntries.map((e: any) => {
      const hasMediaAudio =
        (Array.isArray(e.mediaType) && e.mediaType.includes('audio')) ||
        (Array.isArray(e.mediaUrl?.audio) && e.mediaUrl.audio.length > 0) ||
        (Array.isArray(e.audioUrls) && e.audioUrls.length > 0);
      const hasVoice =
        Boolean(e.hasVoice) ||
        Boolean(e.voiceTranscript && e.voiceTranscript.trim()) ||
        hasMediaAudio ||
        e.journalType === 'voice' ||
        e.journal_type === 'voice';

      const audioUrls = Array.isArray(e.mediaUrl?.audio)
        ? e.mediaUrl.audio
        : Array.isArray(e.audioUrls)
        ? e.audioUrls
        : [];

      return {
        id: e.id || e.journalId || e.journal_id || '',
        journalId: e.journalId || e.journal_id || e.id || '',
        title: e.title || '',
        content: e.resolvedContent || e.content || '',
        date: e.date || e.display_date || e.created_at || '',
        displayDate: e.display_date || e.date || '',
        mood: e.mood || null,
        tags: Array.isArray(e.tags) ? e.tags : [],
        hasVoice,
        voiceTranscript: e.voiceTranscript || '',
        mediaType: Array.isArray(e.mediaType) ? e.mediaType : hasMediaAudio ? ['audio'] : [],
        audioUrls,
        journalType: e.journalType || e.journal_type || '',
      };
    });

    if (dates && dates.length > 0) {
      filtered = filtered.filter((e) => entryMatchesDatePattern(e.date, dates) || entryMatchesDatePattern(e.displayDate || '', dates));
    }

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter((e) => e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q));
    }

    if (startDate) {
      filtered = filtered.filter((e) => new Date(e.date) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter((e) => new Date(e.date) <= new Date(endDate));
    }

    if (filtered.length > 0) {
      return {
        entries: filtered.slice(0, limit),
        source: 'client_cache',
      };
    }
  }

  // 2. Query Supabase database
  const adminClient = await getAdminClient();
  let dbQuery = adminClient
    .from('journals')
    .select('id, journal_id, title, content, mood, tags, date, display_date, created_at, journal_type, voice_transcript_encrypted, voice_transcript_iv, journal_media(id, media_type, public_url)')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('date', { ascending: false });

  if (query) {
    dbQuery = dbQuery.or(`title.ilike.%${query}%,content.ilike.%${query}%`);
  }

  const { data, error } = await dbQuery.limit(Math.max(limit * 3, 50));
  if (error || !data) {
    console.warn('[appTools.fetchJournals] DB query error:', error?.message);
    return { entries: [], source: 'database' };
  }

  let mapped: NormalizedJournalEntry[] = data.map((j: any) => {
    const hasMediaAudio = Array.isArray(j.journal_media) && j.journal_media.some((m: any) => m.media_type === 'audio');
    const audioUrls = Array.isArray(j.journal_media)
      ? j.journal_media.filter((m: any) => m.media_type === 'audio').map((m: any) => m.public_url).filter(Boolean)
      : [];
    const hasVoice =
      Boolean(j.voice_transcript_encrypted) ||
      j.journal_type === 'voice' ||
      hasMediaAudio;

    return {
      id: j.id,
      journalId: j.journal_id || j.id,
      title: j.title || '',
      content: j.content || '',
      date: j.date || j.created_at || '',
      displayDate: j.display_date || j.date || '',
      mood: j.mood || null,
      tags: Array.isArray(j.tags) ? j.tags : [],
      hasVoice,
      voiceTranscript: '',
      mediaType: hasMediaAudio ? ['audio'] : [],
      audioUrls,
      journalType: j.journal_type || '',
    };
  });

  if (dates && dates.length > 0) {
    mapped = mapped.filter((e) => entryMatchesDatePattern(e.date, dates) || entryMatchesDatePattern(e.displayDate || '', dates));
  }

  return {
    entries: mapped.slice(0, limit),
    source: 'database',
  };
}

// ── 2. Analyze Journals ─────────────────────────────────────────────────────
export async function analyzeJournals(params: {
  userId: string;
  entries?: NormalizedJournalEntry[];
  dates?: string[];
  query?: string;
  clientEntries?: any[];
  analysisType?: 'sentiment' | 'textual' | 'combined';
}): Promise<JournalAnalysisData> {
  const { userId, clientEntries } = params;
  let targetEntries = params.entries || [];

  // If no entries passed directly, fetch them using dates or query
  if (targetEntries.length === 0) {
    const fetched = await fetchJournals({
      userId,
      dates: params.dates,
      query: params.query,
      clientEntries,
      limit: 5,
    });
    targetEntries = fetched.entries;
  }

  // If still no entries found for requested dates, fetch the 2 most recent entries as fallback
  if (targetEntries.length === 0) {
    const recent = await fetchJournals({ userId, clientEntries, limit: 2 });
    targetEntries = recent.entries;
  }

  const analyzedList = targetEntries.map((e) => ({
    id: e.journalId || e.id,
    title: e.title || `Entry from ${new Date(e.date).toLocaleDateString()}`,
    date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    preview: (e.content || '').slice(0, 140),
  }));

  const entriesText = targetEntries
    .map(
      (e, i) =>
        `[ENTRY ${i + 1}] Date: ${new Date(e.date).toISOString().slice(0, 10)}\nTitle: ${e.title || 'Untitled'}\nMood: ${e.mood || 'Unspecified'}\nContent:\n${e.content || '(Encrypted or empty content)'}`
    )
    .join('\n\n---\n\n');

  // Query memory context for continuity
  let memoryContext = '';
  try {
    const mem = await forceMemoryService.getMemoryContext(userId, entriesText.slice(0, 400), {
      mode: 'journal_analysis',
      contextWindow: 4,
    });
    memoryContext = mem.context;
  } catch {}

  const prompt = `You are Force Agent, an empathetic, quietly observant reflection companion.
Analyze the following journal entries for this user:

${entriesText}

${memoryContext ? `USER MEMORY CONTEXT:\n${memoryContext}\n` : ''}

Provide a deep, thoughtful synthesis comparing these moments.
IMPORTANT GUIDELINES:
- Speak directly to the person with "you" language.
- Pay attention to the shift in tone, energy, tensions, or perspective between the dates.
- Keep observations grounded in specific text evidence.
- Include 2-3 practical, realistic action items / recommendations.

Return valid JSON with this exact structure:
{
  "summary": "3-4 sentences synthesizing the narrative arc, visible tension, and progress between these entries.",
  "overallSentiment": {
    "score": number (-1 to 1),
    "label": "positive" | "negative" | "neutral"
  },
  "emotionalShift": "1 concise sentence describing the emotional trajectory between the dates.",
  "keyInsights": [
    {
      "insight": "Clear observation about their pattern, focus, or conflict",
      "evidence": ["Short quote or specific reference from entry"],
      "significance": "Why this matters in their daily rhythm"
    }
  ],
  "recommendations": [
    {
      "area": "Focus | Rest | Relationships | Health | Routine",
      "suggestion": "Specific, realistic step they can take this week",
      "rationale": "Why this aligns with what they wrote"
    }
  ],
  "taskCandidates": [
    {
      "title": "Clear actionable task title",
      "priority": "high" | "medium" | "low",
      "category": "Personal" | "Work" | "Health" | "Reflection"
    }
  ]
}

Return ONLY valid JSON.`;

  const llmResult = await anthropicAdapter.execute({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2048,
    temperature: 0.4,
  });

  let parsed: any = null;
  if (llmResult.ok && llmResult.data?.text) {
    const raw = llmResult.data.text;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {}
    }
  }

  const result: JournalAnalysisData = {
    analyzedEntries: analyzedList,
    dates: analyzedList.map((a) => a.date),
    summary:
      parsed?.summary ||
      `Between these entries, your reflections show an evolving arc of attention. You are navigating real commitments while carving out space for mental clarity.`,
    overallSentiment: parsed?.overallSentiment || { score: 0.2, label: 'neutral' },
    emotionalShift:
      parsed?.emotionalShift ||
      `A noticeable shift from initial pressure toward clearer perspective and intentional pacing.`,
    keyInsights: Array.isArray(parsed?.keyInsights) && parsed.keyInsights.length > 0
      ? parsed.keyInsights
      : [
          {
            insight: 'Consistency in checking in with yourself creates stabilizing clarity during demanding weeks.',
            evidence: analyzedList.map((a) => a.title),
            significance: 'Protects focus before reactive demands take over.',
          },
        ],
    recommendations: Array.isArray(parsed?.recommendations) && parsed.recommendations.length > 0
      ? parsed.recommendations
      : [
          {
            area: 'Focus & Rhythm',
            suggestion: 'Reserve 15 minutes of uninterrupted morning journaling before checking messages.',
            rationale: 'Reinforces the clarity noted in your reflections.',
          },
        ],
    taskCandidates: Array.isArray(parsed?.taskCandidates) ? parsed.taskCandidates : [],
  };

  // Asynchronously ingest findings into Vektori memory
  void forceMemoryService.ingestJournalMessage(userId, {
    journalId: targetEntries[0]?.journalId || 'multi_entry_analysis',
    title: `Comparative Reflection (${result.dates.join(' & ')})`,
    content: entriesText,
    analysisSummary: result.summary,
    insights: result.keyInsights.map((k) => k.insight),
  });

  return result;
}

export const analyzeCognitionEngine = analyzeJournals;

// ── 2b. Advanced Pattern Map Analysis ───────────────────────────────────────
export async function analyzePatternMap(params: {
  userId: string;
  entries?: NormalizedJournalEntry[];
  dates?: string[];
  query?: string;
  clientEntries?: any[];
}): Promise<PatternMapAnalysisData> {
  const { userId, clientEntries } = params;
  let targetEntries = params.entries || [];

  if (targetEntries.length === 0) {
    const fetched = await fetchJournals({
      userId,
      dates: params.dates,
      query: params.query,
      clientEntries,
      limit: 6,
    });
    targetEntries = fetched.entries;
  }

  if (targetEntries.length === 0) {
    const recent = await fetchJournals({ userId, clientEntries, limit: 3 });
    targetEntries = recent.entries;
  }

  const analyzedList = targetEntries.map((e) => ({
    id: e.id || e.journalId,
    journalId: e.journalId || e.id,
    title: e.title || `Entry from ${new Date(e.date).toLocaleDateString()}`,
    date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    preview: (e.content || '').slice(0, 140),
  }));

  const entriesText = targetEntries
    .map(
      (e, i) =>
        `[ENTRY ${i + 1}] Date: ${new Date(e.date).toISOString().slice(0, 10)}\nTitle: ${e.title || 'Untitled'}\nMood: ${e.mood || 'Unspecified'}\nContent:\n${e.content || '(Encrypted or empty content)'}`
    )
    .join('\n\n---\n\n');

  let memoryContext = '';
  try {
    const mem = await forceMemoryService.getMemoryContext(userId, entriesText.slice(0, 400), {
      mode: 'journal_analysis',
      contextWindow: 4,
    });
    memoryContext = mem.context;
  } catch {}

  const prompt = `You are Force Agent's Advanced Pattern Map Atlas synthesizer.
Perform an Advanced Pattern Map analysis across these journal reflections:

${entriesText}

${memoryContext ? `USER MEMORY CONTEXT:\n${memoryContext}\n` : ''}

Generate structured pattern map analytics:
1. Thematic keywords with relevance weight (0-100) and thematic category.
2. Topic hierarchy spanning the user's primary mental focus areas.
3. Mindmap Pattern Clusters (Stage 2 - Pattern Detection): Cluster title, underlying theme, sequential pattern flow, and grounded insight.
4. Life Patterns (Stage 3 - Insight Generation): Mirror (what is observed), Meaning (why it happens), Movement (how to shift).
5. Emotional trajectory and growth edge.

Return valid JSON with this exact structure:
{
  "summary": "3-4 sentences synthesizing the overarching mental atlas, recurring patterns, and thematic progression.",
  "keywords": [
    { "text": "Deep Work", "value": 92, "category": "Productivity" },
    { "text": "Mental Space", "value": 78, "category": "Mindset" },
    { "text": "Sustainable Pace", "value": 68, "category": "Habits" }
  ],
  "topicHierarchy": ["Deep Focus & Work", "Mental Clarity & Rest", "Relational Rhythm"],
  "topicInsight": "Concise summary of how the primary topics intersect in their daily life.",
  "mindmapClusters": [
    {
      "clusterTitle": "Attentional Focus & Recovery Loop",
      "theme": "Deep Work & Energy Management",
      "patternFlow": ["Intense Project Demands", "Cognitive Strain", "Stabilizing Journal Reflection"],
      "insight": "Writing serves as the primary stabilizing valve before overwhelm sets in."
    }
  ],
  "lifePatterns": [
    {
      "mirror": "Taking on multiple ambitious responsibilities in compressed timeframes.",
      "meaning": "High drive for mastery and impact, occasionally outpacing recovery cycles.",
      "movement": "Deliberately schedule recovery blocks with the same rigor as active projects."
    }
  ],
  "emotionalTrajectory": "Initial friction gives way to grounded resolve as insights are committed to writing.",
  "growthEdge": "Transitioning from reactive problem-solving to proactively shaping daily boundaries."
}
Return ONLY valid JSON.`;

  const llmResult = await anthropicAdapter.execute({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2500,
    temperature: 0.35,
  });

  let parsed: any = null;
  if (llmResult.ok && llmResult.data?.text) {
    const raw = llmResult.data.text;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {}
    }
  }

  const result: PatternMapAnalysisData = {
    analyzedEntries: analyzedList,
    entryIds: targetEntries.map(e => e.journalId || e.id).filter(Boolean),
    dates: analyzedList.map((a) => a.date),
    summary:
      parsed?.summary ||
      `Across these reflections, your thoughts follow a recurring rhythm between intense focus and the desire for calm renewal. Themes of self-discipline and thoughtful recovery stand out.`,
    keywords:
      Array.isArray(parsed?.keywords) && parsed.keywords.length > 0
        ? parsed.keywords
        : [
            { text: 'Clarity', value: 88, category: 'Mindset' },
            { text: 'Rhythm', value: 76, category: 'Habits' },
            { text: 'Priorities', value: 72, category: 'Focus' },
            { text: 'Restoration', value: 64, category: 'Wellness' },
          ],
    topicHierarchy:
      Array.isArray(parsed?.topicHierarchy) && parsed.topicHierarchy.length > 0
        ? parsed.topicHierarchy
        : ['Focus & Energy Allocation', 'Intentional Reflection', 'Sustainable Pace'],
    topicInsight:
      parsed?.topicInsight ||
      'Your reflections show strong intentionality around protecting high-value attention from scattered distractions.',
    mindmapClusters:
      Array.isArray(parsed?.mindmapClusters) && parsed.mindmapClusters.length > 0
        ? parsed.mindmapClusters
        : [
            {
              clusterTitle: 'Attentional Loop',
              theme: 'Deep Work & Mental Energy',
              patternFlow: ['Demanding commitments', 'Cognitive fatigue', 'Journaling grounding'],
              insight: 'Writing serves as the primary stabilizing valve before overwhelm sets in.',
            },
          ],
    lifePatterns:
      Array.isArray(parsed?.lifePatterns) && parsed.lifePatterns.length > 0
        ? parsed.lifePatterns
        : [
            {
              mirror: 'Taking on multiple ambitious responsibilities in compressed timeframes.',
              meaning: 'High drive for mastery and impact, occasionally outpacing recovery cycles.',
              movement: 'Deliberately schedule recovery blocks with the same rigor as active projects.',
            },
          ],
    emotionalTrajectory:
      parsed?.emotionalTrajectory ||
      'Initial friction gives way to grounded resolve as insights are committed to writing.',
    growthEdge:
      parsed?.growthEdge ||
      'Transitioning from reactive problem-solving to proactively shaping daily boundaries.',
    weeklyInsight:
      parsed?.weeklyInsight ||
      'Protect your highest-energy morning hours for single-task focus and thoughtful reflection.',
    reflectionSummary:
      parsed?.reflectionSummary ||
      parsed?.summary ||
      `Across these reflections, your thoughts follow a recurring rhythm between intense focus and the desire for calm renewal.`,
    energyWellbeingInsight:
      parsed?.energyWellbeingInsight ||
      'Mental energy surges when intense deep work sessions are bounded by intentional recovery blocks.',
    sentimentScore:
      typeof parsed?.sentimentScore === 'number' ? parsed.sentimentScore : 78,
    happinessSources:
      Array.isArray(parsed?.happinessSources) && parsed.happinessSources.length > 0
        ? parsed.happinessSources
        : [
            { source: 'Creative Focus', strength: 88, moments: ['Focused writing', 'Unbroken project blocks'], quote: 'Clarity arrives when distractions cease.', color: '#8b5d36' },
            { source: 'Intentional Restoration', strength: 74, moments: ['Evening downtime', 'Physical reset'], quote: 'Recovery fuels sustainable output.', color: '#2563eb' },
          ],
  };

  void forceMemoryService.ingestJournalMessage(userId, {
    journalId: targetEntries[0]?.journalId || 'pattern_map_analysis',
    title: `Pattern Map Synthesis (${result.dates.join(' & ')})`,
    content: entriesText,
    analysisSummary: result.summary,
    insights: result.mindmapClusters.map((c) => `${c.clusterTitle}: ${c.insight}`),
  });

  return result;
}

// ── 2c. Voice & Acoustic Signals Analysis ───────────────────────────────────
export async function analyzeVoice(params: {
  userId: string;
  entries?: NormalizedJournalEntry[];
  dates?: string[];
  query?: string;
  clientEntries?: any[];
}): Promise<VoiceAnalysisData> {
  const { userId, clientEntries } = params;
  let targetEntries = params.entries || [];

  if (targetEntries.length === 0) {
    const fetched = await fetchJournals({
      userId,
      dates: params.dates,
      query: params.query,
      clientEntries,
      limit: 5,
    });
    targetEntries = fetched.entries;
  }

  if (targetEntries.length === 0) {
    const recent = await fetchJournals({ userId, clientEntries, limit: 2 });
    targetEntries = recent.entries;
  }

  const voiceEntries = targetEntries.filter((e) => Boolean(e.hasVoice || e.voiceTranscript));
  const entriesToAnalyze = voiceEntries.length > 0 ? voiceEntries : targetEntries;

  const analyzedList = entriesToAnalyze.map((e) => ({
    id: e.journalId || e.id,
    title: e.title || `Voice Entry from ${new Date(e.date).toLocaleDateString()}`,
    date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }));

  const entriesText = entriesToAnalyze
    .map(
      (e, i) =>
        `[VOICE ENTRY ${i + 1}] Date: ${new Date(e.date).toISOString().slice(0, 10)}\nTitle: ${e.title || 'Untitled'}\nVoice Transcript / Audio Content:\n${e.voiceTranscript || e.content || '(Audio spoken recording)'}`
    )
    .join('\n\n---\n\n');

  const prompt = `You are Force Agent's Acoustic & Voice Signal Analyst.
Analyze the voice recordings, speech patterns, and spoken transcripts for this user:

${entriesText}

Provide an acoustic emotion & voice cadence synthesis:
1. Dominant vocal emotions with probability scores (0.0 to 1.0) and audible indicators.
2. Speech cadence: Words per minute estimate, cadence pace category ("deliberate" | "measured" | "rapid" | "varied"), and rhythm note.
3. Vocal acoustics: Pitch stability description, vocal energy level ("grounded" | "elevated" | "fatigued" | "balanced"), and vocal tension ("low" | "moderate" | "high").
4. Harmony synthesis: How their vocal tone and inflection compare with the spoken words (e.g. calm tone vs urgent content, or authentic vulnerability).
5. 2 practical voice & recovery recommendations.

Return valid JSON with this exact structure:
{
  "summary": "3-4 sentences synthesizing vocal tone, emotional prosody, and presence in their voice.",
  "dominantEmotions": [
    { "emotion": "Calm & Reflective", "score": 0.84, "indicator": "Slow, relaxed expiration and steady pitch" },
    { "emotion": "Contemplation", "score": 0.76, "indicator": "Thoughtful pauses between phrases" },
    { "emotion": "Subtle Fatigue", "score": 0.38, "indicator": "Slight vocal fry and softer volume at sentence ends" }
  ],
  "speechCadence": {
    "wordsPerMinute": 128,
    "paceCategory": "measured",
    "rhythmNote": "Unrushed, intentional cadence with clear pauses at moments of insight."
  },
  "vocalAcoustics": {
    "pitchStability": "Even, centered pitch contour with gentle inflections on emphatic words.",
    "energyLevel": "grounded",
    "vocalTension": "low"
  },
  "harmonySynthesis": "Your spoken tone aligns closely with your reflection — the vocal cadence is grounded, signaling that your thoughts are processed with genuine presence rather than rushed panic.",
  "recommendations": [
    { "suggestion": "Maintain this deliberate cadence during high-stakes discussions.", "rationale": "Your voice carries natural authority and clarity when unrushed." },
    { "suggestion": "Take 2 deep diaphragmatic breaths before recording evening reflections.", "rationale": "Releases subtle vocal tension noted toward the end of your day." }
  ]
}
Return ONLY valid JSON.`;

  const llmResult = await anthropicAdapter.execute({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2048,
    temperature: 0.3,
  });

  let parsed: any = null;
  if (llmResult.ok && llmResult.data?.text) {
    const raw = llmResult.data.text;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {}
    }
  }

  const result: VoiceAnalysisData = {
    analyzedEntries: analyzedList,
    dates: analyzedList.map((a) => a.date),
    summary:
      parsed?.summary ||
      `Your voice carries a steady, centered presence across these recordings. Your speech cadence is measured and thoughtful, reflecting genuine inner processing.`,
    dominantEmotions:
      Array.isArray(parsed?.dominantEmotions) && parsed.dominantEmotions.length > 0
        ? parsed.dominantEmotions
        : [
            { emotion: 'Calm Processing', score: 0.82, indicator: 'Even pacing and steady breath support' },
            { emotion: 'Contemplation', score: 0.74, indicator: 'Extended pauses before key conclusions' },
            { emotion: 'Grounded Energy', score: 0.65, indicator: 'Resonant tone with minimal vocal strain' },
          ],
    speechCadence: parsed?.speechCadence || {
      wordsPerMinute: 132,
      paceCategory: 'measured',
      rhythmNote: 'Natural, unforced tempo that facilitates clear narrative articulation.',
    },
    vocalAcoustics: parsed?.vocalAcoustics || {
      pitchStability: 'Consistent baseline pitch with subtle rises when surfacing positive realizations.',
      energyLevel: 'grounded',
      vocalTension: 'low',
    },
    harmonySynthesis:
      parsed?.harmonySynthesis ||
      'Your vocal tone matches your written content: clear, observant, and devoid of performative urgency.',
    recommendations:
      Array.isArray(parsed?.recommendations) && parsed.recommendations.length > 0
        ? parsed.recommendations
        : [
            {
              suggestion: 'Keep speaking your reflections aloud whenever complex decisions arise.',
              rationale: 'Hearing your voice pace reinforces mental clarity and emotional equilibrium.',
            },
          ],
  };

  void forceMemoryService.ingestJournalMessage(userId, {
    journalId: targetEntries[0]?.journalId || 'voice_analysis',
    title: `Voice Signals & Acoustic Synthesis (${result.dates.join(' & ')})`,
    content: entriesText,
    analysisSummary: result.summary,
    insights: result.dominantEmotions.map((e) => `${e.emotion} (${Math.round(e.score * 100)}%)`),
  });

  return result;
}

// ── 2d. Intelligent Semantic Memory & Vektori Search ─────────────────────────
export interface MemorySearchItem {
  journalId: string;
  title: string;
  date?: string;
  summary: string;
  relevance: number;
  highlight?: string;
}

export interface MemorySearchData {
  query: string;
  answer: string;
  memories: MemorySearchItem[];
  source: 'vektori' | 'local' | 'hybrid' | 'none';
  searchTerms: string[];
  totalHits: number;
  memoryRepaired?: boolean;
}

export async function searchIntelligentMemory(params: {
  userId: string;
  query: string;
  depth?: 'l0' | 'l1' | 'l2';
  clientEntries?: any[];
  contextWindow?: number;
}): Promise<MemorySearchData> {
  const { userId, query, depth = 'l1', clientEntries, contextWindow = 2 } = params;
  const rawQuery = (query || '').trim();

  if (!rawQuery) {
    return {
      query: '',
      answer: 'Please provide a topic or question to search across your memories.',
      memories: [],
      source: 'none',
      searchTerms: [],
      totalHits: 0,
    };
  }

  // 1. Build intelligent multi-hop search plan with semantic expansions
  const searchPlan = buildSearchPlan(rawQuery);

  // 2. Search Vektori memory across search queries and score best result
  let bestResult: Awaited<ReturnType<typeof searchVektoriMemory>> = null;
  let bestScore = 0;
  let queryUsed = searchPlan.primary;

  for (const candidateQuery of searchPlan.searchQueries) {
    try {
      const attempt = await searchVektoriMemory({
        userId,
        query: candidateQuery,
        depth,
        contextWindow,
      });
      const score = scoreVektoriResult(attempt, searchPlan.baseTerms);
      if (score > bestScore) {
        bestScore = score;
        bestResult = attempt;
        queryUsed = candidateQuery;
      }
    } catch (e) {
      console.warn('[searchIntelligentMemory] Vektori search attempt failed:', e);
    }
  }

  // 3. Prepare client candidates from decrypted journals (if available) or DB
  let candidateJournals: any[] = [];
  if (Array.isArray(clientEntries) && clientEntries.length > 0) {
    candidateJournals = clientEntries;
  } else {
    try {
      const fetched = await fetchJournals({ userId, limit: 30 });
      candidateJournals = fetched.entries;
    } catch {}
  }

  // Also include user answers and reflections from Cognition Engine sessions
  try {
    const admin = await getAdminClient();
    const { data: cogRows } = await admin
      .from('cognition_responses')
      .select('id, insight_core, insight_tension, question_responses, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (cogRows && Array.isArray(cogRows)) {
      for (const row of cogRows) {
        const qas = Array.isArray(row.question_responses)
          ? row.question_responses
              .filter((q: any) => Boolean(q?.question && q?.answer))
              .map((q: any) => `Question: ${q.question}\nAnswer: ${q.answer}`)
              .join('\n\n')
          : '';
        const bodyContent = [
          row.insight_core ? `Core Insight: ${row.insight_core}` : '',
          row.insight_tension ? `Tension: ${row.insight_tension}` : '',
          qas,
        ].filter(Boolean).join('\n\n');

        if (bodyContent) {
          candidateJournals.push({
            id: row.id,
            title: `Cognition Engine: ${row.insight_core || 'Reflection Q&A'}`,
            content: bodyContent,
            date: row.created_at,
            category: 'reflective',
          });
        }
      }
    }
  } catch (cogErr) {
    // Graceful skip if table is empty or unavailable
  }

  // Score and filter candidates based on title, content, and expanded search terms
  const parsedCandidates: ParsedJournalMemory[] = [];
  for (const journal of candidateJournals) {
    const title = String(journal.title || '').trim();
    const content = String(journal.content || '').trim();
    if (!title && !content) continue;

    const titleScore = scoreTextMatch(title, searchPlan.baseTerms) * 3 + scoreTextMatch(title, searchPlan.expandedTerms);
    const contentScore = scoreTextMatch(content, searchPlan.baseTerms) * 2 + scoreTextMatch(content, searchPlan.expandedTerms);
    const totalScore = titleScore + contentScore;

    if (totalScore > 0 || searchPlan.baseTerms.length === 0) {
      parsedCandidates.push({
        journalId: String(journal.journalId || journal.id || 'unknown'),
        title: title || 'Untitled Reflection',
        content,
        entryDate: journal.date || journal.displayDate || journal.entryDate || undefined,
        mood: journal.mood || undefined,
      });
    }
  }

  // 4. Autonomous Memory Repair: If local candidates have strong relevance but Vektori lacks indexing, auto-repair!
  let memoryRepaired = false;
  const hasHits = bestResult && (bestResult.facts.length + bestResult.episodes.length + bestResult.sentences.length > 0);
  let maxLocalScore = 0;
  for (const c of parsedCandidates) {
    maxLocalScore = Math.max(maxLocalScore, scoreTextMatch(`${c.title}\n${c.content}`, searchPlan.baseTerms));
  }

  if (parsedCandidates.length > 0 && (maxLocalScore >= 2 || !hasHits || bestScore < 2)) {
    try {
      const repairedCount = await repairVektoriIndex(userId, parsedCandidates.slice(0, 8));
      if (repairedCount > 0) {
        memoryRepaired = true;
        for (const candidateQuery of searchPlan.searchQueries) {
          const attempt = await searchVektoriMemory({
            userId,
            query: candidateQuery,
            depth,
            contextWindow,
          });
          const score = scoreVektoriResult(attempt, searchPlan.baseTerms);
          if (score > bestScore) {
            bestScore = score;
            bestResult = attempt;
            queryUsed = candidateQuery;
          }
        }
      }
    } catch {}
  }

  // 5. Collect and merge Vektori candidate items with local candidates
  const vektoriItems = bestResult
    ? [...bestResult.facts, ...bestResult.episodes, ...bestResult.sentences]
    : [];

  const vektoriCandidates = collectCandidateMemories(vektoriItems, 12);
  const mergedCandidates = mergeSearchCandidates(
    vektoriCandidates,
    parsedCandidates,
    searchPlan.baseTerms,
    10
  );

  const usedVektori = vektoriCandidates.length > 0;

  // 6. Intelligent Synthesis with Claude
  let synthesized = await synthesizeMemoryResults({
    query: rawQuery,
    rankedCandidates: mergedCandidates,
  });

  if (!synthesized || (synthesized.memories.length === 0 && mergedCandidates.length > 0)) {
    synthesized = buildFallbackSynthesis(rawQuery, mergedCandidates);
  }

  const source = usedVektori && parsedCandidates.length > 0
    ? 'hybrid'
    : usedVektori
      ? 'vektori'
      : parsedCandidates.length > 0
        ? 'local'
        : 'none';

  return {
    query: rawQuery,
    answer: synthesized.answer,
    memories: synthesized.memories,
    source,
    searchTerms: searchPlan.expandedTerms,
    totalHits: synthesized.memories.length,
    memoryRepaired,
  };
}

// ── 3. Create Journal Entry ─────────────────────────────────────────────────
export async function createJournalEntry(params: {
  userId: string;
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  date?: string;
}): Promise<NormalizedJournalEntry> {
  const { userId, title, content, mood = 'reflective', tags = [], date } = params;
  const adminClient = await getAdminClient();

  const entryDate = date ? new Date(date).toISOString() : new Date().toISOString();
  const journalId = `${userId.substring(0, 8)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const { data, error } = await adminClient
    .from('journals')
    .insert({
      user_id: userId,
      journal_id: journalId,
      title: title || 'Journal Entry',
      content,
      mood,
      tags,
      date: entryDate,
      display_date: entryDate,
      is_deleted: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create journal: ${error.message}`);
  }

  // Ingest to memory
  void forceMemoryService.ingestJournalMessage(userId, {
    journalId,
    title,
    content,
  });

  return {
    id: data.id,
    journalId: data.journal_id || journalId,
    title: data.title,
    content: data.content,
    date: data.date,
    displayDate: data.display_date,
    mood: data.mood,
    tags: data.tags,
  };
}

// ── 4. Task Management (ai_todos) ───────────────────────────────────────────
export async function fetchTodos(params: {
  userId: string;
  status?: 'pending' | 'in_progress' | 'done' | 'all';
  priority?: 'high' | 'medium' | 'low';
  limit?: number;
  clientTodos?: any[];
}): Promise<any[]> {
  const { userId, status = 'pending', priority, limit = 50, clientTodos } = params;
  const adminClient = await getAdminClient();

  let rawList: any[] = [];
  if (Array.isArray(clientTodos) && clientTodos.length > 0) {
    rawList = clientTodos;
  } else {
    // Fetch generous window from database ordered by created_at
    const { data, error } = await adminClient
      .from('ai_todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('[appTools.fetchTodos] DB error:', error.message);
      return [];
    }
    rawList = data || [];
  }

  // 1. Filter out completely blank or empty titles
  let processed = rawList.filter((t) => Boolean(t.title && String(t.title).trim()));

  // 2. Filter by status if specified
  if (status && status !== 'all') {
    if (status === 'pending') {
      processed = processed.filter((t) => t.status === 'pending' || t.status === 'in_progress');
    } else {
      processed = processed.filter((t) => t.status === status);
    }
  }

  // 3. Filter by priority if specified
  if (priority) {
    processed = processed.filter((t) => t.priority === priority);
  }

  // 4. Sort with correct priority weights and status order:
  //    Active/pending tasks first, high > medium > low, newest first
  const statusWeights: Record<string, number> = { pending: 0, in_progress: 1, done: 2 };
  const priorityWeights: Record<string, number> = { high: 0, medium: 1, low: 2 };

  processed.sort((a, b) => {
    // Pending tasks ALWAYS come before completed tasks
    const sa = statusWeights[a.status] ?? 0;
    const sb = statusWeights[b.status] ?? 0;
    if (sa !== sb) return sa - sb;

    // High priority before medium, then low
    const pa = priorityWeights[a.priority] ?? 1;
    const pb = priorityWeights[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;

    // Newest first
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

  return processed.slice(0, limit);
}

export async function createTodo(params: {
  userId: string;
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  due_date?: string | null;
  category?: string;
  reminder_at?: string | null;
}): Promise<any> {
  const { userId, title, description, priority = 'medium', due_date, category = 'Personal', reminder_at } = params;
  const adminClient = await getAdminClient();

  const { data, error } = await adminClient
    .from('ai_todos')
    .insert({
      user_id: userId,
      title: title.trim(),
      description: description || null,
      priority,
      status: 'pending',
      due_date: due_date || null,
      category,
      is_manual: true,
      source_type: 'manual',
      reminder_at: reminder_at || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  // Schedule in-app reminder notification if date provided
  if (reminder_at && data) {
    try {
      const remDate = new Date(reminder_at);
      if (!Number.isNaN(remDate.getTime())) {
        const scheduler = await getReminderScheduler();
        await scheduler.schedule({
          userId,
          todoId: data.id,
          title: data.title,
          body: description || `Reminder: ${data.title}`,
          reminderAt: remDate,
          reminderType: 'custom',
        });
      }
    } catch {}
  }

  return data;
}

export async function updateTodoStatus(params: {
  userId: string;
  id?: string;
  titleMatch?: string;
  status: 'pending' | 'in_progress' | 'done';
}): Promise<any> {
  const { userId, id, titleMatch, status } = params;
  const adminClient = await getAdminClient();

  if (id) {
    const { data, error } = await adminClient
      .from('ai_todos')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  if (titleMatch) {
    const { data: matches } = await adminClient
      .from('ai_todos')
      .select('id, title')
      .eq('user_id', userId)
      .ilike('title', `%${titleMatch.trim()}%`)
      .limit(1);

    if (matches && matches.length > 0 && matches[0]?.id) {
      const targetId = matches[0].id;
      const { data, error } = await adminClient
        .from('ai_todos')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', targetId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  throw new Error('Task not found to update');
}

export async function deleteTodo(params: {
  userId: string;
  id?: string;
  clearCompleted?: boolean;
}): Promise<{ success: boolean; message: string }> {
  const { userId, id, clearCompleted } = params;
  const adminClient = await getAdminClient();

  if (clearCompleted) {
    const { error } = await adminClient.from('ai_todos').delete().eq('user_id', userId).eq('status', 'done');
    if (error) throw error;
    return { success: true, message: 'Cleared all completed tasks.' };
  }

  if (id) {
    const { error } = await adminClient.from('ai_todos').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
    return { success: true, message: 'Task deleted successfully.' };
  }

  return { success: false, message: 'No task specified to delete.' };
}

// ── 5. User Activity Stats ──────────────────────────────────────────────────
export async function getUserStats(userId: string): Promise<{
  journalCount: number;
  activeTodosCount: number;
  completedTodosCount: number;
  streakDays: number;
  momentumScore: number;
}> {
  const adminClient = await getAdminClient();

  const [journalsRes, todosRes] = await Promise.all([
    adminClient.from('journals').select('date, created_at').eq('user_id', userId).eq('is_deleted', false),
    adminClient.from('ai_todos').select('status').eq('user_id', userId),
  ]);

  const journals = journalsRes.data || [];
  const todos = todosRes.data || [];

  const activeTodos = todos.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
  const completedTodos = todos.filter((t) => t.status === 'done').length;

  const uniqueDates = new Set(journals.map((j) => (j.date || j.created_at || '').slice(0, 10)).filter(Boolean));
  const streakDays = Math.min(uniqueDates.size, 14);
  const momentumScore = Math.min(100, Math.round(journals.length * 5 + completedTodos * 8 + streakDays * 3));

  return {
    journalCount: journals.length,
    activeTodosCount: activeTodos,
    completedTodosCount: completedTodos,
    streakDays,
    momentumScore,
  };
}

// ── Claude Tool Definitions ─────────────────────────────────────────────────
export const FORCE_APP_TOOLS: ClaudeToolDefinition[] = [
  {
    name: 'fetch_journals',
    description: 'Retrieve user journal entries from database by exact date (e.g. Aug 29, Sep 1), search keyword, or recent entries.',
    input_schema: {
      type: 'object',
      properties: {
        dates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Calendar dates to look for, e.g. ["08-29", "09-01"] or ["2026-08-29"]',
        },
        query: { type: 'string', description: 'Keyword to search across titles and contents' },
        limit: { type: 'number', description: 'Number of entries to return' },
      },
    },
  },
  {
    name: 'analyze_journals',
    description: 'Perform Cognition Engine analysis (Story Lens) on journal entries across dates or topics for narrative arc, emotional shift, core tensions, and actionable task synthesis.',
    input_schema: {
      type: 'object',
      properties: {
        dates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dates to compare/analyze, e.g. ["08-29", "09-01"]',
        },
        query: { type: 'string', description: 'Specific theme to focus analysis on' },
      },
    },
  },
  {
    name: 'analyze_pattern_map',
    description: 'Perform Advanced Pattern Map Atlas analysis across journal reflections for thematic keywords, mindmap clusters, life patterns (Mirror-Meaning-Movement), and growth edge.',
    input_schema: {
      type: 'object',
      properties: {
        dates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dates to compare/analyze, e.g. ["08-29", "09-01"]',
        },
        query: { type: 'string', description: 'Specific theme to focus analysis on' },
      },
    },
  },
  {
    name: 'analyze_voice',
    description: 'Perform Voice and Acoustic Signals analysis on audio recordings and voice transcripts for vocal emotions, speech cadence, pitch stability, and energy patterns.',
    input_schema: {
      type: 'object',
      properties: {
        dates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dates of voice entries to analyze, e.g. ["08-29", "09-01"]',
        },
        query: { type: 'string', description: 'Specific audio topic to focus on' },
      },
    },
  },
  {
    name: 'create_journal_entry',
    description: "Write and save a new journal or diary entry in the user's personal journal.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the entry' },
        content: { type: 'string', description: 'Text content of the reflection' },
        mood: { type: 'string', description: 'Mood indicator (e.g. calm, reflective, energized)' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['content'],
    },
  },
  {
    name: 'fetch_todos',
    description: "Retrieve user's tasks and action items from their to-do list.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'all'] },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
  },
  {
    name: 'create_todo',
    description: 'Add a new prioritized task or reminder to the to-do list.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Actionable task title' },
        description: { type: 'string', description: 'Optional context or details' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        due_date: { type: 'string', description: 'ISO date string or deadline' },
        category: { type: 'string', description: 'Category (Personal, Work, Health, Reflection)' },
        reminder_at: { type: 'string', description: 'ISO reminder time string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_todo',
    description: 'Update the status of a task, such as marking it as done or in_progress.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the todo if known' },
        titleMatch: { type: 'string', description: 'Task title or keyword to match' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'done'] },
      },
      required: ['status'],
    },
  },
  {
    name: 'search_memory',
    description: "Search and recall semantic memories, past events, health/medication notes, habits, travel, commitments, and specific reflections across the user's private memory tiers and journals.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Plain English question or search phrase, e.g. "medication timings", "what did I say about allergies", "trip to Kolkata"' },
        depth: { type: 'string', enum: ['l0', 'l1', 'l2'], description: 'Optional memory search depth (l0 = recent, l1 = episodic, l2 = deep semantic core)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'query_memory',
    description: "Recall user's habits, standing intentions, preferences, or narrative history from memory tiers.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic or aspect to recall' },
        depth: { type: 'string', enum: ['l0', 'l1', 'l2'], description: 'Optional memory search depth' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_user_stats',
    description: 'Retrieve user journal count, streak, active task counts, and momentum score.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'register_luma_event',
    description: 'Automate event registration via TinyFish browser agent for a Luma URL.',
    input_schema: {
      type: 'object',
      properties: {
        eventUrl: { type: 'string', description: 'https://lu.ma/... event link' },
      },
      required: ['eventUrl'],
    },
  },
  {
    name: 'suggest_real_world_action',
    description:
      'Suggest an offline, physical, or human connection action when the user is stuck in a loop, mentally fatigued, stressed, isolated, or needs a physical reset. Prototypes: walk ("Go for a walk"), call_friend ("Call your friend"), take_break ("Take a break"), or meal ("Have a meal away from desk").',
    input_schema: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          enum: ['walk', 'call_friend', 'take_break', 'meal', 'custom'],
          description: 'Type of real-world action to suggest',
        },
        title: {
          type: 'string',
          description:
            'Clear, encouraging title (e.g. "Go for a 15-minute walk outside", "Call your friend Alex", "Take a 10-minute screen break")',
        },
        description: {
          type: 'string',
          description:
            'Gentle, empathetic grounding rationale explaining why stepping into the physical world helps right now',
        },
        estimated_minutes: {
          type: 'number',
          description: 'Suggested duration in minutes',
        },
        target_person: {
          type: 'string',
          description:
            'Name of friend, partner, or connection to call/meet if action_type is call_friend',
        },
        suggested_prompt: {
          type: 'string',
          description: 'A low-pressure conversation starter if reaching out to someone',
        },
      },
      required: ['action_type', 'title', 'description'],
    },
  },
  {
    name: 'get_user_location',
    description: "Retrieve the user's live physical location, coordinates, city, region, country, and timezone to provide location-specific advice, weather, venue recommendations, or accurate local time context.",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'web_search',
    description: 'Search the live web for movie releases, cinema, films, news, entertainment, events, classes, websites, meetups, venues, articles, local activities, or up-to-date real-world facts using Firecrawl and live search engines.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query or keywords to look up on the web (e.g. "latest Bengali movie releases 2026", "AI events in Chennai 2026", "new movies in theaters")' },
        location: { type: 'string', description: 'Optional city or location context, e.g. "Chennai", "Kolkata"' },
        limit: { type: 'number', description: 'Number of results to return (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'browse_and_register',
    description: 'Use the TinyFish autonomous browser agent to navigate to an event or class URL and perform automated online sign-up / registration for the user. If an account login or membership is required, the agent checks user profile credentials and logs in or uses guest registration to successfully complete the sign-up.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target registration or booking URL' },
        prompt: { type: 'string', description: 'Task instruction (e.g. "Register me in the 11am class")' },
      },
      required: ['url'],
    },
  },
  {
    name: 'check_residency_schedule',
    description:
      'Check potential schedule conflicts against the official Dhun residency schedule (October 24–30). Identifies core sessions (Daily Stand-up, Logos workshop, quiet build time, dinner) and accounts for the 45–60 min transit time each way between Dhun bioreserve and central Jaipur.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date string, e.g. "2026-10-25" or "tomorrow"' },
        departureTime: { type: 'string', description: 'Planned departure time, e.g. "17:30" or "18:00"' },
        returnTime: { type: 'string', description: 'Estimated return time, e.g. "23:30"' },
      },
      required: ['date'],
    },
  },
  {
    name: 'manage_sidequest_coordination',
    description:
      'Manage and track the minimal structured state for a group outing or sidequest (e.g. Jaipur concert). Distinguishes confirmed facts from unknowns, tracks host permission, interested participant count, vehicle capacity, and return transport logistics. Detects capacity mismatches and unresolved constraints.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get_status', 'update_state', 'check_capacity', 'check_feasibility'],
          description: 'Action to perform on coordination state',
        },
        eventName: { type: 'string', description: 'Name of the concert or event' },
        eventVerified: { type: 'boolean', description: 'Whether event details/tickets are verified' },
        hostPermission: {
          type: 'string',
          enum: ['unknown', 'pending', 'granted', 'not_required'],
          description: 'Host permission/notification status per Dhun residency protocol',
        },
        hostNotes: { type: 'string', description: 'Notes regarding host approval or who was contacted' },
        interestedCount: { type: 'number', description: 'Total number of people interested in going' },
        interestedPeople: { type: 'array', items: { type: 'string' }, description: 'Names of interested participants' },
        transportCapacity: { type: 'number', description: 'Total available passenger seats across booked/planned vehicles' },
        returnPlan: {
          type: 'string',
          enum: ['unknown', 'pending', 'confirmed'],
          description: 'Status of return transport from Jaipur back to Dhun bioreserve',
        },
        returnNotes: { type: 'string', description: 'Details of return transport (e.g. pre-booked driver name/phone)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'draft_group_interest_check',
    description:
      'Generate a clear, low-pressure interest-check message to gauge group demand for an outing before making financial or logistical commitments. Adheres to the principle that messages require user approval before sending.',
    input_schema: {
      type: 'object',
      properties: {
        eventName: { type: 'string', description: 'Name of the event or activity, e.g. "Concert in Jaipur"' },
        targetDate: { type: 'string', description: 'Day of outing, e.g. "tomorrow (Sunday)"' },
      },
    },
  },
  {
    name: 'get_user_schedule',
    description:
      'Retrieve the user\'s schedule, upcoming events, and commitments for today or a specific date. Automatically checks linked Google Calendar meetings, the active residency schedule (e.g. Dhun Oct 24–30), and scheduled tasks. If Google Calendar is not yet connected, returns the active residency schedule and a 1-tap connection link.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date to inspect in YYYY-MM-DD format, or "today" / "tomorrow"' },
      },
    },
  },
  {
    name: 'get_user_gmail',
    description:
      'Inspect the user\'s Gmail inbox, unread emails, and recent threads. If Gmail is connected, searches for relevant messages, sender details, and email snippets. If not yet connected, provides the secure 1-click connect URL.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional search query, e.g. "is:unread", "from:Manvendra", "tickets", "flight"' },
        maxResults: { type: 'number', description: 'Number of emails to fetch (default 5)' },
      },
    },
  },
];
