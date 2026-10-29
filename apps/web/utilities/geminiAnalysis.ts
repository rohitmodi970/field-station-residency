import { JournalEntry } from '@/components/Journal/types';

export interface FlowNode {
  id: string;
  label: string;
  type: string;
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface GeminiAnalytics {
  keywords: { text: string; value: number }[];
  keywordInsight?: string;
  metrics: { energy: number; productivity: number }[];
  moodInfluencers: { influencer: string; impact: number }[];
  emotionDistribution: Record<string, number>[];
  topicHierarchy: string[];
  topicHierarchyInsight?: string;
  mindmapInsight?: {
    physical: string;
    mental: string;
    spiritual: string;
  };
  // New: structured mindmap clusters (Stage 2 - Pattern Detection)
  mindmapClusters?: {
    clusterTitle: string;
    theme: string;
    patternFlow: string[];
    insight: string;
    supportingEntries: string[];
  }[];
  // New: Stage 3 - Insight Generation (Mirror → Meaning → Movement)
  reflectionSummary?: string;
  lifePatterns?: {
    mirror: string;
    meaning: string;
    movement: string;
  }[];
  energyWellbeingInsight?: string;
  growthEdge?: string;
  weeklyInsight?: string;
  flowData: FlowData;
  healthMetrics: { sentiment: number; physicalWellness: number; mentalResilience: number }[];
  progressMetrics: { health: number; resilience: number; academic: number; research: number };
  happinessSources: { source: string; strength: number; moments: string[]; quote: string; color: string }[];
  tenseUsage: { present: number; past: number; future: number };
  wordChoiceCategories: { category: string; percentage: number }[];
  healthWellnessInsight: string;
  emotionalTriggers: { event: string; mood: string; timeframe: string; note: string }[];
  energyLevelTracking: { timeBlock: string; energy: number; mood: string; correlation: string }[];
  goalProgressMetrics: { goal: string; status: string; milestone: string; setback: string }[];
  socialInteractionImpact: { interaction: string; moodImpact: string; note: string }[];
  sleepRestAnalysis: { date: string; duration: string; quality: string; productivityCorrelation: string }[];
  creativeOutputLog: { date: string; output: string; timeBlock: string }[];
  stressIndicators: { term: string; context: string; event: string }[];
  gratitudeTracking: { moment: string; positivityTrend: string }[];
  vocabularyShifts: {
    phases: { phase: string; words: string[]; mood: string }[];
    insight: string;
  };
  majorMilestones: {
    milestones: { date: string; title: string; description: string; insight: string }[];
    insight: string;
  };
  dailyRhythmPatterns: {
    blocks: { block: string; activities: string[]; note: string }[];
    insight: string;
  };
}

function transformTextToFlowData(text: string): FlowData {
  // Extract emotions and factors from the text
  const emotions = new Set<string>();
  const factors = new Set<string>();
  
  // Extract emotions (positive and negative)
  const emotionMatches = text.match(/(?:positive|negative) emotions? \(([^)]+)\)/gi);
  if (emotionMatches) {
    emotionMatches.forEach(match => {
      const emotionsList = match.match(/\(([^)]+)\)/)?.[1]?.split(',').map(e => e.trim());
      emotionsList?.forEach(e => emotions.add(e));
    });
  }

  // Extract factors (external and internal)
  const factorMatches = text.match(/(?:external|internal) factors? like ([^,.]+)/gi);
  if (factorMatches) {
    factorMatches.forEach(match => {
      const factorsList = match.split('like ')[1]?.split(',').map(f => f.trim());
      factorsList?.forEach(f => factors.add(f));
    });
  }

  // Create nodes
  const nodes: FlowNode[] = [
    ...Array.from(emotions).map((emotion, index) => ({
      id: `emotion-${index}`,
      label: emotion,
      type: 'emotion',
      data: { category: emotion.includes('positive') ? 'positive' : 'negative' }
    })),
    ...Array.from(factors).map((factor, index) => ({
      id: `factor-${index}`,
      label: factor,
      type: 'factor',
      data: { category: factor.includes('external') ? 'external' : 'internal' }
    }))
  ];

  // Create edges between factors and emotions
  const edges: FlowEdge[] = [];
  let edgeId = 0;

  factors.forEach((factor, factorIndex) => {
    emotions.forEach((emotion, emotionIndex) => {
      // Create bidirectional relationships
      edges.push({
        id: `edge-${edgeId++}`,
        source: `factor-${factorIndex}`,
        target: `emotion-${emotionIndex}`,
        label: 'influences'
      });
    });
  });

  return { nodes, edges };
}

export async function fetchGeminiAnalytics(entries: JournalEntry[], retryCount = 0): Promise<GeminiAnalytics | null> {
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000; // Start with 1 second
  const startTime = performance.now();
  
  try {
    console.log('[Performance] Starting analytics fetch for', entries.length, 'entries', retryCount > 0 ? `(retry ${retryCount}/${MAX_RETRIES})` : '');
    
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: JSON.stringify(entries),
        provider: 'claude',
        options: {
          includeWordCloud: true,
          includeMoodDistribution: true,
          includeGoals: true,
          includeSocialInteractions: true,
          includeFlowData: true
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM] API error:', response.status, errorText);
      throw new Error(`Failed to fetch analytics: ${response.status}`);
    }
    
    const fetchTime = performance.now();
    console.log('[Performance] API fetch completed in', Math.round(fetchTime - startTime), 'ms');
    
    const data = await response.json();
    console.log('[Performance] JSON parsed in', Math.round(performance.now() - fetchTime), 'ms');
    console.log('LLM raw response:', data.text);
    
    // Check if response is empty or invalid
    if (!data.text || data.text.trim().length === 0) {
      console.error('Empty LLM response received');
      return null;
    }
    
    let analyticsRaw;
    try {
      // Extract JSON from response, handling markdown code fences and trailing content
      let cleanedText = data.text.trim();
      
      // If wrapped in ```json ... ```, extract only the content between fences
      const codeBlockMatch = cleanedText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        cleanedText = codeBlockMatch[1].trim();
      }
      
      // If still not valid JSON, try to extract the first complete JSON object
      if (!cleanedText.startsWith('{') && !cleanedText.startsWith('[')) {
        const jsonStart = cleanedText.indexOf('{');
        if (jsonStart !== -1) {
          cleanedText = cleanedText.substring(jsonStart);
        }
      }
      
      // Remove any trailing content after the last closing brace/bracket
      const lastBrace = cleanedText.lastIndexOf('}');
      const lastBracket = cleanedText.lastIndexOf(']');
      const lastClose = Math.max(lastBrace, lastBracket);
      if (lastClose !== -1 && lastClose < cleanedText.length - 1) {
        cleanedText = cleanedText.substring(0, lastClose + 1);
      }
      
      // Check if cleaned text is empty
      if (!cleanedText) {
        console.error('Empty cleaned text after removing markdown');
        return null;
      }
      
      analyticsRaw = JSON.parse(cleanedText);
      console.log('[Analytics] Parsed response insights:', {
        keywordInsight: analyticsRaw.keywordInsight ? 'present' : 'missing',
        topicHierarchyInsight: analyticsRaw.topicHierarchyInsight ? 'present' : 'missing',
        mindmapInsight: analyticsRaw.mindmapInsight ? typeof analyticsRaw.mindmapInsight : 'missing'
      });
    } catch (e) {
      console.error('Failed to parse analytics JSON:', e);
      console.error('Response text length:', data.text?.length || 0);
      console.error('Response text preview:', data.text?.substring(0, 200));
      
      // Retry on empty response if we haven't exceeded max retries
      if ((!data.text || data.text.trim().length === 0) && retryCount < MAX_RETRIES) {
        console.log(`[LLM] Retrying due to empty response in ${RETRY_DELAY * (retryCount + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return fetchGeminiAnalytics(entries, retryCount + 1);
      }
      
      return null;
    }

    // Validate and transform keywords to {text, value}[]
    let keywordsArr = analyticsRaw.keywords;
    console.log('Raw keywords from LLM:', keywordsArr);
    
    if (Array.isArray(keywordsArr) && keywordsArr.length > 0 && typeof keywordsArr[0] === 'string') {
      // Count frequency
      const freq: Record<string, number> = {};
      keywordsArr.forEach(word => {
        freq[word] = (freq[word] || 0) + 1;
      });
      keywordsArr = Object.entries(freq).map(([text, value]) => ({ text, value }));
      console.log('Transformed keywords:', keywordsArr);
    } else if (Array.isArray(keywordsArr) && keywordsArr.length > 0 && typeof keywordsArr[0] === 'object' && 'text' in keywordsArr[0]) {
      // Already in correct format
      console.log('Keywords already in correct format:', keywordsArr);
    } else {
      console.warn('LLM keywords field is malformed or empty, using empty array:', keywordsArr);
      keywordsArr = []; // Provide empty array as fallback instead of failing
    }

    // Transform flow data from text to structured format
    let flowData: FlowData;
    if (typeof analyticsRaw.flowData === 'string') {
      flowData = transformTextToFlowData(analyticsRaw.flowData);
    } else if (analyticsRaw.flowData && Array.isArray(analyticsRaw.flowData.nodes) && Array.isArray(analyticsRaw.flowData.edges)) {
      flowData = analyticsRaw.flowData;
    } else {
      flowData = { nodes: [], edges: [] };
    }

    // Validate other fields (basic check)
    if (!Array.isArray(analyticsRaw.metrics) || 
        !Array.isArray(analyticsRaw.moodInfluencers) || 
        !Array.isArray(analyticsRaw.emotionDistribution) || 
        !Array.isArray(analyticsRaw.topicHierarchy) || 
        !Array.isArray(analyticsRaw.healthMetrics) || 
        typeof analyticsRaw.progressMetrics !== 'object') {
      console.error('Gemini analytics missing or malformed fields:', analyticsRaw);
      return null;
    }

    // Return in the expected format
    return {
      keywords: keywordsArr,
      keywordInsight: analyticsRaw.keywordInsight || undefined,
      metrics: analyticsRaw.metrics,
      moodInfluencers: analyticsRaw.moodInfluencers,
      emotionDistribution: analyticsRaw.emotionDistribution,
      topicHierarchy: analyticsRaw.topicHierarchy,
      topicHierarchyInsight: analyticsRaw.topicHierarchyInsight || undefined,
      mindmapInsight: analyticsRaw.mindmapInsight || undefined,
      mindmapClusters: analyticsRaw.mindmapClusters || undefined,
      reflectionSummary: analyticsRaw.reflectionSummary || undefined,
      lifePatterns: analyticsRaw.lifePatterns || undefined,
      energyWellbeingInsight: analyticsRaw.energyWellbeingInsight || undefined,
      growthEdge: analyticsRaw.growthEdge || undefined,
      weeklyInsight: analyticsRaw.weeklyInsight || undefined,
      flowData,
      healthMetrics: analyticsRaw.healthMetrics,
      progressMetrics: analyticsRaw.progressMetrics,
      happinessSources: analyticsRaw.happinessSources || [],
      tenseUsage: analyticsRaw.tenseUsage || { present: 0, past: 0, future: 0 },
      wordChoiceCategories: analyticsRaw.wordChoiceCategories || [],
      healthWellnessInsight: analyticsRaw.healthWellnessInsight || '',
      emotionalTriggers: analyticsRaw.emotionalTriggers || [],
      energyLevelTracking: analyticsRaw.energyLevelTracking || [],
      goalProgressMetrics: analyticsRaw.goalProgressMetrics || [],
      socialInteractionImpact: analyticsRaw.socialInteractionImpact || [],
      sleepRestAnalysis: analyticsRaw.sleepRestAnalysis || [],
      creativeOutputLog: analyticsRaw.creativeOutputLog || [],
      stressIndicators: analyticsRaw.stressIndicators || [],
      gratitudeTracking: analyticsRaw.gratitudeTracking || [],
      vocabularyShifts: analyticsRaw.vocabularyShifts || { phases: [], insight: '' },
      majorMilestones: analyticsRaw.majorMilestones || { milestones: [], insight: '' },
      dailyRhythmPatterns: analyticsRaw.dailyRhythmPatterns || { blocks: [], insight: '' },
    };
  } catch (error) {
    console.log('[Performance] Total analytics fetch failed after', Math.round(performance.now() - startTime), 'ms');
    console.error('Error fetching Gemini analytics:', error);
    return null;
  }
} 