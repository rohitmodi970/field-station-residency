// apps/web/components/Journal/EnhancedComponents/AnalysisCard.tsx
"use client";

import React from 'react';
import { TrendingUp, Heart, MessageCircle, Zap, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/quilted-gallery/ui/card';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface AnalysisCardProps {
  analysisType: 'sentiment' | 'textual';
  results: any;
  isAnalyzing: boolean;
  dateRange: string;
  onSaveToHistory?: () => void;
}

export default function AnalysisCard({
  analysisType,
  results,
  isAnalyzing,
  dateRange,
  onSaveToHistory,
}: AnalysisCardProps) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
  };

  if (isAnalyzing) {
    return (
      <Card className="p-8" style={containerStyle}>
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: `${currentTheme.primary}40`, borderTopColor: currentTheme.primary }}
            />
            <Zap
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              size={24}
              style={{ color: currentTheme.primary }}
            />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium mb-1">Analyzing Your Journals</p>
            <p className="text-sm opacity-70">Extracting insights from your entries...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (results?.error) {
    return (
      <Card className="p-6" style={containerStyle}>
        <div className="flex items-start gap-3">
          <AlertCircle size={24} className="text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-red-500 mb-1">Analysis Error</h4>
            <p className="text-sm opacity-80">{results.error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!results) {
    return (
      <Card className="p-8" style={containerStyle}>
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: `${currentTheme.primary}20` }}
          >
            <TrendingUp size={32} style={{ color: currentTheme.primary }} />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Discover Your Story</h3>
            <p className="text-sm opacity-70 max-w-md mx-auto">
              Select dates from the calendar and click "Analyze" to uncover patterns, emotions, and themes in your
              journaling journey.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-6" style={containerStyle}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: `${currentTheme.primary}20` }}
            >
              {analysisType === 'sentiment' ? (
                <Heart size={24} style={{ color: currentTheme.primary }} />
              ) : (
                <MessageCircle size={24} style={{ color: currentTheme.primary }} />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {analysisType === 'sentiment' ? 'Sentiment Analysis' : 'Textual Analysis'}
              </h3>
              <p className="text-sm opacity-70">{dateRange}</p>
            </div>
          </div>
          {onSaveToHistory && (
            <button
              onClick={onSaveToHistory}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: currentTheme.primary,
                color: '#FFFFFF',
              }}
            >
              Save to History
            </button>
          )}
        </div>

        {/* Overall Sentiment */}
        {analysisType === 'sentiment' && results.overallSentiment && (
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: isDarkMode ? '#374151' : '#F9FAFB' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-70">Overall Mood</span>
              <span className="text-2xl font-bold" style={{ color: currentTheme.primary }}>
                {Math.round(results.overallSentiment.confidence * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold capitalize">{results.overallSentiment.label}</span>
                  <span className="text-sm opacity-70">{results.overallSentiment.score.toFixed(2)}</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${((results.overallSentiment.score + 1) / 2) * 100}%`,
                      backgroundColor: currentTheme.primary,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Sentiment Trend Chart */}
      {analysisType === 'sentiment' &&
        results.sentimentTrends &&
        Array.isArray(results.sentimentTrends) &&
        results.sentimentTrends.length > 0 && (
          <Card className="p-6" style={containerStyle}>
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={20} style={{ color: currentTheme.primary }} />
              Sentiment Trend Over Time
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={results.sentimentTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
                <XAxis dataKey="date" stroke={elementColors.text} style={{ fontSize: '12px' }} />
                <YAxis domain={[-1, 1]} stroke={elementColors.text} style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sentiment"
                  stroke={currentTheme.primary}
                  strokeWidth={3}
                  dot={{ fill: currentTheme.primary, r: 5 }}
                  name="Sentiment Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

      {/* Primary Emotions */}
      {analysisType === 'sentiment' &&
        results.emotionalPatterns?.primaryEmotions &&
        results.emotionalPatterns.primaryEmotions.length > 0 && (
          <Card className="p-6" style={containerStyle}>
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Heart size={20} style={{ color: currentTheme.primary }} />
              Primary Emotions
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={results.emotionalPatterns.primaryEmotions}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
                <XAxis dataKey="emotion" stroke={elementColors.text} style={{ fontSize: '12px' }} />
                <YAxis stroke={elementColors.text} style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="frequency" fill={currentTheme.primary} name="Frequency" radius={[8, 8, 0, 0]} />
                <Bar
                  dataKey="intensity"
                  fill={`${currentTheme.primary}80`}
                  name="Intensity"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

      {/* Mood Patterns */}
      {analysisType === 'sentiment' &&
        results.insights?.moodPatterns &&
        results.insights.moodPatterns.length > 0 && (
          <Card className="p-6" style={containerStyle}>
            <h4 className="text-lg font-semibold mb-4">Mood Patterns & Insights</h4>
            <div className="space-y-3">
              {results.insights.moodPatterns.map((pattern: any, index: number) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                  }}
                >
                  <h5 className="font-semibold mb-1">{pattern.pattern}</h5>
                  <p className="text-sm opacity-80 mb-2">{pattern.significance}</p>
                  {pattern.recommendation && (
                    <p
                      className="text-sm font-medium"
                      style={{ color: currentTheme.primary }}
                    >
                      💡 {pattern.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

      {/* Topics */}
      {analysisType === 'textual' && results.topics && results.topics.length > 0 && (
        <Card className="p-6" style={containerStyle}>
          <h4 className="text-lg font-semibold mb-4">Key Topics</h4>
          <div className="space-y-3">
            {results.topics.map((topic: any, index: number) => (
              <div key={index} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    backgroundColor: `${currentTheme.primary}20`,
                    color: currentTheme.primary,
                  }}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium capitalize">{topic.topic}</span>
                    <span className="text-sm opacity-70">
                      {topic.frequency ? `${topic.frequency} mentions` : `${Math.round((topic.sentiment || 0) * 100)}%`}
                    </span>
                  </div>
                  {topic.context && topic.context.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {topic.context.slice(0, 3).map((ctx: string, i: number) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                          }}
                        >
                          {ctx}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Key Insights */}
      {analysisType === 'textual' && results.keyInsights && results.keyInsights.length > 0 && (
        <Card className="p-6" style={containerStyle}>
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap size={20} style={{ color: currentTheme.primary }} />
            Key Insights
          </h4>
          <div className="space-y-3">
            {results.keyInsights.map((insight: any, index: number) => (
              <div
                key={index}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                  borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                }}
              >
                <p className="font-medium mb-2">{insight.insight}</p>
                {insight.evidence && insight.evidence.length > 0 && (
                  <div className="space-y-1">
                    {insight.evidence.map((evidence: string, i: number) => (
                      <p key={i} className="text-sm opacity-70 pl-3 border-l-2" style={{ borderColor: currentTheme.primary }}>
                        "{evidence}"
                      </p>
                    ))}
                  </div>
                )}
                {insight.significance && (
                  <p className="text-sm mt-2 opacity-80 italic">{insight.significance}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
