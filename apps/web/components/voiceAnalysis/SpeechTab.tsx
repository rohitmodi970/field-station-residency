"use client";

import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTheme } from "@/utilities/context/ThemeContext";

interface TimeSeriesPoint {
  time: number;
  [key: string]: number;
}

interface SpeechData {
  pitch: {
    average: number;
    data?: number[];
  };
  rate: {
    wordsPerMinute: number;
    data?: number[];
  };
  volume: {
    average: number;
    peak: number;
  };
  pauses: {
    count: number;
    averageDuration: number;
    locations?: number[];
  };
}

interface AnalysisResults {
  speech: SpeechData;
  metadata: {
    duration: number;
  };
}

interface SpeechTabProps {
  analysisResults: AnalysisResults;
}

const getTimeSeriesData = (data: { data?: number[] }, label: string): TimeSeriesPoint[] => {
  if (!data || !data.data) return [];

  return data.data.map((value, index) => ({
    time: index / 5, // Assuming 5 samples per second
    [label]: value,
  }));
};

const SpeechTab: React.FC<SpeechTabProps> = ({ analysisResults }) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  // Validate analysis results
  if (!analysisResults || !analysisResults.speech) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-semibold">Something went wrong</p>
          <p className="text-sm mt-1">Speech analysis data is missing. Please try analyzing again.</p>
        </div>
      </div>
    );
  }

  const pitchData = getTimeSeriesData(analysisResults.speech.pitch, "pitch");
  const rateData = getTimeSeriesData(analysisResults.speech.rate, "rate");

  console.log("SpeechTab: ", analysisResults);
  console.log("SpeechTab rateData: ", rateData);

  // Read CSS vars for theme-aware colors
  let cssVars: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const root = getComputedStyle(document.documentElement);
      cssVars = {
        text: root.getPropertyValue('--analysis-text') || (isDarkMode ? '#F9FAFB' : '#111827'),
        muted: root.getPropertyValue('--analysis-muted') || (isDarkMode ? '#9CA3AF' : '#6b7280'),
        card: root.getPropertyValue('--analysis-card') || (isDarkMode ? '#111827' : '#fff8ee'),
      };
    } catch (e) {
      cssVars = { text: isDarkMode ? '#F9FAFB' : '#111827', muted: '#6b7280', card: isDarkMode ? '#111827' : '#fff8ee' };
    }
  }

  // Theme colors for charts
  const pitchLineColor = currentTheme.primary;
  const rateLineColor = currentTheme.hover;
  const gridColor = isDarkMode ? (cssVars.muted || '#4B5563') : (cssVars.muted || '#e2e8f0');

  return (
    <div className="grid grid-cols-1 gap-6">
      <div style={{ background: 'var(--analysis-card)', padding: 16, borderRadius: 8 }} className="shadow-md">
        <h3 className={`text-lg font-medium mb-4`} style={{ color: cssVars.text }}>Pitch Variation Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pitchData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="time" 
                label={{ value: "Time (seconds)", position: "insideBottom", offset: -5 }} 
                stroke={cssVars.muted}
              />
              <YAxis 
                label={{ value: "Pitch (Hz)", angle: -90, position: "insideLeft" }} 
                domain={["auto", "auto"]} 
                stroke={cssVars.muted}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)} Hz`, "Pitch"]}
                contentStyle={{
                  backgroundColor: cssVars.card,
                  borderColor: cssVars.muted,
                  color: cssVars.text
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="pitch" 
                stroke={pitchLineColor} 
                activeDot={{ r: 8 }} 
                strokeWidth={2} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

         <div className="p-4 rounded-lg shadow-md" style={{ background: 'var(--analysis-card)' }}>
        <h3 className={`text-lg font-medium mb-4`} style={{ color: cssVars.text }}>Speech Rate Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rateData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="time" 
                label={{ value: "Time (seconds)", position: "insideBottom", offset: -5 }} 
                stroke={cssVars.muted}
              />
              <YAxis 
                label={{ value: "Syllables/sec", angle: -90, position: "insideLeft" }} 
                domain={["auto", "auto"]} 
                stroke={cssVars.muted}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)} syllables/sec`, "Rate"]}
                contentStyle={{
                  backgroundColor: cssVars.card,
                  borderColor: cssVars.muted,
                  color: cssVars.text
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke={rateLineColor} 
                activeDot={{ r: 8 }} 
                strokeWidth={2} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-4 rounded-lg shadow-md" style={{ background: 'var(--analysis-card)' }}>
        <h3 className={`text-lg font-medium mb-4`} style={{ color: cssVars.text }}>Speech Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-3 rounded`} style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
            <h4 className={`font-medium`} style={{ color: cssVars.text }}>Average Pitch</h4>
            <p className={`text-lg`} style={{ color: cssVars.text }}>{analysisResults.speech.pitch.average} Hz</p>
          </div>
          <div className={`p-3 rounded`} style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
            <h4 className={`font-medium`} style={{ color: cssVars.text }}>Speech Rate</h4>
            <p className={`text-lg`} style={{ color: cssVars.text }}>{analysisResults.speech.rate.wordsPerMinute} WPM</p>
          </div>
          <div className={`p-3 rounded`} style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
            <h4 className={`font-medium`} style={{ color: cssVars.text }}>Volume</h4>
            <p style={{ color: cssVars.text }}>Avg: {analysisResults.speech.volume.average} dB</p>
            <p style={{ color: cssVars.text }}>Peak: {analysisResults.speech.volume.peak} dB</p>
          </div>
          <div className={`p-3 rounded`} style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
            <h4 className={`font-medium`} style={{ color: cssVars.text }}>Pauses</h4>
            <p style={{ color: cssVars.text }}>{analysisResults.speech.pauses.count} pauses</p>
            <p style={{ color: cssVars.text }}>Avg: {analysisResults.speech.pauses.averageDuration.toFixed(2)}s</p>
          </div>
        </div>

        <div className="mt-4">
        <h4 className="font-medium mb-2" style={{ color: cssVars.text }}>Pause Distribution</h4>
          {analysisResults.speech.pauses.locations && (
            <div className={`relative w-full rounded`} style={{ height: 32, background: 'var(--analysis-shell-bg)' }}>
              {analysisResults.speech.pauses.locations.map((location, index) => {
                const duration = analysisResults.metadata.duration;
                const position = (location / duration) * 100;
                return (
                  <div
                    key={index}
                    className={`absolute`}
                    style={{ left: `${position}%`, height: 32, width: 2, background: currentTheme.primary }}
                    title={`Pause at ${location.toFixed(1)}s`}
                  ></div>
                );
              })}
            </div>
          )}
          <div className={`flex justify-between text-xs mt-1`} style={{ color: cssVars.text }}>
            <span>Start</span>
            <span>End</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechTab;