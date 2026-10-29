import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface HumeData {
  transcript: string;
  confidence: number;
  sentiment: { overall: string; score: number };
  topics: string[];
  keywords: string[];
  summary: string;
}

function createPrompt(humeData: HumeData) {
  return `You are a professional audio analyzer. Analyze the following audio transcription and provide detailed insights:

Transcription: ${humeData.transcript}

Topics: ${humeData.topics.join(', ')}

Sentiment: ${humeData.sentiment.overall} (score: ${humeData.sentiment.score})

First, analyze the transcript and estimate the percentage of positive, neutral, and negative sentiment expressed. Return these as values between 0 and 1 that sum to 1, in a JSON object with keys: positive, neutral, negative. Then, provide a comprehensive analysis in the following JSON format (add a 'sentimentPercentages' field at the root, with the sentiment percentages you calculated):

{
  "sentimentPercentages": { "positive": 0.0, "neutral": 0.0, "negative": 0.0 },
  "summary": "A concise summary of the audio content",
  "keyPoints": ["List of main points discussed"],
  "insights": ["Key insights and observations"],
  "emotions": {
    "primary": "main emotion detected",
    "secondary": ["other emotions detected"],
    "intensity": 0.0 // 0-1 scale
  },
  "speechPatterns": {
    "pace": "slow/medium/fast",
    "clarity": 0.0, // 0-1 scale
    "confidence": 0.0 // 0-1 scale
  },
  "recommendations": ["Actionable recommendations based on the content"],
  "lifeInsights": {
    "shortTerm": ["Immediate actionable insights"],
    "longTerm": ["Long-term life improvement suggestions"],
    "actionableSteps": ["Specific steps to implement insights"],
    "mindsetShifts": ["Recommended changes in perspective"]
  },
  "textAnalysis": {
    "coreValues": [
      {
        "name": "Value name (e.g. Balance & Flexibility)",
        "alignmentPercent": 0.0, // 0-1 scale, e.g. 0.85 for 85%
        "description": "Short description of the value and its role in the audio",
        "quotes": [
          "Direct quote from the transcript that exemplifies this value",
          "Another relevant quote"
        ],
        "insight": "A paragraph interpreting the value's role and importance in the audio context.",
        "actionGap": {
          "score": 0.0, // 0-1 scale, 0 = low gap, 1 = high gap
          "label": "Low/Medium/High"
        },
        "recommendations": [
          "Actionable recommendation to bridge the gap",
          "Another recommendation"
        ]
      }
    ]
  },
  "visualizationData": {
    "emotionDistribution": {
      "labels": ["Emotion names"],
      "values": [0.0] // 0-1 scale for each emotion
    },
    "topicRelevance": {
      "labels": ["Topic names"],
      "values": [0.0] // 0-1 scale for each topic
    },
    "speechMetrics": {
      "labels": ["Metric names"],
      "values": [0.0] // 0-1 scale for each metric
    },
    "mindMap": {
      "nodes": [
        {
          "id": "string",
          "label": "string",
          "group": "string",
          "value": 1,
          "details": {
            "description": "Detailed explanation of this topic/concept",
            "keyPoints": ["List of key points about this topic"],
            "relevance": 0.0, // 0-1 scale
            "sentiment": "positive/neutral/negative",
            "connections": ["List of related topics/concepts"],
            "color": "hex color code based on sentiment and relevance"
          }
        }
      ],
      "links": [
        {
          "source": "string",
          "target": "string",
          "strength": 0.0 // 0-1 scale indicating connection strength
        }
      ],
      "insights": "A short paragraph of mind map insights.",
      "actionSuggestion": "A short actionable suggestion."
    },
    "energyPatterns": {
      "segments": [
        {
          "time": "0:00",
          "energy": 0.0,
          "mood": 0.0,
          "focus": 0.0
        }
      ]
    },
    "growthInsights": {
      "categories": ["Cultural Awareness", "Personal Reflection", "Emotional Wellbeing", "Relationship Building", "Mindfulness"],
      "values": [0.0]
    }
  }
}

For the textAnalysis, identify the top 3-5 core values expressed in the audio. For each value, provide:
- Name, alignment percentage (0-1), and a short description
- 1-2 direct quotes from the transcript that exemplify the value
- An "Insight" paragraph interpreting the value's role in the audio
- An "Action Gap" score (0-1) and a label (Low/Medium/High)
- 2-3 actionable recommendations to bridge the gap

For the mindMap nodes:
1. Create meaningful nodes that represent key topics, concepts, or themes from the audio
2. Assign each node a color based on its sentiment (positive: green shades, neutral: blue shades, negative: red shades) and relevance (darker for more relevant)
3. Provide detailed information about each node including description, key points, and connections
4. Ensure nodes are logically connected based on their relationships in the content

For the energyPatterns, analyze the audio content in 5 equal time segments and provide:
1. Energy level (0-1): How energetic/enthusiastic the speaker is
2. Mood level (0-1): The emotional tone and positivity
3. Focus level (0-1): How focused and clear the message is

Recommendation safety rules:
- Be empathetic and human-centered.
- Never recommend abandoning, discarding, or cutting off a person as a first-line solution.
- For interpersonal stress, prioritize nuanced options: boundaries, respectful conversation, support-seeking, and reflection.

Return ONLY valid JSON.`;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    // Accept both 'deepgram' (legacy) and 'hume' field names
    const deepgram: HumeData = body.deepgram || body.hume;
    const metadata = body.metadata || {};

    console.log('Finalize endpoint called with:', {
      hasData: !!deepgram,
      transcriptLength: deepgram?.transcript?.length || 0,
      hasMetadata: !!metadata,
    });

    if (!deepgram || typeof deepgram.transcript !== 'string') {
      console.error('Invalid audio analysis data:', { deepgram, metadata });
      return NextResponse.json({
        message: 'Invalid audio analysis data',
        error: 'Missing or invalid transcript in audio data',
        received: { hasData: !!deepgram, transcriptType: typeof deepgram?.transcript }
      }, { status: 400 });
    }

    // Check if transcript is empty
    if (!deepgram.transcript.trim()) {
      console.warn('Empty transcript received from Hume');
      return NextResponse.json({
        message: 'No transcript available',
        error: 'Hume returned empty transcript. Check audio file and API key.',
        metadata,
        deepgram: {
          ...deepgram,
          sentiment: { ...deepgram.sentiment, positive: 0, neutral: 0, negative: 0 },
        },
        gemini: {
          summary: 'No transcript available for analysis',
          keyPoints: [],
          insights: [],
          emotions: { primary: 'unknown', secondary: [], intensity: 0 },
          speechPatterns: { pace: 'unknown', clarity: 0, confidence: 0 },
          recommendations: [],
          lifeInsights: { shortTerm: [], longTerm: [], actionableSteps: [], mindsetShifts: [] },
          textAnalysis: { coreValues: [] },
          visualizationData: {
            emotionDistribution: { labels: [], values: [] },
            topicRelevance: { labels: [], values: [] },
            speechMetrics: { labels: [], values: [] },
            mindMap: { nodes: [], links: [], insights: '', actionSuggestion: '' },
            energyPatterns: { segments: [] },
            growthInsights: { categories: [], values: [] }
          }
        }
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = createPrompt(deepgram);

    // Use Claude for analysis
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192,
        temperature: 0.7,
      })
    });

    if (!claudeResponse.ok) {
      const error = await claudeResponse.json();
      throw new Error(error.error?.message || 'Claude API error');
    }

    const claudeData = await claudeResponse.json();
    const geminiResponse = { text: claudeData.content?.[0]?.text || '' };

    let geminiAnalysis: any;
    let sentimentPercentages = { positive: 0, neutral: 0, negative: 0 };
    try {
      const text = geminiResponse.text || '';
      const jsonText = text.replace(/```json\n?|\n?```/g, '').trim();
      geminiAnalysis = JSON.parse(jsonText);
      if (geminiAnalysis.sentimentPercentages) {
        sentimentPercentages = geminiAnalysis.sentimentPercentages;
        delete geminiAnalysis.sentimentPercentages;
      }
    } catch (e) {
      geminiAnalysis = {
        summary: 'Failed to analyze',
        keyPoints: [],
        insights: [],
        emotions: { primary: 'unknown', secondary: [], intensity: 0 },
        speechPatterns: { pace: 'unknown', clarity: 0, confidence: 0 },
        recommendations: [],
        lifeInsights: { shortTerm: [], longTerm: [], actionableSteps: [], mindsetShifts: [] },
        textAnalysis: { coreValues: [] },
        visualizationData: {
          emotionDistribution: { labels: [], values: [] },
          topicRelevance: { labels: [], values: [] },
          speechMetrics: { labels: [], values: [] },
          mindMap: { nodes: [], links: [], insights: '', actionSuggestion: '' },
          energyPatterns: { segments: [] },
          growthInsights: { categories: [], values: [] }
        }
      };
    }

    const analysisResults = {
      metadata,
      deepgram: {
        ...deepgram,
        sentiment: { ...deepgram.sentiment, positive: sentimentPercentages.positive, neutral: sentimentPercentages.neutral, negative: sentimentPercentages.negative },
      },
      gemini: geminiAnalysis,
    };

    return NextResponse.json(analysisResults);
  } catch (error: unknown) {
    console.error('Finalize error:', error);
    return NextResponse.json(
      { message: 'Error finalizing analysis', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


