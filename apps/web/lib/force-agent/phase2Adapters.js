import {
  buildAnalysisPrompt,
  buildAutomationPrompt,
  buildChatPrompt,
  buildForcePersona,
  buildGoal,
  buildUniversalGoal,
  buildTaskPrompt,
  inferMemoryCategories,
  normalizeEventUrl,
  resolveMemorySource,
  toCleanText,
  verifySignature,
} from './memoryHelpers.js';

export const tinyfishAdapter = {
  name: 'tinyfish',
  async execute(params) {
    try {
      const action = params.action || (params.profile || params.goal || params.prompt ? 'stream' : 'goal');
      if (action === 'goal') {
        const targetUrl =
          params.url ||
          params.eventUrl ||
          (params.prompt ? `https://www.google.com/search?q=${encodeURIComponent(params.prompt)}` : 'https://www.google.com');
        const isRegistration = params.taskType === 'registration' || targetUrl.includes('lu.ma') || targetUrl.includes('luma');
        if (isRegistration && !params.profile && !params.goal && !params.prompt) {
          return { ok: false, error: 'Profile is required to build TinyFish goal' };
        }
        const goal =
          params.goal ||
          buildUniversalGoal({
            prompt: params.prompt,
            url: targetUrl,
            profile: params.profile,
            taskType: params.taskType,
          });
        return { ok: true, data: { goal, url: targetUrl, eventUrl: targetUrl } };
      }
      if (action === 'persist') {
        return { ok: true, data: { persisted: true } };
      }
      if (action === 'stream') {
        const targetUrl =
          params.url ||
          params.eventUrl ||
          (params.prompt ? `https://www.google.com/search?q=${encodeURIComponent(params.prompt)}` : 'https://www.google.com');
        const isRegistration = params.taskType === 'registration' || targetUrl.includes('lu.ma') || targetUrl.includes('luma');
        if (isRegistration && !params.profile) {
          return { ok: false, error: 'Profile is required to create registration stream' };
        }
        return { ok: true, data: { stream: {}, url: targetUrl } };
      }
      return { ok: false, error: `Unsupported action "${action}"` };
    } catch (error) {
      return { ok: false, error: error.message || 'TinyFish execution failed' };
    }
  },
  async health() {
    const started = Date.now();
    const apiKey = process.env.TINYFISH_API_KEY;
    const configured = Boolean(apiKey && apiKey !== 'your_tinyfish_api_key_here');
    return {
      ok: configured,
      name: 'tinyfish',
      error: configured ? undefined : 'TINYFISH_API_KEY is not configured',
      latencyMs: Date.now() - started,
    };
  },
};

export const photonAdapter = {
  name: 'photon',
  async execute(params) {
    try {
      const action = params.action || 'process';
      if (action === 'verify') {
        if (!params.rawBody || !params.timestamp || !params.signature) {
          return { ok: false, error: 'rawBody, timestamp, and signature are required for verification' };
        }
        const valid = verifySignature(
          params.rawBody,
          params.timestamp,
          params.signature,
          process.env.WEBHOOK_SECRET || process.env.PHOTON_WEBHOOK_SECRET || 'secret'
        );
        return { ok: valid, data: { valid } };
      }
      if (action === 'process' || action === 'ingest') {
        if (!params.payload) {
          return { ok: false, error: 'payload is required for message processing' };
        }
        return { ok: true, data: { ok: true, handled: true, payload: params.payload } };
      }
      return { ok: false, error: `Unsupported action "${action}"` };
    } catch (error) {
      return { ok: false, error: error.message || 'Photon execution failed' };
    }
  },
  async health() {
    const started = Date.now();
    const secret = process.env.WEBHOOK_SECRET || process.env.PHOTON_WEBHOOK_SECRET;
    const configured = Boolean(secret);
    return {
      ok: configured,
      name: 'photon',
      error: configured ? undefined : 'WEBHOOK_SECRET or PHOTON_WEBHOOK_SECRET is not configured',
      latencyMs: Date.now() - started,
    };
  },
};

export const vektoriAdapter = {
  name: 'vektori',
  async execute(params) {
    if (params.action === 'status') {
      return { ok: true, data: { status: 'mock_active' } };
    }
    if (params.action === 'metrics') {
      return { ok: true, data: { totalRequests: 0 } };
    }
    return { ok: true, data: { result: 'vektori_mock_ok' } };
  },
  async health() {
    return {
      ok: true,
      name: 'vektori',
      latencyMs: 1,
    };
  },
};

export const anthropicAdapter = {
  name: 'anthropic',
  async execute(params) {
    return {
      ok: true,
      data: {
        text: 'mock_anthropic_response',
        usage: { input_tokens: 10, output_tokens: 20 },
      },
    };
  },
  async health() {
    const configured = Boolean(process.env.ANTHROPIC_API_KEY);
    return {
      ok: configured,
      name: 'anthropic',
      error: configured ? undefined : 'ANTHROPIC_API_KEY missing',
      latencyMs: 1,
    };
  },
};

export const toolRegistry = {
  anthropic: anthropicAdapter,
  vektori: vektoriAdapter,
  tinyfish: tinyfishAdapter,
  photon: photonAdapter,
};

export function getToolAdapter(name) {
  return toolRegistry[(name || '').toLowerCase()];
}

export async function checkAllToolsHealth() {
  const entries = Object.entries(toolRegistry);
  const healthResults = await Promise.all(
    entries.map(async ([key, adapter]) => {
      try {
        const health = await adapter.health();
        return [key, health];
      } catch (error) {
        return [
          key,
          {
            ok: false,
            name: adapter.name,
            error: error.message || 'Health check failed',
          },
        ];
      }
    })
  );

  return Object.fromEntries(healthResults);
}

export class ForceAgentOrchestratorRunner {
  constructor(options = {}) {
    this.memoryContextMock = options.memoryContextMock || 'WHAT I KNOW ABOUT YOU:\n- Loves hiking';
    this.traces = [];
    this.auditEvents = [];
  }

  recordTrace(trace) {
    this.traces.unshift(trace);
    if (this.traces.length > 100) this.traces.pop();
  }

  getAgentTraces(options = {}) {
    let filtered = this.traces;
    if (options.userId) filtered = filtered.filter((t) => t.userId === options.userId);
    if (options.requestType) filtered = filtered.filter((t) => t.requestType === options.requestType);
    return filtered.slice(0, options.limit || 50);
  }

  clearTraces() {
    this.traces = [];
  }

  recordAuditEvent(event) {
    const fullEvent = {
      ...event,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditEvents.unshift(fullEvent);
    if (this.auditEvents.length > 100) this.auditEvents.pop();
    return fullEvent;
  }

  getAuditEvents(options = {}) {
    let filtered = this.auditEvents;
    if (options.type) filtered = filtered.filter((e) => e.type === options.type);
    if (options.source) filtered = filtered.filter((e) => e.source === options.source);
    return filtered.slice(0, options.limit || 50);
  }

  clearAuditEvents() {
    this.auditEvents = [];
  }

  async handle(request) {
    const startedAt = Date.now();
    let result;

    try {
      switch (request.type) {
        case 'chat': {
          if (!request.messages || request.messages.length === 0) {
            result = { type: 'chat', memorySource: 'none', errors: ['Messages array is required'] };
            break;
          }
          const lastUserMsg = [...request.messages].reverse().find((m) => m.role === 'user')?.content || '';
          const trimmed = lastUserMsg.trim();
          const lower = trimmed.toLowerCase();

          // 1. TinyFish Universal Browser Intent
          const urlMatch = trimmed.match(/https?:\/\/[^\s<>"')]+/i);
          if (urlMatch || lower.includes('register me for') || lower.includes('luma event') || /\b(use tinyfish|browse the web|search the web)\b/i.test(trimmed)) {
            const targetUrl = urlMatch ? urlMatch[0] : 'https://lu.ma/event';
            const isLuma = /lu\.ma|luma\.com/i.test(targetUrl);
            result = {
              type: 'chat',
              message: `I noticed you'd like to execute a browser action for: **${targetUrl}**. I have prepared the TinyFish browser automation tool below.`,
              toolExecution: {
                tool: 'tinyfish',
                status: 'running',
                title: isLuma ? 'TinyFish Event Registration' : 'TinyFish Browser Automation',
                data: { url: targetUrl, eventUrl: targetUrl },
              },
              memorySource: 'none',
            };
            break;
          }

          // 2. Unsupported external actions
          const isUnsupported = /\b(book|reserve)\s+(a\s+)?(flight|hotel)\b|\b(order|buy)\s+(a\s+)?(pizza|food|groceries)\b|\b(send|draft)\s+(an\s+)?email\b/i.test(trimmed);
          if (isUnsupported) {
            result = {
              type: 'chat',
              message: `I don't currently have a tool adapter for that external action. Active capabilities include Luma event registration, grounded task creation, reflective pattern synthesis, and memory recall.`,
              toolExecution: {
                tool: 'unsupported',
                status: 'unsupported',
                title: 'Capability Not Available',
                message: 'Action is not currently supported.',
              },
              memorySource: 'none',
            };
            break;
          }

          // 3. Task / Todo creation intent
          if (/\b(add|create|make)\s+(a\s+)?(task|todo|to-do|reminder)\b|^(remind me to|todo:)\s+/i.test(trimmed)) {
            const taskTitle = trimmed.replace(/^(please\s+)?(can you\s+)?(add|create|make)\s+(a\s+)?(task|todo|to-do|reminder)\s+(to\s+)?/i, '').trim() || 'New Action Item';
            result = {
              type: 'chat',
              message: `I have noted this task for you: **"${taskTitle}"**.`,
              toolExecution: {
                tool: 'task_generation',
                status: 'success',
                title: 'Task Created',
                data: { title: taskTitle, priority: 'medium' },
              },
              memorySource: 'none',
            };
            break;
          }

          // 4. Reflective Pattern Synthesis Intent
          if (/\b(patterns?|synthesis|synthesize|trends?)\b/i.test(trimmed) && /\b(notice|spotted|recent|week|journals?)\b/i.test(trimmed)) {
            result = {
              type: 'chat',
              message: `Looking across your recent entries, here is a pattern that has surfaced.`,
              toolExecution: {
                tool: 'reflective_synthesis',
                status: 'success',
                title: 'Category 4 Reflective Pattern',
                data: {
                  offerId: `offer-${Date.now()}`,
                  observation: 'Over your recent reflections, creative energy remains highest when morning quiet time is preserved.',
                },
              },
              memorySource: 'vektori',
            };
            break;
          }

          const prompt = buildChatPrompt({
            systemContext: request.systemContext,
            memoryContext: this.memoryContextMock,
          });
          const llmResult = await anthropicAdapter.execute({ system: prompt, messages: request.messages });
          result = {
            type: 'chat',
            message: llmResult.data?.text,
            memorySource: 'legacy',
            usage: llmResult.data?.usage,
          };
          break;
        }
        case 'journal_analysis': {
          if (!request.entryText && !request.metadata?.title) {
            result = {
              type: 'journal_analysis',
              memorySource: 'none',
              errors: ['Missing journal content for analysis'],
            };
            break;
          }
          const prompt = buildAnalysisPrompt({
            title: request.metadata?.title || 'Entry',
            content: request.entryText || '',
            analysisType: request.metadata?.analysisType || 'combined',
            historicalContext: this.memoryContextMock,
          });
          result = {
            type: 'journal_analysis',
            analysis: { summary: 'Analysis completed', promptSnippet: prompt.slice(0, 50) },
            memorySource: 'vektori',
          };
          break;
        }
        case 'ai_task_generation': {
          const prompt = buildTaskPrompt({
            journalEntry: request.entryText,
            query: request.query,
            memoryContext: this.memoryContextMock,
            systemContext: request.systemContext,
          });
          result = {
            type: 'ai_task_generation',
            tasks: [{ title: 'Grounded Next Step', priority: 'high' }],
            memorySource: 'vektori',
          };
          break;
        }
        case 'external_action': {
          const toolName = request.tool || request.metadata?.tool || 'tinyfish';
          const adapter = getToolAdapter(toolName);
          if (!adapter) {
            result = { type: 'external_action', memorySource: 'none', errors: [`Tool adapter "${toolName}" not found`] };
            break;
          }
          const toolResult = await adapter.execute(request.metadata || {});
          if (!toolResult.ok) {
            result = {
              type: 'external_action',
              memorySource: 'none',
              actionOutcome: toolResult.data,
              errors: [toolResult.error || `Tool "${toolName}" execution failed`],
            };
            break;
          }
          result = { type: 'external_action', actionOutcome: toolResult.data, memorySource: 'none' };
          break;
        }
        case 'external_ingest': {
          const toolName = request.tool || 'photon';
          const adapter = getToolAdapter(toolName);
          if (!adapter) {
            result = { type: 'external_ingest', memorySource: 'none', errors: [`Ingest adapter "${toolName}" not found`] };
            break;
          }
          const toolResult = await adapter.execute(request.metadata || {});
          if (!toolResult.ok) {
            result = {
              type: 'external_ingest',
              memorySource: 'none',
              actionOutcome: toolResult.data,
              errors: [toolResult.error || `Ingest adapter "${toolName}" failed`],
            };
            break;
          }
          result = { type: 'external_ingest', actionOutcome: toolResult.data, memorySource: 'none' };
          break;
        }
        case 'memory_query': {
          const categories = inferMemoryCategories(this.memoryContextMock);
          result = {
            type: 'memory_query',
            message: this.memoryContextMock,
            memorySource: 'vektori',
            actionOutcome: { categories },
          };
          break;
        }
        case 'agent_control': {
          const action = request.metadata?.action || 'health';
          if (action === 'diagnostics') {
            result = {
              type: 'agent_control',
              memorySource: 'none',
              actionOutcome: { vektori: 'active', metrics: { count: 42 } },
            };
            break;
          }
          if (action === 'traces') {
            const traces = this.getAgentTraces({
              userId: request.userId,
              limit: request.metadata?.limit || 50,
              requestType: request.metadata?.requestType,
            });
            result = {
              type: 'agent_control',
              memorySource: 'none',
              actionOutcome: { traces },
            };
            break;
          }
          if (action === 'audit_logs') {
            const auditEvents = this.getAuditEvents({
              limit: request.metadata?.limit || 50,
              type: request.metadata?.type,
              source: request.metadata?.source,
            });
            result = {
              type: 'agent_control',
              memorySource: 'none',
              actionOutcome: { auditEvents },
            };
            break;
          }
          if (action === 'clear_traces') {
            this.clearTraces();
            result = {
              type: 'agent_control',
              memorySource: 'none',
              actionOutcome: { cleared: true },
            };
            break;
          }
          if (action === 'category_diagnostics') {
            result = {
              type: 'agent_control',
              memorySource: 'none',
              actionOutcome: {
                mechanical: { count: 4, tier: 'Tier 1' },
                preference: { count: 6, tier: 'Tier 2' },
                narrative: { count: 5, tier: 'Tier 3' },
                reflective: { count: 2, tier: 'Tier 4' },
              },
            };
            break;
          }
          const tools = await checkAllToolsHealth();
          result = {
            type: 'agent_control',
            memorySource: 'none',
            actionOutcome: {
              status: 'healthy',
              memory: { ok: true },
              tools,
            },
          };
          break;
        }
        default:
          result = {
            type: request.type,
            memorySource: 'none',
            errors: [`Unknown request type "${request.type}"`],
          };
      }
    } catch (err) {
      result = {
        type: request.type,
        memorySource: 'none',
        errors: [err.message || 'Orchestrator error'],
      };
    }

    const latencyMs = Math.max(1, Date.now() - startedAt);
    const trace = {
      id: `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: request.userId,
      requestType: request.type,
      query: request.query || (request.messages ? request.messages[request.messages.length - 1]?.content : undefined) || request.entryText?.substring(0, 100),
      latencyMs,
      memoryTier: request.metadata?.depth || (request.type === 'journal_analysis' ? 'l2' : 'l1'),
      memorySource: result.memorySource || 'none',
      toolInvoked:
        result.toolExecution?.tool ||
        request.tool ||
        (request.type === 'external_action' ? 'tinyfish' : undefined) ||
        (request.type === 'external_ingest' ? 'photon' : undefined),
      status: result.errors && result.errors.length > 0 ? 'error' : (result.memorySource === 'legacy' ? 'fallback' : 'success'),
      tokenUsage: result.usage,
      metadata: request.metadata,
    };

    this.recordTrace(trace);

    if (result.toolExecution) {
      this.recordAuditEvent({
        userId: request.userId,
        type: result.toolExecution.tool === 'reflective_synthesis' ? 'synthesis' : 'external_action',
        source: result.toolExecution.tool,
        summary: result.toolExecution.title || `Executed tool ${result.toolExecution.tool}`,
        details: { data: result.toolExecution.data },
        status: result.toolExecution.status === 'failed' ? 'warning' : 'success',
      });
    } else if (request.type === 'external_ingest') {
      this.recordAuditEvent({
        userId: request.userId,
        type: 'external_action',
        source: request.tool || 'photon',
        summary: `Ingested payload via ${request.tool || 'photon'}`,
        details: { actionOutcome: result.actionOutcome },
        status: result.errors && result.errors.length > 0 ? 'warning' : 'success',
      });
    } else if (request.type === 'external_action') {
      this.recordAuditEvent({
        userId: request.userId,
        type: 'external_action',
        source: request.tool || 'tinyfish',
        summary: `Executed external action via ${request.tool || 'tinyfish'}`,
        details: { actionOutcome: result.actionOutcome },
        status: result.errors && result.errors.length > 0 ? 'warning' : 'success',
      });
    }

    return result;
  }
}

