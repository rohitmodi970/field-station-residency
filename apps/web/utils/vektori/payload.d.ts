export interface VektoriJournalPayloadParams {
  journalId: string;
  title?: string;
  content?: string;
  mood?: string;
  entryDate?: string;
  createdAt?: string;
  updatedAt?: string;
  eventType?: 'create' | 'update' | 'backfill' | 'upsert' | string;
  corrections?: string[];
}

export interface VektoriJournalMessage {
  role: 'user';
  content: string;
}

export function buildVektoriJournalMessages(
  params: VektoriJournalPayloadParams
): VektoriJournalMessage[];

export interface VektoriOnboardingPayloadParams {
  narrativeReflection: string;
  explicitFacts?: Array<{
    fact: string;
    category?: string;
    source_label?: string;
  }>;
  unresolvedThreads?: Array<{
    topic: string;
    initial_context?: string;
  }>;
  sourceBadges?: string[];
  generatedAt?: string;
}

export function buildVektoriOnboardingMessages(
  params: VektoriOnboardingPayloadParams
): VektoriJournalMessage[];
