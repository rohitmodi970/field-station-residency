import { createAdminClient } from '@/utils/supabase/admin';
import {
  formatVektoriContext,
  getVektoriMetrics,
  getVektoriRuntimeStatus,
  healthCheckVektori,
  ingestVektoriMessages,
  searchVektoriMemory,
} from '@/utils/vektori/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  dedupeContextLines,
  formatLegacyKnowledgeContext,
  formatStoryLensLegacyContext,
  inferMemoryCategories,
  normalizeWhitespace,
  resolveMemorySource,
  scoreLegacyKnowledge,
} from './memoryHelpers.js';
import type {
  CapturePayload,
  MemoryCategory,
  MemoryContextOptions,
  MemoryContextResult,
  MemorySource,
  MemoryWritePath,
  SynthesisPayload,
} from './types';

const STORY_LENS_BROAD_QUERY =
  'values goals relationships routines stress triggers health work focus decisions';

async function isMemoryOptedIn(userId: string): Promise<boolean> {
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('user_settings')
      .select('memory_opt_in')
      .eq('user_id', userId)
      .single();

    return data?.memory_opt_in !== false;
  } catch {
    return true;
  }
}

async function fetchLegacyChatContext(userId: string, queryText: string): Promise<string> {
  try {
    const adminClient = createAdminClient();
    const { data: allKnowledge } = await adminClient
      .from('user_knowledge')
      .select('knowledge_type, category, content, confidence, embedding')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!allKnowledge || allKnowledge.length === 0) return '';

    const scored = scoreLegacyKnowledge(allKnowledge, queryText);
    const memories = scored.filter((i: { knowledge_type?: string }) => i.knowledge_type === 'memory').slice(0, 5);
    const rawItems = scored.filter((i: { knowledge_type?: string }) => i.knowledge_type === 'raw').slice(0, 3);

    return formatLegacyKnowledgeContext([...memories, ...rawItems]);
  } catch (error) {
    console.error('[ForceMemoryService] Legacy chat context fetch error:', error);
    return '';
  }
}

async function fetchJournalHistoricalContext(params: {
  userId: string;
  title: string;
  content: string;
  adminClient: SupabaseClient;
  maxContextChars?: number;
}): Promise<{ context: string; source: MemorySource }> {
  const { userId, title, content, adminClient, maxContextChars = 18000 } = params;
  const entryQuery = normalizeWhitespace(`${title} ${content}`);

  const [vektoriEntry, vektoriBroad, legacyKnowledge] = await Promise.all([
    searchVektoriMemory({
      userId,
      query: entryQuery,
      depth: 'l2',
      contextWindow: 12,
    }),
    searchVektoriMemory({
      userId,
      query: STORY_LENS_BROAD_QUERY,
      depth: 'l2',
      contextWindow: 12,
    }),
    adminClient
      .from('user_knowledge')
      .select('knowledge_type,category,content,confidence,last_seen_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
      .order('last_seen_at', { ascending: false })
      .limit(240),
  ]);

  const contextBlocks: string[] = [];
  let hasVektori = false;

  const vektoriEntryContext = formatVektoriContext(vektoriEntry);
  if (vektoriEntryContext) {
    hasVektori = true;
    contextBlocks.push('VEKTORI MEMORY (ENTRY-RELEVANT):\n' + vektoriEntryContext);
  }

  const vektoriBroadContext = formatVektoriContext(vektoriBroad);
  if (vektoriBroadContext) {
    hasVektori = true;
    contextBlocks.push('VEKTORI MEMORY (GLOBAL USER CONTEXT):\n' + vektoriBroadContext);
  }

  const legacyRows = legacyKnowledge.data || [];
  if (legacyRows.length > 0) {
    const legacyContext = formatStoryLensLegacyContext(legacyRows);
    if (legacyContext) {
      contextBlocks.push(legacyContext);
    }
  }

  if (contextBlocks.length === 0) {
    return { context: '', source: 'none' };
  }

  const deduped = dedupeContextLines(contextBlocks);
  const context =
    deduped.length > maxContextChars ? deduped.slice(0, maxContextChars) : deduped;

  const source: MemorySource = hasVektori ? 'vektori' : legacyRows.length > 0 ? 'legacy' : 'none';
  return { context, source };
}

export class ForceMemoryService {
  async getMemoryContext(
    userId: string,
    queryText: string,
    options: MemoryContextOptions = {}
  ): Promise<MemoryContextResult> {
    const optedIn = await isMemoryOptedIn(userId);
    if (!optedIn) {
      return { context: '', source: 'none', categories: [] };
    }

    if (options.mode === 'journal_analysis') {
      const adminClient = createAdminClient();
      const result = await fetchJournalHistoricalContext({
        userId,
        title: options.title || '',
        content: options.content || queryText,
        adminClient,
        maxContextChars: options.maxContextChars,
      });

      return {
        ...result,
        categories: inferMemoryCategories(result.context) as MemoryCategory[],
      };
    }

    const vektoriResult = await searchVektoriMemory({
      userId,
      query: queryText,
      depth: options.depth || 'l1',
      contextWindow: options.contextWindow ?? 2,
    });

    const vektoriContext = formatVektoriContext(vektoriResult);
    const legacyContext = vektoriContext ? '' : await fetchLegacyChatContext(userId, queryText);
    const resolved = resolveMemorySource(vektoriContext, legacyContext);

    return {
      context: resolved.context,
      source: resolved.source as MemorySource,
      categories: inferMemoryCategories(resolved.context) as MemoryCategory[],
    };
  }

  /**
   * Capture path — high-frequency messaging-layer writes (chat, Photon).
   * Records mechanical, preference, and raw narrative signals.
   */
  async captureMessage(userId: string, payload: CapturePayload): Promise<boolean> {
    if (!(await isMemoryOptedIn(userId))) return false;

    const mappedMessages = payload.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    return ingestVektoriMessages({
      userId,
      sessionId: payload.sessionId,
      messages: mappedMessages,
    });
  }

  /**
   * Synthesis path — journal/reflection writes that distill captured moments.
   * Produces confirmed narrative and reflective memory.
   */
  async ingestJournalMessage(userId: string, payload: SynthesisPayload): Promise<boolean> {
    if (!(await isMemoryOptedIn(userId))) return false;

    const lines = [
      payload.title ? `Journal: ${payload.title}` : '',
      payload.content ? `Entry:\n${payload.content}` : '',
      payload.analysisSummary ? `Synthesis:\n${payload.analysisSummary}` : '',
      payload.insights?.length ? `Insights:\n${payload.insights.map((i) => `- ${i}`).join('\n')}` : '',
    ].filter(Boolean);

    if (lines.length === 0) return false;

    const sessionId = payload.journalId ? `journal-synthesis:${payload.journalId}` : 'journal-synthesis';

    return ingestVektoriMessages({
      userId,
      sessionId,
      messages: [
        {
          role: 'system',
          content: 'Force Agent synthesis path — narrative and reflective memory update.',
        },
        {
          role: 'user',
          content: lines.join('\n\n'),
        },
      ],
    });
  }

  async persistAgentOutcome(
    userId: string,
    outcome: { summary: string; tool?: string; success?: boolean }
  ): Promise<boolean> {
    if (!(await isMemoryOptedIn(userId))) return false;

    return ingestVektoriMessages({
      userId,
      sessionId: `agent-outcome:${outcome.tool || 'unknown'}`,
      messages: [
        {
          role: 'assistant',
          content: `[Agent ${outcome.tool || 'action'}] ${outcome.summary}${outcome.success === false ? ' (failed)' : ''}`,
        },
      ],
    });
  }

  getWritePathForSource(source: CapturePayload['source']): MemoryWritePath {
    return source === 'chat' || source === 'photon' || source === 'messaging' ? 'capture' : 'capture';
  }

  async healthCheck(): Promise<{ ok: boolean; vektori: Awaited<ReturnType<typeof healthCheckVektori>> }> {
    const vektori = await healthCheckVektori();
    return { ok: vektori.ok, vektori };
  }

  getMemorySourceDiagnostics() {
    return {
      vektori: getVektoriRuntimeStatus(),
      metrics: getVektoriMetrics(),
    };
  }
}

export const forceMemoryService = new ForceMemoryService();
