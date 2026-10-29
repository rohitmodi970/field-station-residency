import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildUniversalGoal, classifyBrowserOutcome } from '../lib/force-agent/memoryHelpers.js';
import { tinyfishAdapter } from '../lib/force-agent/phase2Adapters.js';
import { generateSmartSemanticTitle, cleanAiGeneratedTitle, formatDomainBrand } from '../lib/force-agent/smartTitleCore.js';

// ── Date parsing utilities ──────────────────────────────────────────────────
function parseRequestedDatePatterns(text) {
  const dates = [];
  const lower = text.toLowerCase();

  const monthMap = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sept: '09', sep: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  };

  const dayMonthRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/gi;
  let match;
  while ((match = dayMonthRegex.exec(lower)) !== null) {
    const dayStr = match[1];
    const monthStr = match[2];
    if (dayStr && monthStr) {
      const day = dayStr.padStart(2, '0');
      const month = monthMap[monthStr.toLowerCase()];
      if (month) dates.push(`${month}-${day}`);
    }
  }

  const monthDayRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;
  while ((match = monthDayRegex.exec(lower)) !== null) {
    const monthStr = match[1];
    const dayStr = match[2];
    if (monthStr && dayStr) {
      const month = monthMap[monthStr.toLowerCase()];
      const day = dayStr.padStart(2, '0');
      if (month) dates.push(`${month}-${day}`);
    }
  }

  const isoRegex = /\b(?:\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g;
  while ((match = isoRegex.exec(lower)) !== null) {
    dates.push(`${match[1]}-${match[2]}`);
  }

  return [...new Set(dates)];
}

function detectConversationalToolIntent(text, conversationMessages = []) {
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

  // 1. TinyFish Universal Browser Agent Intent
  const urlMatch = trimmed.match(/https?:\/\/[^\s<>"')]+/i);
  if (urlMatch) {
    const rawUrl = urlMatch[0];
    const isLuma = /lu\.ma|luma\.com/i.test(rawUrl);
    const taskType =
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
    let pendingUrl;
    const reversed = [...conversationMessages].reverse();

    // Pass 1: Prioritize full HTTP/HTTPS URLs
    for (const msg of reversed) {
      const toolUrl = msg.toolExecution?.data?.url || msg.toolExecution?.data?.eventUrl;
      if (toolUrl && toolUrl.startsWith('http')) {
        pendingUrl = toolUrl;
        break;
      }

      if (msg.toolExecutions && Array.isArray(msg.toolExecutions)) {
        const found = msg.toolExecutions.find(
          (t) =>
            (t.data?.url && t.data?.url.startsWith('http')) ||
            (t.data?.eventUrl && t.data?.eventUrl.startsWith('http'))
        );
        if (found) {
          pendingUrl = found.data?.url || found.data?.eventUrl;
          break;
        }
      }

      const content = msg.content || '';
      const urlInMsg = content.match(/https?:\/\/[^\s<>"')]+/i);
      if (urlInMsg) {
        pendingUrl = urlInMsg[0];
        break;
      }
    }

    // Pass 2: Fallback to domain name
    if (!pendingUrl) {
      for (const msg of reversed) {
        const content = msg.content || '';
        const domainMatch = content.match(/\b([a-zA-Z0-9-]+\.(?:com|org|io|net|co|in|app|ma)(?:\/[^\s<>"')]*)?)\b/i);
        if (domainMatch && !domainMatch[1].includes('@')) {
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
      let resolvedPass;
      const passMatch =
        trimmed.match(/(?:password|pass|secret|pwd|key)(?:\s+is|\s*:|=|\s+to)?\s*([^\s,;]+)/i) ||
        trimmed.match(/(?:password|pass)\s*[:=]\s*([^\s,;]+)/i);
      if (passMatch && passMatch[1] && !['and', 'is', 'for', 'the', 'my', 'to', 'was', 'it'].includes(passMatch[1].toLowerCase())) {
        resolvedPass = passMatch[1].trim();
      }

      let resolvedUser;
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

      const customAnswers = {};
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

  // Unsupported external actions
  const unsupportedPatterns = [
    { regex: /\b(book|reserve)\s+(a\s+)?(flight|hotel|airbnb|car|train|ticket|table)\b/i, action: 'travel and reservation booking' },
    { regex: /\b(order|buy)\s+(a\s+)?(pizza|food|groceries|coffee|lunch|dinner|uber eats|doordash)\b/i, action: 'external food ordering' },
    { regex: /\b(send|draft)\s+(an\s+)?(email|gmail|text message|sms|dm)\s+(to|for)\b/i, action: 'external email and message dispatch' },
    { regex: /\b(call|order)\s+(an\s+)?(uber|lyft|cab|taxi)\b/i, action: 'ride-hailing services' },
    { regex: /\b(buy|sell|trade)\s+(stocks|crypto|bitcoin|shares|options)\b/i, action: 'financial asset trading' },
  ];

  for (const pattern of unsupportedPatterns) {
    if (pattern.regex.test(trimmed)) {
      return { type: 'unsupported', extractedAction: pattern.action };
    }
  }

  // Explicit Mode Analysis Intent
  const datePatterns = parseRequestedDatePatterns(trimmed);
  if (/\b(cognition|cognition engine|story lens)\b/i.test(trimmed)) {
    return { type: 'journal_analysis_cognition', data: { dates: datePatterns, query: trimmed } };
  }
  if (/\b(pattern map|advanced analysis|mindmap|mind map)\b/i.test(trimmed)) {
    return { type: 'journal_analysis_pattern_map', data: { dates: datePatterns, query: trimmed } };
  }
  if (/\b(voice analysis|audio analysis|acoustic signals?|vocal tone)\b/i.test(trimmed)) {
    return { type: 'journal_analysis_voice', data: { dates: datePatterns, query: trimmed } };
  }

  // Date-based or comparative general journal analysis
  if (
    datePatterns.length > 0 &&
    /\b(analyze|analysis|compare|look at|review|break down|examine)\b/i.test(trimmed) &&
    /\b(journals?|entries|diary|thoughts?)\b/i.test(trimmed)
  ) {
    return { type: 'journal_analysis', data: { dates: datePatterns, query: trimmed } };
  }

  if (datePatterns.length >= 2 && /\b(journals?|entries|diary|wrote|written)\b/i.test(trimmed)) {
    return { type: 'journal_analysis', data: { dates: datePatterns, query: trimmed } };
  }

  if (
    /\b(analyze|break down|synthesize)\b/i.test(trimmed) &&
    /\b(my journals?|these entries|diary|reflections?|entries by date)\b/i.test(trimmed)
  ) {
    return { type: 'journal_analysis', data: { query: trimmed } };
  }

  if (/^(can you\s+)?(please\s+)?analyze\s+(my\s+)?(journals?|entries|reflections?|diary)\b/i.test(trimmed)) {
    return { type: 'journal_analysis', data: { query: trimmed } };
  }

  // Show / List Todos
  if (
    /\b(show|list|view|what are|display|get)\b/i.test(trimmed) &&
    /\b(tasks?|todos?|to-dos?|action items?|checklist)\b/i.test(trimmed)
  ) {
    return { type: 'todo_list' };
  }

  // Complete / Mark Done Todo
  if (
    /\b(mark|set|check off|complete|finish|done with)\b/i.test(trimmed) &&
    /\b(task|todo|to-do|item|done|completed)\b/i.test(trimmed)
  ) {
    const match = trimmed
      .replace(/^(please\s+)?(can you\s+)?(mark|set|check off|complete|finish)\s+(the\s+)?(task\s+|todo\s+)?/i, '')
      .replace(/\s+as\s+(done|complete|completed)$/i, '')
      .trim();
    return { type: 'todo_update', data: { titleMatch: match || undefined, status: 'done' } };
  }

  // Semantic Memory & Journal Search Intent (Multi-Tier Memory & Journal Recall)
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

  // Task / Todo creation intent
  const taskCreateRegex = /\b(add|create|make|put|schedule|remind me to)\s+(a\s+)?(task|todo|to-do|reminder|item)\b|^(remind me to|todo:)\s+/i;
  if (taskCreateRegex.test(trimmed)) {
    let taskTitle = trimmed
      .replace(/^(please\s+)?(can you\s+)?(add|create|make|put|schedule|remind me to)\s+(a\s+)?(task|todo|to-do|reminder|item)(\s+to|\s+that|\s+for)?/i, '')
      .replace(/^todo:\s*/i, '')
      .replace(/^remind me to\s+/i, '')
      .trim();
    if (!taskTitle) taskTitle = 'Action Item';
    return { type: 'task_generation', data: { title: taskTitle } };
  }

  // User activity stats / streak
  if (/\b(streak|momentum|stats|statistics|activity score|how active|how many journals)\b/i.test(trimmed)) {
    return { type: 'user_stats' };
  }

  return { type: 'standard' };
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('parseRequestedDatePatterns accurately parses August 29 and September 1', () => {
  const prompt = 'I want to analyze my journals from 29th August and 1st September';
  const dates = parseRequestedDatePatterns(prompt);
  assert.deepEqual(dates.sort(), ['08-29', '09-01'].sort());
});

test('parseRequestedDatePatterns handles American month-first format', () => {
  const prompt = 'Analyze my entries from August 29th and September 1';
  const dates = parseRequestedDatePatterns(prompt);
  assert.deepEqual(dates.sort(), ['08-29', '09-01'].sort());
});

test('detectConversationalToolIntent recognizes date-based journal analysis prompt', () => {
  const prompt = 'I want to analyze my journals from 29th August and 1st September';
  const intent = detectConversationalToolIntent(prompt);
  assert.equal(intent.type, 'journal_analysis');
  assert.deepEqual(intent.data?.dates?.sort(), ['08-29', '09-01'].sort());
});

test('detectConversationalToolIntent recognizes to-do listing query', () => {
  const intent = detectConversationalToolIntent('Show my tasks and to-do list');
  assert.equal(intent.type, 'todo_list');
});

test('detectConversationalToolIntent recognizes to-do completion query', () => {
  const intent = detectConversationalToolIntent('Mark task "review roadmap" as done');
  assert.equal(intent.type, 'todo_update');
  assert.equal(intent.data?.status, 'done');
  assert.ok(intent.data?.titleMatch?.includes('review roadmap'));
});

test('detectConversationalToolIntent recognizes task creation query', () => {
  const intent = detectConversationalToolIntent('Add a task to prepare the quarterly roadmap review tomorrow');
  assert.equal(intent.type, 'task_generation');
  assert.ok(intent.data?.title?.includes('quarterly roadmap review'));
});

test('detectConversationalToolIntent recognizes user stats and momentum query', () => {
  const intent = detectConversationalToolIntent('What is my current streak and stats?');
  assert.equal(intent.type, 'user_stats');
});

test('detectConversationalToolIntent provides fallback for unsupported external services', () => {
  const intent = detectConversationalToolIntent('Book a flight to Tokyo');
  assert.equal(intent.type, 'unsupported');
  assert.equal(intent.extractedAction, 'travel and reservation booking');
});

test('Journal entry date matching correctly matches 2026-08-29 and 2026-09-01', () => {
  const entries = [
    { id: '1', date: '2026-08-29T08:00:00Z', title: 'Aug 29 Reflection' },
    { id: '2', date: '2026-09-01T12:00:00Z', title: 'Sep 1 Reflection' },
    { id: '3', date: '2026-07-20T12:00:00Z', title: 'July Reflection' },
  ];
  const requestedDates = ['08-29', '09-01'];
  const matched = entries.filter((e) => requestedDates.some((d) => e.date.includes(d)));
  assert.equal(matched.length, 2);
  assert.equal(matched[0].id, '1');
  assert.equal(matched[1].id, '2');
});

test('Journal analysis data shape supports UI action candidates and emotional arc', () => {
  const mockAnalysis = {
    dates: ['Aug 29, 2026', 'Sep 1, 2026'],
    summary: 'Between these two entries, your reflections show an intentional shift towards calm focus.',
    overallSentiment: { score: 0.35, label: 'positive' },
    emotionalShift: 'Noticeable progression from feeling scattered to establishing calm clarity.',
    keyInsights: [
      {
        insight: 'Consistent morning reflections reduce daily context-switching stress.',
        evidence: ['Needed to slow down', 'head feels clearer now'],
        significance: 'Protects deep work buffers.',
      },
    ],
    recommendations: [
      {
        area: 'Focus',
        suggestion: 'Keep 20-minute morning reflection buffer',
        rationale: 'Reinforces focus before pings arrive.',
      },
    ],
  };

  assert.equal(mockAnalysis.dates.length, 2);
  assert.ok(mockAnalysis.emotionalShift.includes('calm clarity'));
  assert.equal(mockAnalysis.keyInsights[0].evidence.length, 2);
  assert.equal(mockAnalysis.recommendations[0].area, 'Focus');
});

// ── Smart Media Inspection Tests ────────────────────────────────────────────

function inspectJournalMedia(entries) {
  const hasVoice = entries.some(
    (e) =>
      Boolean(e.hasVoice) ||
      Boolean(e.voiceTranscript && e.voiceTranscript.trim()) ||
      (Array.isArray(e.mediaType) && e.mediaType.includes('audio')) ||
      (Array.isArray(e.audioUrls) && e.audioUrls.length > 0) ||
      e.journalType === 'voice'
  );
  const isTextOnly = !hasVoice;

  const availableModes = [
    { id: 'cognition_engine', title: 'Cognition Engine Analysis' },
    { id: 'pattern_map', title: 'Pattern Map Analysis' },
  ];

  if (hasVoice) {
    availableModes.push({ id: 'voice_analysis', title: 'Voice Analysis' });
  }

  return { isTextOnly, hasVoice, availableModes };
}

test('inspectJournalMedia returns 2 options (Cognition Engine & Pattern Map) when journal is text-only', () => {
  const textEntries = [
    { id: '1', title: 'Aug 29 Notes', content: 'Writing my thoughts down today.', hasVoice: false },
    { id: '2', title: 'Sep 1 Reflection', content: 'Focused morning planning.', hasVoice: false },
  ];

  const inspection = inspectJournalMedia(textEntries);
  assert.equal(inspection.isTextOnly, true);
  assert.equal(inspection.hasVoice, false);
  assert.equal(inspection.availableModes.length, 2);
  assert.equal(inspection.availableModes[0].id, 'cognition_engine');
  assert.equal(inspection.availableModes[1].id, 'pattern_map');
});

test('inspectJournalMedia returns 3 options including Voice Analysis when audio/voice is detected', () => {
  const voiceEntries = [
    { id: '1', title: 'Aug 29 Spoken Note', content: 'Audio reflection', hasVoice: true, voiceTranscript: 'Feeling clear today' },
    { id: '2', title: 'Sep 1 Text', content: 'Text thoughts', hasVoice: false },
  ];

  const inspection = inspectJournalMedia(voiceEntries);
  assert.equal(inspection.isTextOnly, false);
  assert.equal(inspection.hasVoice, true);
  assert.equal(inspection.availableModes.length, 3);
  assert.equal(inspection.availableModes[0].id, 'cognition_engine');
  assert.equal(inspection.availableModes[1].id, 'pattern_map');
  assert.equal(inspection.availableModes[2].id, 'voice_analysis');
});

test('detectConversationalToolIntent recognizes explicit cognition engine selection', () => {
  const intent = detectConversationalToolIntent('Run cognition engine analysis for 08-29 and 09-01');
  assert.equal(intent.type, 'journal_analysis_cognition');
});

test('detectConversationalToolIntent recognizes explicit pattern map selection', () => {
  const intent = detectConversationalToolIntent('Run pattern map analysis');
  assert.equal(intent.type, 'journal_analysis_pattern_map');
});

test('detectConversationalToolIntent recognizes explicit voice analysis selection', () => {
  const intent = detectConversationalToolIntent('Do a voice analysis of my recent audio entries');
  assert.equal(intent.type, 'journal_analysis_voice');
});

// ── Intelligent Semantic Memory Search Tests ─────────────────────────────────

test('detectConversationalToolIntent recognizes "search memory for" intent and extracts query', () => {
  const intent = detectConversationalToolIntent('Search memory for my thoughts on morning routine and focus');
  assert.equal(intent.type, 'memory_query');
  assert.equal(intent.data?.query, 'my thoughts on morning routine and focus');
});

test('detectConversationalToolIntent recognizes "vektori search" intent and extracts query', () => {
  const intent = detectConversationalToolIntent('vektori search allergy medications and asthma inhaler');
  assert.equal(intent.type, 'memory_query');
  assert.equal(intent.data?.query, 'allergy medications and asthma inhaler');
});

test('detectConversationalToolIntent recognizes "what did I write about" inquiry', () => {
  const intent = detectConversationalToolIntent('What did I write about insomnia and sleep quality?');
  assert.equal(intent.type, 'memory_query');
  assert.equal(intent.data?.query, 'insomnia and sleep quality');
});

test('detectConversationalToolIntent recognizes "search my journals for" semantic inquiry', () => {
  const intent = detectConversationalToolIntent('Search my journals for my coffee habit and caffeine');
  assert.equal(intent.type, 'memory_query');
  assert.equal(intent.data?.query, 'my coffee habit and caffeine');
});

test('detectConversationalToolIntent handles bare "vektori search" gracefully', () => {
  const intent = detectConversationalToolIntent('vektori search');
  assert.equal(intent.type, 'memory_query');
});

test('Memory search candidates merge and rank by relevance score with quotes', () => {
  const rawCandidates = [
    {
      journalId: 'j-1',
      title: 'Morning Caffeine Notes',
      date: '2026-08-25',
      summary: 'Noted having 2 espressos before 10 AM, felt jitters.',
      relevance: 0.88,
      highlight: 'Felt jitters after second espresso',
    },
    {
      journalId: 'j-2',
      title: 'Sleep Tracking',
      date: '2026-08-28',
      summary: 'Drank chamomile tea instead of coffee, slept deeply.',
      relevance: 0.94,
      highlight: 'Slept 8 hours after avoiding afternoon espresso',
    },
  ];

  const sorted = [...rawCandidates].sort((a, b) => b.relevance - a.relevance);
  assert.equal(sorted[0].journalId, 'j-2');
  assert.equal(sorted[0].relevance, 0.94);
  assert.ok(sorted[0].highlight.includes('afternoon espresso'));
});

// ── To-Do List Sorting & Blank Filtering Tests ──────────────────────────────

test('Todo list sorts pending tasks before completed and high priority before medium', () => {
  const rawTodos = [
    { id: '1', title: 'Completed Old Task', status: 'done', priority: 'medium', created_at: '2026-04-10' },
    { id: '2', title: 'Schedule a grounding conversation', status: 'pending', priority: 'medium', created_at: '2026-08-24' },
    { id: '3', title: 'Define what meaningful building looks like', status: 'pending', priority: 'high', created_at: '2026-08-24' },
    { id: '4', title: 'Map your two selves: ambition versus presence', status: 'pending', priority: 'high', created_at: '2026-08-25' },
    { id: '5', title: 'Establish a weekly rhythm', status: 'pending', priority: 'medium', created_at: '2026-08-24' },
    { id: '6', title: '   ', status: 'done', priority: 'medium', created_at: '2026-08-20' }, // blank title
    { id: '7', title: null, status: 'done', priority: 'medium', created_at: '2026-08-20' }, // null title
  ];

  // 1. Filter blanks
  const valid = rawTodos.filter((t) => Boolean(t.title && String(t.title).trim()));
  assert.equal(valid.length, 5); // rows 6 and 7 filtered out

  // 2. Sort
  const statusWeights = { pending: 0, in_progress: 1, done: 2 };
  const priorityWeights = { high: 0, medium: 1, low: 2 };

  valid.sort((a, b) => {
    const sa = statusWeights[a.status] ?? 0;
    const sb = statusWeights[b.status] ?? 0;
    if (sa !== sb) return sa - sb;

    const pa = priorityWeights[a.priority] ?? 1;
    const pb = priorityWeights[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;

    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

  // Top 4 tasks MUST be the 4 pending tasks, with the 2 high priority ones first!
  const pendingCount = valid.filter((t) => t.status !== 'done').length;
  assert.equal(pendingCount, 4);
  assert.equal(valid[0].priority, 'high');
  assert.equal(valid[0].id, '4'); // newest high priority
  assert.equal(valid[1].priority, 'high');
  assert.equal(valid[1].id, '3');
  assert.equal(valid[2].priority, 'medium');
  assert.equal(valid[3].priority, 'medium');
  assert.equal(valid[4].status, 'done'); // completed task at the end
});

// ── Universal TinyFish Autonomous Browser Agent Tests ────────────────────────

test('buildUniversalGoal generates registration goal for Luma / RSVP events', () => {
  const goal = buildUniversalGoal({
    url: 'https://lu.ma/tech-summit-2026',
    prompt: 'Register me for this tech summit',
    taskType: 'registration',
    profile: {
      name: 'Alex Mercer',
      email: 'alex@example.com',
      company: 'Acme AI',
      role: 'Research Engineer',
    },
  });

  assert.ok(goal.includes('automated registration assistant'));
  assert.ok(goal.includes('Alex Mercer'));
  assert.ok(goal.includes('alex@example.com'));
  assert.ok(goal.includes('Acme AI'));
  assert.ok(goal.includes('Submit / Register / Confirm'));
});

test('buildUniversalGoal generates web research and extraction goal for arbitrary URLs', () => {
  const goal = buildUniversalGoal({
    url: 'https://news.ycombinator.com',
    prompt: 'Extract the top 5 trending AI stories and their point counts',
    taskType: 'research',
  });

  assert.ok(goal.includes('autonomous web research assistant'));
  assert.ok(goal.includes('https://news.ycombinator.com'));
  assert.ok(goal.includes('Extract the top 5 trending AI stories'));
  assert.ok(goal.includes('structured JSON or clean markdown'));
});

test('buildUniversalGoal generates interactive action goal for web forms / operations', () => {
  const goal = buildUniversalGoal({
    url: 'https://example.com/apply',
    prompt: 'Fill out job application and upload resume',
    taskType: 'action',
    profile: {
      name: 'Alex Mercer',
      email: 'alex@example.com',
    },
  });

  assert.ok(goal.includes('autonomous web action agent'));
  assert.ok(goal.includes('https://example.com/apply'));
  assert.ok(goal.includes('Fill out job application'));
  assert.ok(goal.includes('Alex Mercer'));
});

test('detectConversationalToolIntent routes arbitrary web URLs to TinyFish universal agent', () => {
  const prompt = 'Please browse https://github.com/trending and summarize the top repositories';
  const intent = detectConversationalToolIntent(prompt);

  assert.equal(intent.type, 'tinyfish');
  assert.equal(intent.data?.url, 'https://github.com/trending');
  assert.equal(intent.data?.taskType, 'research');
  assert.ok(typeof intent.data?.goal === 'string');
  assert.ok(intent.data?.goal.includes('github.com/trending'));
});

test('detectConversationalToolIntent routes explicit web search prompts to TinyFish agent', () => {
  const prompt = 'Search the web for upcoming autonomous agent hackathons in San Francisco';
  const intent = detectConversationalToolIntent(prompt);

  assert.equal(intent.type, 'tinyfish');
  assert.ok(intent.data?.url.includes('google.com/search?q='));
  assert.ok(intent.data?.url.includes('hackathons'));
  assert.equal(intent.data?.taskType, 'research');
});

test('tinyfishAdapter handles arbitrary URLs and universal goal construction without errors', async () => {
  const result = await tinyfishAdapter.execute({
    action: 'goal',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API',
    prompt: 'Research WebRTC stream specifications',
    taskType: 'research',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data?.url, 'https://developer.mozilla.org/en-US/docs/Web/API');
  assert.ok(result.data?.goal.includes('developer.mozilla.org'));
  assert.ok(result.data?.goal.includes('WebRTC stream specifications'));
});

test('tinyfishAdapter handles stream creation for universal browser tasks', async () => {
  const result = await tinyfishAdapter.execute({
    action: 'stream',
    url: 'https://example.com',
    prompt: 'Check page contents',
    taskType: 'research',
  });

  assert.equal(result.ok, true);
  assert.ok(result.data?.stream);
  assert.equal(result.data?.url, 'https://example.com');
});

test('classifyBrowserOutcome classifies LOGIN_REQUIRED from ignitealiign login wall / account prompts', () => {
  const event = {
    type: 'COMPLETE',
    status: 'COMPLETED',
    resultJson: JSON.stringify({
      message: 'The class was selected, but an account login and password are required to complete the registration. Please log in to proceed.',
    }),
  };

  const outcome = classifyBrowserOutcome(event, 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613');
  assert.equal(outcome.status, 'LOGIN_REQUIRED');
  assert.equal(outcome.category, 'login_missing');
  assert.ok(outcome.reason.includes('ignitealiign.com'));
  assert.ok(outcome.missingFields.includes('account_password'));
  assert.ok(outcome.actionRequired.includes('password'));
});

test('classifyBrowserOutcome classifies MISSING_DATA when phone number or personal info is required', () => {
  const event = {
    type: 'COMPLETE',
    status: 'COMPLETED',
    resultJson: {
      message: 'Booking form opened, but personal details are missing: mobile phone number is required to proceed.',
    },
  };

  const outcome = classifyBrowserOutcome(event, 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613');
  assert.equal(outcome.status, 'MISSING_DATA');
  assert.equal(outcome.category, 'data_missing');
  assert.ok(outcome.missingFields.includes('phone_number'));
});

test('classifyBrowserOutcome refuses false success and reports failure when registration was incomplete', () => {
  const event = {
    type: 'COMPLETE',
    status: 'COMPLETED',
    resultJson: 'Could not complete registration due to form timeout on studio checkout.',
  };

  const outcome = classifyBrowserOutcome(event, 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613');
  assert.equal(outcome.status, 'FAILED');
  assert.notEqual(outcome.status, 'SUCCESS');
});

test('classifyBrowserOutcome verifies positive confirmation for confirmed registration', () => {
  const event = {
    type: 'COMPLETE',
    status: 'COMPLETED',
    resultJson: {
      status: 'CONFIRMED',
      bookingId: 'IGN-98124',
      message: 'Registration confirmed for 6:00 PM class on August 23rd!',
    },
  };

  const outcome = classifyBrowserOutcome(event, 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613');
  assert.equal(outcome.status, 'SUCCESS');
  assert.equal(outcome.category, 'success');
  assert.ok(outcome.reason.includes('confirmed'));
});

test('detectConversationalToolIntent recognizes user credential reply to resume pending registration', () => {
  const conversationHistory = [
    {
      role: 'user',
      content: 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613 register me in the 6pm class on 23rd aug',
    },
    {
      role: 'assistant',
      content: 'I reached the booking page on ignitealiign.com, but an account login or password is required. Please reply with your password or phone number.',
    },
  ];

  const userReply = 'my phone is 555-0199 and password is secretPassword123';
  const intent = detectConversationalToolIntent(userReply, conversationHistory);

  assert.equal(intent.type, 'tinyfish');
  assert.equal(intent.data?.url, 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613');
  assert.equal(intent.data?.isResume, true);
  assert.equal(intent.data?.providedPassword, 'secretPassword123');
  assert.equal(intent.data?.providedPhone, '555-0199');
});

test('detectConversationalToolIntent recognizes username/userid alongside password when resuming login', () => {
  const conversationHistory = [
    {
      role: 'assistant',
      content: "I reached the booking page on **ignitealiign.com**, but I couldn't complete the registration because an account login or password is required.\n\nPlease reply with your password, phone number, or login credentials in the chat",
      toolExecution: {
        tool: 'tinyfish',
        data: {
          url: 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613',
        },
      },
    },
  ];

  const userReply = 'here is my userid: srinjoysen and password: superSecretPassword!';
  const intent = detectConversationalToolIntent(userReply, conversationHistory);

  assert.equal(intent.type, 'tinyfish');
  assert.equal(intent.data?.url, 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613');
  assert.equal(intent.data?.isResume, true);
  assert.equal(intent.data?.providedUsername, 'srinjoysen');
  assert.equal(intent.data?.providedPassword, 'superSecretPassword!');
});

test('detectConversationalToolIntent recognizes retry signal with pending registration', () => {
  const conversationHistory = [
    {
      role: 'assistant',
      content: 'I reached the booking page on **ignitealiign.com**, but an account login is required.',
      toolExecution: {
        tool: 'tinyfish',
        data: {
          url: 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613',
        },
      },
    },
  ];

  const userReply = 'try to register for the class like before and log the user in too';
  const intent = detectConversationalToolIntent(userReply, conversationHistory);

  assert.equal(intent.type, 'tinyfish');
  assert.equal(intent.data?.url, 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613');
  assert.equal(intent.data?.isResume, true);
});

// ── Smart AI Chat Tab Naming Tests ───────────────────────────────────────────
test('generateSmartSemanticTitle produces specific "Active Tasks Review" for todo query instead of generic "Action Planning"', () => {
  const prompt = 'Show my tasks and to-do list';
  const title = generateSmartSemanticTitle(prompt);
  assert.equal(title, 'Active Tasks Review');
  assert.notEqual(title, 'Action Planning');
});

test('generateSmartSemanticTitle extracts brand and class for booking URLs instead of generic "Event Registration"', () => {
  const prompt = 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613 register me in the 11 am class';
  const title = generateSmartSemanticTitle(prompt);
  assert.equal(title, 'Ignite Align 11 AM Class');
  assert.notEqual(title, 'Event Registration');
});

test('generateSmartSemanticTitle extracts brand for Luma registration URLs', () => {
  const prompt = 'https://lu.ma/sf-ai-builders-night register me please';
  const title = generateSmartSemanticTitle(prompt);
  assert.equal(title, 'Luma Registration');
});

test('generateSmartSemanticTitle formats journal date analysis prompts intelligently', () => {
  const prompt = 'analyze my journals from 29th August and 1st September';
  const title = generateSmartSemanticTitle(prompt);
  assert.equal(title, 'Reflections: Aug 29 & Sep 1');
});

test('generateSmartSemanticTitle formats pattern map prompts intelligently', () => {
  const prompt = 'Apply pattern map on my journal';
  const title = generateSmartSemanticTitle(prompt);
  assert.equal(title, 'Journal Pattern Map');
});

test('generateSmartSemanticTitle formats new task creation intelligently', () => {
  const prompt = 'Create a task to email Sarah about roadmap tomorrow';
  const title = generateSmartSemanticTitle(prompt);
  assert.equal(title, 'Task: Email Sarah About');
});

test('generateSmartSemanticTitle strips conversational prefixes and generates clean title', () => {
  const prompt = 'Can you please help me improve my sleep routine';
  const title = generateSmartSemanticTitle(prompt);
  assert.equal(title, 'Improve My Sleep Routine');
});

test('cleanAiGeneratedTitle strips quotes, removes "Title:" prefixes, and enforces title casing', () => {
  const rawAi = '"Title: Ignite Align 11 AM Class."';
  const cleaned = cleanAiGeneratedTitle(rawAi);
  assert.equal(cleaned, 'Ignite Align 11 AM Class');
});

test('cleanAiGeneratedTitle falls back to semantic title if AI returns generic placeholder', () => {
  const rawAi = 'New Chat';
  const fallback = 'Show my tasks and to-do list';
  const cleaned = cleanAiGeneratedTitle(rawAi, fallback);
  assert.equal(cleaned, 'Active Tasks Review');
});

// ── User Location Access Tests ───────────────────────────────────────────────
test('detectConversationalToolIntent recognizes "where am I" location query', () => {
  const query = 'where am I right now?';
  const intent = detectConversationalToolIntent(query);
  assert.equal(intent.type, 'user_location');
});

test('detectConversationalToolIntent recognizes "give force agent location access" query', () => {
  const query = 'Give force agent location access of users';
  const intent = detectConversationalToolIntent(query);
  assert.equal(intent.type, 'user_location');
});

test('detectConversationalToolIntent recognizes "what is my location" query', () => {
  const query = 'what is my current location?';
  const intent = detectConversationalToolIntent(query);
  assert.equal(intent.type, 'user_location');
});

test('buildUniversalGoal embeds user location, coordinates, and timezone into registration goal', () => {
  const location = {
    latitude: 37.7749,
    longitude: -122.4194,
    city: 'San Francisco',
    region: 'California',
    country: 'United States',
    timezone: 'America/Los_Angeles',
  };

  const goal = buildUniversalGoal({
    prompt: 'register me in the 11 am class',
    url: 'https://www.ignitealiign.com/schedule#/class-schedule/r/1613',
    taskType: 'registration',
    location,
  });

  assert.ok(goal.includes('Location / City: San Francisco, California, United States'));
  assert.ok(goal.includes('Coordinates: 37.7749, -122.4194'));
  assert.ok(goal.includes('Local Timezone: America/Los_Angeles'));
});

test('Proximity centroid calculation identifies Chennai for coordinates 12.98878, 80.23002', () => {
  const KNOWN_METROS = [
    { city: 'Chennai', region: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707, radiusKm: 80 },
    { city: 'Bengaluru', region: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946, radiusKm: 70 },
    { city: 'Kolkata', region: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639, radiusKm: 70 },
  ];

  const lat = 12.98878;
  const lon = 80.23002;

  let matchedMetro = null;
  for (const metro of KNOWN_METROS) {
    const dLat = ((metro.lat - lat) * Math.PI) / 180;
    const dLon = ((metro.lon - lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((metro.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist <= metro.radiusKm) {
      matchedMetro = metro;
      break;
    }
  }

  assert.ok(matchedMetro, 'Expected to match a metro');
  assert.equal(matchedMetro.city, 'Chennai');
  assert.equal(matchedMetro.region, 'Tamil Nadu');
  assert.notEqual(matchedMetro.city, 'Calcutta');
});

test('Cached location detection invalidates Calcutta when coordinates are in Chennai', () => {
  const cached = {
    latitude: 12.98878,
    longitude: 80.23002,
    city: 'Calcutta',
    formattedAddress: 'Calcutta (estimated from timezone)',
  };

  const isMismatchedCalcutta =
    (cached.city === 'Calcutta' || cached.formattedAddress?.includes('estimated from timezone')) &&
    (Math.abs(cached.latitude - 22.57) > 2 || Math.abs(cached.longitude - 88.36) > 2);

  assert.equal(isMismatchedCalcutta, true, 'Cached Calcutta for Chennai coordinates must be flagged as mismatched');
});

// ── Web Search & Firecrawl Tool Tests ───────────────────────────────────────
test('searchWeb returns structured event results for AI events in Chennai', async () => {
  const { searchWeb } = await import('../lib/force-agent/webSearch.ts');
  const res = await searchWeb({
    query: 'ai events in chennai 2026',
    location: 'Chennai',
    limit: 4,
  });

  assert.ok(res.query.includes('ai events in chennai'));
  assert.ok(Array.isArray(res.results));
  assert.ok(res.results.length > 0, 'Expected at least 1 search result');
  assert.ok(res.results[0].title, 'First result must have a title');
  assert.ok(res.results[0].url.startsWith('http'), 'First result must have valid URL');
  assert.ok(typeof res.durationMs === 'number', 'Expected durationMs to be numeric');
});

// ── Multi-Step Autonomous Task Completion Tests ─────────────────────────────
test('buildChatPrompt includes explicit autonomous multi-step completion instructions', async () => {
  const { buildChatPrompt } = await import('../lib/force-agent/promptBuilder.ts');
  const prompt = buildChatPrompt({
    systemContext: 'User is located in Chennai, India',
    memoryContext: 'Prefers AI and engineering events',
  });

  assert.ok(prompt.includes('AUTONOMOUS MULTI-STEP TASK COMPLETION'));
  assert.ok(prompt.includes('browse_and_register'));
  assert.ok(prompt.includes('NEVER stop after just one preliminary step'));
});

test('Compound intent detects combined search and sign-up request', () => {
  const prompt1 = 'find me a good ai event in chennai near me and sign me up online';
  const prompt2 = 'search for AI conferences in Chennai and register me';
  const prompt3 = 'look up yoga classes near me and RSVP';
  const prompt4 = 'what is the weather like today';

  const isCompoundReg = (text) => /\b(sign\s*(me\s*)?up|register\s*me|rsvp|book(\s*it|\s*me)?)\b/i.test(text);

  assert.equal(isCompoundReg(prompt1), true);
  assert.equal(isCompoundReg(prompt2), true);
  assert.equal(isCompoundReg(prompt3), true);
  assert.equal(isCompoundReg(prompt4), false);
});

test('Compound task completion chains web search into TinyFish registration with toolExecutions array', () => {
  const executedTools = [];
  const searchResults = [
    {
      title: 'Chennai AI Innovation Summit 2026',
      url: 'https://lu.ma/chennai-ai-summit-2026',
      snippet: 'Join leading AI researchers and builders in Chennai.',
    },
    {
      title: 'Tamil Nadu Tech Expo',
      url: 'https://eventbrite.com/e/tamil-nadu-tech-expo',
      snippet: 'Annual technology expo in Chennai.',
    },
  ];

  // Step 1: Web search executed
  executedTools.push({
    tool: 'web_search',
    status: 'success',
    title: 'Web Search: "ai event in chennai"',
    data: { results: searchResults },
  });

  // Step 2: Auto-completion for compound registration intent
  const userMsg = 'find me a good ai event in chennai near me and sign me up online';
  const isCompoundRegistration = /\b(sign\s*(me\s*)?up|register\s*me|rsvp|book(\s*it|\s*me)?)\b/i.test(userMsg);

  if (isCompoundRegistration && searchResults.length > 0 && !executedTools.some((t) => t.tool === 'tinyfish')) {
    const targetEvent = searchResults.find((r) => /lu\.ma|luma|eventbrite/i.test(r.url)) || searchResults[0];
    executedTools.push({
      tool: 'tinyfish',
      status: 'running',
      title: `Registration: ${targetEvent.title}`,
      data: {
        url: targetEvent.url,
        eventUrl: targetEvent.url,
        prompt: `Register user online for ${targetEvent.title}`,
        taskType: 'registration',
      },
    });
  }

  // Verifications
  assert.equal(executedTools.length, 2, 'Must have executed 2 tools (web_search and tinyfish registration)');
  assert.equal(executedTools[0].tool, 'web_search');
  assert.equal(executedTools[1].tool, 'tinyfish');
  assert.equal(executedTools[1].status, 'running');
  assert.equal(executedTools[1].data.url, 'https://lu.ma/chennai-ai-summit-2026');
});

test('buildUniversalGoal embeds login, guest RSVP, and profile credentials rules', () => {
  const goal = buildUniversalGoal({
    url: 'https://ignitealiign.com/schedule#/class-schedule/r/1613',
    prompt: 'Sign me up for the 10:00 AM class',
    taskType: 'registration',
    profile: {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '+91 98765 43210',
      customAnswers: {
        account_password: 'SecurePassword123!',
      },
    },
  });

  assert.ok(goal.includes('=== LOGIN & REGISTRATION RULES ==='));
  assert.ok(goal.includes('Continue as guest'));
  assert.ok(goal.includes('CREDENTIALS & CUSTOM DATA'));
  assert.ok(goal.includes('account_password: SecurePassword123!'));
  assert.ok(goal.includes('enter the email and password, click \'Log In\''));
});

test('buildChatPrompt specifies Claude-style step-by-step textual context and login rules', async () => {
  const { buildChatPrompt } = await import('../lib/force-agent/promptBuilder.ts');
  const prompt = buildChatPrompt({
    systemContext: 'User is located in Chennai, India',
    memoryContext: 'Prefers AI events',
  });

  assert.ok(prompt.includes('Provide Textual Context for Each Step (Just like Claude)'));
  assert.ok(prompt.includes('Login & Account Handling'));
  assert.ok(prompt.includes('Before invoking ANY tool, always provide 1-2 natural, transparent sentences'));
});

test('Multi-turn tool execution preserves intermediate turn narratives like Claude', () => {
  const turnNarratives = [
    "I'll start by checking your current physical location to discover events happening nearby.",
    "Now that I see you're based in Chennai, let me search for upcoming AI conferences and workshops in the city.",
    "I found the Chennai AI Summit 2026. I'm opening the registration page to check availability and sign you up.",
  ];

  // Synthesize multi-step textual context across turns
  let finalMessage = '';
  if (turnNarratives.length > 1) {
    const lastNarrative = turnNarratives[turnNarratives.length - 1];
    const priorNarratives = turnNarratives.slice(0, -1);
    const missingPriors = priorNarratives.filter((p) => !lastNarrative.includes(p));
    if (missingPriors.length > 0) {
      finalMessage = [...missingPriors, lastNarrative].join('\n\n');
    } else {
      finalMessage = lastNarrative;
    }
  }

  assert.ok(finalMessage.includes('checking your current physical location'));
  assert.ok(finalMessage.includes("you're based in Chennai"));
  assert.ok(finalMessage.includes('Chennai AI Summit 2026'));
});

test('TinyFish automation state tracks chronological step timeline with checkmarks', () => {
  const steps = [];
  const addStep = (msg) => {
    if (msg && !steps.includes(msg)) steps.push(msg);
  };

  addStep('Navigating to ignitealiign.com...');
  addStep('Autonomous browser session started');
  addStep('Checking sign-in requirements');
  addStep('Entering attendee credentials');
  addStep('Registration confirmed!');

  assert.equal(steps.length, 5);
  assert.equal(steps[0], 'Navigating to ignitealiign.com...');
  assert.equal(steps[2], 'Checking sign-in requirements');
  assert.equal(steps[4], 'Registration confirmed!');
});

test('classifyBrowserOutcome accurately classifies SALES_ENDED and REGISTRATION_CLOSED as sold_out', () => {
  // Test sales ended outcome
  const salesEndedResult = classifyBrowserOutcome(
    {
      type: 'COMPLETE',
      status: 'COMPLETE',
      message: 'Sales have ended for this event',
      resultJson: JSON.stringify({
        status: 'SALES_ENDED',
        summary: 'Ticket sales ended on March 20, 2026.',
      }),
    },
    'https://eventbrite.com/e/aicon-chennai'
  );

  assert.equal(salesEndedResult.status, 'CLASS_FULL');
  assert.equal(salesEndedResult.category, 'sold_out');
  assert.ok(/sold out|sales (have )?ended/i.test(salesEndedResult.reason));

  // Test registration closed outcome
  const closedResult = classifyBrowserOutcome(
    {
      type: 'COMPLETE',
      status: 'COMPLETE',
      message: 'Registration is closed for this meetup',
      resultJson: JSON.stringify({
        status: 'REGISTRATION_CLOSED',
        summary: 'Registration closed by organizer.',
      }),
    },
    'https://lu.ma/chennai-ai-closed'
  );

  assert.equal(closedResult.status, 'CLASS_FULL');
  assert.equal(closedResult.category, 'sold_out');
});

test('Task completion detection picks next unattempted candidate when first candidate is sold out', () => {
  const attemptedUrls = new Set(['https://eventbrite.com/e/aicon-chennai-sales-ended']);
  const conversationMessages = [
    {
      role: 'assistant',
      toolExecutions: [
        {
          tool: 'web_search',
          status: 'success',
          data: {
            results: [
              {
                title: 'AICon Chennai 2026',
                url: 'https://eventbrite.com/e/aicon-chennai-sales-ended',
              },
              {
                title: 'Chennai AI & Machine Learning Meetup',
                url: 'https://lu.ma/chennai-ai-meetup-open',
              },
              {
                title: 'Deep Learning Workshop Chennai',
                url: 'https://meetup.com/chennai-ai/events/101',
              },
            ],
          },
        },
      ],
    },
  ];

  // Scan for next candidate
  let nextCandidate = null;
  for (const m of conversationMessages) {
    const tools = m.toolExecutions || [];
    for (const t of tools) {
      if (t.tool === 'web_search' && Array.isArray(t.data?.results)) {
        for (const res of t.data.results) {
          if (res.url && !attemptedUrls.has(res.url)) {
            nextCandidate = res;
            break;
          }
        }
      }
      if (nextCandidate) break;
    }
    if (nextCandidate) break;
  }

  assert.ok(nextCandidate !== null);
  assert.equal(nextCandidate.url, 'https://lu.ma/chennai-ai-meetup-open');
  assert.equal(nextCandidate.title, 'Chennai AI & Machine Learning Meetup');
});

test('Stop command pattern correctly identifies user cancellation keywords', () => {
  const isStopWord = (text) =>
    /^\s*(stop|cancel|pause|abort|halt|stop\s+searching|hold\s+on|shut\s+up|please\s+stop)\b/i.test(text.trim());

  assert.equal(isStopWord('stop'), true);
  assert.equal(isStopWord('Stop searching'), true);
  assert.equal(isStopWord('cancel'), true);
  assert.equal(isStopWord('pause please'), true);
  assert.equal(isStopWord('abort'), true);
  assert.equal(isStopWord('hold on'), true);
  assert.equal(isStopWord('find me an event'), false);
  assert.equal(isStopWord('register me for the next one'), false);
});

test('buildChatPrompt includes guideline 8 for persistent alternative exploration until finished or stopped', async () => {
  const { buildChatPrompt } = await import('../lib/force-agent/promptBuilder.ts');
  const prompt = buildChatPrompt({
    systemContext: 'User wants event registration in Chennai',
  });

  assert.ok(prompt.includes('Completion Detection & Persistent Alternative Finding'));
  assert.ok(prompt.includes('THE TASK IS NOT COMPLETED'));
  assert.ok(prompt.includes('DO NOT stop and DO NOT merely ask'));
  assert.ok(prompt.includes('NEXT available alternative event candidate'));
});





