import { AnalysisCategory } from '@/types/analysis.contract';

export interface AnalysisHistoryFilters {
  userId: string;
  category?: AnalysisCategory;
  limit?: number;
}

// Phase 1 scaffold: add unified query logic here as routes migrate.
export const analysisRepository = {
  async getHistory(_filters: AnalysisHistoryFilters): Promise<unknown[]> {
    return [];
  },
};
