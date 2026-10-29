"use client";

import React, { useEffect, useState } from "react";
import TextTab from "@/components/voiceAnalysis/TextTab";
import EmotionTab from "@/components/voiceAnalysis/EmotionTab";
import SpeechTab from "@/components/voiceAnalysis/SpeechTab";
import { useTheme } from "@/utilities/context/ThemeContext";
import { Loader, AlertCircle, Mic, FileText, Smile, Activity, Zap } from "lucide-react";
import { analyzeVoiceAudio } from '@/lib/analysis/client';
interface AudioAnalyzerProps {
  audioFile: File | Blob | null;
  onAnalysisComplete?: (results: AnalysisResults) => void;
}

interface AnalysisResults {
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
  };
  emotions: Record<string, number>;
  speech: {
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
  energyData: {
    totalEnergy: number;
    averageEnergy: number;
    energyDistribution: Array<{time: number; energy: number}>;
  };
  metadata: {
    duration: number;
    filename: string;
    filesize: number;
  };
}

type TabOption = "text" | "emotions" | "speech" | "energy";

const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ audioFile, onAnalysisComplete }) => {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabOption>("text");

  const { currentTheme, isDarkMode } = useTheme();

  // Theme-aware styles
  const bgColor = isDarkMode ? "bg-gray-800" : "bg-white";
  const textColor = isDarkMode ? "text-gray-200" : "text-gray-800";
  const borderColor = isDarkMode ? "border-gray-700" : "border-gray-200";

  useEffect(() => {
    const analyzeAudio = async () => {
      if (!audioFile) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create form data to send the audio file
        const formData = new FormData();
        formData.append("audioFile", audioFile);

        // Send the audio to the backend for analysis
        const analysisData = await analyzeVoiceAudio(formData) as AnalysisResults;
        setAnalysisResults(analysisData);
        
        // Call the callback if provided
        if (onAnalysisComplete) {
          onAnalysisComplete(analysisData);
        }

        setAnalysisResults(analysisData);
        
        // Call the callback if provided
        if (onAnalysisComplete) {
          onAnalysisComplete(analysisData);
        }
      } catch (err: any) {
        setError(`Failed to analyze audio: ${err.response?.data?.message || err.message}`);
        console.error("Analysis error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (audioFile) {
      analyzeAudio();
    }
  }, [audioFile, onAnalysisComplete]);

  if (!audioFile) {
    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg p-6 text-center shadow-sm`}>
        <Mic size={32} className="mx-auto mb-3 text-gray-400" />
        <p className={`${textColor} text-sm`}>No audio file selected for analysis</p>
        <p className="text-gray-500 text-xs mt-2">Record or upload audio to see voice analysis</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg p-8 text-center shadow-sm`}>
        <Loader 
          className="inline-block animate-spin h-8 w-8 mb-3" 
          style={{ color: currentTheme.primary }}
        />
        <p className={`${textColor} mt-2`}>Analyzing voice patterns...</p>
        <p className="text-gray-500 text-sm mt-1">This may take a moment</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${bgColor} border border-red-300 rounded-lg p-6 shadow-sm`}>
        <div className="flex flex-col items-center text-center">
          <svg className="w-12 h-12 mb-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h4 className="text-red-600 font-semibold text-lg mb-2">Something went wrong</h4>
          <p className="text-red-600 text-sm mb-3">Unable to analyze the audio file. Please try again.</p>
          <details className="text-left w-full mt-2">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">Technical details</summary>
            <p className="text-xs text-gray-600 mt-2 p-3 bg-gray-50 rounded border border-gray-200">{error}</p>
          </details>
        </div>
      </div>
    );
  }

  if (!analysisResults) return null;

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg shadow-md transition-all duration-300`}>
      <div className={`border-b ${borderColor}`}>
        <nav className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab("text")}
            className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap
              ${activeTab === "text" 
                ? `border-b-2 text-${currentTheme.primary} border-${currentTheme.primary}` 
                : isDarkMode ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <FileText size={16} />
            Text Analysis
          </button>
          <button
            onClick={() => setActiveTab("emotions")}
            className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap
              ${activeTab === "emotions" 
                ? `border-b-2 text-${currentTheme.primary} border-${currentTheme.primary}` 
                : isDarkMode ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <Smile size={16} />
            Emotions
          </button>
          <button
            onClick={() => setActiveTab("speech")}
            className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap
              ${activeTab === "speech" 
                ? `border-b-2 text-${currentTheme.primary} border-${currentTheme.primary}` 
                : isDarkMode ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <Activity size={16} />
            Speech Patterns
          </button>
          <button
            onClick={() => setActiveTab("energy")}
            className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap
              ${activeTab === "energy" 
                ? `border-b-2 text-${currentTheme.primary} border-${currentTheme.primary}` 
                : isDarkMode ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <Zap size={16} />
            Energy Levels
          </button>
        </nav>
      </div>

      <div className="p-6">
        {activeTab === "text" && <TextTab analysisResults={analysisResults} />}
        {activeTab === "emotions" && analysisResults.emotions && (
          <EmotionTab emotions={analysisResults.emotions} />
        )}
        {activeTab === "speech" && analysisResults.speech && analysisResults.metadata && (
          <SpeechTab analysisResults={analysisResults} />
        )}
        {activeTab === "energy" && analysisResults.energyData && (
          <div className="space-y-4">
            <div className={`${bgColor} p-6 rounded-lg border ${borderColor}`}>
              <h3 className={`text-lg font-semibold mb-4 ${textColor}`}>Energy Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 ${borderColor === "border-gray-700" ? "bg-gray-700" : "bg-gray-50"} rounded-lg`}>
                  <p className="text-sm text-gray-500">Total Energy</p>
                  <p className={`text-2xl font-bold ${textColor}`}>
                    {analysisResults.energyData.totalEnergy.toFixed(2)}
                  </p>
                </div>
                <div className={`p-4 ${borderColor === "border-gray-700" ? "bg-gray-700" : "bg-gray-50"} rounded-lg`}>
                  <p className="text-sm text-gray-500">Average Energy</p>
                  <p className={`text-2xl font-bold ${textColor}`}>
                    {analysisResults.energyData.averageEnergy.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <h4 className={`text-sm font-medium mb-2 ${textColor}`}>Energy Distribution Over Time</h4>
                <p className="text-xs text-gray-500 mb-4">
                  Shows how vocal energy varies throughout the recording
                </p>
                <div className="grid gap-2">
                  {analysisResults.energyData.energyDistribution.slice(0, 10).map((point, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16">{point.time.toFixed(1)}s</span>
                      <div className="flex-1 bg-gray-300 rounded-full h-2 dark:bg-gray-600">
                        <div 
                          className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{ width: `${Math.min(100, (point.energy / analysisResults.energyData.totalEnergy) * 1000)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-20">{point.energy.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioAnalyzer;