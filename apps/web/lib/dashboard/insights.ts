export type MentalWeatherPattern = "calm" | "shifting" | "stormy" | "clearing" | "bright";
export type MindEnergyState = "low" | "recovering" | "steady" | "flowing" | "peak";
export type WellnessPriority = "emotional" | "mental" | "physical";
export type RhythmPattern = "morning" | "midday" | "evening" | "night";

export interface MentalWeatherInsight {
  pattern: MentalWeatherPattern;
  intensity: number;
  forecast: string;
  analysis?: string;
}

export interface MindEnergyInsight {
  level: number;
  state: MindEnergyState;
  message: string;
  hint: string;
}

export interface WellnessBalanceInsight {
  emotional: number;
  mental: number;
  physical: number;
  priority: WellnessPriority;
  message: string;
}

export interface RhythmInsight {
  energyPattern: RhythmPattern;
  label: string;
  insight: string;
  times: string[];
}

export interface DashboardInsights {
  version?: number;
  generatedAt: string;
  source: "llm" | "fallback";
  sourceEntryId: string | null;
  sourceEntryCount: number;
  sourceEntryDate: string | null;
  sourceContext: "entry" | "onboarding" | "fallback";
  mentalWeather: MentalWeatherInsight;
  mindEnergy: MindEnergyInsight;
  wellnessBalance: WellnessBalanceInsight;
  rhythm: RhythmInsight;
}
