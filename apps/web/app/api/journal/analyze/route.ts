import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

interface JournalEntry {
  date: string;
  content: string;
  title: string;
}

interface AnalysisRequest {
  entries: JournalEntry[];
  analysisType: 'sentiment' | 'textual';
  dateRange: {
    start: string;
    end: string;
  };
}

// Define specific response types for each analysis type
interface SentimentAnalysisResult {
  overallSentiment: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
  };
  emotionalPatterns: {
    primaryEmotions: Array<{
      emotion: string;
      frequency: number;
      intensity: number;
    }>;
    secondaryEmotions: Array<{
      emotion: string;
      frequency: number;
      intensity: number;
    }>;
  };
  sentimentTrends: Array<{
    date: string;
    sentiment: number;
    primaryEmotion: string;
    keyPhrases: string[];
  }>;
  insights: {
    emotionalTriggers: Array<{
      trigger: string;
      impact: number;
      frequency: number;
    }>;
    moodPatterns: Array<{
      pattern: string;
      significance: string;
      recommendation: string;
    }>;
  };
}

interface TextualAnalysisResult {
  topics: Array<{
    topic: string;
    frequency: number;
    context: string[];
    sentiment: number;
  }>;
  writingPatterns: {
    vocabulary: {
      commonWords: string[];
      uniqueWords: string[];
      wordCategories: Array<{
        category: string;
        percentage: number;
      }>;
    };
    structure: {
      averageLength: number;
      paragraphPatterns: string[];
      temporalReferences: {
        present: number;
        past: number;
        future: number;
      };
    };
  };
  keyInsights: Array<{
    insight: string;
    evidence: string[];
    significance: string;
  }>;
  goalsAndProgress: Array<{
    goal: string;
    status: string;
    progress: number;
    milestones: string[];
  }>;
  recommendations: Array<{
    area: string;
    suggestion: string;
    rationale: string;
  }>;
}

type AnalysisResult = SentimentAnalysisResult | TextualAnalysisResult;

const LLM_CONFIG = {
  modelName: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  maxTokens: 8192,
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { entries, analysisType, dateRange }: AnalysisRequest = await request.json();

    if (!entries || !analysisType || !dateRange) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not defined in environment variables');
    }

    // Format entries into a prompt
    const entriesText = entries.map(entry =>
      `Date: ${entry.date}\nTitle: ${entry.title}\nContent: ${entry.content}\n---`
    ).join('\n\n');

    // Create appropriate prompt based on analysis type
    const prompt = analysisType === 'sentiment'
      ? formatSentimentAnalysisPrompt(entriesText, dateRange)
      : formatTextualAnalysisPrompt(entriesText, dateRange);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: LLM_CONFIG.modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: LLM_CONFIG.maxTokens,
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Claude API error');
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    if (!text) {
      throw new Error('No response text received from Claude API');
    }

    let parsedData: AnalysisResult;
    const jsonString = extractFirstJson(text);
    if (!jsonString) {
      console.error('No JSON found in Claude response:', text);
      throw new Error('Invalid JSON response from Claude API');
    }
    try {
      parsedData = JSON.parse(jsonString) as AnalysisResult;
    } catch {
      console.error('Failed to parse Claude response:', jsonString);
      throw new Error('Invalid JSON response from Claude API');
    }

    return NextResponse.json({
      data: parsedData,
      analysisType
    });

  } catch (error) {
    console.error('Journal Analysis API error:', error);
    return NextResponse.json(
      { error: 'Failed to process analysis request', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function formatSentimentAnalysisPrompt(entriesText: string, dateRange: { start: string; end: string }): string {
  return `
Analyze the following journal entries for sentiment and emotional patterns between ${dateRange.start} and ${dateRange.end}:

${entriesText}

Please provide a comprehensive sentiment analysis in JSON format with the following structure:
{
  "overallSentiment": {
    "score": number, // -1 to 1
    "label": string, // "positive", "negative", "neutral"
    "confidence": number // 0 to 1
  },
  "emotionalPatterns": {
    "primaryEmotions": [
      {
        "emotion": string,
        "frequency": number,
        "intensity": number // 0 to 1
      }
    ],
    "secondaryEmotions": [
      {
        "emotion": string,
        "frequency": number,
        "intensity": number
      }
    ]
  },
  "sentimentTrends": [
    {
      "date": string,
      "sentiment": number, // -1 to 1
      "primaryEmotion": string,
      "keyPhrases": string[]
    }
  ],
  "insights": {
    "emotionalTriggers": [
      {
        "trigger": string,
        "impact": number, // -1 to 1
        "frequency": number
      }
    ],
    "moodPatterns": [
      {
        "pattern": string,
        "significance": string,
        "recommendation": string
      }
    ]
  }
}

Guidance for recommendations and insights:
- Use a compassionate, practical tone.
- Never recommend abandoning, discarding, or cutting off a person as a first-line solution.
- For interpersonal conflict, prioritize nuanced options first: boundaries, respectful conversation, support-seeking, and reflection.
- Keep suggestions specific, realistic, and emotionally safe.

Return ONLY valid JSON.
`;
}

function formatTextualAnalysisPrompt(entriesText: string, dateRange: { start: string; end: string }): string {
  return `
Analyze the following journal entries for textual patterns and insights between ${dateRange.start} and ${dateRange.end}:

${entriesText}

Please provide a comprehensive textual analysis in JSON format with the following structure:
{
  "topics": [
    {
      "topic": string,
      "frequency": number,
      "context": string[],
      "sentiment": number // -1 to 1
    }
  ],
  "writingPatterns": {
    "vocabulary": {
      "commonWords": string[],
      "uniqueWords": string[],
      "wordCategories": [
        {
          "category": string,
          "percentage": number
        }
      ]
    },
    "structure": {
      "averageLength": number,
      "paragraphPatterns": string[],
      "temporalReferences": {
        "present": number,
        "past": number,
        "future": number
      }
    }
  },
  "keyInsights": [
    {
      "insight": string,
      "evidence": string[],
      "significance": string
    }
  ],
  "goalsAndProgress": [
    {
      "goal": string,
      "status": string,
      "progress": number, // 0 to 1
      "milestones": string[]
    }
  ],
  "recommendations": [
    {
      "area": string,
      "suggestion": string,
      "rationale": string
    }
  ]
}

Guidance for recommendations and insights:
- Use a compassionate, practical tone.
- Never recommend abandoning, discarding, or cutting off a person as a first-line solution.
- For interpersonal conflict, prioritize nuanced options first: boundaries, respectful conversation, support-seeking, and reflection.
- Keep suggestions specific, realistic, and emotionally safe.

Return ONLY valid JSON.
`;
}

function extractFirstJson(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return null;
} 