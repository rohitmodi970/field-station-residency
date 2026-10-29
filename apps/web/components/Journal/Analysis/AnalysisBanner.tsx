// components/Journal/AnalysisBanner.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/quilted-gallery/ui/card';
import { Brain, TrendingUp, Heart, Lightbulb, Zap, BarChart3 } from 'lucide-react';
import { useTheme } from "@/utilities/context/ThemeContext";

interface AnalysisBannerProps {
  totalEntries: number;
  analysisCount: number;
}

const AnalysisBanner: React.FC<AnalysisBannerProps> = ({ totalEntries, analysisCount }) => {
  const { currentTheme, isDarkMode } = useTheme();

  const features = [
    {
      icon: Heart,
      title: "Sentiment Analysis",
      description: "Discover if your entries are positive, negative, or neutral"
    },
    {
      icon: Brain,
      title: "Emotion Detection",
      description: "Identify primary and secondary emotions in your writing"
    },
    {
      icon: TrendingUp,
      title: "Mood Trends",
      description: "Track your emotional patterns over time"
    },
    {
      icon: Lightbulb,
      title: "Key Insights",
      description: "Extract important phrases and themes from your entries"
    }
  ];

  return (
    <Card className="mb-8 overflow-hidden shadow-lg border-0" style={{
      background: isDarkMode 
        ? `linear-gradient(135deg, ${currentTheme.primary}15 0%, ${currentTheme.primary}08 100%)`
        : `linear-gradient(135deg, ${currentTheme.primary}10 0%, ${currentTheme.primary}05 100%)`,
      borderLeft: `4px solid ${currentTheme.primary}`
    }}>
      <CardContent className="p-8">
        <div className="flex flex-col lg:flex-row items-start gap-8">
          {/* Left Section - Main Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="p-3 rounded-full"
                style={{ backgroundColor: `${currentTheme.primary}20` }}
              >
                <BarChart3 className="h-6 w-6" style={{ color: currentTheme.primary }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: currentTheme.primary }}>
                  AI-Powered Journal Analysis
                </h2>
                <p className="text-muted-foreground">
                  Understand your thoughts and emotions through advanced sentiment analysis
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-base leading-relaxed">
                Get deep insights into your mental and emotional patterns by analyzing your journal entries. 
                Our AI examines your writing to identify sentiments, emotions, and key themes, helping you 
                better understand your personal growth journey.
              </p>
              
              {totalEntries > 0 && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: currentTheme.primary }}
                    />
                    <span className="font-medium">{analysisCount} of {totalEntries} entries analyzed</span>
                  </div>
                  {analysisCount < totalEntries && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Zap className="h-4 w-4" />
                      <span>{totalEntries - analysisCount} entries pending analysis</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            {totalEntries === 0 && (
              <div 
                className="p-4 rounded-lg border border-dashed"
                style={{ 
                  borderColor: currentTheme.primary + '40',
                  backgroundColor: isDarkMode ? currentTheme.primary + '08' : currentTheme.primary + '05'
                }}
              >
                <p className="text-sm font-medium mb-1">Ready to get started?</p>
                <p className="text-sm text-muted-foreground">
                  Create your first journal entry to begin receiving personalized insights about your thoughts and emotions.
                </p>
              </div>
            )}
          </div>

          {/* Right Section - Features */}
          <div className="lg:w-80">
            <h3 className="text-lg font-semibold mb-4">What you'll discover:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div 
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: `${currentTheme.primary}15` }}
                  >
                    <feature.icon className="h-4 w-4" style={{ color: currentTheme.primary }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{feature.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisBanner;