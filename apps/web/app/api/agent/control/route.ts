import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  forceAgentOrchestrator,
  forceMemoryService,
  checkAllToolsHealth,
  toolRegistry,
} from '@/lib/force-agent';
import type { ForceAgentHealthSummary, MemoryCategory } from '@/lib/force-agent/types';

// In-memory telemetry cache for reflective offer metrics and recent agent events
// Can be backed by supabase when tables are available
interface ReflectiveOffer {
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

interface AgentAuditEvent {
  id: string;
  timestamp: string;
  type: 'capture' | 'synthesis' | 'external_action' | 'feedback' | 'health_check';
  source: string;
  summary: string;
  details?: Record<string, unknown>;
  status: 'success' | 'warning' | 'info';
}

const recentReflectiveOffers: Map<string, ReflectiveOffer[]> = new Map();
const recentAuditEvents: AgentAuditEvent[] = [];

function recordAuditEvent(event: Omit<AgentAuditEvent, 'id' | 'timestamp'>) {
  const fullEvent: AgentAuditEvent = {
    ...event,
    id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  recentAuditEvents.unshift(fullEvent);
  if (recentAuditEvents.length > 50) {
    recentAuditEvents.pop();
  }
}

// Pre-seed sample narrative/reflective items for demo sequence if user is new
function getOrCreateUserOffers(userId: string): ReflectiveOffer[] {
  if (!recentReflectiveOffers.has(userId)) {
    const defaultOffers: ReflectiveOffer[] = [
      {
        id: `offer-1-${userId.slice(0, 6)}`,
        userId,
        category: 'reflective',
        title: 'Outdoor Time & Mood Continuity',
        observation: 'Over the past several weeks, you consistently report feeling most grounded and clear-headed on days with at least 30 minutes outdoors before noon.',
        evidence: [
          'Mentioned feeling refreshed after morning walk in Tuesday journal',
          'Noted high creative flow on days with outdoor movement',
        ],
        suggestedAction: 'Keep a gentle 20-minute morning outdoor window on low-energy days',
        status: 'pending',
        createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      },
      {
        id: `offer-2-${userId.slice(0, 6)}`,
        userId,
        category: 'narrative',
        title: 'Repairing Long-term Creative Collaborations',
        observation: 'You have been carrying a standing intention to reconnect with past creative peers without feeling rushed or transactional.',
        evidence: [
          'Referenced unread message from Marcus last Thursday',
          'Noted wanting to share updates on ongoing project',
        ],
        suggestedAction: 'Send one calm, open-ended check-in note this weekend',
        status: 'accepted',
        createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
        respondedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
      },
    ];
    recentReflectiveOffers.set(userId, defaultOffers);
  }
  return recentReflectiveOffers.get(userId) || [];
}

/**
 * GET /api/agent/control
 * Returns comprehensive Force Agent Control Center status, health, memory categories, and telemetry.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || 'demo-user';

    const [healthSummary, diagnostics] = await Promise.all([
      forceAgentOrchestrator.getHealthSummary(),
      Promise.resolve(forceMemoryService.getMemorySourceDiagnostics()),
    ]);

    const userOffers = getOrCreateUserOffers(userId);
    const totalDecided = userOffers.filter((o) => o.status !== 'pending').length;
    const acceptedCount = userOffers.filter((o) => o.status === 'accepted').length;
    const refinedCount = userOffers.filter((o) => o.status === 'refined').length;
    const dismissedCount = userOffers.filter((o) => o.status === 'dismissed').length;
    const acceptanceRate = totalDecided > 0 ? Math.round(((acceptedCount + refinedCount * 0.5) / totalDecided) * 100) : 100;

    // Categorized memory snapshot (Four Categories from Section 2.1)
    const memoryCategories: Record<MemoryCategory, { title: string; tier: string; description: string; count: number; samples: string[] }> = {
      mechanical: {
        title: 'Mechanical Memory',
        tier: 'Tier 1 · Commodity',
        description: 'Deadlines, renewal dates, anniversaries, and expiry timelines.',
        count: 4,
        samples: [
          'Passport expires in November 2026',
          'Domain renewal for personal site due on the 15th',
          'Quarterly review sync scheduled for Friday 3 PM',
        ],
      },
      preference: {
        title: 'Preference Memory',
        tier: 'Tier 2 · Commodity',
        description: 'Standing habits, coffee/tea choices, work environment, and communication styles.',
        count: 6,
        samples: [
          'Prefers oat milk flat white with cinnamon',
          'Deep work preferred in mornings without back-to-back meetings',
          'Prefers async summaries over ad-hoc video calls',
        ],
      },
      narrative: {
        title: 'Narrative Memory',
        tier: 'Tier 3 · Force Territory',
        description: 'Standing intentions, ongoing life threads, and relationships currently in motion.',
        count: 5,
        samples: [
          'Working through boundary setting with family members',
          'Standing intention to complete the architecture transition by Q3',
          'Exploring deeper writing habits on weekends',
        ],
      },
      reflective: {
        title: 'Reflective Memory',
        tier: 'Tier 4 · Force Territory',
        description: 'Patterns synthesized across time, offered quietly for user reflection rather than as directives.',
        count: userOffers.length,
        samples: userOffers.map((o) => o.observation),
      },
    };

    const orchestratorTraces = forceAgentOrchestrator.getAgentTraces({ limit: 30 });
    const orchestratorAuditEvents = forceAgentOrchestrator.getAuditEvents({ limit: 30 });
    const allAuditEvents = [...orchestratorAuditEvents, ...recentAuditEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 40);

    return NextResponse.json({
      health: healthSummary,
      diagnostics,
      telemetry: {
        acceptanceRate,
        totalOffers: userOffers.length,
        acceptedCount,
        refinedCount,
        dismissedCount,
        pendingCount: userOffers.filter((o) => o.status === 'pending').length,
        dualWritePaths: {
          capturePath: {
            name: 'Capture Path (Messaging Layer)',
            triggers: ['Chat turns', 'Photon webhook messages'],
            targetCategories: ['Mechanical', 'Preference', 'Raw Narrative'],
            frequency: 'High-frequency, low-latency',
            status: 'active',
          },
          synthesisPath: {
            name: 'Synthesis Path (Journal & Reflection)',
            triggers: ['Journal analysis', 'Periodic pattern synthesis'],
            targetCategories: ['Confirmed Narrative', 'Reflective Insights'],
            frequency: 'Periodic, high-synthesis',
            status: 'active',
          },
        },
      },
      memoryCategories,
      reflectiveOffers: userOffers,
      traces: orchestratorTraces,
      auditEvents: allAuditEvents,
    });
  } catch (error: unknown) {
    console.error('[Agent Control API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Control center status query failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/control
 * Executes control actions: health check, reflective feedback, on-demand reflective synthesis, or tool testing.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'demo-user';

    const body = await request.json();
    const action = body.action || body.type;

    // 1. Health check action
    if (action === 'health') {
      const summary = await forceAgentOrchestrator.getHealthSummary();
      recordAuditEvent({
        type: 'health_check',
        source: 'orchestrator',
        summary: `Health check executed: status is ${summary.status}`,
        details: { status: summary.status },
        status: summary.status === 'healthy' ? 'success' : 'warning',
      });
      return NextResponse.json({ ok: true, health: summary });
    }

    // 2. Reflective offer feedback (Accept / Refine / Dismiss)
    if (action === 'reflective_feedback') {
      const { offerId, decision, userNote } = body;
      if (!offerId || !decision || !['accepted', 'refined', 'dismissed'].includes(decision)) {
        return NextResponse.json(
          { error: 'Valid offerId and decision (accepted | refined | dismissed) required' },
          { status: 400 }
        );
      }

      const offers = getOrCreateUserOffers(userId);
      const target = offers.find((o) => o.id === offerId);
      if (target) {
        target.status = decision;
        target.respondedAt = new Date().toISOString();
        if (userNote) target.userNote = userNote;
      }

      // Persist outcome into memory
      await forceMemoryService.persistAgentOutcome(userId, {
        tool: 'reflective_synthesis',
        summary: `User ${decision} reflective observation: "${target?.title || offerId}"${userNote ? ` (Note: ${userNote})` : ''}`,
        success: true,
      });

      recordAuditEvent({
        type: 'feedback',
        source: 'reflective_synthesis',
        summary: `Reflective offer marked as ${decision}: "${target?.title || offerId}"`,
        details: { offerId, decision, userNote },
        status: 'success',
      });

      return NextResponse.json({
        ok: true,
        offerId,
        decision,
        updatedOffer: target,
      });
    }

    // 3. On-demand Reflective Synthesis (Demo Sequence #6)
    if (action === 'reflective_synthesis') {
      const contextResult = await forceMemoryService.getMemoryContext(userId, 'patterns reflections growth habits energy', {
        mode: 'chat',
        depth: 'l2',
        contextWindow: 6,
      });

      const newOffer: ReflectiveOffer = {
        id: `offer-${Date.now()}`,
        userId,
        category: 'reflective',
        title: body.title || 'Weekly Energy & Focus Pattern',
        observation: body.observation || 'When you prioritize calm reflection in the morning, your afternoon task completion and mood resilience remain consistently elevated.',
        evidence: [
          'Grounded in recent journal and chat sessions',
          contextResult.context ? `Memory source: ${contextResult.source}` : 'Synthesized across captured moments',
        ],
        suggestedAction: 'Keep 10 minutes reserved for quiet journaling before reviewing tasks',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const offers = getOrCreateUserOffers(userId);
      offers.unshift(newOffer);

      recordAuditEvent({
        type: 'synthesis',
        source: 'memoryService',
        summary: `New Category-4 reflective offer synthesized: "${newOffer.title}"`,
        details: { offerId: newOffer.id, source: contextResult.source },
        status: 'info',
      });

      return NextResponse.json({
        ok: true,
        newOffer,
        memorySource: contextResult.source,
      });
    }

    // 4. Memory query
    if (action === 'memory_query') {
      const queryText = body.query || '';
      const memoryResult = await forceMemoryService.getMemoryContext(userId, queryText);
      return NextResponse.json({
        ok: true,
        context: memoryResult.context,
        source: memoryResult.source,
        categories: memoryResult.categories,
      });
    }

    // 5. AI Task Generation (Orchestrator delegation)
    if (action === 'task_generation') {
      const result = await forceAgentOrchestrator.handle({
        userId,
        type: 'ai_task_generation',
        entryText: body.journalEntry,
        query: body.query,
        systemContext: body.systemContext,
      });

      recordAuditEvent({
        type: 'external_action',
        source: 'ai_task_generation',
        summary: `Generated ${result.tasks?.length || 0} memory-grounded tasks`,
        details: { memorySource: result.memorySource },
        status: 'success',
      });

      return NextResponse.json({
        ok: true,
        tasks: result.tasks || [],
        memorySource: result.memorySource,
        usage: result.usage,
      });
    }

    // 6. Trace management
    if (action === 'clear_traces') {
      forceAgentOrchestrator.clearTraces();
      return NextResponse.json({ ok: true, cleared: true });
    }

    if (action === 'record_trace' && body.trace) {
      forceAgentOrchestrator.recordTrace(body.trace);
      return NextResponse.json({ ok: true, recorded: true });
    }

    // 7. Generic Orchestrator delegation fallback
    const result = await forceAgentOrchestrator.handle({
      userId,
      type: body.type || 'agent_control',
      messages: body.messages,
      entryText: body.entryText,
      query: body.query,
      tool: body.tool,
      metadata: body.metadata || body,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[Agent Control API POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent control execution failed' },
      { status: 500 }
    );
  }
}
