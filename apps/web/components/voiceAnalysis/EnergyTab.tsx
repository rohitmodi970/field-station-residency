import React from "react";
import { 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  Area
} from "recharts";
import { useTheme } from "@/utilities/context/ThemeContext";

interface EnergyPoint {
  time: number;
  energy: number;
  intensity?: number;
}

interface EnergyData {
  totalEnergy: number;
  averageEnergy: number;
  energyDistribution: EnergyPoint[];
}

interface AnalysisResults {
  energyData: EnergyData;
}

interface EnergyTabProps {
  analysisResults: AnalysisResults;
}

interface EnergyInsights {
  energyVariance: number;
  peakEnergy: number;
  lowEnergy: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  const { isDarkMode, elementColors } = useTheme();
  
  if (active && payload && payload.length) {
    const tooltipStyle = isDarkMode 
      ? "bg-gray-800 border border-gray-700 p-4 rounded shadow-lg text-gray-200" 
      : "bg-[#fff8ee] border border-[#d5b493] p-4 rounded shadow-lg text-[#5e4028]";
    
    return (
      <div className={tooltipStyle}>
        <p className="font-bold">Time: {label} seconds</p>
        <p className="text-[#8b5d36]">Energy: {payload[0].value.toFixed(3)}</p>
        {payload[1] && (
          <p className="text-green-600">Intensity: {payload[1].value.toFixed(3)}</p>
        )}
      </div>
    );
  }
  return null;
};

// Utility function to compute variance
function computeVariance(data: EnergyPoint[], key: keyof EnergyPoint): number {
  const mean = data.reduce((sum, item) => sum + Number(item[key]), 0) / data.length;
  const squaredDiffs = data.map(item => Math.pow(Number(item[key]) - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / data.length;
}

// Function to interpret energy data
function interpretEnergyData(energyData: EnergyData, insights: EnergyInsights): string {
  const { totalEnergy, averageEnergy } = energyData;
  const { energyVariance, peakEnergy, lowEnergy } = insights;

  if (totalEnergy < 0.5) return "Low overall energy detected. The audio might be very quiet or subdued.";
  if (energyVariance > 0.5) return "High energy variability suggests dynamic audio content with significant intensity changes.";
  if (peakEnergy > averageEnergy * 2) return "Sharp energy peaks indicate momentary intense sounds or sudden audio events.";
  
  return "Relatively consistent energy levels with moderate variations in audio intensity.";
}

const EnergyTab: React.FC<EnergyTabProps> = ({ analysisResults }) => {
  const { energyData } = analysisResults;
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  
  // Read CSS vars
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

  // Compute additional insights
  const energyInsights: EnergyInsights = {
    energyVariance: computeVariance(energyData.energyDistribution, 'energy'),
    peakEnergy: Math.max(...energyData.energyDistribution.map(d => d.energy)),
    lowEnergy: Math.min(...energyData.energyDistribution.map(d => d.energy))
  };
  
  const themeStyles = {
    pageStyle: { background: 'var(--analysis-shell-bg)', padding: 16, borderRadius: 8 },
    cardStyle: { background: 'var(--analysis-card)', padding: 16, borderRadius: 8 },
    textPrimary: cssVars.text,
    textSecondary: cssVars.muted,
    grid: isDarkMode ? '#374151' : '#f3f3f3',
    lineColor: currentTheme.primary || '#60A5FA',
    areaColor: currentTheme.light || 'rgba(96,165,250,0.2)'
  };

  return (
    <div style={themeStyles.pageStyle}>
      <h2 className={`text-2xl font-bold mb-6`} style={{ color: themeStyles.textPrimary }}>Energy Level Analysis</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div style={themeStyles.cardStyle} className="shadow">
          <h3 className={`text-lg font-semibold mb-4`} style={{ color: themeStyles.textPrimary }}>Energy Statistics</h3>
          <div className="space-y-2">
            <p style={{ color: themeStyles.textPrimary }}>
              <strong style={{ color: 'var(--analysis-muted)' }}>Total Energy:</strong> 
              {" "}{energyData.totalEnergy.toFixed(2)}
            </p>
            <p style={{ color: themeStyles.textPrimary }}>
              <strong style={{ color: '#10B981' }}>Average Energy:</strong> 
              {" "}{energyData.averageEnergy.toFixed(2)}
            </p>
            <p style={{ color: themeStyles.textPrimary }}>
              <strong style={{ color: '#8B5CF6' }}>Energy Variance:</strong> 
              {" "}{energyInsights.energyVariance.toFixed(3)}
            </p>
            <p style={{ color: themeStyles.textPrimary }}>
              <strong style={{ color: '#EF4444' }}>Peak Energy:</strong> 
              {" "}{energyInsights.peakEnergy.toFixed(3)}
            </p>
            <p style={{ color: themeStyles.textPrimary }}>
              <strong style={{ color: '#F59E0B' }}>Lowest Energy:</strong> 
              {" "}{energyInsights.lowEnergy.toFixed(3)}
            </p>
          </div>
        </div>
        
        <div style={themeStyles.cardStyle} className="shadow">
          <h3 className={`text-lg font-semibold mb-4`} style={{ color: themeStyles.textPrimary }}>Energy Interpretation</h3>
          <p style={{ color: themeStyles.textSecondary }}>
            {interpretEnergyData(energyData, energyInsights)}
          </p>
        </div>
      </div>

      <h3 className={`text-xl font-semibold mb-4 ${themeStyles.textPrimary}`}>Energy Distribution Over Time</h3>
      
      <div className="w-full" style={{ height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={energyData.energyDistribution}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid 
              stroke={themeStyles.grid} 
              strokeDasharray="5 5" 
            />
            <XAxis 
              dataKey="time" 
              label={{ 
                value: "Time (seconds)", 
                position: "insideBottom", 
                offset: -10,
                fill: themeStyles.textPrimary
              }}
              tick={{ fill: themeStyles.textPrimary }}
            />
            <YAxis 
              label={{ 
                value: "Energy Intensity", 
                angle: -90, 
                position: "insideLeft",
                fill: themeStyles.textPrimary
              }}
              tick={{ fill: themeStyles.textPrimary }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="energy" 
              stroke={themeStyles.lineColor} 
              strokeWidth={3}
              dot={{ stroke: themeStyles.lineColor, strokeWidth: 2 }}
              activeDot={{ r: 8, stroke: themeStyles.lineColor, strokeWidth: 2 }}
            />
            <Area 
              type="monotone" 
              dataKey="energy" 
              fill={themeStyles.lineColor} 
              fillOpacity={0.3} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EnergyTab;