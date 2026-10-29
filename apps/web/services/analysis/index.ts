import {
  AnalysisCategory,
  AnalysisTimeframe,
  LLMProvider,
  MultiEntryAnalysisType,
  NormalizedAnalysisResult,
  SingleEntryAnalysisType,
} from '@/types/analysis.contract';
import { analysisRepository } from './repository';

export interface AnalyzeSingleInput {
  userId: string;
  journalId: string;
  title: string;
  content: string;
  analysisType: SingleEntryAnalysisType;
  provider?: LLMProvider;
}

export interface AnalyzeMultiInput {
  userId: string;
  entries: unknown[];
  timeframe: AnalysisTimeframe;
  analysisTypes: MultiEntryAnalysisType[];
  provider?: LLMProvider;
}

export interface AnalysisHistoryFilters {
  userId: string;
  category?: AnalysisCategory;
  limit?: number;
}

// Phase 1 scaffold: routes can incrementally delegate here.
export const analysisService = {
  async analyzeSingle(_input: AnalyzeSingleInput): Promise<NormalizedAnalysisResult> {
    return {
      category: 'text_single',
      metadata: { delegated: false, phase: 1 },
    };
  },

  async analyzeMulti(_input: AnalyzeMultiInput): Promise<NormalizedAnalysisResult> {
    return {
      category: 'text_multi',
      metadata: { delegated: false, phase: 1 },
    };
  },

  async getHistory(filters: AnalysisHistoryFilters): Promise<unknown[]> {
    return analysisRepository.getHistory(filters);
  },
};

export { audioAnalysisService, AudioAnalysisService } from './audioAnalysisService';
export * from '@/types/audioAnalysis.contract';
export * from '@/types/imentiv.contract';

