import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie } from "recharts";
import { useTheme } from "@/utilities/context/ThemeContext";

interface EmotionData {
  name: string;
  value: number;
}

interface Emotions {
  [key: string]: number;
}

interface AnalysisResults {
  emotions: Emotions;
}

interface EmotionsTabProps {
  analysisResults: AnalysisResults;
}

const COLORS: Record<string, string> = {
  joy: "#4CAF50",
  sadness: "#2196F3",
  anger: "#F44336",
  fear: "#9C27B0",
  surprise: "#FF9800",
  disgust: "#795548",
  contempt: "#607D8B",
  neutral: "#9E9E9E",
};

const getEmotionChartData = (analysisResults: AnalysisResults): EmotionData[] => {
  if (!analysisResults?.emotions) return [];

  return Object.entries(analysisResults.emotions)
    .map(([emotion, value]) => ({
      name: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      value: parseFloat((value * 100).toFixed(1)),
    }))
    .sort((a, b) => b.value - a.value);
};

const EmotionsTab: React.FC<EmotionsTabProps> = ({ analysisResults }) => {
  const emotionData = getEmotionChartData(analysisResults);
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  
  // Read CSS variables for theme-aware rendering
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
    cardBgStyle: { background: 'var(--analysis-card)' },
    textStyle: { color: 'var(--analysis-text)' },
    secondaryTextStyle: { color: 'var(--analysis-muted)' },
    bgStyle: { background: 'var(--analysis-shell-bg)' },
    progressBarColor: currentTheme.primary,
    chartGridStroke: isDarkMode ? '#374151' : '#e5e7eb'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="p-4 rounded-lg shadow-md" style={themeStyles.cardBgStyle}>
        <h3 className="text-lg font-medium mb-4" style={themeStyles.textStyle}>Emotion Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
           <BarChart data={emotionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={themeStyles.chartGridStroke} />
              <XAxis dataKey="name" tick={{ fill: cssVars.text }} />
              <YAxis 
                label={{ 
                  value: "Percentage (%)", 
                  angle: -90, 
                  position: "insideLeft",
                  fill: cssVars.text 
                }} 
                tick={{ fill: cssVars.text }}
              />
              <Tooltip 
                formatter={(value: number) => [`${value}%`, "Intensity"]} 
                contentStyle={{ 
                  backgroundColor: isDarkMode ? "#1F2937" : "#fff",
                  borderColor: isDarkMode ? "#374151" : "#e5e7eb",
                  color: cssVars.text
                }}
              />
              <Bar dataKey="value" name="Intensity">
                {emotionData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.name.toLowerCase()] || `hsl(${index * 45}, 70%, 50%)`} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-4 rounded-lg shadow-md" style={themeStyles.cardBgStyle}>
        <h3 className="text-lg font-medium mb-4" style={themeStyles.textStyle}>Emotion Breakdown</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={emotionData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {emotionData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.name.toLowerCase()] || `hsl(${index * 45}, 70%, 50%)`} 
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value}%`, "Intensity"]}
                contentStyle={{ 
                  backgroundColor: isDarkMode ? "#1F2937" : "#fff",
                  borderColor: isDarkMode ? "#374151" : "#e5e7eb",
                  color: cssVars.text
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4">
          <h4 className="font-medium" style={themeStyles.textStyle}>Emotional Energy</h4>
          <p style={themeStyles.textStyle}>Based on voice analysis, the speaker's emotional energy is:</p>

          <div className={`mt-2 rounded-full h-4 w-full`} style={themeStyles.bgStyle}>
            {emotionData.some((item) => item.name.toLowerCase() === "neutral") ? (
              <div
                className="h-4 rounded-full"
                style={{
                  width: `${100 - (emotionData.find((item) => item.name.toLowerCase() === "neutral")?.value || 0)}%`,
                  backgroundColor: themeStyles.progressBarColor
                }}
              ></div>
            ) : (
              <div className="h-4 rounded-full w-3/4" style={{ backgroundColor: themeStyles.progressBarColor }}></div>
            )}
          </div>
          <div className={`flex justify-between text-xs mt-1`} style={themeStyles.textStyle}>
            <span>Low Energy</span>
            <span>High Energy</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmotionsTab;