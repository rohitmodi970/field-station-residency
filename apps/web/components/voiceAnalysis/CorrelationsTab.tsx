import React from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useTheme } from "@/utilities/context/ThemeContext";

interface CorrelationPoint {
  pitch: number;
  rate: number;
}

interface Metadata {
  duration: number;
  sampleRate: number;
  bitrate: number;
  filesize: number;
}

interface SpeechData {
  pitch: {
    data: number[];
  };
  rate: {
    data: number[];
  };
}

interface AnalysisResults {
  speech: SpeechData;
  metadata: Metadata;
}

interface CorrelationsTabProps {
  analysisResults: AnalysisResults;
}

const getCorrelationData = (analysisResults: AnalysisResults): CorrelationPoint[] => {
  if (!analysisResults?.speech?.pitch?.data || !analysisResults?.speech?.rate?.data) return [];

  const pitchData = analysisResults.speech.pitch.data;
  const rateData = analysisResults.speech.rate.data;
  const minLength = Math.min(pitchData.length, rateData.length);

  return Array.from({ length: minLength }, (_, i) => ({
    pitch: pitchData[i] ?? 0,
    rate: rateData[i] ?? 0,
  }));
};

const CorrelationsTab: React.FC<CorrelationsTabProps> = ({ analysisResults }) => {
  const correlationData = getCorrelationData(analysisResults);
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  // Read CSS vars for theme-aware colors
  let cssVars: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const root = getComputedStyle(document.documentElement);
      cssVars = {
        text: root.getPropertyValue('--analysis-text') || (isDarkMode ? '#E6E1DE' : '#35261f'),
        muted: root.getPropertyValue('--analysis-muted') || (isDarkMode ? '#BFAE9C' : '#6b5547'),
        card: root.getPropertyValue('--analysis-card') || (isDarkMode ? '#111827' : '#fffaf5')
      };
    } catch (e) {
      cssVars = { text: isDarkMode ? '#E6E1DE' : '#35261f', muted: '#6b5547', card: isDarkMode ? '#111827' : '#fffaf5' };
    }
  }

  const themeStyles = {
    panelStyle: { background: 'var(--analysis-card)', padding: 16, borderRadius: 8 },
    textColor: cssVars.text,
    mutedColor: cssVars.muted,
    scatterColor: currentTheme.primary || '#6366F1'
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div style={themeStyles.panelStyle} className="shadow-md">
        <h3 className={`text-lg font-medium mb-4`} style={{ color: themeStyles.textColor }}>Correlations</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={cssVars.muted || (isDarkMode ? '#374151' : '#e5e7eb')} />
              <XAxis 
                type="number" 
                dataKey="pitch" 
                name="Pitch" 
                label={{ value: "Pitch (Hz)", position: "insideBottom", offset: -5, fill: themeStyles.textColor }} 
                tick={{ fill: themeStyles.textColor }}
              />
              <YAxis 
                type="number" 
                dataKey="rate" 
                name="Rate" 
                label={{ value: "Speech Rate (syl/sec)", angle: -90, position: "insideLeft", fill: themeStyles.textColor }} 
                tick={{ fill: themeStyles.textColor }}
              />
              <Tooltip 
                cursor={{ strokeDasharray: "3 3" }} 
                formatter={(value: number) => value.toFixed(2)} 
                contentStyle={{ backgroundColor: isDarkMode ? "#1F2937" : "#fff", borderColor: isDarkMode ? "#374151" : "#e5e7eb", color: themeStyles.textColor }}
                labelStyle={{ color: themeStyles.textColor }}
              />
              <Scatter name="Pitch vs Rate" data={correlationData} fill={themeStyles.scatterColor} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm mt-2" style={{ color: themeStyles.mutedColor }}>
          This chart shows the relationship between pitch and speaking rate throughout the recording.
        </p>
      </div>
      <div style={{ background: 'var(--analysis-card)', padding: 16, borderRadius: 8 }} className="shadow-md">
        <h3 className={`text-lg font-medium mb-4`} style={{ color: themeStyles.textColor }}>Metadata Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-3 rounded`} style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
            <h4 className={`font-medium`} style={{ color: themeStyles.textColor }}>Recording Duration</h4>
            <p style={{ color: themeStyles.textColor }}>{analysisResults.metadata.duration.toFixed(1)} seconds</p>
          </div>
          <div className={`p-3 rounded`} style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
            <h4 className={`font-medium`} style={{ color: themeStyles.textColor }}>Sample Rate</h4>
            <p style={{ color: themeStyles.textColor }}>{(analysisResults.metadata.sampleRate / 1000).toFixed(1)} kHz</p>
          </div>
          <div className={`p-3 rounded`} style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
            <h4 className={`font-medium`} style={{ color: themeStyles.textColor }}>Bitrate</h4>
            <p style={{ color: themeStyles.textColor }}>{(analysisResults.metadata.bitrate / 1000).toFixed(0)} kbps</p>
          </div>
          <div className={`p-3 rounded`} style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
            <h4 className={`font-medium`} style={{ color: themeStyles.textColor }}>File Size</h4>
            <p style={{ color: themeStyles.textColor }}>{(analysisResults.metadata.filesize / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>

        <div className="mt-4">
          <h4 className={`font-medium mb-2`} style={{ color: themeStyles.textColor }}>Speaker Analysis</h4>
          <p style={{ color: themeStyles.textColor }}>Currently analyzing a single speaker's voice. Multi-speaker detection can be enabled for group conversations.</p>
        </div>
      </div>
    </div>
  );
};

export default CorrelationsTab;