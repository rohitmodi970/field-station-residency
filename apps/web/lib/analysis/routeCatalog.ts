import { AnalysisCategory } from '@/types/analysis.contract';

export interface AnalysisRouteCatalogEntry {
  category: AnalysisCategory;
  status: 'active' | 'deprecating';
  canonicalTarget?: string;
}

// Runtime map aligned with docs/analysis/REGISTRY.yaml (Phase 1 bootstrap).
export const ANALYSIS_ROUTE_CATALOG: Record<string, AnalysisRouteCatalogEntry> = {
  '/api/analysis/text/single': {
    category: 'text_single',
    status: 'active',
  },
  '/api/analysis/text/multi': {
    category: 'text_multi',
    status: 'active',
  },
  '/api/analysis/audio': {
    category: 'audio_voice',
    status: 'active',
  },
  '/api/analysis/audio/history': {
    category: 'audio_voice',
    status: 'active',
  },
  '/api/analysis/audio/hume': {
    category: 'audio_voice',
    status: 'active',
  },
  '/api/analysis/audio/imentiv': {
    category: 'audio_voice',
    status: 'active',
  },
  '/api/analysis/audio/presigned-upload': {

    category: 'audio_voice',
    status: 'active',
  },
  '/api/analysis/audio/start-from-upload': {
    category: 'audio_voice',
    status: 'active',
  },
  '/api/analysis/audio/chunk': {
    category: 'audio_voice',
    status: 'active',
  },
  '/api/journal/[journalId]/analyze': {
    category: 'text_single',
    status: 'deprecating',
    canonicalTarget: '/api/analysis/text/single',
  },
  '/api/journal-analysis': {
    category: 'text_multi',
    status: 'deprecating',
    canonicalTarget: '/api/analysis/text/multi',
  },
  '/api/sentiment/analyze-entry': {
    category: 'sentiment_quick',
    status: 'deprecating',
    canonicalTarget: '/api/analysis/text/single',
  },
  '/api/audio-analysis': {
    category: 'audio_voice',
    status: 'deprecating',
    canonicalTarget: '/api/analysis/audio',
  },
  '/api/voice-analysis': {
    category: 'audio_voice',
    status: 'deprecating',
    canonicalTarget: '/api/analysis/audio',
  },
  '/api/journal-embeddings': {
    category: 'embeddings_graph',
    status: 'active',
  },
  '/api/ai/insights': {
    category: 'insights_records',
    status: 'active',
  },
};
