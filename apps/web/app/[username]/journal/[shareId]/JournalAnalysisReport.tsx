// apps/web/app/[username]/journal/[shareId]/JournalAnalysisReport.tsx
'use client';

import React, { useState } from 'react';
import {
  Brain,
  Heart,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  Activity,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Topic {
  topic: string;
  context: string[];
  frequency: number;
  sentiment: number;
}

interface MoodPattern {
  pattern: string;
  significance: string;
  recommendation: string;
}

interface EmotionalTrigger {
  impact: number;
  trigger: string;
  frequency: number;
}

interface KeyInsight {
  insight: string;
  evidence: string[];
  significance: string;
}

interface Recommendation {
  area: string;
  rationale: string;
  suggestion: string;
}

interface OverallSentiment {
  label: string;
  score: number;
  confidence: number;
}

interface Emotion {
  emotion: string;
  frequency: number;
  intensity: number;
}

interface EmotionalPatterns {
  primaryEmotions: Emotion[];
  secondaryEmotions: Emotion[];
}

interface Insights {
  moodPatterns: MoodPattern[];
  emotionalTriggers: EmotionalTrigger[];
}

export interface AnalysisData {
  topics?: Topic[];
  summary?: string;
  insights?: Insights;
  keyInsights?: KeyInsight[];
  recommendations?: Recommendation[];
  overallSentiment?: OverallSentiment;
  emotionalPatterns?: EmotionalPatterns;
}

interface Props {
  analysis: AnalysisData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sentimentToColor = (score: number) => {
  if (score >= 0.3) return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' };
  if (score >= -0.1) return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500' };
  return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', bar: 'bg-red-500' };
};

const sentimentLabel = (score: number) => {
  if (score >= 0.5) return 'Very Positive';
  if (score >= 0.2) return 'Positive';
  if (score >= -0.1) return 'Neutral';
  if (score >= -0.4) return 'Negative';
  return 'Very Negative';
};

const significanceConfig = {
  critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: '🔴' },
  high:     { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', icon: '🟠' },
  medium:   { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', icon: '🟡' },
  low:      { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: '🟢' },
};

const areaIcons: Record<string, string> = {
  'health management': '🏥',
  'work-life balance': '⚖️',
  'sleep hygiene': '😴',
  'screen time reduction': '📱',
  'activity tracking': '📊',
  'mental health': '🧠',
  'nutrition': '🥗',
  'exercise': '🏃',
  'relationships': '❤️',
  'productivity': '⚡',
};

function SentimentBar({ score }: { score: number }) {
  // Normalize -1..1 to 0..100
  const pct = Math.round(((score + 1) / 2) * 100);
  const colors = sentimentToColor(score);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>Very Negative</span>
        <span>Very Positive</span>
      </div>
      <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`absolute h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
        {/* Neutral marker */}
        <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400 dark:bg-gray-500 -translate-x-1/2" />
      </div>
    </div>
  );
}

function IntensityBar({ value, color = 'bg-purple-500' }: { value: number; color?: string }) {
  return (
    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  badge,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string | number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-600 dark:text-gray-300">{icon}</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 py-4 bg-white dark:bg-gray-800">{children}</div>}
    </div>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

function OverallSentimentSection({ sentiment }: { sentiment: OverallSentiment }) {
  const colors = sentimentToColor(sentiment.score);
  const label = sentimentLabel(sentiment.score);

  return (
    <CollapsibleSection title="Overall Sentiment" icon={<Activity className="w-4 h-4" />}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span
            className={`text-3xl font-bold ${colors.text}`}
          >
            {label}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
            Score: {sentiment.score > 0 ? '+' : ''}{sentiment.score.toFixed(2)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            {Math.round(sentiment.confidence * 100)}% confidence
          </span>
        </div>
        <SentimentBar score={sentiment.score} />
      </div>
    </CollapsibleSection>
  );
}

function SummarySection({ summary }: { summary: string }) {
  return (
    <CollapsibleSection title="Summary" icon={<MessageSquare className="w-4 h-4" />}>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
    </CollapsibleSection>
  );
}

function TopicsSection({ topics }: { topics: Topic[] }) {
  return (
    <CollapsibleSection title="Topics" icon={<BarChart3 className="w-4 h-4" />} badge={topics.length}>
      <div className="space-y-3">
        {topics.map((t, i) => {
          const colors = sentimentToColor(t.sentiment);
          return (
            <div key={i} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize text-sm">{t.topic}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400">×{t.frequency}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                    {t.sentiment > 0 ? '+' : ''}{t.sentiment.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.context.map((c, j) => (
                  <span key={j} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

function EmotionalPatternsSection({ patterns }: { patterns: EmotionalPatterns }) {
  return (
    <CollapsibleSection title="Emotional Patterns" icon={<Heart className="w-4 h-4" />}>
      <div className="space-y-4">
        {patterns.primaryEmotions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Primary</p>
            <div className="space-y-2">
              {patterns.primaryEmotions.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-800 dark:text-gray-200 w-36 capitalize truncate">{e.emotion}</span>
                  <IntensityBar value={e.intensity} color="bg-purple-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{Math.round(e.intensity * 100)}%</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">×{e.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {patterns.secondaryEmotions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Secondary</p>
            <div className="space-y-2">
              {patterns.secondaryEmotions.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-800 dark:text-gray-200 w-36 capitalize truncate">{e.emotion}</span>
                  <IntensityBar value={e.intensity} color="bg-blue-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{Math.round(e.intensity * 100)}%</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">×{e.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function InsightsSection({ insights }: { insights: Insights }) {
  return (
    <CollapsibleSection title="Insights" icon={<Brain className="w-4 h-4" />}>
      <div className="space-y-5">
        {insights.moodPatterns.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Mood Patterns</p>
            <div className="space-y-3">
              {insights.moodPatterns.map((p, i) => {
                const sig = significanceConfig[p.significance as keyof typeof significanceConfig] ?? significanceConfig.medium;
                return (
                  <div key={i} className={`rounded-lg border p-3 ${sig.border} ${sig.bg}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-base">{sig.icon}</span>
                      <div>
                        <p className={`text-sm font-medium ${sig.color}`}>{p.pattern}</p>
                        <span className={`text-xs capitalize ${sig.color} opacity-70`}>{p.significance} significance</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 mt-2 pl-6">
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-600 dark:text-gray-300">{p.recommendation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {insights.emotionalTriggers.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Emotional Triggers</p>
            <div className="space-y-2">
              {insights.emotionalTriggers.sort((a, b) => b.impact - a.impact).map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 capitalize">{t.trigger}</span>
                  <IntensityBar value={t.impact} color="bg-amber-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{Math.round(t.impact * 100)}%</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">×{t.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function KeyInsightsSection({ keyInsights }: { keyInsights: KeyInsight[] }) {
  return (
    <CollapsibleSection title="Key Insights" icon={<Lightbulb className="w-4 h-4" />} badge={keyInsights.length}>
      <div className="space-y-4">
        {keyInsights.map((ki, i) => {
          const sig = significanceConfig[ki.significance as keyof typeof significanceConfig] ?? significanceConfig.medium;
          return (
            <div key={i} className={`rounded-lg border p-4 ${sig.border} ${sig.bg}`}>
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${sig.color}`} />
                <div>
                  <p className={`text-sm font-semibold ${sig.color}`}>{ki.insight}</p>
                  <span className={`text-xs capitalize ${sig.color} opacity-70`}>{ki.significance}</span>
                </div>
              </div>
              {ki.evidence.length > 0 && (
                <ul className="space-y-1 pl-6">
                  {ki.evidence.map((e, j) => (
                    <li key={j} className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-1 text-xs">•</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">{e}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

function RecommendationsSection({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <CollapsibleSection title="Recommendations" icon={<Target className="w-4 h-4" />} badge={recommendations.length}>
      <div className="space-y-3">
        {recommendations.map((r, i) => {
          const icon = areaIcons[r.area.toLowerCase()] ?? '💡';
          return (
            <div key={i} className="rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{icon}</span>
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300 capitalize">{r.area}</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{r.rationale}</p>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-200">{r.suggestion}</p>
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function JournalAnalysisReport({ analysis }: Props) {
  // Handle plain string (legacy / fallback)
  if (typeof analysis === 'string') {
    return (
      <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
        {analysis}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {analysis.summary && (
        <SummarySection summary={analysis.summary} />
      )}
      {analysis.keyInsights && analysis.keyInsights.length > 0 && (
        <KeyInsightsSection keyInsights={analysis.keyInsights} />
      )}
      {!analysis.summary && (!analysis.keyInsights || analysis.keyInsights.length === 0) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">Detailed passive analytics have been removed. Use the Cognition Engine to turn this into action.</p>
      )}
    </div>
  );
}
