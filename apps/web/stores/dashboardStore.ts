"use client";

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PersonalizedDashboardPayload } from '@/lib/personalization/types';
import type { DashboardInsights } from '@/lib/dashboard/insights';

import { dashboardCache } from '@/lib/cache/dashboardCache';

// Tiered TTL configuration (in seconds)
export const DASHBOARD_CACHE_CONFIG = {
  stats: 5 * 60, // 5 minutes
  prompts: 24 * 60 * 60, // 24 hours default
  insights: 8 * 60 * 60, // 8 hours
  personalization: 24 * 60 * 60, // 24 hours
  spotlightGreeting: 4 * 60 * 60, // 4 hours
};
 
 interface DashboardStoreState {
   // Data
   stats: any | null;
   promptData: any | null;
   promptSourceEntryCount?: number;
   personalization: PersonalizedDashboardPayload | null;
   insights: DashboardInsights | null;
   
   // Timestamps per section (for tiered TTL)
   lastUpdatedStats: number;
   lastUpdatedPrompts: number;
   lastUpdatedInsights: number;
   lastUpdatedPersonalization: number;
   
   // Legacy (kept for backward compatibility)
   lastUpdated: number;
   
   // Setters
   setStats: (stats: any | null) => void;
   setPromptData: (promptData: any | null, sourceEntryCount?: number) => void;
   setPersonalization: (personalization: PersonalizedDashboardPayload | null) => void;
   setInsights: (insights: DashboardInsights | null) => void;
   
   // Refresh methods
   shouldRefresh: (section: keyof typeof DASHBOARD_CACHE_CONFIG) => boolean;
   setSectionUpdated: (section: keyof typeof DASHBOARD_CACHE_CONFIG) => void;
   
   // Cache methods
   clear: () => void;
   isFresh: (ttlSeconds?: number) => boolean;
   clearSection: (section: keyof typeof DASHBOARD_CACHE_CONFIG) => void;
   hydrateFromPersistentCache: () => Promise<void>;
 }

const useDashboardStore = create<DashboardStoreState>()(
  persist(
    (set, get) => ({
       // Data
       stats: null,
       promptData: null,
       promptSourceEntryCount: undefined,
       personalization: null,
       insights: null,
       
       // Timestamps
       lastUpdatedStats: 0,
       lastUpdatedPrompts: 0,
       lastUpdatedInsights: 0,
       lastUpdatedPersonalization: 0,
       lastUpdated: 0, // Legacy
       
       // Setters
       setStats: (stats) => {
         const now = Date.now();
         set({ stats, lastUpdatedStats: now, lastUpdated: now });
         // Persist to IndexedDB
         dashboardCache.set('stats', stats, DASHBOARD_CACHE_CONFIG.stats).catch(() => {});
       },
       
       setPromptData: (promptData, sourceEntryCount) => {
         const now = Date.now();
         set({ promptData, promptSourceEntryCount: sourceEntryCount, lastUpdatedPrompts: now, lastUpdated: now });
         dashboardCache.set('prompts', { promptData, sourceEntryCount }, DASHBOARD_CACHE_CONFIG.prompts).catch(() => {});
       },
       
       setPersonalization: (personalization) => {
         const now = Date.now();
         set({ personalization, lastUpdatedPersonalization: now, lastUpdated: now });
         dashboardCache.set('personalization', personalization, DASHBOARD_CACHE_CONFIG.personalization).catch(() => {});
       },
       
       setInsights: (insights) => {
         const now = Date.now();
         set({ insights, lastUpdatedInsights: now, lastUpdated: now });
         dashboardCache.set('insights', insights, DASHBOARD_CACHE_CONFIG.insights).catch(() => {});
       },
       
       // Refresh logic: Check if section is stale based on tiered TTL
       shouldRefresh: (section) => {
         const lastUpdatedKey =
           section === 'stats'
             ? 'lastUpdatedStats'
             : section === 'prompts'
               ? 'lastUpdatedPrompts'
               : section === 'insights'
                 ? 'lastUpdatedInsights'
                 : 'lastUpdatedPersonalization';

         const lastUpdated = get()[lastUpdatedKey];
         if (!lastUpdated) return true; // No data = needs refresh
         
         if (section === 'prompts') {
           // Prompts should also refresh if the day has changed
           const lastFetchDate = new Date(lastUpdated).toISOString().split('T')[0];
           const today = new Date().toISOString().split('T')[0];
           if (lastFetchDate !== today) return true;
         }

         const ttl = DASHBOARD_CACHE_CONFIG[section] * 1000; // Convert to ms
         return Date.now() - lastUpdated > ttl;
       },
       
       // Mark section as just updated
       setSectionUpdated: (section) => {
         const now = Date.now();
         const field = `lastUpdated${section.charAt(0).toUpperCase() + section.slice(1)}`;
         set({ [field]: now, lastUpdated: now } as any);
       },
       
       // Legacy check (backward compatible)
       isFresh: (ttlSeconds = 300) => {
         const lastUpdated = get().lastUpdated;
         if (!lastUpdated) return false;
         return Date.now() - lastUpdated < ttlSeconds * 1000;
       },
       
       // Clear everything
       clear: () => {
         set({
           stats: null,
           promptData: null,
           personalization: null,
           insights: null,
           lastUpdatedStats: 0,
           lastUpdatedPrompts: 0,
           lastUpdatedInsights: 0,
           lastUpdatedPersonalization: 0,
           lastUpdated: 0,
         });
         dashboardCache.clear().catch(() => {});
       },
       
       // Clear specific section
       clearSection: (section) => {
         const field = section.charAt(0).toUpperCase() + section.slice(1);
         const dataField = section === 'prompts' ? 'promptData' : (section === 'personalization' || section === 'spotlightGreeting' ? 'personalization' : section);
         
         set({
           [dataField]: null,
           [`lastUpdated${field}`]: 0,
         } as any);
         
         dashboardCache.delete(section).catch(() => {});
       },

       hydrateFromPersistentCache: async () => {
         try {
           const [stats, prompts, insights, personalization] = await Promise.all([
             dashboardCache.get<any>('stats').catch(() => null),
             dashboardCache.get<any>('prompts').catch(() => null),
             dashboardCache.get<any>('insights').catch(() => null),
             dashboardCache.get<any>('personalization').catch(() => null),
           ]);

           const nextState: Partial<DashboardStoreState> = {};

           if (stats) {
             nextState.stats = stats;
             // Do not overwrite lastUpdatedStats so TTL is respected
           }

           if (prompts) {
             if (prompts.promptData !== undefined) {
               nextState.promptData = prompts.promptData;
               nextState.promptSourceEntryCount = prompts.sourceEntryCount;
             } else {
               nextState.promptData = prompts;
             }
             // Do not overwrite lastUpdatedPrompts so TTL is respected
           }

           if (insights) {
             nextState.insights = insights;
             // Do not overwrite lastUpdatedInsights so TTL is respected
           }

           if (personalization) {
             nextState.personalization = personalization;
             // Do not overwrite lastUpdatedPersonalization so TTL is respected
           }

           if (Object.keys(nextState).length > 0) {
             set({
               ...nextState,
             } as Partial<DashboardStoreState>);
           }
         } catch {
           // Ignore persistent cache hydration failures and fall back to live fetches.
         }
       },
    }),
    {
      name: 'force:dashboard-cache',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        stats: state.stats,
        promptData: state.promptData,
        promptSourceEntryCount: state.promptSourceEntryCount,
        personalization: state.personalization,
        insights: state.insights,
        lastUpdatedStats: state.lastUpdatedStats,
        lastUpdatedPrompts: state.lastUpdatedPrompts,
        lastUpdatedInsights: state.lastUpdatedInsights,
        lastUpdatedPersonalization: state.lastUpdatedPersonalization,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);

export default useDashboardStore;
