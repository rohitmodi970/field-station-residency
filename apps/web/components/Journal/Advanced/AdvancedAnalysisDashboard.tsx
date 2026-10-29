import React, { useEffect, useState } from 'react';
import { JournalEntry } from '../types';
import ActivityWordCloud from './ActivityWordCloud';
import TopicHierarchy from './TopicHierarchy';
import HappinessTree from '@/components/HappinessTree';
import JournalMindMap from './MindMap/JournalMindMap';
import { useAiDecryption } from '@/utils/encryption/useAiDecryption';
import { fetchGeminiAnalytics, GeminiAnalytics } from '../../../utilities/geminiAnalysis';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TextualAnalysisTab from './TextualAnalysisTab';

interface AdvancedAnalysisDashboardProps {
  entries: JournalEntry[];
  onAnalysisComplete?: (analysis: GeminiAnalytics, title: string, summary: string) => void;
  currentAnalysis?: GeminiAnalytics | null;
  initialTab?: string;
}

const AdvancedAnalysisDashboard: React.FC<AdvancedAnalysisDashboardProps> = ({ 
  entries, 
  onAnalysisComplete,
  currentAnalysis,
  initialTab 
}) => {
  const { decryptEmbedding } = useAiDecryption();
  const [analytics, setAnalytics] = useState<GeminiAnalytics | null>(currentAnalysis || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mindmapData, setMindmapData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  const [mindmapLoading, setMindmapLoading] = useState(true);
  const [hasAnalyzed, setHasAnalyzed] = useState(!!currentAnalysis);

  // Reset state when currentAnalysis is explicitly set to null (new analysis requested)
  useEffect(() => {
    if (currentAnalysis === null && hasAnalyzed) {
      setAnalytics(null);
      setHasAnalyzed(false);
      setError(null);
    }
  }, [currentAnalysis]);

  useEffect(() => {
    if (currentAnalysis) {
      setAnalytics(currentAnalysis);
      setHasAnalyzed(true);
      return;
    }

    // Only auto-start analysis if we don't have it yet and entries exist
    if (!entries || entries.length === 0 || hasAnalyzed || loading) return;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGeminiAnalytics(entries);
        if (data) {
          console.log('[Dashboard] Analytics received:', {
            hasKeywordInsight: !!data.keywordInsight,
            hasTopicHierarchyInsight: !!data.topicHierarchyInsight,
            hasMindmapInsight: !!data.mindmapInsight,
            mindmapInsight: data.mindmapInsight
          });
          setAnalytics(data);
          setHasAnalyzed(true);
          // Call the callback with the analysis results
          if (onAnalysisComplete) {
            const title = `Analysis of ${entries.length} entries`;
            const summary = data.healthWellnessInsight || 'Advanced analysis completed';
            onAnalysisComplete(data, title, summary);
          }
        } else {
          setError('Failed to fetch analytics data');
        }
      } catch (err) {
        setError('Error fetching analytics');
        setHasAnalyzed(true); // Prevent retries on error
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [entries, currentAnalysis, hasAnalyzed, loading]);

  const entryIdsKey = React.useMemo(() => {
    return (entries || []).map(e => e.journalId || e.id).filter(Boolean).sort().join(',');
  }, [entries]);

  // Fetch mindmap data
  useEffect(() => {
    let isCancelled = false;
    const fetchMindmapData = async () => {
      if (!entryIdsKey) {
        setMindmapLoading(false);
        return;
      }

      setMindmapLoading(true);
      try {
        const response = await fetch(`/api/journal-embeddings?entryIds=${entryIdsKey}`);
        
        if (response.ok) {
          const data = await response.json();
          if (isCancelled) return;
          // Decrypt mindmap nodes (which map to DB rows)
          if (Array.isArray(data.nodes)) {
            data.nodes = await Promise.all(data.nodes.map(async (row: any) => {
              const fields = await decryptEmbedding(row);
              const keyword = fields.keyword ?? row.keyword;
              const category = fields.category ?? row.category;
              return {
                ...row,
                keyword,
                category,
                label: keyword || row.label || row.title || 'Journal Entry',
              };
            }));
          }
          if (!isCancelled) {
            setMindmapData(data);
          }
        } else {
          console.error('Failed to fetch mindmap data');
        }
      } catch (err) {
        console.error('Error fetching mindmap data:', err);
      } finally {
        if (!isCancelled) {
          setMindmapLoading(false);
        }
      }
    };

    fetchMindmapData();
    return () => {
      isCancelled = true;
    };
  }, [entryIdsKey, decryptEmbedding]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b5d36]"></div>
        <div className="text-[#6f4a2e] text-lg">Analyzing {entries.length} journal entries...</div>
        <div className="text-[#9a7655] text-sm">This may take a couple of minutes</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8">
        <div className="text-red-500 text-xl font-semibold">⚠️ Analysis Error</div>
        <div className="text-[#6f4a2e] text-center max-w-md">{error}</div>
        <div className="text-[#9a7655] text-sm text-center max-w-lg">
          This might be due to rate limiting or API quota limits. Please wait a moment and try again.
        </div>
        <button
          onClick={() => {
            setError(null);
            setHasAnalyzed(false);
            window.location.reload();
          }}
          className="mt-4 px-6 py-2 bg-[#8b5d36] text-white rounded-lg hover:bg-[#7f4f2f] transition-colors"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#856347]">No analytics data available.</div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="visual" value={initialTab} className="w-full">
      <TabsList className="mb-6 !bg-[#f0dfcc] !border !border-[#d5b493]/65 p-1 rounded-xl">
        <TabsTrigger value="visual" className="rounded-lg !text-[#6f4a2e] data-[state=active]:!bg-[#8b5d36] data-[state=active]:!text-white data-[state=active]:!border-b-0 data-[state=active]:!shadow-none">Visual Analysis</TabsTrigger>
        <TabsTrigger value="textual" className="rounded-lg !text-[#6f4a2e] data-[state=active]:!bg-[#8b5d36] data-[state=active]:!text-white data-[state=active]:!border-b-0 data-[state=active]:!shadow-none">Textual Analysis</TabsTrigger>
      </TabsList>

      {/* Reflection Insights — Always visible above tabs */}
      {(analytics.reflectionSummary || analytics.lifePatterns || analytics.weeklyInsight) && (
        <div className="mb-8 space-y-4">
          {/* Weekly Takeaway */}
          {analytics.weeklyInsight && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-900">
                <span className="mr-2">💡</span>
                <span className="font-semibold">This Week&apos;s Takeaway:</span>{' '}
                {analytics.weeklyInsight}
              </p>
            </div>
          )}

          {/* Reflection Summary */}
          {analytics.reflectionSummary && (
            <div className="bg-[#fff8ee]/95 rounded-xl shadow-sm border border-[#d5b493]/65 p-5">
              <h3 className="text-lg font-semibold mb-2 text-[#2e2012]">Reflection Summary</h3>
              <p className="text-sm text-[#6b4a2e] leading-relaxed">{analytics.reflectionSummary}</p>
            </div>
          )}

          {/* Life Patterns — Mirror → Meaning → Movement */}
          {analytics.lifePatterns && analytics.lifePatterns.length > 0 && (
            <div className="bg-[#fff8ee]/95 rounded-xl shadow-sm border border-[#d5b493]/65 p-5">
              <h3 className="text-lg font-semibold mb-4 text-[#2e2012]">Life Patterns</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analytics.lifePatterns.map((pattern, idx) => (
                  <div key={idx} className="bg-[#f7e9db] rounded-lg p-4 border border-[#e1c8ad]">
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#8b5d36]">Mirror</span>
                        <p className="text-sm text-[#6b4a2e] mt-0.5">{pattern.mirror}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#8b5d36]">Meaning</span>
                        <p className="text-sm text-[#6b4a2e] mt-0.5">{pattern.meaning}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#8b5d36]">Movement</span>
                        <p className="text-sm text-[#6b4a2e] mt-0.5 italic">{pattern.movement}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Growth Edge + Energy Wellbeing side by side */}
          {(analytics.growthEdge || analytics.energyWellbeingInsight) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.growthEdge && (
                <div className="bg-gradient-to-br from-rose-50 to-white rounded-xl border border-rose-100 p-4">
                  <h4 className="text-sm font-semibold text-rose-700 mb-1">🌱 Growth Edge</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{analytics.growthEdge}</p>
                </div>
              )}
              {analytics.energyWellbeingInsight && (
                <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100 p-4">
                  <h4 className="text-sm font-semibold text-emerald-700 mb-1">⚡ Energy & Wellbeing</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{analytics.energyWellbeingInsight}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <TabsContent value="visual">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Activity/Topic Word Cloud */}
          <div className="w-full">
            <div className="bg-[#fff8ee]/95 border border-[#d5b493]/65 rounded-lg shadow p-4 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-3">Activity & Topic Word Cloud</h2>
              <div className="w-full overflow-hidden">
                <ActivityWordCloud words={(analytics.keywords || []).map(k => k.text).filter(Boolean)} />
              </div>
              {analytics.keywordInsight && (
                <div className="mt-4 p-3 bg-[#f5e8d9] rounded-lg border-l-4 border-[#8b5d36]">
                  <p className="text-sm text-[#5e4028] italic leading-relaxed">
                    <span className="font-semibold text-[#8b5d36]">Insight: </span>
                    {analytics.keywordInsight}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Topic Hierarchy */}
          <div>
            <div className="bg-[#fff8ee]/95 border border-[#d5b493]/65 rounded-lg shadow p-4 mb-4">
              <h2 className="text-2xl font-bold mb-2">Topic Hierarchy</h2>
              <TopicHierarchy topicHierarchy={analytics.topicHierarchy || []} />
              {analytics.topicHierarchyInsight && (
                <div className="mt-4 p-3 bg-[#f5e8d9] rounded-lg border-l-4 border-[#8b5d36]">
                  <p className="text-sm text-[#5e4028] italic">
                    <span className="font-semibold text-[#8b5d36]">Insight: </span>
                    {analytics.topicHierarchyInsight}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Happiness Tree Visualization */}
          <div className="col-span-1 md:col-span-2">
            <HappinessTree sources={analytics.happinessSources} />
          </div>
          {/* Journal Mind Map */}
          <div className="col-span-1 md:col-span-2">
            <div className="bg-[#fff8ee]/95 border border-[#d5b493]/65 rounded-lg shadow p-4 mb-4">
              <h2 className="text-2xl font-bold mb-4">Journal Connections Mind Map</h2>
              <p className="text-sm text-[#6f4a2e] mb-4">
                Visualizing semantic relationships between your journal entries based on AI-powered similarity analysis.
              </p>
              {mindmapLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-[#9a7655]">Analyzing journal connections...</div>
                </div>
              ) : mindmapData.nodes.length > 0 ? (
                <JournalMindMap 
                  nodes={mindmapData.nodes} 
                  links={mindmapData.links}
                  mindmapInsight={typeof analytics.mindmapInsight === 'object' ? analytics.mindmapInsight : undefined}
                  mindmapClusters={analytics.mindmapClusters}
                />
              ) : (
                <div className="flex items-center justify-center h-96 bg-[#f5e8d9] rounded-lg border border-[#e1c8ad]">
                  <div className="text-center text-[#856347]">
                    <p className="mb-2">No connections found yet.</p>
                    <p className="text-sm">Connections will appear as you create more journal entries with similar themes.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="textual">
        <TextualAnalysisTab analytics={analytics} />
      </TabsContent>
    </Tabs>
  );
};

export default AdvancedAnalysisDashboard; 