export type EnergyBucket = 'clarity' | 'growth' | 'stability';

export interface PersonalizedInsight {
  headline: string;
  insight: string;
  actionLabel: string;
  actionHint: string;
}

export interface PersonalizedPillar {
  title: string;
  desc: string;
}

export interface PersonalizedSectionLabels {
  writingRitual: string;
  momentum: string;
  execution: string;
  memory: string;
  explore: string;
}

export interface PersonalizedWritingPrompt {
  text: string;
  explanation: string;
  ctaLabel: string;
}

export interface PersonalizedActionPanel {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
}

export interface PersonalizedBehaviorDirectives {
  preferSpotlightV2: boolean;
  discoverChipOrder: number[];
}

export interface PersonalizedDashboardVariants {
  sectionLabels: PersonalizedSectionLabels;
  writingPrompt: PersonalizedWritingPrompt;
  narrativePillars: PersonalizedPillar[];
  discoverChipLabels: string[];
  actionPanel: PersonalizedActionPanel;
  behavior: PersonalizedBehaviorDirectives;
}

export interface PersonalizedDashboardPayload {
  bucket: EnergyBucket;
  source: 'llm' | 'cache' | 'fallback';
  promptVersion: string;
  insight: PersonalizedInsight;
  variants: PersonalizedDashboardVariants;
  generatedAt: number;
}
