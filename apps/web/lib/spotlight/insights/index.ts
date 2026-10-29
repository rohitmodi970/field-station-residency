/**
 * Spotlight Insights Module
 * 
 * Exports insight generators and orchestrator for the AI Spotlight system.
 */

// Types
export * from './types';

// Generators
export { generateJournalInsights, fetchJournalAnalysisData, aggregateJournalData } from './journal-generator';
export { generateWaitlistInsights, fetchWaitlistData } from './waitlist-generator';

// Orchestrator
export { orchestrateInsights, type OrchestratedInsights } from './orchestrator';

// Default export is the orchestrator
export { default } from './orchestrator';
