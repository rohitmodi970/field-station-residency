"use client";

import React from "react";
import { useTheme } from "@/utilities/context/ThemeContext";
import { 
  Smile, Frown,  AlertCircle, Heart, Brain, 
  TrendingUp, TrendingDown, Activity, Eye, Coffee,
  Search, Zap, CloudRain, Shield, Flame, Meh
} from "lucide-react";
import { 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  EnrichedEmotion,
  ENRICHED_EMOTION_EMOJI,
  ENRICHED_EMOTION_GRADIENT,
  ENRICHED_EMOTION_POLARITY,
  aggregateToEnrichedEmotions,
  getSentimentFromEnriched,
} from "@/utilities/emotionMapping";

interface EmotionTabProps {
  emotions: Record<string, number>;
  basicEmotions?: Record<string, number>;
  enrichedEmotions?: Record<string, number>;
}

/** Icon + color for each enriched emotion category */
const ENRICHED_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  [EnrichedEmotion.HAPPINESS]:   { icon: Smile,      color: 'text-yellow-500' },
  [EnrichedEmotion.LOVE_WARMTH]: { icon: Heart,      color: 'text-pink-500' },
  [EnrichedEmotion.WONDER]:      { icon: Zap,        color: 'text-amber-500' },
  [EnrichedEmotion.SERENITY]:    { icon: Coffee,     color: 'text-teal-500' },
  [EnrichedEmotion.CURIOSITY]:   { icon: Search,     color: 'text-sky-500' },
  [EnrichedEmotion.SURPRISE]:    { icon: Zap,        color: 'text-cyan-500' },
  [EnrichedEmotion.SADNESS]:     { icon: CloudRain,  color: 'text-blue-500' },
  [EnrichedEmotion.ANXIETY]:     { icon: AlertCircle, color: 'text-orange-500' },
  [EnrichedEmotion.FEAR]:        { icon: Shield,     color: 'text-purple-500' },
  [EnrichedEmotion.FRUSTRATION]: { icon: Flame,      color: 'text-red-500' },
  [EnrichedEmotion.DISCOMFORT]:  { icon: Meh,        color: 'text-slate-500' },
  [EnrichedEmotion.DISGUST]:     { icon: Frown,      color: 'text-green-600' },
};



const CHART_COLORS = [
  '#FBBF24', '#EC4899', '#F59E0B', '#14B8A6', '#38BDF8', '#22D3EE',
  '#3B82F6', '#FB923C', '#8B5CF6', '#EF4444', '#94A3B8', '#10B981',
];

const EmotionTab: React.FC<EmotionTabProps> = ({ emotions, basicEmotions, enrichedEmotions: enrichedProp }) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  
  // Validate emotions data
  if (!emotions || Object.keys(emotions).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-semibold">Something went wrong</p>
          <p className="text-sm mt-1">Emotion analysis data is missing. Please try analyzing again.</p>
        </div>
      </div>
    );
  }
  
  const bgColor = isDarkMode ? "bg-gray-800" : "bg-[#fff8ee]/95";
  const textColor = isDarkMode ? "text-gray-200" : "text-gray-800";
  const borderColor = isDarkMode ? "border-gray-700" : "border-[#d5b493]/65";
  const panelBgColor = isDarkMode ? "bg-gray-700" : "bg-[#f5e8d9]";

  // ----- ENRICHED EMOTIONS: primary system (12 categories) -----
  const enriched: Record<string, number> = enrichedProp || aggregateToEnrichedEmotions(emotions);

  // Sorted enriched data for charts
  const enrichedSorted = Object.entries(enriched)
    .map(([name, score]) => ({
      name,
      score: Number((score * 100).toFixed(1)),
      rawScore: score,
      emoji: ENRICHED_EMOTION_EMOJI[name as EnrichedEmotion] || '',
    }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score);

  const dominant = enrichedSorted[0];

  // Sentiment derived from enriched categories
  const sentiment = getSentimentFromEnriched(enriched as Record<EnrichedEmotion, number>);
  const sentimentData = [
    { name: 'Positive', value: Number((sentiment.positive * 100).toFixed(1)), color: '#10B981' },
    { name: 'Negative', value: Number((sentiment.negative * 100).toFixed(1)), color: '#EF4444' },
    { name: 'Neutral',  value: Number((sentiment.neutral * 100).toFixed(1)),  color: '#6B7280' },
  ];

  // Radar data (all enriched categories, including zero)
  const radarData = Object.entries(enriched)
    .map(([name, score]) => ({
      emotion: `${ENRICHED_EMOTION_EMOJI[name as EnrichedEmotion] || ''} ${name}`,
      intensity: Number((score * 100).toFixed(1)),
    }));

  // Raw detailed emotion data (for the "Complete Analysis" grid)
  const emotionData = Object.entries(emotions)
    .map(([name, score]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      score: Number((score * 100).toFixed(1)),
      rawScore: score
    }))
    .sort((a, b) => b.score - a.score);
// Helper to determine icon and color for detailed emotions (basic mapping)
  const getDetailedEmotionIcon = (emotion: string) => {
    const lower = emotion.toLowerCase();
    const posSet = ['joy', 'amusement', 'excitement', 'contentment', 'satisfaction', 'pride', 'relief', 'love', 'romance', 'adoration', 'admiration', 'gratitude', 'awe', 'entrancement'];
    const negSet = ['sadness', 'anger', 'fear', 'disgust', 'contempt', 'anxiety', 'embarrassment', 'shame', 'guilt'];
    if (posSet.includes(lower)) return { icon: Smile, color: 'text-green-500' };
    if (negSet.includes(lower)) return { icon: Frown, color: 'text-red-500' };
    return { icon: Heart, color: 'text-blue-500' };
  };

  return (
    <div className="space-y-6">
      {/* ── Header Cards ──  */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dominant Emotion */}
        <div className={`${panelBgColor} p-5 rounded-lg border ${borderColor} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Dominant Emotion</p>
              <p className={`text-2xl font-bold ${textColor} mt-1`}>
                {dominant ? `${dominant.emoji} ${dominant.name}` : 'N/A'}
              </p>
            </div>
            {dominant && (() => {
              const iconInfo = ENRICHED_ICON_MAP[dominant.name] || { icon: Heart, color: 'text-blue-500' };
              return <div className={iconInfo.color}>{React.createElement(iconInfo.icon, { size: 32 })}</div>;
            })()}
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-300 rounded-full h-2 dark:bg-gray-600">
              <div 
                className={`h-2 rounded-full bg-gradient-to-r ${dominant ? ENRICHED_EMOTION_GRADIENT[dominant.name as EnrichedEmotion] || 'from-purple-500 to-pink-500' : 'from-gray-400 to-gray-500'}`}
                style={{ width: `${dominant?.score || 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{dominant?.score || 0}% intensity</p>
          </div>
        </div>

        {/* Overall Sentiment */}
        <div className={`${panelBgColor} p-5 rounded-lg border ${borderColor} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall Sentiment</p>
              <p className={`text-2xl font-bold ${textColor} mt-1 capitalize`}>
                {sentiment.overall}
              </p>
            </div>
            <div className={sentiment.overall === 'positive' ? 'text-green-500' : sentiment.overall === 'negative' ? 'text-red-500' : 'text-gray-400'}>
              {sentiment.overall === 'positive' ? <TrendingUp size={32} /> : sentiment.overall === 'negative' ? <TrendingDown size={32} /> : <Activity size={32} />}
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-300 rounded-full h-2 dark:bg-gray-600">
              <div 
                className={`h-2 rounded-full ${sentiment.overall === 'positive' ? 'bg-green-500' : sentiment.overall === 'negative' ? 'bg-red-500' : 'bg-gray-400'}`}
                style={{ width: `${Math.max(sentiment.positive, sentiment.negative, sentiment.neutral) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {(Math.max(sentiment.positive, sentiment.negative) * 100).toFixed(1)}% confidence
            </p>
          </div>
        </div>

        {/* Emotion Variety */}
        <div className={`${panelBgColor} p-5 rounded-lg border ${borderColor} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Emotion Categories</p>
              <p className={`text-2xl font-bold ${textColor} mt-1`}>
                {enrichedSorted.length} of 12
              </p>
            </div>
            <Brain size={32} className="text-purple-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {Object.keys(emotions).length} detailed emotions mapped to {enrichedSorted.length} categories
          </p>
        </div>
      </div>

      {/* Detailed passive charts removed to prevent passive analytics; keep dominant cue only  */}
      <div className={`${bgColor} p-6 rounded-lg border ${borderColor} shadow-md`}>
        <h3 className={`text-lg font-semibold mb-2 ${textColor}`}>Emotion Overview</h3>
        <p className="text-sm text-gray-600">Detailed charts have been removed to avoid passive analytics. The dominant emotion is shown above; use the Cognition Engine to turn this into action.</p>
      </div>

        {/* Sentiment Distribution Pie Chart */}
        <div className={`${bgColor} p-6 rounded-lg border ${borderColor} shadow-md`}>
          <h3 className={`text-lg font-semibold mb-4 ${textColor}`}>Sentiment Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sentimentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {sentimentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

      {/* ── Radar Chart ── */}
      <div className={`${bgColor} p-6 rounded-lg border ${borderColor} shadow-md`}>
        <h3 className={`text-lg font-semibold mb-4 ${textColor}`}>Emotional Profile</h3>
        <ResponsiveContainer width="100%" height={420}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke={isDarkMode ? "#374151" : "#E5E7EB"} />
            <PolarAngleAxis 
              dataKey="emotion" 
              stroke={isDarkMode ? "#9CA3AF" : "#6B7280"}
              tick={{ fontSize: 11 }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 'auto']}
              stroke={isDarkMode ? "#9CA3AF" : "#6B7280"}
            />
            <Radar 
              name="Intensity" 
              dataKey="intensity" 
              stroke="#8B5CF6" 
              fill="#8B5CF6" 
              fillOpacity={0.5} 
            />
            <Tooltip 
              formatter={(value: number) => [`${value}%`, 'Intensity']}
              contentStyle={{
                backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
                border: `1px solid ${isDarkMode ? "#374151" : "#E5E7EB"}`,
                borderRadius: '8px'
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Detailed Emotion Grid ── */}
      <div className={`${bgColor} p-6 rounded-lg border ${borderColor} shadow-md`}>
        <h3 className={`text-lg font-semibold mb-4 ${textColor}`}>Detailed Emotion Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {emotionData.map((emotion, index) => {
            const { icon: Icon, color } = getDetailedEmotionIcon(emotion.name);
            return (
              <div 
                key={emotion.name}
                className={`${panelBgColor} p-4 rounded-lg border ${borderColor} hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${textColor}`}>{emotion.name}</span>
                  <Icon size={20} className={color} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{emotion.score}%</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-1.5 dark:bg-gray-600">
                    <div 
                      className="h-1.5 rounded-full" 
                      style={{ 
                        width: `${emotion.score}%`,
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Insights ── */}
      <div className={`${panelBgColor} p-6 rounded-lg border ${borderColor}`}>
        <h3 className={`text-lg font-semibold mb-4 ${textColor} flex items-center gap-2`}>
          <Brain size={20} className="text-purple-500" />
          Emotional Insights
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-[#8b5d36] mt-0.5 flex-shrink-0" />
            <p className={`text-sm ${textColor}`}>
              Your voice primarily conveys <strong>{dominant?.emoji} {dominant?.name?.toLowerCase()}</strong> at {dominant?.score}% intensity.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Activity size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
            <p className={`text-sm ${textColor}`}>
              Overall sentiment is <strong>{sentiment.overall}</strong> — positive emotions account for {(sentiment.positive * 100).toFixed(0)}% and negative for {(sentiment.negative * 100).toFixed(0)}%.
            </p>
          </div>
          {enrichedSorted.length > 1 && (
            <div className="flex items-start gap-3">
              <Zap size={20} className="text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className={`text-sm ${textColor}`}>
                Other notable emotions: {enrichedSorted.slice(1, 4).map(e => `${e.emoji} ${e.name.toLowerCase()} (${e.score}%)`).join(', ')}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmotionTab;
