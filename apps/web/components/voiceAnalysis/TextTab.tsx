"use client";

import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Label, Cell } from "recharts";
import { useTheme } from "@/utilities/context/ThemeContext";

interface WordFrequency {
  word: string;
  count: number;
}

interface SentimentData {
  overall: string;
  score: number;
}

interface LinguisticsData {
  transcript?: string;
  summary: string;
  sentiment: SentimentData;
  confidence: number;
  topics: string[];
}

interface AnalysisResults {
  linguistics: LinguisticsData;
}

interface TextTabProps {
  analysisResults: AnalysisResults;
}

const TextTab: React.FC<TextTabProps> = ({ analysisResults }) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  
  // Read theme CSS vars
  let cssVars: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const root = getComputedStyle(document.documentElement);
      cssVars = {
        text: root.getPropertyValue('--analysis-text') || (isDarkMode ? '#E6E1DE' : '#35261f'),
        muted: root.getPropertyValue('--analysis-muted') || (isDarkMode ? '#BFAE9C' : '#6b5547'),
        card: root.getPropertyValue('--analysis-card') || (isDarkMode ? '#111827' : '#fffaf5'),
        shell: root.getPropertyValue('--analysis-shell-bg') || (isDarkMode ? '#0b1220' : 'rgba(255,255,255,0.9)'),
      };
    } catch (e) {
      cssVars = { text: isDarkMode ? '#E6E1DE' : '#35261f', muted: '#6b5547', card: isDarkMode ? '#111827' : '#fffaf5', shell: isDarkMode ? '#0b1220' : 'rgba(255,255,255,0.9)' };
    }
  }

  const themeStyles = {
    containerStyle: { background: 'var(--analysis-shell-bg)' },
    panelStyle: { background: 'var(--analysis-card)', borderColor: 'rgba(147,114,95,0.08)' },
    textStyle: { color: 'var(--analysis-text)' },
    mutedStyle: { color: 'var(--analysis-muted)' },
    gridColor: elementColors.accent || (isDarkMode ? '#4B5563' : '#e2e8f0')
  };

  // Validate analysis results
  if (!analysisResults || !analysisResults.linguistics) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-semibold">Something went wrong</p>
          <p className="text-sm mt-1">Analysis data is missing or malformed. Please try analyzing again.</p>
        </div>
      </div>
    );
  }
  
  // Memoize the word frequency calculation to avoid recalculating on every render
  const wordFrequency = useMemo(() => {
    if (!analysisResults?.linguistics?.transcript) return [];

    const text = analysisResults.linguistics.transcript.toLowerCase();
    const words = text.match(/\b\w+\b/g) || [];
    const frequencies: Record<string, number> = {};

    // Filter out common stop words
    const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'is', 'it', 'that', 'was', 'for', 'on', 'with']);
    
    words.forEach((word) => {
      if (word.length > 2 && !stopWords.has(word)) {
        frequencies[word] = (frequencies[word] || 0) + 1;
      }
    });

    return Object.entries(frequencies)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [analysisResults?.linguistics?.transcript]);

  // Get sentiment color based on score
  const getSentimentColor = (sentiment: string) => {
    switch(sentiment?.toLowerCase()) {
      case 'positive':
        return isDarkMode ? 'text-green-400' : 'text-green-600';
      case 'negative':
        return isDarkMode ? 'text-red-400' : 'text-red-600';
      case 'neutral':
        return isDarkMode ? 'text-blue-400' : 'text-blue-600';
      default:
        return textColor;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return isDarkMode ? 'text-green-400' : 'text-green-600';
    if (confidence >= 0.5) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
    return isDarkMode ? 'text-red-400' : 'text-red-600';
  };

  // Theme-aware styling
  const bgColor = isDarkMode ? "bg-gray-800" : "bg-[#fff8ee]/95";
  const textColor = isDarkMode ? "text-gray-200" : "text-gray-800";
  const borderColor = isDarkMode ? "border-gray-700" : "border-[#d5b493]/65";
  const panelBgColor = isDarkMode ? "bg-gray-700" : "bg-[#f5e8d9]";
  const gridColor = elementColors.accent || (isDarkMode ? "#4B5563" : "#e2e8f0");
  const topicBgColor = isDarkMode ? "bg-blue-800" : "bg-[#f1dfcb]";
  const topicTextColor = isDarkMode ? "text-blue-100" : "text-[#6f4a2e]";
  
  // Create a custom color array for the bars
  const customColors = [
    currentTheme.primary,
    isDarkMode ? "#6366F1" : "#818CF8", // Indigo
    isDarkMode ? "#8B5CF6" : "#A78BFA", // Purple
    isDarkMode ? "#EC4899" : "#F472B6", // Pink
    isDarkMode ? "#EF4444" : "#F87171", // Red
    isDarkMode ? "#F59E0B" : "#FBBF24", // Amber
    isDarkMode ? "#10B981" : "#34D399", // Emerald
    isDarkMode ? "#3B82F6" : "#60A5FA", // Blue
    isDarkMode ? "#14B8A6" : "#2DD4BF", // Teal
    isDarkMode ? "#6366F1" : "#818CF8", // Indigo (repeat)
  ];

  const sentimentScore = analysisResults.linguistics.sentiment.score;
  const confidenceScore = analysisResults.linguistics.confidence;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="p-6 rounded-lg shadow-md border" style={themeStyles.containerStyle}>
        <h2 className="text-2xl font-bold mb-6" style={themeStyles.textStyle}>Text Analysis Results</h2>
        
        {/* Summary Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3" style={themeStyles.textStyle}>Content Summary</h3>
          <div className={`p-4 rounded-lg max-h-48 overflow-y-auto shadow-inner`} style={themeStyles.panelStyle}>
            <p style={themeStyles.textStyle} className="leading-relaxed">{analysisResults.linguistics.summary}</p>
          </div>
        </div>
        
        {/* Transcript Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3" style={themeStyles.textStyle}>Full Transcript</h3>
          <div className={`p-4 rounded-lg max-h-48 overflow-y-auto shadow-inner`} style={themeStyles.panelStyle}>
            <p style={themeStyles.textStyle} className="leading-relaxed">{analysisResults.linguistics.transcript}</p>
          </div>
        </div>

        {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sentiment Card */}
          <div className="p-5 rounded-lg shadow-sm transition-transform hover:scale-105" style={themeStyles.panelStyle}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium" style={themeStyles.textStyle}>Sentiment Analysis</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${getSentimentColor(analysisResults.linguistics.sentiment.overall)} bg-opacity-20 bg-current`}>
                {analysisResults.linguistics.sentiment.overall?.toUpperCase()}
              </span>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm" style={isDarkMode ? { color: '#9CA3AF' } : { color: '#6B7280' }}>Sentiment Score</p>
                <div className="flex items-center space-x-2">
                  <div className="w-full bg-gray-300 rounded-full h-2.5 dark:bg-gray-600">
                    <div 
                      className={`h-2.5 rounded-full ${getSentimentColor(analysisResults.linguistics.sentiment.overall)}`} 
                      style={{ width: `${Math.round(sentimentScore * 100)}%`, backgroundColor: 'currentColor' }}>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${getSentimentColor(analysisResults.linguistics.sentiment.overall)}`}>
                    {Math.round(sentimentScore * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Confidence Card */}
          <div className="p-5 rounded-lg shadow-sm transition-transform hover:scale-105" style={themeStyles.panelStyle}>
            <h3 className="text-lg font-medium mb-3" style={themeStyles.textStyle}>Analysis Confidence</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-full">
                  <div className="flex items-center space-x-2">
                    <div className="w-full bg-gray-300 rounded-full h-2.5 dark:bg-gray-600">
                      <div 
                        className={`h-2.5 rounded-full ${getConfidenceColor(confidenceScore)}`} 
                        style={{ width: `${Math.round(confidenceScore * 100)}%`, backgroundColor: 'currentColor' }}>
                      </div>
                    </div>
                    <span className={`text-xl font-bold ${getConfidenceColor(confidenceScore)}`}>
                      {Math.round(confidenceScore * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Word Frequency Chart */}
        <div className="p-6 rounded-lg shadow-md transition duration-300 hover:shadow-lg" style={themeStyles.panelStyle}>
          <h3 className="text-lg font-semibold mb-4" style={themeStyles.textStyle}>Word Frequency</h3>
          
          <div className="h-72">
            {wordFrequency.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={wordFrequency}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={themeStyles.gridColor} horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    stroke={isDarkMode ? "#D1D5DB" : "#4B5563"}
                    tickLine={true}
                    domain={[0, 'dataMax + 1']}
                  >
                    <Label 
                      value="Occurrences" 
                      position="bottom" 
                      offset={10} 
                      style={{ textAnchor: 'middle', fill: isDarkMode ? "#D1D5DB" : "#4B5563" }} 
                    />
                  </XAxis>
                  <YAxis 
                    type="category" 
                    dataKey="word" 
                    tick={{ fontSize: 12 }} 
                    width={60} 
                    stroke={isDarkMode ? "#D1D5DB" : "#4B5563"}
                  >
                    <Label 
                      value="Words" 
                      angle={-90} 
                      position="left" 
                      style={{ textAnchor: 'middle', fill: isDarkMode ? "#D1D5DB" : "#4B5563" }} 
                    />
                  </YAxis>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDarkMode ? "#374151" : "#fff",
                      borderColor: isDarkMode ? "#4B5563" : "#e2e8f0",
                      color: cssVars.text,
                      borderRadius: "0.375rem",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
                    }}
                    formatter={(value) => [`${value} occurrences`, 'Count']}
                    labelFormatter={(label) => `Word: ${label}`}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  >
                    {wordFrequency.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={customColors[index % customColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No word frequency data available
              </div>
            )}
          </div>
        </div>

        {/* Topics and Word Cloud Section */}
        <div className="p-6 rounded-lg shadow-md transition duration-300 hover:shadow-lg" style={themeStyles.panelStyle}>
          <h3 className="text-lg font-semibold mb-4" style={themeStyles.textStyle}>Key Topics & Word Cloud</h3>
          
          {/* Topics Section */}
          <div className="mb-6">
            <h4 className="font-medium mb-3" style={themeStyles.textStyle}>Topics Detected</h4>
            {analysisResults.linguistics.topics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysisResults.linguistics.topics.map((topic, index) => (
                  <span
                    key={index}
                    className={`px-3 py-2 rounded-full text-sm font-medium transition-transform hover:scale-105 cursor-default`}
                    style={{ background: isDarkMode ? '#083358' : '#f1dfcb', color: isDarkMode ? '#DBEAFE' : '#6f4a2e' }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No topics detected</p>
            )}
          </div>

          {/* Word Cloud */}
          <div>
            <h4 className="font-medium mb-3" style={themeStyles.textStyle}>Word Cloud</h4>
            <div className={`p-5 rounded-lg flex flex-wrap justify-center items-center min-h-40 shadow-inner`} style={themeStyles.panelStyle}>
              {wordFrequency.length > 0 ? (
                wordFrequency.map((item, index) => {
                  // Calculate base color from theme with variation
                  const hue = index * 36;
                  const color = customColors[index % customColors.length];
                  const fontSize = Math.max(1, 0.8 + (item.count / (wordFrequency[0]?.count ?? 1)) * 1.4);
                  
                  return (
                    <span
                      key={index}
                      className="inline-block m-2 transition-all duration-300 hover:scale-110 cursor-pointer"
                      style={{
                        fontSize: `${fontSize}rem`,
                        color: color,
                        textShadow: isDarkMode ? '0px 0px 3px rgba(0,0,0,0.3)' : 'none',
                        fontWeight: item.count === wordFrequency[0]?.count ? 'bold' : 'normal',
                      }}
                    >
                      {item.word}
                    </span>
                  );
                })
              ) : (
                <p className="text-gray-500">No word data available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextTab;