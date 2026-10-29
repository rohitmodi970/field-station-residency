import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SentimentAnalysisData {
  overallSentiment: {
    score: number;
    label: string;
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

interface Props {
  data: SentimentAnalysisData;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function SentimentAnalysisResults({ data }: Props) {
  // Passive analytics have been removed from the public UI.
  // Keep a minimal note for the user and encourage actionable flows via the Cognition Engine.
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700">Detailed sentiment dashboards have been intentionally removed to avoid passive analytics. Use the Cognition Engine to convert reflections into concrete actions.</p>
        </CardContent>
      </Card>
    </div>
  );
} 