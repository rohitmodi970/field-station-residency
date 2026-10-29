// apps/web/components/onBoarding/Question5.tsx
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Zap, Tag, Lightbulb, CheckCircle2 } from 'lucide-react';

interface Question5Props {
  formData: {
    ai_features_accepted?: boolean;
    ai_sentiment_analysis?: boolean;
    ai_topic_detection?: boolean;
    ai_writing_suggestions?: boolean;
  };
  onUpdate: (field: string, value: any) => void;
  currentTheme: { primary: string; medium: string; light: string };
  isDarkMode: boolean;
}

const Question5: React.FC<Question5Props> = ({
  formData,
  onUpdate,
  currentTheme,
  isDarkMode,
}) => {
  const aiFeatures = [
    {
      key: 'ai_sentiment_analysis',
      icon: Brain,
      title: 'Sentiment Analysis',
      description: 'Understand the emotions and mood in your journal entries',
      benefit: 'Track your emotional patterns over time',
      enabled: formData.ai_sentiment_analysis,
    },
    {
      key: 'ai_topic_detection',
      icon: Tag,
      title: 'Topic Detection',
      description: 'Automatically identify and tag topics in your writing',
      benefit: 'Organize entries by themes without manual tagging',
      enabled: formData.ai_topic_detection,
    },
    {
      key: 'ai_writing_suggestions',
      icon: Lightbulb,
      title: 'Writing Suggestions',
      description: 'Get AI-powered prompts and suggestions to enhance your writing',
      benefit: 'Overcome writer\'s block and explore new perspectives',
      enabled: formData.ai_writing_suggestions,
    },
  ];

  const handleToggle = (key: string) => {
    onUpdate(key, !formData[key as keyof typeof formData]);
  };

  const handleAcceptAI = () => {
    onUpdate('ai_features_accepted', !formData.ai_features_accepted);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: `${currentTheme.primary}20` }}>
          <Zap size={32} style={{ color: currentTheme.primary }} />
        </div>
        <h3 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
          AI-Powered Features
        </h3>
        <p className="text-sm max-w-2xl mx-auto" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
          Enhance your journaling experience with AI. All features are optional and can be changed later in settings.
        </p>
      </div>

      {/* AI Consent */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
          formData.ai_features_accepted ? 'shadow-lg' : ''
        }`}
        style={{
          borderColor: formData.ai_features_accepted ? currentTheme.primary : isDarkMode ? '#374151' : '#D1D5DB',
          backgroundColor: formData.ai_features_accepted 
            ? `${currentTheme.primary}10` 
            : isDarkMode ? '#1F2937' : '#F9FAFB'
        }}
        onClick={handleAcceptAI}
      >
        <div className="flex items-start gap-4">
          <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            formData.ai_features_accepted ? 'bg-opacity-100' : 'bg-transparent'
          }`}
          style={{ 
            borderColor: currentTheme.primary,
            backgroundColor: formData.ai_features_accepted ? currentTheme.primary : 'transparent'
          }}>
            {formData.ai_features_accepted && <CheckCircle2 size={16} color="white" />}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold mb-1" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
              I agree to use AI features
            </h4>
            <p className="text-sm" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
              By enabling AI features, you allow our AI models to analyze your journal content to provide insights, 
              suggestions, and enhance your experience. Your data is processed securely and never shared with third parties.
            </p>
          </div>
        </div>
      </motion.div>

      {/* AI Features List */}
      {formData.ai_features_accepted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h4 className="font-semibold text-lg mb-4" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
            Choose your AI features
          </h4>

          {aiFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.key}
                whileHover={{ scale: 1.01 }}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  feature.enabled ? 'shadow-md' : ''
                }`}
                style={{
                  borderColor: feature.enabled ? currentTheme.primary : isDarkMode ? '#374151' : '#E5E7EB',
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF'
                }}
                onClick={() => handleToggle(feature.key)}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div 
                    className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${currentTheme.primary}20` }}
                  >
                    <Icon size={24} style={{ color: currentTheme.primary }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-semibold" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
                        {feature.title}
                      </h5>
                      <button
                        type="button"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          feature.enabled ? 'bg-opacity-100' : 'bg-opacity-30'
                        }`}
                        style={{ backgroundColor: feature.enabled ? currentTheme.primary : '#9CA3AF' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            feature.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-sm mb-2" style={{ color: isDarkMode ? '#D1D5DB' : '#4B5563' }}>
                      {feature.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Zap size={14} style={{ color: currentTheme.primary }} />
                      <p className="text-xs" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                        {feature.benefit}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Privacy Note */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }}>
        <p className="text-xs text-center" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
          🔒 Your privacy is our priority. AI analysis happens securely, and you maintain full control over your data. 
          You can disable any feature at any time in settings.
        </p>
      </div>
    </div>
  );
};

export default Question5;
