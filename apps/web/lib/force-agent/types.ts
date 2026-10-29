export type ForceAgentRequestType =
  | 'chat'
  | 'journal_analysis'
  | 'ai_task_generation'
  | 'external_action'
  | 'memory_query'
  | 'agent_control'
  | 'external_ingest'
  | 'social_interaction';

export type MemorySource = 'vektori' | 'legacy' | 'none';

export type MemoryWritePath = 'capture' | 'synthesis';

/** Four memory tiers from product philosophy (v1.2). */
export type MemoryCategory = 'mechanical' | 'preference' | 'narrative' | 'reflective';

export interface ForceAgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<Record<string, unknown>>;
  toolExecution?: ToolExecutionData;
  toolExecutions?: ToolExecutionData[];
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  formattedAddress?: string;
  timezone?: string;
  timestamp?: number;
}

export interface SocialMessagingContext {
  platform: 'whatsapp' | 'imessage' | 'telegram' | 'sms';
  senderId: string;
  senderName?: string;
  messageId: string;
  mediaType?: 'text' | 'voice' | 'image' | 'document';
  mediaUrl?: string;
  audioTranscript?: string;
  recentThreadTurns?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export interface ForceAgentRequest {
  userId: string;
  type: ForceAgentRequestType;
  messages?: ForceAgentMessage[];
  journalId?: string;
  entryText?: string;
  query?: string;
  systemContext?: string;
  tool?: string;
  sessionId?: string;
  decryptedJournals?: any[];
  decryptedTodos?: any[];
  location?: UserLocation;
  socialContext?: SocialMessagingContext;
  activeBackgroundTask?: {
    id?: string;
    sourceSessionId?: string;
    sourceSessionTitle?: string;
    taskType?: string;
    goal?: string;
    currentAction?: string;
    status?: string;
    targetUrl?: string;
    steps?: string[];
    outcome?: any;
  };
  previousSessionContext?: {
    previousSessionId?: string;
    previousSessionTitle?: string;
    lastUserMessage?: string;
    lastAssistantMessage?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ForceAgentUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface ToolExecutionData {
  tool:
    | 'tinyfish'
    | 'task_generation'
    | 'reflective_synthesis'
    | 'memory_query'
    | 'journal_analysis'
    | 'journal_read'
    | 'journal_created'
    | 'todo_list'
    | 'todo_updated'
    | 'memory_saved'
    | 'user_stats'
    | 'real_world_action'
    | 'user_location'
    | 'web_search'
    | 'unsupported'
    | string;
  status: 'success' | 'running' | 'failed' | 'unsupported';
  title?: string;
  message?: string;
  durationMs?: number;
  data?: Record<string, any>;
  narrative?: string;
}

export interface ForceAgentResult {
  type: ForceAgentRequestType;
  message?: string;
  tasks?: unknown[];
  analysis?: unknown;
  actionOutcome?: unknown;
  toolExecution?: ToolExecutionData;
  toolExecutions?: ToolExecutionData[];
  suggestedTitle?: string;
  memorySource: MemorySource;
  usage?: ForceAgentUsage;
  errors?: string[];
  outboundSocialReply?: {
    platform: 'whatsapp' | 'imessage' | 'telegram' | 'sms';
    recipientId: string;
    text: string;
    mediaUrl?: string;
  };
  sideEffects?: {
    journalSaved?: boolean;
    taskCreated?: boolean;
    taskScratchpadUpdated?: boolean;
    energyPulseUpdated?: boolean;
    toolLaunched?: string;
    sidequestCoordination?: boolean;
  };
}

export interface MemoryContextOptions {
  depth?: 'l0' | 'l1' | 'l2';
  contextWindow?: number;
  /** chat = single-query retrieval; journal_analysis = entry + broad context */
  mode?: 'chat' | 'journal_analysis';
  maxContextChars?: number;
  title?: string;
  content?: string;
}

export interface MemoryContextResult {
  context: string;
  source: MemorySource;
  /** Internal category hints for diagnostics / future transparency UI. */
  categories: MemoryCategory[];
}

export interface CapturePayload {
  sessionId: string;
  messages: ForceAgentMessage[];
  source?: 'chat' | 'photon' | 'messaging';
}

export interface SynthesisPayload {
  journalId?: string;
  title?: string;
  content: string;
  analysisSummary?: string;
  insights?: string[];
}

export interface ToolHealth {
  ok: boolean;
  name: string;
  error?: string;
  latencyMs?: number;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ToolAdapter<TParams = unknown, TData = unknown> {
  name: string;
  execute(params: TParams): Promise<ToolResult<TData>>;
  health(): Promise<ToolHealth>;
}

export interface ChatPromptInput {
  systemContext?: string;
  memoryContext?: string;
}

export interface AnalysisPromptInput {
  title: string;
  content: string;
  analysisType: string;
  historicalContext?: string;
}

export interface TaskPromptInput {
  journalEntry?: string;
  query?: string;
  memoryContext?: string;
  systemContext?: string;
}

export interface AutomationPromptInput {
  eventUrl?: string;
  memoryContext?: string;
  goal?: string;
}

export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ClaudeMessageParams {
  system?: string;
  messages: ForceAgentMessage[];
  maxTokens?: number;
  temperature?: number;
  tools?: ClaudeToolDefinition[];
}

export interface ClaudeToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeMessageResult {
  text: string;
  usage: ForceAgentUsage;
  toolCalls?: ClaudeToolCall[];
  stopReason?: string;
}

export interface TinyfishAgentProfile {
  name: string;
  email: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  company?: string;
  role?: string;
  phone?: string;
  website?: string;
  customAnswers?: Record<string, string>;
}

export interface TinyfishExecuteParams {
  action?: 'stream' | 'goal' | 'persist';
  url?: string;
  eventUrl?: string;
  goal?: string;
  prompt?: string;
  taskType?: 'research' | 'action' | 'registration' | 'browse';
  profile?: TinyfishAgentProfile;
  userId?: string;
  payload?: {
    url?: string;
    eventUrl?: string;
    runId?: string;
    status: 'SUCCESS' | 'FAILED';
    message: string;
    result?: Record<string, unknown> | null;
  };
}

export interface PhotonExecuteParams {
  action?: 'verify' | 'process' | 'ingest';
  rawBody?: Buffer;
  timestamp?: string;
  signature?: string;
  payload?: Record<string, unknown>;
  adminClient?: unknown;
}

export interface ForceAgentHealthSummary {
  status: 'healthy' | 'degraded' | 'unhealthy';
  memory: {
    ok: boolean;
    vektori: {
      ok: boolean;
      status?: number | string;
      error?: string;
      storeCount?: number;
    };
  };
  tools: Record<string, ToolHealth>;
}

/** Phase 4: Persisted Agent Execution Trace */
export interface AgentTrace {
  id: string;
  timestamp: string;
  userId: string;
  requestType: ForceAgentRequestType;
  query?: string;
  latencyMs: number;
  memoryTier?: 'l0' | 'l1' | 'l2';
  memorySource: MemorySource;
  toolInvoked?: string;
  status: 'success' | 'fallback' | 'error';
  tokenUsage?: ForceAgentUsage;
  metadata?: Record<string, unknown>;
}

/** Phase 4: External Action Audit Log Event */
export interface AgentAuditEvent {
  id: string;
  timestamp: string;
  userId?: string;
  type: 'capture' | 'synthesis' | 'external_action' | 'feedback' | 'health_check';
  source: string;
  summary: string;
  details?: Record<string, unknown>;
  status: 'success' | 'warning' | 'info' | 'error';
}

/** Phase 4: Reflective Offer Item */
export interface ReflectiveOfferItem {
  id: string;
  userId: string;
  category: 'reflective' | 'narrative';
  title: string;
  observation: string;
  evidence: string[];
  suggestedAction?: string;
  status: 'pending' | 'accepted' | 'refined' | 'dismissed';
  userNote?: string;
  createdAt: string;
  respondedAt?: string;
}

/** Phase 4: Reflective Insight Acceptance Rate Metrics */
export interface ReflectiveInsightMetrics {
  totalOffers: number;
  acceptedCount: number;
  refinedCount: number;
  dismissedCount: number;
  pendingCount: number;
  acceptanceRate: number; // 0 - 100%
}

/** Phase 4: Memory Category Diagnostic Breakdown */
export interface MemoryCategoryDiagnostic {
  category: MemoryCategory;
  title: string;
  tier: string;
  description: string;
  count: number;
  samples: string[];
  healthStatus: 'healthy' | 'degraded' | 'uncalibrated';
}

