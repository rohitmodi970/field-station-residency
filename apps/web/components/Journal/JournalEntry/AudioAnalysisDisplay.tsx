import React, { useState } from 'react';
import { FileText, Smile, Activity, Zap } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import TextTab from '../../voiceAnalysis/TextTab';
import EmotionTab from '../../voiceAnalysis/EmotionTab';
import SpeechTab from '../../voiceAnalysis/SpeechTab';

interface AnalysisResults {
  emotions?: Record<string, number>;
  linguistics: {
    transcript?: string;
    summary: string;
    sentiment: {
      overall: string;
      score: number;
      positive: number;
      negative: number;
      neutral: number;
    };
    confidence: number;
    topics: string[];
    keywords?: string[];
  };
  speech?: {
    pitch: {
      average: number;
      variation: number;
      data: number[];
    };
    rate: {
      wordsPerMinute: number;
      syllablesPerSecond: number;
      data: number[];
    };
    volume: {
      average: number;
      peak: number;
      data: number[];
    };
    pauses: {
      count: number;
      locations: number[];
      durations?: number[];
      averageDuration: number;
    };
  };
  energyData?: {
    totalEnergy: number;
    averageEnergy: number;
    energyDistribution: Array<{ time: number; energy: number }>;
  };
  metadata?: {
    duration: number;
    filename: string;
    filesize: number;
  };
}

interface AudioAnalysisDisplayProps {
  results: AnalysisResults;
}

type TabOption = "text" | "emotions" | "speech" | "energy";

const AudioAnalysisDisplay: React.FC<AudioAnalysisDisplayProps> = ({ results }) => {
  const [activeTab, setActiveTab] = useState<TabOption>("text");
  const { currentTheme, isDarkMode } = useTheme();

  const bgColor = isDarkMode ? "bg-gray-800" : "bg-white";
  const textColor = isDarkMode ? "text-gray-200" : "text-gray-800";
  const borderColor = isDarkMode ? "border-gray-700" : "border-gray-200";

  return (
    <div className={`mt-3 ${bgColor} ${textColor} border ${borderColor} rounded-lg overflow-hidden shadow-lg`}>
      {/* Tab Navigation */}
      <div className={`border-b ${borderColor}`}>
        <nav className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab("text")}
            className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap
              ${activeTab === "text" 
                ? `border-b-2` 
                : isDarkMode ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-700"
              }`}
            style={activeTab === "text" ? { 
              color: currentTheme.primary, 
              borderColor: currentTheme.primary 
            } : {}}
          >
            <FileText size={16} />
            Text Analysis
          </button>
          {results.emotions && (
            <button
              onClick={() => setActiveTab("emotions")}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap
                ${activeTab === "emotions" 
                  ? `border-b-2` 
                  : isDarkMode ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-700"
                }`}
              style={activeTab === "emotions" ? { 
                color: currentTheme.primary, 
                borderColor: currentTheme.primary 
              } : {}}
            >
              <Smile size={16} />
              Emotions
            </button>
          )}
          {results.speech && (
            <button
              onClick={() => setActiveTab("speech")}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap
                ${activeTab === "speech" 
                  ? `border-b-2` 
                  : isDarkMode ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-700"
                }`}
              style={activeTab === "speech" ? { 
                color: currentTheme.primary, 
                borderColor: currentTheme.primary 
              } : {}}
            >
              <Activity size={16} />
              Speech Patterns
            </button>
          )}
          {results.energyData && (
            <button
              onClick={() => setActiveTab("energy")}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap
                ${activeTab === "energy" 
                  ? `border-b-2` 
                  : isDarkMode ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-700"
                }`}
              style={activeTab === "energy" ? { 
                color: currentTheme.primary, 
                borderColor: currentTheme.primary 
              } : {}}
            >
              <Zap size={16} />
              Energy Levels
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "text" && <TextTab analysisResults={results} />}
        {activeTab === "emotions" && results.emotions && (
          <EmotionTab emotions={results.emotions} />
        )}
        {activeTab === "speech" && results.speech && results.metadata && (
          <SpeechTab analysisResults={results as any} />
        )}
        {activeTab === "energy" && results.energyData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`${isDarkMode ? "bg-gray-700" : "bg-gray-50"} p-4 rounded-lg`}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: currentTheme.primary }}>
                  Total Energy
                </h3>
                <p className="text-2xl font-bold">{results.energyData.totalEnergy.toFixed(2)}</p>
              </div>
              <div className={`${isDarkMode ? "bg-gray-700" : "bg-gray-50"} p-4 rounded-lg`}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: currentTheme.primary }}>
                  Average Energy
                </h3>
                <p className="text-2xl font-bold">{results.energyData.averageEnergy.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioAnalysisDisplay;
