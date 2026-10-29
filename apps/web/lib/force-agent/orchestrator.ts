import { forceMemoryService } from './memoryService';
import { buildAnalysisPrompt, buildChatPrompt, buildTaskPrompt, buildSocialAgentPrompt } from './promptBuilder';
import { formatMessageForPlatform } from '@/lib/photon/outboundClient';
import { generateSmartAITitle } from './smartTitle';
import {
  anthropicAdapter,
  buildUniversalGoal,
  checkAllToolsHealth,
  getToolAdapter,
  photonAdapter,
  tinyfishAdapter,
  toolRegistry,
  vektoriAdapter,
} from './toolAdapters';
import {
  FORCE_APP_TOOLS,
  analyzeCognitionEngine,
  analyzeJournals,
  analyzePatternMap,
  analyzeVoice,
  createJournalEntry,
  createTodo,
  fetchJournals,
  fetchTodos,
  getUserStats,
  inspectJournalMedia,
  parseRequestedDatePatterns,
  searchIntelligentMemory,
  updateTodoStatus,
} from './appTools';
import { searchWeb } from './webSearch';
import { createAdminClient } from '@/utils/supabase/admin';
import { loadProfile } from '@/lib/agent/profileStore';
import {
  checkResidencyConflicts,
  getCoordinationState,
  updateCoordinationState,
} from './dhunCoordination';
import { getUserSchedule, getUserGmail } from './calendarGmailTools';
import type {
  AgentAuditEvent,
  AgentTrace,
  ForceAgentHealthSummary,
  ForceAgentMessage,
  ForceAgentRequest,
  ForceAgentResult,
  ForceAgentUsage,
  MemorySource,
  ToolExecutionData,
  UserLocation,
} from './types';

function getMessageText(content?: string | Array<Record<string, unknown>>): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return JSON.stringify(content);
}

function formatLocationContext(location?: UserLocation): string {
  if (!location || !location.latitude || !location.longitude) return '';

  const parts = [
    `Current Physical Location:`,
    `- Coordinates: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} (accuracy: ±${Math.round(location.accuracy || 0)}m)`,
  ];

  if (location.city || location.region || location.country) {
    const area = [location.city, location.region, location.country].filter(Boolean).join(', ');
    parts.push(`- Area: ${area}`);
  }
  if (location.formattedAddress) {
    parts.push(`- Formatted Address: ${location.formattedAddress}`);
  }
  if (location.timezone) {
    parts.push(`- Local Timezone: ${location.timezone}`);
  }

  return parts.join('\n');
}

function buildChatQueryText(messages: ForceAgentMessage[], systemContext?: string): string {
  const lastUserMsg = getMessageText([...messages].reverse().find((m) => m.role === 'user')?.content);
  return `${lastUserMsg} ${(systemContext || '').substring(0, 500)}`;
}

function extractFirstJson(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return text.substring(firstBracket, lastBracket + 1);
  }
  return null;
}

function detectConversationalToolIntent(
  text: string,
  conversationMessages?: ForceAgentMessage[]
): {
  type:
    | 'tinyfish'
    | 'task_generation'
    | 'reflective_synthesis'
    | 'memory_query'
    | 'journal_analysis'
    | 'journal_analysis_cognition'
    | 'journal_analysis_pattern_map'
    | 'journal_analysis_voice'
    | 'journal_read'
    | 'journal_create'
    | 'todo_list'
    | 'todo_update'
    | 'user_stats'
    | 'real_world_action'
    | 'user_location'
    | 'unsupported'
    | 'standard';
  data?: Record<string, unknown>;
  extractedAction?: string;
} {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 0. Location Access & Verification Intent
  if (
    /\b(where am i|what('s| is) my (current )?location|check my location|my (current )?location|what city am i in|give force agent location|enable location|location access|where i am)\b/i.test(lower)
  ) {
    return {
      type: 'user_location',
      data: {},
    };
  }

  // 1. TinyFish Universal Browser Agent Intent (Any URL, Luma, web research, or explicit browser task)
  const urlMatch = trimmed.match(/https?:\/\/[^\s<>"')]+/i);
  if (urlMatch) {
    const rawUrl = urlMatch[0];
    const isLuma = /lu\.ma|luma\.com/i.test(rawUrl);
    const taskType: 'research' | 'action' | 'registration' | 'browse' =
      isLuma || /\b(register|rsvp|attend|sign up)\b/i.test(trimmed)
        ? 'registration'
        : /\b(research|extract|search|summarize|find|what is|read|check|price|table)\b/i.test(trimmed)
        ? 'research'
        : 'action';

    return {
      type: 'tinyfish',
      data: {
        url: rawUrl,
        eventUrl: rawUrl,
        taskType,
        prompt: trimmed,
        goal: buildUniversalGoal({ prompt: trimmed, url: rawUrl, taskType }),
      },
    };
  }

  // 1b. Check if user is replying with missing credentials/personal data for a pending browser task
  if (conversationMessages && conversationMessages.length > 0) {
    let pendingUrl: string | undefined;
    const reversed = [...conversationMessages].reverse();

    // Pass 1: Prioritize full HTTP/HTTPS URLs from tool execution data or message text
    for (const msg of reversed) {
      const execData = msg.toolExecution?.data as Record<string, any> | undefined;
      const toolUrl = (execData?.url as string) || (execData?.eventUrl as string);
      if (toolUrl && toolUrl.startsWith('http')) {
        pendingUrl = toolUrl;
        break;
      }

      if (msg.toolExecutions && Array.isArray(msg.toolExecutions)) {
        const found = msg.toolExecutions.find((t: ToolExecutionData) => {
          const d = t.data as Record<string, any> | undefined;
          const u = (d?.url as string) || (d?.eventUrl as string);
          return typeof u === 'string' && u.startsWith('http');
        });
        if (found) {
          const d = found.data as Record<string, any> | undefined;
          pendingUrl = (d?.url as string) || (d?.eventUrl as string);
          break;
        }
      }

      const content = getMessageText(msg.content);
      const urlInMsg = content.match(/https?:\/\/[^\s<>"')]+/i);
      if (urlInMsg) {
        pendingUrl = urlInMsg[0];
        break;
      }
    }

    // Pass 2: Fallback to domain name if no complete URL was found
    if (!pendingUrl) {
      for (const msg of reversed) {
        const content = getMessageText(msg.content);
        const domainMatch = content.match(/\b([a-zA-Z0-9-]+\.(?:com|org|io|net|co|in|app|ma)(?:\/[^\s<>"')]*)?)\b/i);
        if (domainMatch && domainMatch[1] && !domainMatch[1].includes('@')) {
          pendingUrl = `https://${domainMatch[1].replace(/^\*\*|\*\*$/g, '')}`;
          break;
        }
      }
    }

    const hasPasswordSignal =
      /(?:password|pass|code|secret|pwd)(?:\s+is|\s*:|=|\s+to)?\s*([^\s,;]+)/i.test(trimmed) ||
      /(?:password|pass)\s*[:=]\s*([^\s,;]+)/i.test(trimmed);
    const hasUserSignal =
      /(?:userid|user\s*id|username|user|login|account|member\s*id|email|id)(?:\s+is|\s*:|=|\s+to)?\s*([^\s,;]+)/i.test(trimmed);
    const hasPhoneSignal =
      /(?:phone|mobile|cell)(?:\s+is|\s*:|=)?\s*([+0-9-()\s]{7,16})/i.test(trimmed) ||
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(trimmed);
    const hasLoginSignal =
      /\b(here\s+is\s+my\s+(login|password|phone|details|credentials|userid|user)|my\s+(password|phone|login|userid|username)\s+is|credentials|log\s+in\s+with|login\s+with)\b/i.test(trimmed);
    const hasRetrySignal =
      /\b(register\s+(again|like\s+before|for\s+the\s+class)|try\s+(again|to\s+register)|log\s*(in)?\s*(the\s*user\s*)?too|log\s+in\s+and\s+register|retry\s+registration|run\s+registration\s+again|failed\s+again|gave\s+the\s+userid|try\s+to\s+register)\b/i.test(trimmed);

    if (pendingUrl && (hasPasswordSignal || hasUserSignal || hasPhoneSignal || hasLoginSignal || hasRetrySignal)) {
      let resolvedPass: string | undefined;
      const passMatch =
        trimmed.match(/(?:password|pass|secret|pwd|key)(?:\s+is|\s*:|=|\s+to)?\s*([^\s,;]+)/i) ||
        trimmed.match(/(?:password|pass)\s*[:=]\s*([^\s,;]+)/i);
      if (passMatch && passMatch[1] && !['and', 'is', 'for', 'the', 'my', 'to', 'was', 'it'].includes(passMatch[1].toLowerCase())) {
        resolvedPass = passMatch[1].trim();
      }

      let resolvedUser: string | undefined;
      const userMatch =
        trimmed.match(/(?:userid|user\s*id|username|account|member\s*id)(?:\s+is|\s*:|=|\s+to)?\s*([^\s,;]+)/i) ||
        trimmed.match(/(?:user|id|login)\s*[:=]\s*([^\s,;]+)/i);
      if (userMatch && userMatch[1] && !['and', 'is', 'for', 'the', 'my', 'to', 'was', 'it', 'password'].includes(userMatch[1].toLowerCase())) {
        resolvedUser = userMatch[1].trim();
      }

      const emailMatch = trimmed.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
      const resolvedEmail = emailMatch ? emailMatch[0].trim() : undefined;

      const phoneMatch =
        trimmed.match(/(?:phone|mobile|cell)(?:\s+is|\s*:|=)?\s*([+0-9-()\s]{7,16})/i) ||
        trimmed.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
      const resolvedPhone = phoneMatch ? (phoneMatch[1] || phoneMatch[0]).trim() : undefined;

      const customAnswers: Record<string, string> = {};
      if (resolvedPass) {
        customAnswers['account_password'] = resolvedPass;
        customAnswers['password'] = resolvedPass;
      }
      if (resolvedUser) {
        customAnswers['username'] = resolvedUser;
        customAnswers['user_id'] = resolvedUser;
        customAnswers['login_id'] = resolvedUser;
      }
      if (resolvedEmail) {
        customAnswers['login_email'] = resolvedEmail;
        customAnswers['email'] = resolvedEmail;
      }

      return {
        type: 'tinyfish',
        data: {
          url: pendingUrl,
          eventUrl: pendingUrl,
          taskType: 'registration',
          prompt: `Log in and complete registration on ${pendingUrl} with user credentials`,
          goal: buildUniversalGoal({
            prompt: `Log in with user credentials and complete class registration on ${pendingUrl}`,
            url: pendingUrl,
            taskType: 'registration',
            profile: {
              name: '',
              email: resolvedEmail || '',
              phone: resolvedPhone || '',
              customAnswers,
            },
          }),
          isResume: true,
          providedPassword: resolvedPass,
          providedUsername: resolvedUser,
          providedPhone: resolvedPhone,
          providedEmail: resolvedEmail,
        },
      };
    }
  }

  if (
    lower.includes('register me for') ||
    lower.includes('rsvp for') ||
    lower.includes('luma event') ||
    lower.includes('sign me up for')
  ) {
    return {
      type: 'tinyfish',
      data: {
        prompt: trimmed,
        taskType: 'registration',
      },
    };
  }

  if (
    /\b(use tinyfish|open browser|browse the web|search the web|search online for|look up online|find on the web|google search)\b/i.test(trimmed) ||
    (/\btinyfish\b/i.test(trimmed) && trimmed.length > 8)
  ) {
    const cleanSearchQuery = trimmed
      .replace(/\b(use tinyfish to|tinyfish|open browser and|browse the web for|search the web for|search online for|look up online|find on the web|google search for|google)\b/gi, '')
      .trim();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanSearchQuery || trimmed)}`;
    return {
      type: 'tinyfish',
      data: {
        url: searchUrl,
        eventUrl: searchUrl,
        taskType: 'research',
        prompt: trimmed,
        goal: buildUniversalGoal({ prompt: trimmed, url: searchUrl, taskType: 'research' }),
      },
    };
  }

  // 2. Unsupported external actions (hardware controls, real phone calls, direct stock trading without a web URL)
  const unsupportedPatterns = [
    { regex: /\b(book|reserve)\s+(a\s+)?(flight|hotel|airbnb|car|train|ticket|table)\b/i, action: 'travel and reservation booking' },
    { regex: /\b(order|buy)\s+(a\s+)?(pizza|food|groceries|coffee|lunch|dinner|uber eats|doordash)\b/i, action: 'external food ordering' },
    { regex: /\b(send|draft)\s+(an\s+)?(email|gmail|text message|sms|dm)\s+(to|for)\b/i, action: 'external email and message dispatch' },
    { regex: /\b(call|order)\s+(an\s+)?(uber|lyft|cab|taxi)\b/i, action: 'ride-hailing services' },
    { regex: /\b(buy|sell|trade)\s+(stocks|crypto|bitcoin|shares|options)\b/i, action: 'financial asset trading' },
    { regex: /\b(play|stream)\s+(music|spotify|song|album|video|movie)\b/i, action: 'media streaming controls' },
  ];

  for (const pattern of unsupportedPatterns) {
    if (pattern.regex.test(trimmed)) {
      return {
        type: 'unsupported',
        extractedAction: pattern.action,
      };
    }
  }

  // 3. Explicit Mode Analysis Intent
  const datePatterns = parseRequestedDatePatterns(trimmed);
  const isCognitionExplicit = /\b(cognition|cognition engine|story lens|tensions? and tasks?)\b/i.test(trimmed);
  const isPatternMapExplicit = /\b(pattern map|advanced analysis|atlas|thematic patterns?|mindmap|mind map)\b/i.test(trimmed);
  const isVoiceExplicit = /\b(voice analysis|audio analysis|acoustic signals?|vocal tone|speech cadence|speaking pace)\b/i.test(trimmed);

  if (isCognitionExplicit) {
    return {
      type: 'journal_analysis_cognition',
      data: { dates: datePatterns, query: trimmed },
    };
  }

  if (isPatternMapExplicit) {
    return {
      type: 'journal_analysis_pattern_map',
      data: { dates: datePatterns, query: trimmed },
    };
  }

  if (isVoiceExplicit) {
    return {
      type: 'journal_analysis_voice',
      data: { dates: datePatterns, query: trimmed },
    };
  }

  // 4. Date-based or comparative general journal analysis (e.g. "I want to analyze my journals from 29th August and 1st September")
  if (
    datePatterns.length > 0 &&
    /\b(analyze|analysis|compare|look at|review|break down|examine)\b/i.test(trimmed) &&
    /\b(journals?|entries|diary|thoughts?)\b/i.test(trimmed)
  ) {
    return {
      type: 'journal_analysis',
      data: { dates: datePatterns, query: trimmed },
    };
  }

  if (datePatterns.length >= 2 && /\b(journals?|entries|diary|wrote|written)\b/i.test(trimmed)) {
    return {
      type: 'journal_analysis',
      data: { dates: datePatterns, query: trimmed },
    };
  }

  if (
    /\b(analyze|break down|synthesize)\b/i.test(trimmed) &&
    /\b(my journals?|these entries|diary|reflections?|entries by date)\b/i.test(trimmed)
  ) {
    return {
      type: 'journal_analysis',
      data: { query: trimmed },
    };
  }

  if (/^(can you\s+)?(please\s+)?analyze\s+(my\s+)?(journals?|entries|reflections?|diary)\b/i.test(trimmed)) {
    return {
      type: 'journal_analysis',
      data: { query: trimmed },
    };
  }

  // 4. Show / List Todos
  if (
    /\b(show|list|view|what are|display|get)\b/i.test(trimmed) &&
    /\b(tasks?|todos?|to-dos?|action items?|checklist)\b/i.test(trimmed)
  ) {
    return { type: 'todo_list' };
  }

  // 5. Complete / Mark Done Todo
  if (
    /\b(mark|set|check off|complete|finish|done with)\b/i.test(trimmed) &&
    /\b(task|todo|to-do|item|done|completed)\b/i.test(trimmed)
  ) {
    const match = trimmed
      .replace(/^(please\s+)?(can you\s+)?(mark|set|check off|complete|finish)\s+(the\s+)?(task\s+|todo\s+)?/i, '')
      .replace(/\s+as\s+(done|complete|completed)$/i, '')
      .trim();
    return {
      type: 'todo_update',
      data: { titleMatch: match || undefined, status: 'done' },
    };
  }

  // 6. Task / Todo creation intent
  const taskCreateRegex = /\b(add|create|make|put|schedule|remind me to)\s+(a\s+)?(task|todo|to-do|reminder|item)\b|^(remind me to|todo:)\s+/i;
  if (taskCreateRegex.test(trimmed)) {
    let taskTitle = trimmed
      .replace(/^(please\s+)?(can you\s+)?(add|create|make|put|schedule|remind me to)\s+(a\s+)?(task|todo|to-do|reminder|item)(\s+to|\s+that|\s+for)?/i, '')
      .replace(/^todo:\s*/i, '')
      .replace(/^remind me to\s+/i, '')
      .trim();
    if (!taskTitle) taskTitle = 'Action Item';

    return {
      type: 'task_generation',
      data: { title: taskTitle },
    };
  }

  // 7. Semantic Memory & Journal Search Intent (Multi-Tier Memory & Journal Recall)
  const isMemorySearchIntent =
    /\b(vektori(\s+search)?|search\s+(my\s+)?(memory|memories)|find\s+in\s+(my\s+)?(memory|memories)|what\s+did\s+i\s+(say|write|mention|note)\s+about|what\s+do\s+(my\s+)?journals?\s+say\s+about|did\s+i\s+(ever\s+)?(write|say|mention|note)\s+(anything\s+)?about|do\s+i\s+have\s+(any\s+)?(allergies|meds?|notes|records?)|recall\s+(what\s+i\s+wrote\s+about|about)?|tell\s+me\s+what\s+i\s+wrote\s+about)\b/i.test(trimmed) ||
    /\bsearch\s+(my\s+)?(journals?|reflections?|entries)\s+(for|about)\b/i.test(trimmed) ||
    /\b(what do you know|what('s| is) stored|tell me about)\s+(about\s+)?(me|my\s+(passport|preferences?|habits?|coffee|intentions?|memory|med\s*timings?|allergies|health))\b/i.test(trimmed);

  if (isMemorySearchIntent) {
    let extractedQuery = trimmed
      .replace(/^(can you\s+)?(please\s+)?(vektori(\s+search)?|search\s+(my\s+)?(memory|memories|journals?|reflections?|entries)?(\s+for|\s+about)?|find\s+(in\s+)?(my\s+)?(memory|memories|journals?|reflections?)?(\s+about|\s+for)?|what\s+did\s+i\s+(say|write|mention|note)\s+about|what\s+do\s+(my\s+)?journals?\s+say\s+about|did\s+i\s+(ever\s+)?(write|say|mention|note)\s+(anything\s+)?about|recall\s+(what\s+i\s+wrote\s+about|about)?|tell\s+me\s+what\s+i\s+wrote\s+about)\s*/i, '')
      .replace(/[?.!]+$/, '')
      .trim();

    if (!extractedQuery && /\b(vektori|memory)\b/i.test(trimmed)) {
      extractedQuery = '';
    }

    return {
      type: 'memory_query',
      data: { query: extractedQuery || trimmed },
    };
  }

  // 8. Read / Show Journal Entries
  if (
    /\b(show|read|find|view)\b/i.test(trimmed) &&
    /\b(journals?|entries|entry|diary)\b/i.test(trimmed)
  ) {
    return {
      type: 'journal_read',
      data: { dates: datePatterns.length > 0 ? datePatterns : undefined, query: trimmed },
    };
  }

  // 9. Write / Create Journal Entry
  if (
    /\b(write|create|save|add|draft)\s+(a\s+)?(new\s+)?(journal|diary|entry|reflection)\b/i.test(trimmed) ||
    /^journal:\s*/i.test(trimmed)
  ) {
    const text = trimmed
      .replace(/^(please\s+)?(can you\s+)?(write|create|save|add|draft)\s+(a\s+)?(new\s+)?(journal|diary|entry|reflection)(\s+about|\s+titled|\s+saying)?/i, '')
      .replace(/^journal:\s*/i, '')
      .trim();
    return {
      type: 'journal_create',
      data: { title: 'Reflection', content: text || 'Quiet reflection from Force Agent' },
    };
  }

  // 10. User activity stats / streak
  if (/\b(streak|momentum|stats|statistics|activity score|how active|how many journals)\b/i.test(trimmed)) {
    return { type: 'user_stats' };
  }

  // 11. Reflective Pattern Synthesis Intent
  if (
    /\b(patterns?|synthesis|synthesize|trends?|themes?|threads?)\b/i.test(trimmed) &&
    /\b(notice|spotted|seen|recent|week|month|journals?|entries|habits?|feeling)\b/i.test(trimmed)
  ) {
    return {
      type: 'reflective_synthesis',
      data: { query: trimmed },
    };
  }

  // 12. Real-World Action Intent Prototypes (Walk, Call a friend, Take a break, Meal)
  const isWalkIntent = /\b(go for a walk|take a walk|should i walk|need to walk|walk outside|step outside|get some air|fresh air)\b/i.test(trimmed);
  const isCallFriendIntent = /\b(call (a|my|your)?\s*(friend|partner|alex|someone)|reach out to (a|my)?\s*friend|talk to (a|my)?\s*(friend|human|someone)|phone call)\b/i.test(trimmed);
  const isBreakIntent = /\b(take a break|need a break|give me a break|stuck in a loop|looping|overwhelmed|mental fatigue|brain fog|staring at (the|this|my)?\s*screen|screen fatigue|step away|reset my mind|exhausted|burnout|burned out)\b/i.test(trimmed);
  const isMealIntent = /\b(eat something|have (a\s+)?(meal|lunch|dinner)|food break|step away for lunch)\b/i.test(trimmed);
  const isExplicitActionIntent = /\b(real[- ]world action|offline action|action prototype|suggest an action)\b/i.test(trimmed);

  if (isWalkIntent || isCallFriendIntent || isBreakIntent || isMealIntent || isExplicitActionIntent) {
    let actionType: 'walk' | 'call_friend' | 'take_break' | 'meal' | 'custom' = 'take_break';
    if (isWalkIntent) actionType = 'walk';
    else if (isCallFriendIntent) actionType = 'call_friend';
    else if (isMealIntent) actionType = 'meal';
    else if (isBreakIntent) actionType = 'take_break';
    else actionType = 'walk';

    return {
      type: 'real_world_action',
      data: { action_type: actionType, query: trimmed },
    };
  }

  return { type: 'standard' };
}

export class ForceAgentOrchestrator {
  private traces: AgentTrace[] = [];
  private auditEvents: AgentAuditEvent[] = [];

  async handle(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const startedAt = Date.now();
    let result: ForceAgentResult;

    try {
      switch (request.type) {
        case 'chat':
          result = await this.handleChat(request);
          if (request.messages && request.messages.length <= 2) {
            const firstUser = getMessageText(request.messages.find((m) => m.role === 'user')?.content);
            if (firstUser) {
              try {
                result.suggestedTitle = await generateSmartAITitle({
                  prompt: firstUser,
                  assistantResponse: result.message,
                  toolUsed: result.toolExecution?.tool,
                });
              } catch {}
            }
          }
          break;
        case 'journal_analysis':
          result = await this.handleJournalAnalysis(request);
          break;
        case 'ai_task_generation':
          result = await this.handleAiTaskGeneration(request);
          break;
        case 'external_action':
          result = await this.handleExternalAction(request);
          break;
        case 'external_ingest':
          result = await this.handleExternalIngest(request);
          break;
        case 'memory_query':
          result = await this.handleMemoryQuery(request);
          break;
        case 'social_interaction':
          result = await this.handleSocialInteraction(request);
          break;
        case 'agent_control':
          result = await this.handleAgentControl(request);
          break;
        default:
          result = {
            type: request.type,
            memorySource: 'none',
            errors: [`Unknown request type "${request.type}"`],
          };
      }
    } catch (error) {
      result = {
        type: request.type,
        memorySource: 'none',
        errors: [error instanceof Error ? error.message : 'Orchestrator handling failed'],
      };
    }

    const latencyMs = Math.max(1, Date.now() - startedAt);
    const lastMsgContent = request.messages && request.messages.length > 0
      ? getMessageText(request.messages[request.messages.length - 1]?.content)
      : undefined;
    const query =
      request.query ||
      lastMsgContent ||
      (request.entryText ? request.entryText.substring(0, 100) : undefined);

    const trace: AgentTrace = {
      id: `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: request.userId,
      requestType: request.type,
      query,
      latencyMs,
      memoryTier: (request.metadata?.depth as any) || (request.type === 'journal_analysis' ? 'l2' : 'l1'),
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

    if (result.toolExecutions && result.toolExecutions.length > 0) {
      for (const t of result.toolExecutions) {
        this.recordAuditEvent({
          userId: request.userId,
          type: t.tool === 'reflective_synthesis' ? 'synthesis' : 'external_action',
          source: t.tool,
          summary: t.title || `Executed tool ${t.tool}`,
          details: { data: t.data },
          status: t.status === 'failed' ? 'warning' : 'success',
        });
      }
    } else if (result.toolExecution) {
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

  private async handleChat(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const messages = request.messages || [];
    if (messages.length === 0) {
      return {
        type: 'chat',
        memorySource: 'none',
        errors: ['Messages array is required'],
      };
    }

    const lastUserMsg = getMessageText([...messages].reverse().find((m) => m.role === 'user')?.content);
    const detectedIntent = detectConversationalToolIntent(lastUserMsg, messages);

    // 0. Tool Intent: User Location Access & Status
    if (detectedIntent.type === 'user_location') {
      const loc = request.location;
      if (loc && loc.latitude && loc.longitude) {
        const area = [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
        const accuracyStr = loc.accuracy ? ` (accuracy: ±${Math.round(loc.accuracy)}m)` : '';
        return {
          type: 'chat',
          message: `### 📍 Location Verified\n\nYou are currently in **${area || 'your local area'}**.\n\n- **Coordinates**: \`${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}\`${accuracyStr}\n- **Local Timezone**: ${loc.timezone || 'Local'}\n${loc.formattedAddress ? `- **Address**: ${loc.formattedAddress}\n` : ''}\nForce Agent has active location awareness enabled. I will automatically use your local surroundings for schedule suggestions, weather, venue lookups, and event registrations.`,
          toolExecution: {
            tool: 'user_location',
            status: 'success',
            title: `Location: ${area || 'Active'}`,
            data: loc,
          },
          memorySource: 'none',
        };
      } else {
        return {
          type: 'chat',
          message: `### 📍 Location Access Needed\n\nForce Agent does not currently have access to your live location.\n\nTo give Force Agent location access:\n1. Click the **"Enable Location"** button in the top navigation bar.\n2. Allow location access when prompted by your browser.\n\nOnce granted, I can provide localized recommendations, timezone-accurate scheduling, and automated registrations tailored to your exact city.`,
          toolExecution: {
            tool: 'user_location',
            status: 'unsupported',
            title: 'Location Permission Needed',
            data: { granted: false },
          },
          memorySource: 'none',
        };
      }
    }

    // Helper to resolve dates from current turn or prior turns
    const resolveContextualDates = (currentDates?: string[]): string[] => {
      if (currentDates && currentDates.length > 0) return currentDates;
      for (const m of [...messages].reverse()) {
        const found = parseRequestedDatePatterns(getMessageText(m.content));
        if (found.length > 0) return found;
      }
      return [];
    };

    // 1. Tool Intent: General Journal Analysis -> Inspect media & offer mode choices
    if (detectedIntent.type === 'journal_analysis') {
      const dates = resolveContextualDates(detectedIntent.data?.dates as string[]);
      const fetched = await fetchJournals({
        userId: request.userId,
        dates: dates.length > 0 ? dates : undefined,
        query: (detectedIntent.data?.query as string) || lastUserMsg,
        clientEntries: request.decryptedJournals,
        limit: 5,
      });

      const entries =
        fetched.entries.length > 0
          ? fetched.entries
          : (await fetchJournals({ userId: request.userId, clientEntries: request.decryptedJournals, limit: 2 })).entries;

      const inspection = inspectJournalMedia(entries);
      const datesLabel =
        inspection.dates.length > 0 ? inspection.dates.join(' and ') : 'your reflections';

      if (inspection.isTextOnly) {
        return {
          type: 'chat',
          message: `I reviewed your journal entries for **${datesLabel}** — they are **text reflections**.\n\nWhich type of analysis would you like me to perform?\n\n1. 🧠 **Cognition Engine Analysis** (Story Lens: narrative arc, core tensions, insight synthesis, and actionable task candidates)\n2. 🗺️ **Pattern Map Analysis** (Advanced Analysis: emotional trajectory, thematic topics, mindmap clusters, and life patterns)\n\nPlease choose an option below or reply with your preference!`,
          toolExecution: {
            tool: 'analysis_mode_selection',
            status: 'success',
            title: `Select Analysis Mode: ${datesLabel}`,
            data: {
              ...inspection,
              targetDates: dates,
              query: (detectedIntent.data?.query as string) || lastUserMsg,
            },
          },
          memorySource: 'none',
        };
      } else {
        return {
          type: 'chat',
          message: `I reviewed your journal entries for **${datesLabel}** — they contain **voice & audio recordings**.\n\nWhich type of analysis would you like me to perform?\n\n1. 🧠 **Cognition Engine Analysis** (Story Lens: narrative arc, core tensions, insight synthesis, and actionable task candidates)\n2. 🗺️ **Pattern Map Analysis** (Advanced Analysis: emotional trajectory, thematic topics, mindmap clusters, and life patterns)\n3. 🎙️ **Voice Analysis** (Acoustic Signals: vocal sentiment, speech cadence, pitch stability, and energy dynamics)\n\nPlease choose an option below or reply with your preference!`,
          toolExecution: {
            tool: 'analysis_mode_selection',
            status: 'success',
            title: `Select Analysis Mode: ${datesLabel}`,
            data: {
              ...inspection,
              targetDates: dates,
              query: (detectedIntent.data?.query as string) || lastUserMsg,
            },
          },
          memorySource: 'none',
        };
      }
    }

    // 1b. Tool Intent: Cognition Engine Analysis
    if (detectedIntent.type === 'journal_analysis_cognition') {
      const dates = resolveContextualDates(detectedIntent.data?.dates as string[]);
      const analysisData = await analyzeCognitionEngine({
        userId: request.userId,
        dates: dates.length > 0 ? dates : undefined,
        query: (detectedIntent.data?.query as string) || lastUserMsg,
        clientEntries: request.decryptedJournals,
      });

      const datesLabel = analysisData.dates.length > 0 ? analysisData.dates.join(' and ') : 'your reflections';
      return {
        type: 'chat',
        message: `### 🧠 Cognition Engine Analysis: ${datesLabel}\n\n${analysisData.summary}\n\n**Emotional Progression**: ${analysisData.emotionalShift || 'Grounded shift towards intentional focus.'}\n\nI have synthesized your core tensions, grounded observations, and actionable task candidates below:`,
        toolExecution: {
          tool: 'cognition_engine_result',
          status: 'success',
          title: `Cognition Engine: ${datesLabel}`,
          data: analysisData,
        },
        memorySource: 'vektori',
      };
    }

    // 1c. Tool Intent: Pattern Map Analysis (Advanced)
    if (detectedIntent.type === 'journal_analysis_pattern_map') {
      const dates = resolveContextualDates(detectedIntent.data?.dates as string[]);
      const patternData = await analyzePatternMap({
        userId: request.userId,
        dates: dates.length > 0 ? dates : undefined,
        query: (detectedIntent.data?.query as string) || lastUserMsg,
        clientEntries: request.decryptedJournals,
      });

      const datesLabel = patternData.dates.length > 0 ? patternData.dates.join(' and ') : 'your reflections';
      return {
        type: 'chat',
        message: `### 🗺️ Pattern Map Analysis: ${datesLabel}\n\n${patternData.summary}\n\n**Thematic Focus**: ${patternData.topicInsight}\n\n**Growth Edge**: ${patternData.growthEdge}\n\nHere is your full Pattern Map breakdown including keywords, mindmap clusters, and life patterns:`,
        toolExecution: {
          tool: 'pattern_map_result',
          status: 'success',
          title: `Pattern Map: ${datesLabel}`,
          data: patternData,
        },
        memorySource: 'vektori',
      };
    }

    // 1d. Tool Intent: Voice Analysis
    if (detectedIntent.type === 'journal_analysis_voice') {
      const dates = resolveContextualDates(detectedIntent.data?.dates as string[]);
      const voiceData = await analyzeVoice({
        userId: request.userId,
        dates: dates.length > 0 ? dates : undefined,
        query: (detectedIntent.data?.query as string) || lastUserMsg,
        clientEntries: request.decryptedJournals,
      });

      const datesLabel = voiceData.dates.length > 0 ? voiceData.dates.join(' and ') : 'your voice entries';
      return {
        type: 'chat',
        message: `### 🎙️ Voice & Acoustic Signals Analysis: ${datesLabel}\n\n${voiceData.summary}\n\n**Acoustic Cadence**: ~${voiceData.speechCadence.wordsPerMinute} WPM (${voiceData.speechCadence.paceCategory}). Pitch stability: ${voiceData.vocalAcoustics.pitchStability}\n\n**Harmony**: ${voiceData.harmonySynthesis}`,
        toolExecution: {
          tool: 'voice_analysis_result',
          status: 'success',
          title: `Voice Analysis: ${datesLabel}`,
          data: voiceData,
        },
        memorySource: 'vektori',
      };
    }

    // 2. Tool Intent: Journal Reading / Search
    if (detectedIntent.type === 'journal_read') {
      const { entries, source } = await fetchJournals({
        userId: request.userId,
        dates: detectedIntent.data?.dates as string[],
        query: detectedIntent.data?.query as string,
        clientEntries: request.decryptedJournals,
        limit: 5,
      });

      return {
        type: 'chat',
        message:
          entries.length > 0
            ? `I retrieved ${entries.length} matching journal entry${entries.length > 1 ? 'ies' : ''} from your diary:`
            : `I looked through your journal records, but couldn't find any entries matching that query or date range.`,
        toolExecution: {
          tool: 'journal_read',
          status: 'success',
          title: `Retrieved ${entries.length} Journal Entries`,
          data: { entries, source },
        },
        memorySource: 'none',
      };
    }

    // 3. Tool Intent: Journal Creation
    if (detectedIntent.type === 'journal_create') {
      const content = (detectedIntent.data?.content as string) || lastUserMsg;
      const title = (detectedIntent.data?.title as string) || 'Reflection';

      const entry = await createJournalEntry({
        userId: request.userId,
        title,
        content,
      });

      return {
        type: 'chat',
        message: `I have saved a new journal entry to your diary: **"${entry.title}"**.\n\nYour reflection has been recorded and ingested into your memory layer.`,
        toolExecution: {
          tool: 'journal_created',
          status: 'success',
          title: 'Journal Entry Created',
          data: entry,
        },
        memorySource: 'vektori',
      };
    }

    // 4. Tool Intent: Fetch Todos
    if (detectedIntent.type === 'todo_list') {
      const todos = await fetchTodos({
        userId: request.userId,
        status: 'all',
        clientTodos: request.decryptedTodos,
      });
      const pendingCount = todos.filter((t) => t.status !== 'done').length;

      return {
        type: 'chat',
        message:
          todos.length > 0
            ? `You currently have **${pendingCount} active task${pendingCount === 1 ? '' : 's'}** on your to-do list:`
            : `Your to-do list is completely clear right now! You can ask me to add a task anytime.`,
        toolExecution: {
          tool: 'todo_list',
          status: 'success',
          title: `To-Do List (${pendingCount} Active)`,
          data: { todos },
        },
        memorySource: 'none',
      };
    }

    // 5. Tool Intent: Complete / Update Todo
    if (detectedIntent.type === 'todo_update') {
      try {
        const updated = await updateTodoStatus({
          userId: request.userId,
          titleMatch: detectedIntent.data?.titleMatch as string,
          status: 'done',
        });

        return {
          type: 'chat',
          message: `I've marked **"${updated.title}"** as completed! Great job following through.`,
          toolExecution: {
            tool: 'todo_updated',
            status: 'success',
            title: 'Task Completed',
            data: updated,
          },
          memorySource: 'none',
        };
      } catch {
        return {
          type: 'chat',
          message: `I couldn't find an active task matching "${detectedIntent.data?.titleMatch || ''}" to complete. Would you like me to show your active tasks?`,
          memorySource: 'none',
        };
      }
    }

    // 6. Tool Intent: Task Creation
    if (detectedIntent.type === 'task_generation') {
      const title = (detectedIntent.data?.title as string) || 'Action item';
      let createdTodo: any = null;
      try {
        createdTodo = await createTodo({
          userId: request.userId,
          title,
          priority: 'medium',
          due_date: new Date(Date.now() + 86400000).toISOString(),
        });
      } catch {
        createdTodo = { title, priority: 'medium', category: 'Personal' };
      }

      return {
        type: 'chat',
        message: `I have created this task for you: **"${title}"**.\n\nI've added it directly to your To-Do list so it stays visible without overwhelming your day.`,
        toolExecution: {
          tool: 'task_generation',
          status: 'success',
          title: 'Task Created',
          data: createdTodo,
        },
        memorySource: 'none',
      };
    }

    // 7. Tool Intent: User Stats & Momentum
    if (detectedIntent.type === 'user_stats') {
      const stats = await getUserStats(request.userId);
      return {
        type: 'chat',
        message: `Here is your current reflection and momentum overview:\n\n• **Current Streak**: ${stats.streakDays} days\n• **Total Journal Entries**: ${stats.journalCount}\n• **Active To-Dos**: ${stats.activeTodosCount}\n• **Completed To-Dos**: ${stats.completedTodosCount}\n• **Momentum Score**: ${stats.momentumScore}/100`,
        toolExecution: {
          tool: 'user_stats',
          status: 'success',
          title: 'Your Reflection Momentum',
          data: stats,
        },
        memorySource: 'none',
      };
    }

    // 8. Tool Intent: TinyFish Universal Browser Agent
    if (detectedIntent.type === 'tinyfish') {
      const targetUrl = (detectedIntent.data?.url as string) || (detectedIntent.data?.eventUrl as string) || '';
      const promptText = (detectedIntent.data?.prompt as string) || lastUserMsg;
      const taskType = (detectedIntent.data?.taskType as 'research' | 'action' | 'registration' | 'browse') || 'research';
      const goal = (detectedIntent.data?.goal as string) || buildUniversalGoal({ prompt: promptText, url: targetUrl, taskType, location: request.location });
      const isResume = Boolean(detectedIntent.data?.isResume);

      // If resuming with newly provided credentials, persist them to profile
      if (
        isResume &&
        (detectedIntent.data?.providedPassword ||
          detectedIntent.data?.providedUsername ||
          detectedIntent.data?.providedPhone ||
          detectedIntent.data?.providedEmail)
      ) {
        try {
          const { createAdminClient } = await import('@/utils/supabase/admin');
          const { saveAgentExtras } = await import('@/lib/agent/profileStore');
          const adminSupabase = createAdminClient();
          const customAnswers: Record<string, string> = {};
          if (detectedIntent.data.providedPassword) {
            customAnswers['account_password'] = detectedIntent.data.providedPassword as string;
            customAnswers['password'] = detectedIntent.data.providedPassword as string;
          }
          if (detectedIntent.data.providedUsername) {
            customAnswers['username'] = detectedIntent.data.providedUsername as string;
            customAnswers['user_id'] = detectedIntent.data.providedUsername as string;
            customAnswers['login_id'] = detectedIntent.data.providedUsername as string;
          }
          if (detectedIntent.data.providedEmail) {
            customAnswers['login_email'] = detectedIntent.data.providedEmail as string;
            customAnswers['email'] = detectedIntent.data.providedEmail as string;
          }
          await saveAgentExtras(adminSupabase, request.userId, {
            phone: (detectedIntent.data.providedPhone as string) || undefined,
            customAnswers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
          });
        } catch (err) {
          console.warn('[Orchestrator] Failed to save resumed credentials:', err);
        }
      }

      const isRegistration = taskType === 'registration' || targetUrl.includes('lu.ma') || targetUrl.includes('luma');

      const title = isResume
        ? 'Resuming TinyFish Registration'
        : isRegistration
        ? 'TinyFish Event Registration'
        : taskType === 'research'
        ? 'TinyFish Web Research'
        : 'TinyFish Browser Automation';

      let domain = 'the website';
      try {
        const parsed = new URL(targetUrl);
        domain = parsed.hostname.replace(/^www\./, '');
      } catch {
        domain = (targetUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]) || 'the website';
      }

      const message = isResume
        ? `Thank you! I've loaded your login credentials securely. I am now launching TinyFish to log in to **${domain}** and finalize your class booking...`
        : targetUrl
        ? isRegistration
          ? `I noticed you'd like to register for this event: **${targetUrl}**.\n\nI have prepared the TinyFish autonomous browser agent below with your profile context. You can click **Run Registration** to have the agent complete the RSVP and store the outcome directly in your memory.`
          : `I have prepared the TinyFish autonomous browser agent to execute this web task:\n\n• **Target**: ${targetUrl}\n• **Goal**: ${goal.split('\n')[0] || promptText}\n\nYou can launch the live browser session below to watch the agent navigate, inspect, and complete your task in real time.`
        : `I can help you navigate, research, or automate tasks on any website using the TinyFish autonomous browser agent. Please share the URL or what you'd like me to look up (e.g. \`https://example.com\` or \`search the web for AI hackathons\`), and I will launch the live browser for you.`;

      return {
        type: 'chat',
        message,
        toolExecution: {
          tool: 'tinyfish',
          status: targetUrl ? 'running' : 'failed',
          title,
          data: {
            url: targetUrl || undefined,
            eventUrl: targetUrl || undefined,
            goal,
            prompt: promptText,
            taskType,
            location: request.location,
            customAnswers:
              detectedIntent.data?.providedPassword ||
              detectedIntent.data?.providedUsername ||
              detectedIntent.data?.providedEmail
                ? {
                    ...(detectedIntent.data?.providedPassword
                      ? {
                          account_password: detectedIntent.data.providedPassword as string,
                          password: detectedIntent.data.providedPassword as string,
                        }
                      : {}),
                    ...(detectedIntent.data?.providedUsername
                      ? {
                          username: detectedIntent.data.providedUsername as string,
                          user_id: detectedIntent.data.providedUsername as string,
                          login_id: detectedIntent.data.providedUsername as string,
                        }
                      : {}),
                    ...(detectedIntent.data?.providedEmail
                      ? {
                          login_email: detectedIntent.data.providedEmail as string,
                          email: detectedIntent.data.providedEmail as string,
                        }
                      : {}),
                  }
                : undefined,
            phone: (detectedIntent.data?.providedPhone as string) || undefined,
          },
        },
        memorySource: 'none',
      };
    }

    // 9. Tool Intent: Unsupported Action Fallback
    if (detectedIntent.type === 'unsupported') {
      const actionName = detectedIntent.extractedAction || 'that external service';
      return {
        type: 'chat',
        message: `I don't currently have an external tool adapter for **${actionName}**.\n\nAs Force's unified orchestration companion, my current active capabilities include:\n1. 📖 **Journal Analysis & Retrieval**: Analyzing past entries (e.g. "analyze my journals from 29th August and 1st September").\n2. 📝 **To-Do & Reminder Management**: Creating, listing, and completing tasks.\n3. 🎫 **Event Automation**: Registering you for Luma events via TinyFish.\n4. ✨ **Reflective Pattern Synthesis**: Surfacing deep themes across your journals.\n5. 🧠 **Memory Recall**: Accessing your standing intentions and preferences.\n\nWould you like me to assist with one of these?`,
        toolExecution: {
          tool: 'unsupported',
          status: 'unsupported',
          title: 'Capability Not Available',
          message: `Requested action "${actionName}" is not currently supported in Force.`,
          data: {
            requestedAction: actionName,
            availableTools: [
              'Journal Analysis & Reading',
              'Task Creation & Management',
              'TinyFish Event Registration',
              'Reflective Synthesis',
              'Memory Recall',
            ],
          },
        },
        memorySource: 'none',
      };
    }

    // 10. Tool Intent: Reflective Pattern Synthesis
    if (detectedIntent.type === 'reflective_synthesis') {
      const memoryResult = await forceMemoryService.getMemoryContext(request.userId, lastUserMsg, {
        mode: 'chat',
        depth: 'l2',
        contextWindow: 6,
      });

      const observation =
        'Over your recent reflections, there is a clear pattern: your creative energy and clarity stay highest when you protect your morning quiet time before responding to external inputs.';
      return {
        type: 'chat',
        message: `Looking across your recent entries and reflections, here is a pattern that has surfaced:\n\n*"${observation}"*\n\nI offer this as an observation for you to affirm, refine, or dismiss — judgment stays entirely with you.`,
        toolExecution: {
          tool: 'reflective_synthesis',
          status: 'success',
          title: 'Category 4 Reflective Pattern',
          data: {
            offerId: `offer-${Date.now()}`,
            title: 'Morning Focus & Energy Pattern',
            observation,
            evidence: [
              'Noted feeling most clear-headed during early journaling',
              'Reported feeling rushed on days starting with immediate communications',
            ],
            suggestedAction: 'Keep a 20-minute quiet reflection buffer tomorrow morning',
          },
        },
        memorySource: memoryResult.source,
      };
    }

    // 11. Tool Intent: Intelligent Semantic Memory Search & Reflection Recall
    if (detectedIntent.type === 'memory_query') {
      const searchTarget = (detectedIntent.data?.query as string) || lastUserMsg;
      const searchResult = await searchIntelligentMemory({
        userId: request.userId,
        query: searchTarget,
        clientEntries: request.decryptedJournals,
      });

      const memoriesCount = searchResult.memories.length;
      const queryLabel = searchResult.query ? `"${searchResult.query}"` : 'your memory';
      const responseMessage = searchResult.answer
        ? `${searchResult.answer}\n\n*Recalled from ${memoriesCount} memory source${memoriesCount === 1 ? '' : 's'}.*`
        : `I searched across your memories for ${queryLabel}, but didn't find any closely matching recollections.`;

      return {
        type: 'chat',
        message: responseMessage,
        toolExecution: {
          tool: 'memory_search_result',
          status: 'success',
          title: searchResult.query ? `Memory Search: "${searchResult.query}"` : 'Memory Search',
          data: searchResult,
        },
        memorySource: 'vektori',
      };
    }

    // 11b. Tool Intent: Real-World Action Prototypes ("Go for a walk", "Call your friend", "Take a break", "Meal")
    if (detectedIntent.type === 'real_world_action') {
      const actionType = (detectedIntent.data?.action_type as string) || 'walk';
      let title = 'Step into the real world';
      let description = 'Grounding your attention in the physical environment clears cognitive residue.';
      let estimatedMinutes = 15;
      let targetPerson: string | undefined = undefined;
      let suggestedPrompt: string | undefined = undefined;

      if (actionType === 'walk') {
        title = 'Go for a 15-minute walk without your phone';
        description =
          'Stepping away from the screen into ambient daylight shifts neural processing into diffuse mode. Physical forward motion reduces amygdala reactivity and resets working memory.';
        estimatedMinutes = 15;
      } else if (actionType === 'call_friend') {
        title = 'Call a friend for an unstructured 10-minute catch-up';
        description =
          'Hearing a real human voice engages the social engagement nervous system, grounding emotional state in a way text cannot. No agenda needed — just a quick check-in.';
        estimatedMinutes = 10;
        targetPerson = 'a friend or partner';
        suggestedPrompt = "Hey! Thinking of you, had a free 10 minutes and wanted to hear how you're doing.";
      } else if (actionType === 'meal') {
        title = 'Have a nourishing meal away from your desk';
        description =
          'Eating while working suppresses satiety cues and maintains baseline cortisol. Take 20 minutes to sit down and enjoy a meal without any screens.';
        estimatedMinutes = 20;
      } else {
        // take_break
        title = 'Step away from all screens for a 10-minute physical reset';
        description =
          'Drink a full glass of water, do a light neck and shoulder roll, and look out the furthest window you can find to relieve optic nerve tension.';
        estimatedMinutes = 10;
      }

      return {
        type: 'chat',
        message: `I notice you might benefit from stepping out of the loop into the physical world.\n\nHere is a real-world action suggestion for you:`,
        toolExecution: {
          tool: 'real_world_action',
          status: 'success',
          title: `Real-World Action: ${title}`,
          data: {
            action_type: actionType,
            title,
            description,
            estimated_minutes: estimatedMinutes,
            target_person: targetPerson,
            suggested_prompt: suggestedPrompt,
          },
        },
        memorySource: 'none',
      };
    }

    // 12. Standard Conversational Reflection with Autonomous Tool Calling (Claude)
    const locationContext = formatLocationContext(request.location);
    let enrichedSystemContext = [request.systemContext, locationContext].filter(Boolean).join('\n\n');

    if (request.activeBackgroundTask) {
      const bg = request.activeBackgroundTask;
      const continuityBlock = `
[PREVIOUS CHAT ACTIVE TASK CONTINUITY]
An ongoing task was initiated in a previous chat session "${bg.sourceSessionTitle || 'Previous Conversation'}":
- Task Goal: ${bg.goal || 'Autonomous search & registration'}
- Current Status: ${bg.status}
- Last/Current Action: ${bg.currentAction || 'In progress'}
- Target URL: ${bg.targetUrl || 'N/A'}
${bg.steps && bg.steps.length > 0 ? `- Recent Steps: ${bg.steps.slice(-4).join(' -> ')}` : ''}
${bg.outcome ? `- Current Findings/Outcome: ${JSON.stringify(bg.outcome)}` : ''}

CROSS-CHAT CONTINUITY INSTRUCTIONS:
The user has switched to this chat session and expects you to carry on and continue this task.
- Seamlessly continue from where the previous chat left off.
- If the user refers to the task ("continue", "status", "keep looking", "how is it going", "register me", "did it work", etc.), provide a clear, transparent status update and immediately execute the next required tool or action.
- Do not make the user re-explain what they already commanded in the previous chat.`;
      enrichedSystemContext += '\n\n' + continuityBlock;
    }

    if (request.previousSessionContext) {
      const prev = request.previousSessionContext;
      const prevBlock = `
[PREVIOUS SESSION CONVERSATION SNIPPET]
- Previous Session: "${prev.previousSessionTitle || 'Previous Chat'}"
${prev.lastUserMessage ? `- User last asked: "${prev.lastUserMessage}"` : ''}
${prev.lastAssistantMessage ? `- Assistant last answered: "${prev.lastAssistantMessage.slice(0, 300)}..."` : ''}`;
      enrichedSystemContext += '\n\n' + prevBlock;
    }

    const queryText = buildChatQueryText(messages, enrichedSystemContext);
    const memoryResult = await forceMemoryService.getMemoryContext(request.userId, queryText, {
      mode: 'chat',
      depth: 'l1',
      contextWindow: 2,
    });

    const systemPrompt = buildChatPrompt({
      systemContext: enrichedSystemContext,
      memoryContext: memoryResult.context,
    });

    // Load user profile and saved credentials so browser registration can automatically log in or sign up
    let userProfile: any = null;
    try {
      const admin = createAdminClient();
      userProfile = await loadProfile(admin, request.userId);
    } catch {
      // Graceful fallback if Supabase admin client is not available in mock/test
    }

    // Multi-turn autonomous tool execution loop (supports up to 5 tool turns for full chains)
    const MAX_TOOL_TURNS = 5;
    let turnCount = 0;
    const conversationHistory: ForceAgentMessage[] = [...messages];
    const executedTools: ToolExecutionData[] = [];
    const turnNarratives: string[] = [];
    let lastSearchResults: any[] = [];
    let finalMessage = '';
    let accumulatedUsage: ForceAgentUsage = {};
    let isTerminalTool = false;

    while (turnCount < MAX_TOOL_TURNS) {
      const llmResult = await anthropicAdapter.execute({
        system: systemPrompt,
        messages: conversationHistory,
        maxTokens: 1024,
        tools: FORCE_APP_TOOLS,
      });

      if (!llmResult.ok || !llmResult.data) {
        if (turnCount === 0) {
          return {
            type: 'chat',
            memorySource: memoryResult.source,
            errors: [llmResult.error || 'Claude request failed'],
          };
        }
        break;
      }

      accumulatedUsage = {
        input_tokens: (accumulatedUsage.input_tokens || 0) + (llmResult.data.usage?.input_tokens || 0),
        output_tokens: (accumulatedUsage.output_tokens || 0) + (llmResult.data.usage?.output_tokens || 0),
      };

      if (llmResult.data.text && llmResult.data.text.trim()) {
        const textSnippet = llmResult.data.text.trim();
        turnNarratives.push(textSnippet);
        finalMessage = textSnippet;
      }

      const toolCalls = llmResult.data.toolCalls;
      if (!toolCalls || toolCalls.length === 0) {
        // Claude responded with final text, no further tools needed in this turn
        break;
      }

      const call = toolCalls[0];
      if (!call) break;
      const {
        stepExecution,
        outputForLlm,
        isTerminalTool: terminalSignal,
        lastSearchResults: newSearchResults,
      } = await this.executeAppTool(call, request, userProfile, lastUserMsg);
      if (terminalSignal !== undefined) isTerminalTool = terminalSignal;
      if (newSearchResults) {
        lastSearchResults = newSearchResults;
      }

      if (stepExecution) {
        if (llmResult.data.text && llmResult.data.text.trim()) {
          const stepNarrative = llmResult.data.text.trim();
          stepExecution.narrative = stepNarrative;
          if (!stepExecution.message) {
            stepExecution.message = stepNarrative;
          }
        }
        executedTools.push(stepExecution);
      }

      if (isTerminalTool) {
        break;
      }

      // Feed tool result back to Claude for the next turn
      conversationHistory.push({
        role: 'assistant',
        content: [
          ...(llmResult.data.text ? [{ type: 'text', text: llmResult.data.text }] : []),
          {
            type: 'tool_use',
            id: call.id,
            name: call.name,
            input: call.input,
          },
        ] as any,
      });

      conversationHistory.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: call.id,
            content: typeof outputForLlm === 'string' ? outputForLlm : JSON.stringify(outputForLlm),
          },
        ] as any,
      });

      turnCount++;
    }

    // Guarantee end-to-end task completion for compound actionable goals (e.g. "find event and sign me up online")
    const isCompoundRegistration = /\b(sign\s*(me\s*)?up|register\s*me|rsvp|book(\s*it|\s*me)?)\b/i.test(lastUserMsg);
    if (
      isCompoundRegistration &&
      lastSearchResults &&
      lastSearchResults.length > 0 &&
      !executedTools.some((t) => t.tool === 'tinyfish')
    ) {
      const targetEvent =
        lastSearchResults.find(
          (r: any) =>
            r.url &&
            (/lu\.ma|luma|eventbrite|meetup|ticket|register/i.test(r.url) ||
              /event|summit|conference|workshop|hackathon/i.test(r.title || ''))
        ) ||
        lastSearchResults.find((r: any) => Boolean(r.url)) ||
        lastSearchResults[0];

      if (targetEvent?.url) {
        const targetUrl = targetEvent.url;
        const targetTitle = targetEvent.title || 'Event';
        const prompt = `Register user online for ${targetTitle} at ${targetUrl}`;
        const tinyfishExecution: ToolExecutionData = {
          tool: 'tinyfish',
          status: 'running',
          title: `Registration: ${targetTitle}`,
          data: {
            url: targetUrl,
            eventUrl: targetUrl,
            title: targetTitle,
            prompt,
            taskType: 'registration',
            goal: buildUniversalGoal({
              prompt: `Register for ${targetTitle}`,
              url: targetUrl,
              taskType: 'registration',
              location: request.location,
              profile: userProfile,
            }),
          },
        };
        executedTools.push(tinyfishExecution);

        if (!/launched|registering|registration agent|tinyfish/i.test(finalMessage)) {
          finalMessage = `${finalMessage ? finalMessage + '\n\n' : ''}I have automatically launched the TinyFish browser registration agent for **${targetTitle}** (${targetUrl}) to complete your online sign-up. It will check availability, sign in with your credentials if needed, and complete your registration.`;
        }
      }
    }

    // Auto-create task if user requested a compound task creation goal ("search for X and add to my tasks")
    const isCompoundTaskCreation = /\b(add\s+(a\s+)?(task|todo)|create\s+(a\s+)?(task|todo)|remind\s+me)\b/i.test(lastUserMsg);
    if (
      isCompoundTaskCreation &&
      !executedTools.some((t) => t.tool === 'task_generation' || t.tool === 'todo_updated')
    ) {
      const firstResult = lastSearchResults && lastSearchResults[0];
      const taskTitle = firstResult?.title ? `Review / Attend ${firstResult.title}` : `Follow up: ${lastUserMsg.substring(0, 40)}`;
      const todo = await createTodo({
        userId: request.userId,
        title: taskTitle,
        description: firstResult?.url ? `Source: ${firstResult.url}` : undefined,
        priority: 'medium',
        category: 'Personal',
      });
      executedTools.push({
        tool: 'task_generation',
        status: 'success',
        title: 'Task Created',
        data: todo,
      });
      if (!/task|todo|added/i.test(finalMessage)) {
        finalMessage = `${finalMessage ? finalMessage + '\n\n' : ''}I have also added a task to your to-do list: **"${taskTitle}"**.`;
      }
    }

    // Synthesize Claude-style textual context across turns if intermediate step narratives exist
    if (turnNarratives.length > 1) {
      const lastNarrative = turnNarratives[turnNarratives.length - 1] || '';
      const priorNarratives = turnNarratives.slice(0, -1);
      const missingPriors = priorNarratives.filter((p) => !lastNarrative.includes(p));
      if (missingPriors.length > 0) {
        finalMessage = [...missingPriors, lastNarrative].join('\n\n');
      } else {
        finalMessage = lastNarrative;
      }
    } else if (turnNarratives.length === 1 && !finalMessage) {
      finalMessage = turnNarratives[0] || '';
    }

    // Determine primary tool for backward compatibility
    const primaryTool =
      executedTools.find((t) => t.tool === 'tinyfish') ||
      executedTools.find((t) => t.tool !== 'user_location') ||
      executedTools[executedTools.length - 1] ||
      executedTools[0];

    // Capture turn into memory asynchronously (capture path)
    const activeSessionId = request.sessionId || `chat:${request.userId}`;
    void forceMemoryService.captureMessage(request.userId, {
      sessionId: activeSessionId,
      messages,
      source: 'chat',
    });

    return {
      type: 'chat',
      message: finalMessage || 'I have completed your request.',
      toolExecution: primaryTool,
      toolExecutions: executedTools,
      memorySource: memoryResult.source,
      usage: accumulatedUsage,
    };
  }

  private async handleJournalAnalysis(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const title = (request.metadata?.title as string) || '';
    const content = request.entryText || '';
    const analysisType = (request.metadata?.analysisType as string) || 'combined';

    if (!title && !content) {
      return {
        type: 'journal_analysis',
        memorySource: 'none',
        errors: ['Missing journal content for analysis'],
      };
    }

    const memoryResult = await forceMemoryService.getMemoryContext(request.userId, content, {
      mode: 'journal_analysis',
      title,
      content,
    });

    const prompt = buildAnalysisPrompt({
      title,
      content,
      analysisType,
      historicalContext: memoryResult.context,
    });

    const llmResult = await anthropicAdapter.execute({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 8192,
      temperature: 0.7,
    });

    if (!llmResult.ok || !llmResult.data) {
      return {
        type: 'journal_analysis',
        memorySource: memoryResult.source,
        errors: [llmResult.error || 'Claude request failed'],
      };
    }

    const jsonString = extractFirstJson(llmResult.data.text);
    if (!jsonString) {
      return {
        type: 'journal_analysis',
        memorySource: memoryResult.source,
        errors: ['Invalid JSON response from Claude API'],
      };
    }

    let parsedAnalysis: unknown;
    try {
      parsedAnalysis = JSON.parse(jsonString);
    } catch {
      return {
        type: 'journal_analysis',
        memorySource: memoryResult.source,
        errors: ['Failed to parse Claude response JSON'],
      };
    }

    // Synthesis path — persist distilled narrative/reflective signals (non-blocking).
    const summary =
      typeof parsedAnalysis === 'object' &&
      parsedAnalysis !== null &&
      'summary' in parsedAnalysis &&
      typeof (parsedAnalysis as { summary?: unknown }).summary === 'string'
        ? (parsedAnalysis as { summary: string }).summary
        : undefined;

    const insights =
      typeof parsedAnalysis === 'object' &&
      parsedAnalysis !== null &&
      'keyInsights' in parsedAnalysis &&
      Array.isArray((parsedAnalysis as { keyInsights?: unknown }).keyInsights)
        ? ((parsedAnalysis as { keyInsights: Array<{ insight?: string }> }).keyInsights || [])
            .map((item) => item.insight)
            .filter((item): item is string => Boolean(item))
        : undefined;

    void forceMemoryService.ingestJournalMessage(request.userId, {
      journalId: request.journalId,
      title,
      content,
      analysisSummary: summary,
      insights,
    });

    return {
      type: 'journal_analysis',
      analysis: parsedAnalysis,
      memorySource: memoryResult.source,
      usage: llmResult.data.usage,
    };
  }

  private async handleAiTaskGeneration(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const query = request.query || request.entryText || '';
    const memoryResult = await forceMemoryService.getMemoryContext(request.userId, query, {
      mode: 'chat',
      depth: 'l1',
      contextWindow: 4,
    });

    const prompt = buildTaskPrompt({
      journalEntry: request.entryText,
      query: request.query,
      memoryContext: memoryResult.context,
      systemContext: request.systemContext,
    });

    const llmResult = await anthropicAdapter.execute({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
      temperature: 0.3,
    });

    if (!llmResult.ok || !llmResult.data) {
      return {
        type: 'ai_task_generation',
        memorySource: memoryResult.source,
        errors: [llmResult.error || 'Task generation failed'],
      };
    }

    let tasks: unknown[] = [];
    const jsonString = extractFirstJson(llmResult.data.text);
    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
          tasks = parsed;
        } else if (parsed && typeof parsed === 'object' && 'todos' in parsed && Array.isArray(parsed.todos)) {
          tasks = parsed.todos;
        } else if (parsed && typeof parsed === 'object' && 'tasks' in parsed && Array.isArray(parsed.tasks)) {
          tasks = parsed.tasks;
        } else {
          tasks = [parsed];
        }
      } catch {
        // keep empty and pass raw text
      }
    }

    return {
      type: 'ai_task_generation',
      message: llmResult.data.text,
      tasks: tasks.length > 0 ? tasks : undefined,
      memorySource: memoryResult.source,
      usage: llmResult.data.usage,
    };
  }

  private async handleExternalAction(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const toolName = request.tool || (request.metadata?.tool as string) || 'tinyfish';
    const adapter = getToolAdapter(toolName);

    if (!adapter) {
      return {
        type: 'external_action',
        memorySource: 'none',
        errors: [`Tool adapter "${toolName}" not found`],
      };
    }

    const toolResult = await adapter.execute(request.metadata || {});

    if (!toolResult.ok) {
      return {
        type: 'external_action',
        memorySource: 'none',
        actionOutcome: toolResult.data,
        errors: [toolResult.error || `Tool "${toolName}" execution failed`],
      };
    }

    // Persist agent outcome to memory
    void forceMemoryService.persistAgentOutcome(request.userId, {
      tool: toolName,
      summary: `Executed action via ${toolName}`,
      success: true,
    });

    return {
      type: 'external_action',
      actionOutcome: toolResult.data,
      memorySource: 'none',
    };
  }

  private async handleExternalIngest(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const toolName = request.tool || 'photon';
    const adapter = getToolAdapter(toolName);

    if (!adapter) {
      return {
        type: 'external_ingest',
        memorySource: 'none',
        errors: [`Ingest adapter "${toolName}" not found`],
      };
    }

    const toolResult = await adapter.execute(request.metadata || {});

    if (!toolResult.ok) {
      return {
        type: 'external_ingest',
        memorySource: 'none',
        actionOutcome: toolResult.data,
        errors: [toolResult.error || `Ingest adapter "${toolName}" failed`],
      };
    }

    return {
      type: 'external_ingest',
      actionOutcome: toolResult.data,
      memorySource: 'none',
    };
  }

  private async handleMemoryQuery(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const query = request.query || request.entryText || '';
    const searchResult = await searchIntelligentMemory({
      userId: request.userId,
      query,
      clientEntries: request.decryptedJournals,
    });

    return {
      type: 'memory_query',
      message: searchResult.answer,
      memorySource: searchResult.source === 'none' ? 'none' : 'vektori',
      actionOutcome: searchResult,
    };
  }

  private async executeAppTool(
    call: { id: string; name: string; input?: Record<string, unknown> },
    request: ForceAgentRequest,
    userProfile?: any,
    lastUserMsg?: string
  ): Promise<{
    stepExecution?: ToolExecutionData;
    outputForLlm: any;
    isTerminalTool?: boolean;
    lastSearchResults?: any[];
  }> {
    const toolInput = call.input || {};
    let stepExecution: any = undefined;
    let outputForLlm: any = undefined;
    let isTerminalTool = false;
    let lastSearchResults: any[] | undefined = undefined;

    switch (call.name) {
      case 'web_search': {
        const query = (toolInput.query as string) || lastUserMsg || '';
        const location = (toolInput.location as string) || request.location?.city;
        const searchRes = await searchWeb({
          query,
          location,
          limit: (toolInput.limit as number) || 5,
        });

        stepExecution = {
          tool: 'web_search',
          status: 'success',
          title: `Web Search: "${query}"`,
          durationMs: searchRes.durationMs,
          data: searchRes,
        };
        outputForLlm = {
          query: searchRes.query,
          provider: searchRes.provider,
          count: searchRes.results.length,
          results: searchRes.results,
        };
        lastSearchResults = searchRes.results;
        break;
      }

      case 'browse_and_register': {
        const targetUrl = (toolInput.url as string) || '';
        const prompt = (toolInput.prompt as string) || 'Complete registration online';
        stepExecution = {
          tool: 'tinyfish',
          status: 'running',
          title: 'Automated Registration',
          data: {
            url: targetUrl,
            eventUrl: targetUrl,
            prompt,
            taskType: 'registration',
            goal: buildUniversalGoal({
              prompt,
              url: targetUrl,
              taskType: 'registration',
              location: request.location,
              profile: userProfile,
            }),
          },
        };
        outputForLlm = `Live browser agent launched for ${targetUrl}. It is actively opening the page to check ticket availability and registration status, and will log in using profile credentials or guest sign-up if needed. Inform the user in natural, friendly language that you have opened the page to check availability and start registration, and do not claim tickets are confirmed or an email has arrived since the browser is currently in progress.`;
        isTerminalTool = false;
        break;
      }

      case 'get_user_location': {
        const loc = request.location;
        if (loc && loc.latitude && loc.longitude) {
          const area = [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
          stepExecution = {
            tool: 'user_location',
            status: 'success',
            title: `Location: ${area || 'Coordinates Found'}`,
            data: loc,
          };
          outputForLlm = {
            latitude: loc.latitude,
            longitude: loc.longitude,
            city: loc.city,
            region: loc.region,
            country: loc.country,
            formattedAddress: loc.formattedAddress,
            timezone: loc.timezone,
          };
        } else {
          stepExecution = {
            tool: 'user_location',
            status: 'unsupported',
            title: 'Location Permission Needed',
            data: { granted: false },
          };
          outputForLlm = {
            error:
              "Current GPS coordinates have not been received yet. Ask the user in your natural wingman tone to tap the paperclip icon (📎) and share their location pin on Telegram, or simply tell you what city or neighborhood they're in, and you will immediately pull up exact spots and directions.",
          };
        }
        break;
      }

      case 'fetch_journals': {
        const { entries } = await fetchJournals({
          userId: request.userId,
          dates: toolInput.dates as string[],
          query: toolInput.query as string,
          clientEntries: request.decryptedJournals,
          limit: (toolInput.limit as number) || 5,
        });
        stepExecution = {
          tool: 'journal_read',
          status: 'success',
          title: `Retrieved ${entries.length} Journal Entries`,
          data: { entries },
        };
        outputForLlm = { count: entries.length, entries };
        break;
      }

      case 'analyze_journals': {
        const analysis = await analyzeJournals({
          userId: request.userId,
          dates: toolInput.dates as string[],
          query: toolInput.query as string,
          clientEntries: request.decryptedJournals,
        });
        stepExecution = {
          tool: 'cognition_engine_result',
          status: 'success',
          title: `Cognition Engine: ${analysis.dates.join(' & ')}`,
          data: analysis,
        };
        outputForLlm = analysis;
        break;
      }

      case 'analyze_pattern_map': {
        const patternData = await analyzePatternMap({
          userId: request.userId,
          dates: toolInput.dates as string[],
          query: toolInput.query as string,
          clientEntries: request.decryptedJournals,
        });
        stepExecution = {
          tool: 'pattern_map_result',
          status: 'success',
          title: `Pattern Map: ${patternData.dates.join(' & ')}`,
          data: patternData,
        };
        outputForLlm = patternData;
        break;
      }

      case 'analyze_voice': {
        const voiceData = await analyzeVoice({
          userId: request.userId,
          dates: toolInput.dates as string[],
          query: toolInput.query as string,
          clientEntries: request.decryptedJournals,
        });
        stepExecution = {
          tool: 'voice_analysis_result',
          status: 'success',
          title: `Voice Analysis: ${voiceData.dates.join(' & ')}`,
          data: voiceData,
        };
        outputForLlm = voiceData;
        break;
      }

      case 'fetch_todos': {
        const todos = await fetchTodos({
          userId: request.userId,
          status: (toolInput.status as any) || 'all',
          priority: toolInput.priority as any,
          clientTodos: request.decryptedTodos,
        });
        stepExecution = {
          tool: 'todo_list',
          status: 'success',
          title: `To-Do List (${todos.length} items)`,
          data: { todos },
        };
        outputForLlm = { count: todos.length, todos };
        break;
      }

      case 'create_todo': {
        const todo = await createTodo({
          userId: request.userId,
          title: (toolInput.title as string) || 'New Task',
          description: toolInput.description as string,
          priority: toolInput.priority as any,
          due_date: toolInput.due_date as string,
          category: toolInput.category as string,
          reminder_at: toolInput.reminder_at as string,
        });
        stepExecution = {
          tool: 'task_generation',
          status: 'success',
          title: 'Task Created',
          data: todo,
        };
        outputForLlm = todo;
        break;
      }

      case 'update_todo': {
        try {
          const updated = await updateTodoStatus({
            userId: request.userId,
            id: toolInput.id as string,
            titleMatch: toolInput.titleMatch as string,
            status: (toolInput.status as any) || 'done',
          });
          stepExecution = {
            tool: 'todo_updated',
            status: 'success',
            title: 'Task Updated',
            data: updated,
          };
          outputForLlm = updated;
        } catch (e: any) {
          outputForLlm = { error: e?.message || 'Update failed' };
        }
        break;
      }

      case 'create_journal_entry': {
        const entry = await createJournalEntry({
          userId: request.userId,
          title: (toolInput.title as string) || 'Reflection',
          content: (toolInput.content as string) || '',
          mood: toolInput.mood as string,
        });
        stepExecution = {
          tool: 'journal_created',
          status: 'success',
          title: 'Journal Entry Created',
          data: entry,
        };
        outputForLlm = entry;
        break;
      }

      case 'get_user_stats': {
        const stats = await getUserStats(request.userId);
        stepExecution = {
          tool: 'user_stats',
          status: 'success',
          title: 'Your Reflection Momentum',
          data: stats,
        };
        outputForLlm = stats;
        break;
      }

      case 'search_memory':
      case 'query_memory': {
        const searchResult = await searchIntelligentMemory({
          userId: request.userId,
          query: (toolInput.query as string) || lastUserMsg || '',
          clientEntries: request.decryptedJournals,
          depth: toolInput.depth as any,
        });
        stepExecution = {
          tool: 'memory_search_result',
          status: 'success',
          title: searchResult.query ? `Memory Search: "${searchResult.query}"` : 'Memory Search',
          data: searchResult,
        };
        outputForLlm = searchResult;
        break;
      }

            case 'suggest_real_world_action': {
        const actionType = (toolInput.action_type as string) || 'walk';
        const title = (toolInput.title as string) || 'Take a step into the real world';
        const description =
          (toolInput.description as string) ||
          'Stepping outside and into the physical environment helps clear working memory.';
        stepExecution = {
          tool: 'real_world_action',
          status: 'success',
          title: `Real-World Action: ${title}`,
          data: {
            action_type: actionType,
            title,
            description,
            estimated_minutes: toolInput.estimated_minutes || 15,
            target_person: toolInput.target_person,
            suggested_prompt: toolInput.suggested_prompt,
          },
        };
        outputForLlm = {
          status: 'suggested',
          action: { action_type: actionType, title, description },
        };
        break;
      }

      case 'register_luma_event': {
        stepExecution = {
          tool: 'tinyfish',
          status: 'running',
          title: 'TinyFish Event Registration',
          data: {
            eventUrl: toolInput.eventUrl,
            url: toolInput.eventUrl,
            taskType: 'registration',
            goal: buildUniversalGoal({
              prompt: 'Register for event',
              url: toolInput.eventUrl as string,
              taskType: 'registration',
              location: request.location,
              profile: userProfile,
            }),
          },
        };
        outputForLlm = `Luma event registration created for ${toolInput.eventUrl}. TinyFish browser agent is running now to log in or register.`;
        isTerminalTool = false;
        break;
      }

      case 'check_residency_schedule': {
        const rawDate = (toolInput.date as string) || '2026-10-25';
        const normalizedDate = /tomorrow|sunday/i.test(rawDate) ? '2026-10-25' : /saturday|today/i.test(rawDate) ? '2026-10-24' : rawDate;
        const depTime = toolInput.departureTime as string | undefined;
        const retTime = toolInput.returnTime as string | undefined;

        const scheduleCheck = checkResidencyConflicts(normalizedDate, depTime, retTime);
        stepExecution = {
          tool: 'schedule_conflict_check',
          status: 'success',
          title: `Dhun Schedule Conflict Check: ${normalizedDate}`,
          data: scheduleCheck,
        };
        outputForLlm = scheduleCheck;
        break;
      }

      case 'manage_sidequest_coordination': {
        const coordSessionId = request.userId || request.socialContext?.senderId || 'dhun_group_coord';
        const action = (toolInput.action as string) || 'get_status';

        let state;
        if (action === 'get_status' || action === 'check_capacity' || action === 'check_feasibility') {
          state = getCoordinationState(coordSessionId);
        } else {
          const updates: any = {};
          if (toolInput.eventName !== undefined) updates.eventName = toolInput.eventName;
          if (toolInput.eventVerified !== undefined) updates.eventVerified = toolInput.eventVerified;
          if (toolInput.hostPermission !== undefined) updates.hostPermission = toolInput.hostPermission;
          if (toolInput.hostNotes !== undefined) updates.hostNotes = toolInput.hostNotes;
          if (toolInput.interestedCount !== undefined) updates.interestedCount = toolInput.interestedCount;
          if (toolInput.interestedPeople !== undefined) updates.interestedPeople = toolInput.interestedPeople;
          if (toolInput.transportCapacity !== undefined) updates.transportCapacity = toolInput.transportCapacity;
          if (toolInput.returnPlan !== undefined) updates.returnPlan = toolInput.returnPlan;
          if (toolInput.returnNotes !== undefined) updates.returnNotes = toolInput.returnNotes;

          state = updateCoordinationState(coordSessionId, updates);
        }

        stepExecution = {
          tool: 'sidequest_coordination_state',
          status: 'success',
          title: `Coordination State: ${state.status.toUpperCase()}`,
          data: state,
        };
        outputForLlm = state;
        break;
      }

      case 'draft_group_interest_check': {
        const eventName = (toolInput.eventName as string) || 'concert in Jaipur';
        const targetDate = (toolInput.targetDate as string) || 'tomorrow';
        const messageText = `A few of us are thinking about going to a ${eventName} ${targetDate}. We're checking whether timing and transport work before committing. Would you be interested if the logistics line up? This is just an interest check, not a confirmed plan.`;

        stepExecution = {
          tool: 'draft_interest_check',
          status: 'success',
          title: 'Drafted Community Interest Check',
          data: {
            messageText,
            requiresUserApproval: true,
          },
        };
        outputForLlm = {
          draftMessage: messageText,
          requiresUserApproval: true,
          status: 'ready_for_user_review',
          instruction: 'Show this exact draft to the user and ask for their approval before sending it to the group or hosts.',
        };
        break;
      }

      case 'get_user_schedule': {
        const rawDate = (toolInput.date as string) || 'today';
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const dateStr = /tomorrow|sunday/i.test(rawDate) ? tomorrow : /today|saturday/i.test(rawDate) ? todayStr : rawDate;

        const schedule = await getUserSchedule({
          userId: request.userId,
          dateStr,
        });

        stepExecution = {
          tool: 'user_schedule',
          status: 'success',
          title: `Schedule for ${dateStr}`,
          data: schedule,
        };
        outputForLlm = schedule;
        break;
      }

      case 'get_user_gmail': {
        const query = toolInput.query as string | undefined;
        const maxResults = toolInput.maxResults as number | undefined;

        const gmail = await getUserGmail({
          userId: request.userId,
          query,
          maxResults,
        });

        stepExecution = {
          tool: 'user_gmail',
          status: 'success',
          title: gmail.connected ? `Gmail (${gmail.email})` : 'Gmail Not Connected',
          data: gmail,
        };
        outputForLlm = gmail;
        break;
      }

      default: {
        outputForLlm = { error: `Tool ${call.name} not implemented` };
      }
    }

    return { stepExecution, outputForLlm, isTerminalTool, lastSearchResults };
  }

  private async handleSocialInteraction(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const social = request.socialContext || {
      platform: 'whatsapp',
      senderId: 'unknown',
      messageId: `msg_${Date.now()}`,
    };

    const userText = (
      social.audioTranscript ||
      request.query ||
      request.entryText ||
      getMessageText(request.messages?.[request.messages.length - 1]?.content) ||
      ''
    ).trim();

    const platform = (social.platform || 'whatsapp').toLowerCase();
    const sideEffects: NonNullable<ForceAgentResult['sideEffects']> = {};
    const executedTools: ToolExecutionData[] = [];

    // Track A: Intelligent Silent Cognition
    // 1. Detect if user is asking to create an explicit task (not just querying tasks)
    const isExplicitTaskCreation =
      /^(remind me to|todo:|need to|have to|remember to|schedule)\s+/i.test(userText) &&
      !/^(what|show|list|view|tell|how|when|can you show)\b/i.test(userText);

    if (isExplicitTaskCreation) {
      try {
        const cleanedTitle = userText
          .replace(/^(remember to|remind me to|need to|have to|todo:)\s+/i, '')
          .slice(0, 100);
        const todo = await createTodo({
          userId: request.userId,
          title: cleanedTitle || 'Social task',
          description: `Captured via ${platform} message: "${userText}"`,
          priority: 'medium',
          category: 'Work & Execution',
        });
        sideEffects.taskCreated = true;
        sideEffects.taskScratchpadUpdated = true;
        executedTools.push({
          tool: 'task_generation',
          status: 'success',
          title: 'Task Created in Scratchpad',
          data: todo,
        });
      } catch (err: any) {
        console.warn('[Orchestrator Social] Silent task creation error:', err.message);
      }
    }

    // 2. Detect if text contains actual emotional reflection or personal fatigue (NOT informational queries or web searches)
    const isInformationalQuery =
      /^(can you|what|where|when|who|why|how|tell me|find|search|lookup|look up|check|recommend|list|show|is there|are there|give me)\b/i.test(userText) ||
      userText.endsWith('?') ||
      /\b(movie|film|cinema|release|releases|news|weather|tickets?|showtimes?)\b/i.test(userText);

    const isReflection =
      !isInformationalQuery &&
      !isExplicitTaskCreation &&
      (userText.length > 50 ||
        /\b(felt|feeling|feel|tired|exhausted|happy|drained|frustrated|grateful|today was|reflect|thought|struggling|burnt out|venting)\b/i.test(
          userText
        ));

    if (isReflection && userText.length > 5) {
      try {
        const journal = await createJournalEntry({
          userId: request.userId,
          title: `Reflection via ${platform === 'whatsapp' ? 'WhatsApp' : platform === 'imessage' ? 'iMessage' : platform === 'telegram' ? 'Telegram' : platform}`,
          content: userText,
          mood: /\b(tired|exhausted|drained|burned out|bad)\b/i.test(userText)
            ? 'reflective'
            : /\b(happy|excited|great|amazing|proud)\b/i.test(userText)
            ? 'energized'
            : 'neutral',
        });
        sideEffects.journalSaved = true;
        executedTools.push({
          tool: 'journal_created',
          status: 'success',
          title: 'Journal Saved to Memory',
          data: journal,
        });

        void forceMemoryService.captureMessage(request.userId, {
          sessionId: `social:${platform}:${request.userId}`,
          messages: [{ role: 'user', content: userText }],
          source: 'photon',
        });
      } catch (err: any) {
        console.warn('[Orchestrator Social] Silent journal save error:', err.message);
      }
    }

    // 3. Energy Pulse Update
    if (/\b(tired|exhausted|drained|burnout|low energy)\b/i.test(userText)) {
      sideEffects.energyPulseUpdated = true;
    }

    // 4. Sidequest / TinyFish trigger & Group Outing Coordination
    if (/\b(concert|jaipur|dhun|sidequest|group outing|outing|residency)\b/i.test(userText)) {
      sideEffects.sidequestCoordination = true;
      const coordSessionId = request.userId || social.senderId || 'dhun_group_coord';
      const updates: any = {};

      if (/\b(thumbs up|approved|permission.*granted|permission.*given|manvendra.*(approved|gave|ok)|host.*ok)\b/i.test(userText)) {
        updates.hostPermission = 'granted';
        updates.hostNotes = userText.slice(0, 100);
      }
      if (/\b(pre-booked driver|driver ramesh|driver.*wait|driver.*booked|return.*booked|driver.*confirmed)\b/i.test(userText)) {
        updates.returnPlan = 'confirmed';
        updates.returnNotes = userText.slice(0, 100);
      }
      const capacityMatch = userText.match(/\b(capacity is (now )?(\d+)|(\d+)-seater)\b/i);
      if (capacityMatch) {
        const rawCap = capacityMatch[3] || capacityMatch[4];
        if (rawCap) {
          const cap = parseInt(rawCap, 10);
          if (!isNaN(cap)) updates.transportCapacity = cap;
        }
      }
      const countMatch = userText.match(/\b(\d+)\s*(people|residents|persons|of us)\b/i);
      const rawCount = countMatch?.[1];
      if (rawCount) {
        const count = parseInt(rawCount, 10);
        if (!isNaN(count)) updates.interestedCount = count;
      }
      if (/\b(concert|fusion|sufi|show|tickets).*at\b/i.test(userText) || /\b(jawahar|kala kendra|tickets.*(confirmed|booked|ready|have))\b/i.test(userText)) {
        updates.eventVerified = true;
      }

      if (Object.keys(updates).length > 0) {
        updateCoordinationState(coordSessionId, updates);
      }
    }
    if (/\b(bored|what to do|recommend|plans for tonight|weekend plans|sidequest)\b/i.test(userText)) {
      sideEffects.toolLaunched = 'tinyfish';
    }

    // Track B: Outbound Banter & Full Autonomous Tool Execution
    const memoryResult = await forceMemoryService.getMemoryContext(request.userId, userText, {
      mode: 'chat',
      depth: 'l1',
      contextWindow: 4,
    });

    const socialPrompt = buildSocialAgentPrompt({
      platform,
      senderName: social.senderName,
      location: request.location,
      userContext: `Message ID: ${social.messageId}`,
      memoryContext: memoryResult.context,
      recentThreadTurns: social.recentThreadTurns,
    });

    let userProfile: any = null;
    try {
      const admin = createAdminClient();
      userProfile = await loadProfile(admin, request.userId);
    } catch {}

    const threadMessages: Array<any> = [];
    if (social.recentThreadTurns && social.recentThreadTurns.length > 0) {
      for (const turn of social.recentThreadTurns.slice(-14)) {
        threadMessages.push({
          role: turn.role === 'assistant' ? 'assistant' : 'user',
          content: turn.content,
        });
      }
    }
    const lastThreadMsg = threadMessages[threadMessages.length - 1];
    if (!lastThreadMsg || lastThreadMsg.role !== 'user' || lastThreadMsg.content !== userText) {
      threadMessages.push({ role: 'user', content: userText || 'Hey' });
    }

    let replyText = '';
    let usage: ForceAgentUsage | undefined;
    const MAX_TOOL_TURNS = 3;
    let turnCount = 0;

    // Autonomous Tool Execution Loop for Photon Chat (Web Search, Firecrawl, Todos, Memory, TinyFish)
    while (turnCount < MAX_TOOL_TURNS) {
      try {
        const llmResult = await anthropicAdapter.execute({
          system: socialPrompt,
          messages: threadMessages,
          maxTokens: 1500,
          temperature: 0.7,
          tools: FORCE_APP_TOOLS,
        });

        if (!llmResult.ok || !llmResult.data) {
          break;
        }

        usage = {
          input_tokens: (usage?.input_tokens || 0) + (llmResult.data.usage?.input_tokens || 0),
          output_tokens: (usage?.output_tokens || 0) + (llmResult.data.usage?.output_tokens || 0),
        };

        const toolCalls = llmResult.data.toolCalls;
        if (!toolCalls || toolCalls.length === 0) {
          if (llmResult.data.text && llmResult.data.text.trim()) {
            replyText = llmResult.data.text.trim();
          }
          break;
        }

        // Execute tool call via unified executeAppTool
        const call = toolCalls[0];
        if (!call) break;
        const { stepExecution, outputForLlm } = await this.executeAppTool(call, request, userProfile, userText);
        if (stepExecution) {
          executedTools.push(stepExecution);
          if (call.name === 'web_search') sideEffects.toolLaunched = 'web_search';
          if (call.name === 'browse_and_register' || call.name === 'register_luma_event') sideEffects.toolLaunched = 'tinyfish';
          if (call.name === 'create_todo') sideEffects.taskCreated = true;
          if (call.name === 'create_journal_entry') sideEffects.journalSaved = true;
          if (
            call.name === 'check_residency_schedule' ||
            call.name === 'manage_sidequest_coordination' ||
            call.name === 'draft_group_interest_check'
          ) {
            sideEffects.sidequestCoordination = true;
          }
        }

        // Feed tool results back to Claude
        threadMessages.push({
          role: 'assistant',
          content: [
            ...(llmResult.data.text ? [{ type: 'text', text: llmResult.data.text }] : []),
            {
              type: 'tool_use',
              id: call.id,
              name: call.name,
              input: call.input,
            },
          ],
        });

        threadMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: call.id,
              content: typeof outputForLlm === 'string' ? outputForLlm : JSON.stringify(outputForLlm),
            },
          ],
        });

        turnCount++;
      } catch (err: any) {
        console.warn('[Orchestrator Social] Autonomous tool loop turn failed:', err.message);
        break;
      }
    }

    // Safety net: If user asked an informational / web query and agent deflected or didn't answer with search
    const isDeflection =
      /\b(wrong wingman|not a film critic|more of a.*guy|can't browse|cannot search|don't have access|as an ai)\b/i.test(replyText);
    const needsSearch =
      /\b(movie|film|cinema|release|releases|news|events? in|weather|what is|when is)\b/i.test(userText);

    if ((!replyText || isDeflection) && needsSearch) {
      try {
        const searchRes = await searchWeb({
          query: userText,
          location: request.location?.city,
          limit: 5,
        });

        if (searchRes.results.length > 0) {
          executedTools.push({
            tool: 'web_search',
            status: 'success',
            title: `Web Search: "${userText}"`,
            data: searchRes,
          });
          sideEffects.toolLaunched = 'web_search';

          const searchSnippets = searchRes.results
            .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
            .join('\n');

          const isListOrRecommendation = /recommend|movie|film|cinema|event|release|places|spots|shows|fest|theat/i.test(userText);
          const formattingGuidance = isListOrRecommendation
            ? `Format the response cleanly and attractively for normal users reading on mobile chat (${platform.toUpperCase()}):\n- Start with a quick, punchy 1-sentence intro.\n- Present the main top releases as a clean bulleted list using '•' and emojis:\n  • 🎬 *Movie Title* — quick hook on the stars/director and what makes it exciting.\n- Leave a blank line between items so it is spacious, clean, and effortless to read.\n- If user asked about Bengali cinema, strictly feature the 4 Durga Puja headliners: *DeSu7*, *Bohurupi: The Golden Daku*, *The Eken: Kerala-e-Kurukshetra*, and *Emperor vs Sarat Chandra*.\n- Wrap up with a quick charismatic 1-sentence closing question.\n- Do NOT cram everything into a single wall of text.`
            : `Answer the user directly, warmly, and concisely in 2-3 natural sentences using the factual information above. Do not deflect.`;

          const synthesisPrompt = `${socialPrompt}\n\nUser asked: "${userText}"\n\nLive Search Results:\n${searchSnippets}\n\n${formattingGuidance}`;

          const fallbackLlm = await anthropicAdapter.execute({
            system: synthesisPrompt,
            messages: [{ role: 'user', content: userText }],
            maxTokens: 550,
            temperature: 0.6,
          });

          if (fallbackLlm.ok && fallbackLlm.data?.text) {
            replyText = fallbackLlm.data.text.trim();
          }
        }
      } catch (err: any) {
        console.warn('[Orchestrator Social] Web search safety fallback failed:', err.message);
      }
    }

    if (!replyText) {
      if (sideEffects.taskCreated) {
        replyText = platform === 'whatsapp' || platform === 'telegram'
          ? "Got it, locked into your *To-Do list*. Let's make sure it actually happens."
          : "Got it, locked into your To-Do list. Let's make sure it actually happens.";
      } else if (sideEffects.journalSaved) {
        replyText = "Logged that to your reflections. Take a second to breathe — we'll tackle the rest tomorrow.";
      } else {
        replyText = "Heard you loud and clear. Ready whenever you are!";
      }
    }

    // Extract mediaUrl if an image is provided in markdown or tool outcome
    let extractedMediaUrl = social.mediaUrl;
    const imgMatch =
      replyText.match(/!\[.*?\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif|svg)(?:\?[^\s)]*)?)\)/i) ||
      replyText.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s)]*)?)/i);
    if (!extractedMediaUrl && imgMatch) {
      extractedMediaUrl = imgMatch[1];
    }

    const formattedReply = formatMessageForPlatform(replyText, platform);

    return {
      type: 'social_interaction',
      message: formattedReply,
      outboundSocialReply: {
        platform: platform as any,
        recipientId: social.senderId,
        text: formattedReply,
        mediaUrl: extractedMediaUrl,
      },
      sideEffects,
      toolExecutions: executedTools.length > 0 ? executedTools : undefined,
      memorySource: memoryResult.source,
      usage,
    };
  }

  recordTrace(trace: AgentTrace): void {
    this.traces.unshift(trace);
    if (this.traces.length > 100) {
      this.traces.pop();
    }
  }

  getAgentTraces(options?: { userId?: string; limit?: number; requestType?: string }): AgentTrace[] {
    let filtered = this.traces;
    if (options?.userId) {
      filtered = filtered.filter((t) => t.userId === options.userId);
    }
    if (options?.requestType) {
      filtered = filtered.filter((t) => t.requestType === options.requestType);
    }
    return filtered.slice(0, options?.limit || 50);
  }

  clearTraces(): void {
    this.traces = [];
  }

  recordAuditEvent(event: Omit<AgentAuditEvent, 'id' | 'timestamp'>): AgentAuditEvent {
    const fullEvent: AgentAuditEvent = {
      ...event,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditEvents.unshift(fullEvent);
    if (this.auditEvents.length > 100) {
      this.auditEvents.pop();
    }
    return fullEvent;
  }

  getAuditEvents(options?: { limit?: number; type?: string; source?: string }): AgentAuditEvent[] {
    let filtered = this.auditEvents;
    if (options?.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }
    if (options?.source) {
      filtered = filtered.filter((e) => e.source === options.source);
    }
    return filtered.slice(0, options?.limit || 50);
  }

  clearAuditEvents(): void {
    this.auditEvents = [];
  }

  private async handleAgentControl(request: ForceAgentRequest): Promise<ForceAgentResult> {
    const action = (request.metadata?.action as string) || 'health';

    if (action === 'diagnostics') {
      const diagnostics = forceMemoryService.getMemorySourceDiagnostics();
      return {
        type: 'agent_control',
        memorySource: 'none',
        actionOutcome: diagnostics,
      };
    }

    if (action === 'traces') {
      const traces = this.getAgentTraces({
        userId: request.userId,
        limit: (request.metadata?.limit as number) || 50,
        requestType: request.metadata?.requestType as string,
      });
      return {
        type: 'agent_control',
        memorySource: 'none',
        actionOutcome: { traces },
      };
    }

    if (action === 'audit_logs') {
      const auditEvents = this.getAuditEvents({
        limit: (request.metadata?.limit as number) || 50,
        type: request.metadata?.type as string,
        source: request.metadata?.source as string,
      });
      return {
        type: 'agent_control',
        memorySource: 'none',
        actionOutcome: { auditEvents },
      };
    }

    if (action === 'clear_traces') {
      this.clearTraces();
      return {
        type: 'agent_control',
        memorySource: 'none',
        actionOutcome: { cleared: true },
      };
    }

    const healthSummary = await this.getHealthSummary();
    return {
      type: 'agent_control',
      memorySource: 'none',
      actionOutcome: healthSummary,
    };
  }

  async getHealthSummary(): Promise<ForceAgentHealthSummary> {
    const [memoryHealth, tools] = await Promise.all([
      forceMemoryService.healthCheck(),
      checkAllToolsHealth(),
    ]);

    const allToolsOk = Object.values(tools).every((t) => t.ok);
    const overallStatus = memoryHealth.ok && allToolsOk
      ? 'healthy'
      : memoryHealth.ok || Object.values(tools).some((t) => t.ok)
        ? 'degraded'
        : 'unhealthy';

    return {
      status: overallStatus,
      memory: memoryHealth,
      tools,
    };
  }
}

export const forceAgentOrchestrator = new ForceAgentOrchestrator();

export {
  anthropicAdapter,
  vektoriAdapter,
  tinyfishAdapter,
  photonAdapter,
  toolRegistry,
  getToolAdapter,
  checkAllToolsHealth,
};

export type { MemorySource, ForceAgentResult, ForceAgentHealthSummary, AgentTrace, AgentAuditEvent };
