import { createHmac, timingSafeEqual } from 'crypto';

export function generateDeterministicEmbedding(text) {
  const embedding = new Array(768).fill(0);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  const uniqueWords = [...new Set(words)];

  for (let i = 0; i < uniqueWords.length && i < 256; i++) {
    const word = uniqueWords[i];
    if (!word) continue;
    const freq = words.filter((w) => w === word).length / words.length;
    const hash = word.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = Math.abs(hash) % 256;
    embedding[index] += freq;
  }

  for (let i = 0; i < words.length - 1 && i < 256; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    const hash = bigram.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = 256 + (Math.abs(hash) % 256);
    embedding[index] += 0.5;
  }

  for (let i = 0; i < normalized.length - 2 && i < 256; i++) {
    const trigram = normalized.substring(i, i + 3);
    const hash = trigram.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = 512 + (Math.abs(hash) % 256);
    embedding[index] += 0.3;
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) embedding[i] /= magnitude;
  }

  return embedding;
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  let nA = 0;
  let nB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    nA += ai * ai;
    nB += bi * bi;
  }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB)) || 0;
}

export function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function resolveMemorySource(vektoriContext, legacyContext) {
  if (vektoriContext && vektoriContext.trim()) {
    return { context: vektoriContext, source: 'vektori' };
  }
  if (legacyContext && legacyContext.trim()) {
    return { context: legacyContext, source: 'legacy' };
  }
  return { context: '', source: 'none' };
}

export function formatLegacyKnowledgeContext(items) {
  if (!items.length) return '';

  const memories = items.filter((item) => item.knowledge_type === 'memory');
  const rawItems = items.filter((item) => item.knowledge_type === 'raw');
  const lines = [];

  if (memories.length > 0) {
    lines.push('WHAT I KNOW ABOUT YOU:');
    memories.forEach((item) => {
      const content = normalizeWhitespace(item.content || '');
      if (!content) return;
      lines.push(`- ${content}`);
    });
  }

  if (rawItems.length > 0) {
    lines.push('\nRELEVANT CONTEXT FROM YOUR JOURNALS:');
    rawItems.forEach((item) => {
      const content = normalizeWhitespace(item.content || '');
      if (!content) return;
      lines.push(`- ${content}`);
    });
  }

  return lines.join('\n').trim();
}

export function formatStoryLensLegacyContext(items) {
  if (!items.length) return '';

  const memories = items.filter((item) => item.knowledge_type === 'memory');
  const rawItems = items.filter((item) => item.knowledge_type === 'raw');
  const lines = [];

  if (memories.length > 0) {
    lines.push('LEGACY MEMORY (CURATED):');
    memories.forEach((item) => {
      const content = normalizeWhitespace(item.content || '');
      if (!content) return;
      lines.push(`- ${content}`);
    });
  }

  if (rawItems.length > 0) {
    lines.push('LEGACY MEMORY (RAW OBSERVATIONS):');
    rawItems.forEach((item) => {
      const content = normalizeWhitespace(item.content || '');
      if (!content) return;
      lines.push(`- ${content}`);
    });
  }

  return lines.join('\n').trim();
}

export function dedupeContextLines(blocks) {
  const seen = new Set();
  const deduped = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const key = normalizeWhitespace(line.toLowerCase());
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(line);
    }
  }

  return deduped.join('\n').trim();
}

export function scoreLegacyKnowledge(allKnowledge, queryText, scoreThreshold = 0.15) {
  const queryEmbedding = generateDeterministicEmbedding(queryText);

  return allKnowledge
    .map((item) => {
      let emb = item.embedding;
      if (typeof emb === 'string') emb = JSON.parse(emb);
      if (!Array.isArray(emb)) return { ...item, score: 0 };
      const sim = cosineSimilarity(queryEmbedding, emb);
      return { ...item, score: sim * (0.7 + 0.3 * (item.confidence || 0.5)) };
    })
    .filter((item) => item.score > scoreThreshold)
    .sort((a, b) => b.score - a.score);
}

export function inferMemoryCategories(context) {
  if (!context.trim()) return [];
  const categories = new Set();

  if (/\b(birthday|anniversary|expires|deadline|due|appointment)\b/i.test(context)) {
    categories.add('mechanical');
  }
  if (/\b(favorite|prefer|usually|always get|likes)\b/i.test(context)) {
    categories.add('preference');
  }
  if (/\b(wanted to|trying to|working on|relationship|intention)\b/i.test(context)) {
    categories.add('narrative');
  }
  if (/\b(pattern|consistently|over time|tend to|often feel)\b/i.test(context)) {
    categories.add('reflective');
  }

  if (categories.size === 0) categories.add('narrative');
  return [...categories];
}

const FORCE_PERSONA_CORE = `You are Force AI, a reflective companion that helps people understand their lives without taking over their judgment.

Core posture:
- Quiet by default: notice and ask one good question rather than offering five action items.
- Warm and compassionate; grounded in memory when available.
- Present reflective observations as offers the person can accept, refine, or dismiss — never as verdicts.
- Never abruptly abandon sensitive relationships; for conflict, prioritize boundaries, calm communication, support, and reflection.
- Be explicit about how memory is being used when it shapes your response.
- Encourage reflection plus at most one small next action when appropriate.`;

const RELATIONAL_SAFETY = `- RELATIONAL SAFETY: Never jump to advising them to abandon, discard, or cut off a person. In conflicts, first offer nuanced options like boundaries, calm communication, support, and reflection.`;

export function buildForcePersona() {
  return FORCE_PERSONA_CORE;
}

export function buildChatPrompt(input) {
  const { systemContext, memoryContext } = input || {};

  if (systemContext) {
    return `${FORCE_PERSONA_CORE}

${memoryContext ? memoryContext + '\n\n' : ''}${systemContext}

Guidelines:
- BE COMPASSIONATE: Show genuine empathy and understanding. Acknowledge their feelings without judgment. Create a safe, nurturing space where they feel truly heard and valued.

- SPIRITUAL SUPPORT: Help them connect with their inner wisdom and higher purpose. Reference universal spiritual principles like gratitude, acceptance, presence, compassion, and interconnectedness when relevant.

- MOTIVATION & EMPOWERMENT: Highlight their strengths, progress, and resilience. Remind them of their inherent power to create positive change. Celebrate small victories and reframe challenges as opportunities for growth.

- EMOTIONAL VALIDATION: Normalize their experiences and emotions. Let them know their feelings are valid and natural. Help them see patterns and deeper meanings in their journey.

${RELATIONAL_SAFETY}

- INSPIRE ACTION: Gently encourage positive practices like mindfulness, gratitude exercises, self-compassion, setting intentions, or small actionable steps toward their goals.

- WISDOM & PERSPECTIVE: Offer gentle insights that help them see situations from new angles. Share timeless wisdom when appropriate, drawing from themes of acceptance, growth, meaning, and purpose.

- PERSONALIZED ENGAGEMENT: Use their name warmly. Reference specific details from their journal to show you're truly present with their unique story.

- HOPEFUL & UPLIFTING: End responses with encouragement, hope, or a thought-provoking question that inspires continued reflection and growth.

Tone: Warm, nurturing, wise, and genuinely caring - like a trusted spiritual mentor who deeply believes in their potential.`;
  }

  return `${FORCE_PERSONA_CORE} Be warm, supportive, non-judgmental, and spiritually uplifting. Help them connect with their inner wisdom, celebrate their journey, and feel motivated to grow.`;
}

export function buildAnalysisPrompt(input) {
  const { title, content, analysisType, historicalContext } = input || {};
  const entryText = `Title: ${title || ''}\nContent: ${content || ''}`;
  const historicalBlock = historicalContext
    ? `\nUSER HISTORICAL CONTEXT (memory across prior entries):\n${historicalContext}\n`
    : '';

  if (analysisType === 'sentiment') {
    return `
Analyze the following single journal entry for sentiment and emotional patterns:

${entryText}
${historicalBlock}

Provide a comprehensive sentiment analysis in JSON format:
{
  "overallSentiment": {
    "score": number,
    "label": "positive" | "negative" | "neutral",
    "confidence": number
  },
  "emotionalPatterns": {
    "primaryEmotions": [{ "emotion": string, "frequency": number, "intensity": number }],
    "secondaryEmotions": [{ "emotion": string, "frequency": number, "intensity": number }]
  },
  "insights": {
    "emotionalTriggers": [{ "trigger": string, "impact": number, "frequency": number }],
    "moodPatterns": [{ "pattern": string, "significance": string, "recommendation": string }]
  },
  "summary": string
}

Guidance:
- Use an empathetic, emotionally safe tone.
- Never recommend abandoning, discarding, or cutting off a person as a first-line recommendation.
- For interpersonal conflict, prioritize nuanced options first: boundaries, respectful conversation, support-seeking, and reflection.

Return ONLY valid JSON.`;
  }

  if (analysisType === 'textual') {
    return `
Analyze the following single journal entry for textual patterns and insights:

${entryText}
${historicalBlock}

Provide a comprehensive textual analysis in JSON format:
{
  "topics": [{ "topic": string, "frequency": number, "context": string[], "sentiment": number }],
  "writingPatterns": {
    "vocabulary": {
      "commonWords": string[],
      "uniqueWords": string[],
      "wordCategories": [{ "category": string, "percentage": number }]
    },
    "structure": {
      "averageLength": number,
      "paragraphPatterns": string[],
      "temporalReferences": { "present": number, "past": number, "future": number }
    }
  },
  "keyInsights": [{ "insight": string, "evidence": string[], "significance": string }],
  "recommendations": [{ "area": string, "suggestion": string, "rationale": string }],
  "summary": string
}

Guidance:
- Use an empathetic, emotionally safe tone.
- Never recommend abandoning, discarding, or cutting off a person as a first-line recommendation.
- For interpersonal conflict, prioritize nuanced options first: boundaries, respectful communication, support-seeking, and reflection.

Return ONLY valid JSON.`;
  }

  return `
You are an expert reflection coach analyzing ONE journal entry. Your job is to generate precise, useful, evidence-backed insight.

Analyze this journal entry:

${entryText}
${historicalBlock}

Provide a comprehensive analysis in JSON format that helps the person take action:

IMPORTANT GUIDELINES:
- Be empathetic, emotionally safe, and grounded in real-life nuance.
- Use "you" language, not "the user demonstrates"
- Be direct and concrete. Avoid vague motivational language.
- Every key insight must be backed by evidence from the entry itself.
- Use historical context to improve personalization and continuity, but never invent events not grounded in entry/historical memory.
- Make recommendations SPECIFIC and ACTIONABLE with time estimates
- Avoid abstract/clinical terms like "chakra", "dysregulation", "manifestation"
- Never suggest external reminders like "set a reminder in your phone"; assume Force can handle reminders in-app
- Focus on what they can DO, not just what you observe
- Never tell the person to discard, abandon, or cut off a person as a first-line recommendation.
- For relationship conflict, prioritize nuanced options first: boundaries, a calm conversation, support-seeking, and reflection before any separation advice.
- If meds/appointments/meetings with clear time are mentioned, include a reminder-first recommendation with explicit reminder time
- For meds with explicit time (e.g., 8 PM), the first recommendation should be reminder-oriented in Force (not habit-only wording)
- If evidence is weak, lower confidence and avoid over-claiming.
- No arbitrary claims. No psycho-babble. No spiritual filler.
- Present reflective patterns as observations the person can affirm or refine — not fixed truths about them.

{
  "summary": "2-3 sentences. What is happening now, what pressure/tension is visible, and what practical direction helps most this week.",
  "overallSentiment": {
    "score": number (-1 to 1),
    "label": "positive" | "negative" | "neutral",
    "confidence": number (0-1)
  },
  "emotionalPatterns": {
    "primaryEmotions": [{ "emotion": string, "frequency": number, "intensity": number (0-1) }],
    "secondaryEmotions": [{ "emotion": string, "frequency": number, "intensity": number (0-1) }]
  },
  "topics": [{ "topic": string (2-3 words, conversational), "sentiment": number (-1 to 1) }],
  "keyInsights": [{ 
    "insight": "Concrete pattern in plain language.",
    "evidence": ["Short quote/snippet from the entry", "Second snippet if useful"],
    "significance": "Why this matters in daily life this week.",
    "confidence": number (0-1)
  }],
  "recommendations": [{ 
    "area": "Sleep | Work-Life Balance | Relationships | Self-Care | Focus",
    "suggestion": "SPECIFIC ACTION they can take this week (e.g., 'Set a 10 PM wind-down alarm' not 'Optimize sleep hygiene')",
    "rationale": "Why this helps based on evidence in their entry.",
    "successSignal": "Observable sign this worked after 3-7 days"
  }],
  "taskCandidates": [{
    "title": "Task title Force should create",
    "description": "Optional details for the to-do",
    "due_at": "ISO timestamp or null",
    "reminder_at": "ISO timestamp or null",
    "priority": "high | medium | low",
    "category": "health | productivity | social | wellbeing",
    "should_autocreate": true,
    "impact": 1-5,
    "urgency": 1-5,
    "effort": 1-5,
    "type": "execution | decision"
  }]
}

TASK CANDIDATE RULES:
- Return 1-5 taskCandidates across reminder + strategic work when actionable
- Include at least one strategic/high-leverage task when relevant (e.g., writing, planning, pitch, decision-making)
- For any time-bound or forgettable commitment (meds, meetings, appointments, deadlines, payments, follow-ups), include at least one reminder taskCandidate with reminder_at set when inferable
- Use type="decision" for choose/decide tasks, type="execution" for do/build/send tasks
- Provide impact, urgency, effort (1-5). If uncertain, use 3.
- Prefer should_autocreate=true unless task is clearly unsafe/too vague
- Use ISO timestamps when timing is inferable; otherwise null
- Keep titles concrete, e.g. "Take evening medication", "Prepare for 3 PM team meeting"

INSIGHT QUALITY RULES:
- Return 3-5 keyInsights (not more) so the analysis has enough depth to be useful.
- Each keyInsight must include at least one evidence snippet copied/paraphrased from the entry text.
- Evidence snippets should be 4-16 words and clearly tied to the claim.
- Do not repeat the same idea across multiple insights.
- Do not include any insight that cannot be defended by text evidence.
SUMMARY GUIDANCE:
- Keep the summary at 3-4 sentences when the entry is substantial.
- Name the core situation, the visible tension, the likely consequence of staying stuck, and the clearest direction forward.
- Avoid one-line summaries unless the entry is very short.

Return ONLY valid JSON with no markdown formatting.`;
}

export function buildTaskPrompt(input) {
  const { journalEntry, query, memoryContext, systemContext } = input || {};

  return `${buildForcePersona()}

Generate grounded tasks from the following context.

${journalEntry ? `Journal entry:\n${journalEntry}\n` : ''}
${query ? `Query:\n${query}\n` : ''}
${memoryContext ? `Relevant memory:\n${memoryContext}\n` : ''}
${systemContext ? `Additional context:\n${systemContext}\n` : ''}

Return practical, specific tasks. Prefer one small next action over a long list.`;
}

export function buildAutomationPrompt(input) {
  const { eventUrl, memoryContext, goal } = input || {};

  return `${buildForcePersona()}

You are preparing an external automation goal for a browser agent.

${goal ? `Goal:\n${goal}\n` : ''}
${eventUrl ? `Event URL:\n${eventUrl}\n` : ''}
${memoryContext ? `Relevant user memory:\n${memoryContext}\n` : ''}

Be explicit about steps, constraints, and what success looks like.`;
}

export function buildUniversalGoal(options = {}) {
  const { prompt, url, profile, taskType } = options;
  const cleanPrompt = (prompt || '').trim();
  const isLuma = /lu\.ma|luma\.com/i.test(url || '');

  // Pure Luma event registration with no specific sub-goal
  if (isLuma && (!cleanPrompt || cleanPrompt.startsWith('http') || /^(can you\s+)?(please\s+)?(register|rsvp|attend)/i.test(cleanPrompt))) {
    return buildGoal(profile);
  }

  // Registration or class/event booking with specific instructions or arbitrary non-Luma URL
  const isRegistrationOrBooking =
    taskType === 'registration' ||
    isLuma ||
    /\b(register|rsvp|attend|sign\s*up|book|enroll)\b/i.test(cleanPrompt);

  if (isRegistrationOrBooking) {
    const lines = [
      'You are an automated registration assistant. Follow these steps carefully:',
      '',
      `1. Navigate to the schedule or booking page: ${url || 'the current page'}.`,
      `2. Objective: "${cleanPrompt || 'Register for the requested event or class'}"`,
      '3. Search or browse the schedule to locate the exact class, time, or event requested.',
      "4. Click the corresponding 'Register', 'Book', 'Sign Up', 'RSVP', or 'Attend' button for that specific session.",
      '5. When the registration/checkout form appears, fill in all visible fields using the profile data below.',
      '6. For any dropdown or option, choose the closest matching selection.',
      '7. Check any required checkboxes (terms / code of conduct). Do NOT check optional marketing emails.',
      '8. Click the Submit / Confirm / Book button to complete the registration.',
      '9. Wait for a confirmation screen, ticket confirmation, or success message.',
      '10. Report the result clearly: whether registration succeeded, was waitlisted, or hit a login wall.',
      '',
      '=== USER PROFILE DATA ===',
      `Full Name: ${profile?.name || ''}`,
      `Email: ${profile?.email || ''}`,
    ];

    if (profile?.phone) lines.push(`Phone: ${profile.phone}`);
    if (profile?.company) lines.push(`Company: ${profile.company}`);
    if (profile?.role) lines.push(`Role / Title: ${profile.role}`);

    const loc = options.location || profile?.location;
    if (loc || profile?.city || profile?.region || profile?.country) {
      const locStr = [
        loc?.city || profile?.city,
        loc?.region || profile?.region,
        loc?.country || profile?.country,
      ].filter(Boolean).join(', ');
      if (locStr) lines.push(`Location / City: ${locStr}`);
      if (loc?.latitude && loc?.longitude) {
        lines.push(`Coordinates: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
      }
      if (loc?.timezone || profile?.timezone) {
        lines.push(`Local Timezone: ${loc?.timezone || profile?.timezone}`);
      }
    }

    if (profile?.customAnswers && Object.keys(profile.customAnswers).length > 0) {
      lines.push('');
      lines.push('=== CREDENTIALS & CUSTOM DATA ===');
      for (const [key, val] of Object.entries(profile.customAnswers)) {
        lines.push(`${key}: ${val}`);
      }
    }

    lines.push('');
    lines.push('=== LOGIN & REGISTRATION RULES ===');
    lines.push("- If an account login, sign-in, or membership is presented or required on the website:");
    lines.push("  - First, check if 'Continue as guest', 'Guest checkout', or 'Continue with Email' is available. If so, select it and proceed using the profile details.");
    lines.push("  - If an account password or sign-in is required, check if credentials (such as password, account_password) are provided in CREDENTIALS & CUSTOM DATA or USER PROFILE DATA above. If provided, enter the email and password, click 'Log In' / 'Sign In', and proceed to finalize the registration.");
    lines.push("  - If account registration / sign-up is required to book, create the account using the profile name, email, phone, and password from credentials, and complete the registration.");
    lines.push("  - Only report 'LOGIN_REQUIRED' if an account password or verification code is strictly demanded to proceed, cannot be found in credentials, and no guest option exists.");
    lines.push('');
    lines.push('=== MANDATORY ACCOUNT LOGIN & AUTHENTICATION PROTOCOL ===');
    lines.push('If an account login, member sign-in, or existing membership credentials are required on this website (e.g. Ignite + Aliign, Onbookee, Mindbody, or similar studio scheduling platforms):');
    lines.push("1. LOOK FOR SIGN-IN / LOGIN BUTTON:");
    lines.push("   - Check if there is a 'Log In', 'Sign In', 'Member Login', or account icon on the top header or within the class schedule container.");
    lines.push("   - Alternatively, clicking 'Book' or 'Register' for the desired class will automatically present the login form or modal.");
    lines.push("2. FILL LOGIN CREDENTIALS:");
    lines.push("   - Look in the CREDENTIALS & CUSTOM DATA and USER PROFILE DATA above.");
    lines.push("   - Username / User ID / Email: Enter the provided 'username', 'user_id', 'login_id', 'login_email', or user email.");
    lines.push("   - Password: Enter the provided 'account_password' or 'password'.");
    lines.push("   - Click 'Log In' or 'Sign In'. Wait 3 seconds for the session to load.");
    lines.push("3. PROCEED TO BOOK CLASS:");
    lines.push("   - After logging in, you are now authenticated. Return to the class schedule.");
    lines.push("   - Locate the exact requested class time and session.");
    lines.push("   - Click 'Book', 'Reserve', or 'Confirm' using the user's active account or pass.");
    lines.push("   - Wait for the final confirmation screen or message.");
    lines.push("4. REPORT RESULT:");
    lines.push("   - Once the booking confirmation screen appears, report status: 'CONFIRMED' with the booking summary.");
    lines.push("   - Only report 'LOGIN_REQUIRED' if NO password/credentials exist in CREDENTIALS above, or if the website explicitly rejects the login with an 'Invalid credentials' error.");
    lines.push('');
    lines.push('=== CRITICAL OUTCOME & COMPLETION RULES ===');
    lines.push("- Only report 'status': 'CONFIRMED' if you reached the final confirmation screen and have an actual booking or ticket confirmation.");
    lines.push("- If an account login/password or member sign-in is required:");
    lines.push("  - If login credentials (email & password) are provided above, enter them and sign in to complete registration.");
    lines.push("  - If guest registration or email RSVP is available, use it to complete registration.");
    lines.push("  - If login credentials are NOT provided above and no guest option is available, STOP IMMEDIATELY and report:");
    lines.push("    'status': 'LOGIN_REQUIRED', 'summary': 'Account login or password is required on this website to proceed with registration.', 'missingFields': ['account_password', 'login_email']");
    lines.push("  - Do NOT submit dummy passwords or report that the task completed.");
    lines.push("- If required personal data (e.g. phone number, waiver, emergency contact) is requested by the form and missing above:");
    lines.push("  - STOP IMMEDIATELY and report:");
    lines.push("    'status': 'MISSING_DATA', 'summary': 'Personal details (such as phone number) are required to book on this site.', 'missingFields': ['phone_number']");
    lines.push("- If a security verification or CAPTCHA appears, STOP and report 'status': 'CAPTCHA_DETECTED'.");
    lines.push("- If the class/session is sold out or full, report 'status': 'CLASS_FULL'.");
    lines.push("- If paid credits, pass, or payment is required, report 'status': 'PAYMENT_REQUIRED'.");
    lines.push("- If registration could not be completed for any other reason, report 'status': 'FAILED' with the exact reason.");
    lines.push("- ALWAYS return your final result as a structured JSON object with keys:");
    lines.push("  { 'status': 'CONFIRMED'|'LOGIN_REQUIRED'|'MISSING_DATA'|'CAPTCHA_DETECTED'|'CLASS_FULL'|'PAYMENT_REQUIRED'|'FAILED', 'summary': '<1-2 sentence English explanation>', 'missingFields': ['...'] }");
    lines.push('- Close any cookie banners or overlays before clicking.');

    return lines.join('\n');
  }

  const isResearch =
    taskType === 'research' ||
    /\b(research|extract|search|summarize|find|what is|read|check|price|table)\b/i.test(cleanPrompt);

  if (isResearch) {
    const lines = [
      'You are an autonomous web research assistant. Follow these steps carefully:',
      '',
      `1. Navigate the target website: ${url || 'the requested destination'}.`,
      `2. Search or browse to answer this objective: "${cleanPrompt}".`,
      '3. Locate the primary content, relevant data points, or requested sections.',
      '4. If search bars, filters, or paginated lists are required, interact with them purposefully.',
      '5. Extract the key findings, factual details, quotes, or tables cleanly.',
      '6. Summarize your final answer as structured JSON or clean markdown.',
      '',
      '=== IMPORTANT RULES ===',
      "- If a CAPTCHA appears, STOP and report 'CAPTCHA_DETECTED'.",
      '- Do NOT submit forms or execute purchases without explicit confirmation.',
      '- Return only verified factual information found on the page.',
    ];
    return lines.join('\n');
  }

  // General interactive action goal (forms, checkout, booking, navigation)
  const lines = [
    'You are an autonomous web action agent. Follow these steps carefully:',
    '',
    `1. Navigate to the target page: ${url || 'the requested destination'}.`,
    `2. Perform the user instruction: "${cleanPrompt}".`,
    '3. Interact with necessary buttons, links, dropdowns, and form inputs.',
  ];

  if (profile && (profile.name || profile.email)) {
    lines.push('4. Use the provided user profile data when filling form fields:');
    if (profile.name) lines.push(`   - Name: ${profile.name}`);
    if (profile.email) lines.push(`   - Email: ${profile.email}`);
    if (profile.company) lines.push(`   - Company: ${profile.company}`);
    if (profile.role) lines.push(`   - Role: ${profile.role}`);
  }

  lines.push('5. Confirm once the action, submission, or workflow step is complete.');
  lines.push('');
  lines.push('=== IMPORTANT RULES ===');
  lines.push("- If a CAPTCHA appears, STOP and report 'CAPTCHA_DETECTED'.");
  lines.push('- Do NOT submit credit card or financial credentials unless explicitly instructed.');

  return lines.join('\n');
}

export function buildGoal(profile) {
  const lines = [
    'You are an automated registration assistant. Follow these steps carefully:',
    '',
    '1. Look at the current page (a Luma event page).',
    '2. Find and click the main registration / RSVP / Attend button.',
    "   - It might say 'Register', 'RSVP', 'Request to Join', 'Attend', or similar.",
    '   - If there are multiple buttons, pick the primary one.',
    '3. A registration form should appear (either on the same page or a new one).',
    '4. Fill in all visible form fields using the profile data below.',
    '5. For any dropdown or select field, choose the closest matching option.',
    '6. Check any required checkboxes (terms / code of conduct).',
    '7. Do NOT check optional marketing / newsletter checkboxes unless they are required.',
    '8. After filling all fields, click the Submit / Register / Confirm button.',
    '9. Wait for a confirmation message or screen.',
    '10. Report the result: whether registration succeeded, failed, or hit a CAPTCHA.',
    '',
    '=== USER PROFILE DATA ===',
    `Full Name: ${profile?.name || ''}`,
    `Email: ${profile?.email || ''}`,
  ];

  if (profile?.bio) lines.push(`Bio / About: ${profile.bio}`);
  if (profile?.linkedin) lines.push(`LinkedIn: ${profile.linkedin}`);
  if (profile?.twitter) lines.push(`Twitter / X: ${profile.twitter}`);
  if (profile?.company) lines.push(`Company: ${profile.company}`);
  if (profile?.role) lines.push(`Role / Title: ${profile.role}`);
  if (profile?.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile?.website) lines.push(`Website: ${profile.website}`);

  if (profile?.customAnswers && Object.keys(profile.customAnswers).length > 0) {
    lines.push('');
    lines.push('=== ADDITIONAL FORM ANSWERS ===');
    for (const [question, answer] of Object.entries(profile.customAnswers)) {
      lines.push(`Q: ${question}`);
      lines.push(`A: ${answer}`);
    }
  }

  lines.push('');
  lines.push('=== IMPORTANT RULES ===');
  lines.push("- If a CAPTCHA appears, STOP and report 'CAPTCHA_DETECTED'.");
  lines.push("- If prompted to log in or enter an email, enter the attendee email. If 'Continue with Email' or guest RSVP is available, proceed with registration.");
  lines.push("- If an account password or member sign-in is required, check if credentials (password) are in the profile below. If provided, enter email and password to log in and finalize RSVP.");
  lines.push("- If an account password or verification code is strictly required and not provided, report 'LOGIN_REQUIRED'.");
  lines.push("- If the event is full / sold out, STOP and report 'EVENT_FULL'.");
  lines.push("- If registration is already closed, STOP and report 'REGISTRATION_CLOSED'.");
  lines.push('- Close any cookie banners or popups before interacting with the form.');
  lines.push('- Return the final result as JSON with keys: status, message, confirmationText');

  return lines.join('\n');
}

export function normalizeEventUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    return u.toString();
  } catch {
    return (rawUrl || '').trim();
  }
}

export function toCleanText(input) {
  return (input || '')
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function verifySignature(rawBody, timestamp, signature, secret) {
  if (!secret || !timestamp || !signature) {
    return false;
  }
  const expected = `v0=${createHmac('sha256', secret)
    .update(`v0:${timestamp}:`)
    .update(rawBody)
    .digest('hex')}`;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function getHostLabel(rawUrl) {
  if (!rawUrl) return 'the website';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return (rawUrl || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'the website';
  }
}

export function classifyBrowserOutcome(event, targetUrl) {
  const urlDomain = getHostLabel(targetUrl);

  let resultJson = {};
  if (typeof event?.resultJson === 'string') {
    try {
      const parsed = JSON.parse(event.resultJson);
      if (typeof parsed === 'object' && parsed !== null) {
        resultJson = parsed;
      } else {
        resultJson = { raw: event.resultJson };
      }
    } catch {
      resultJson = { raw: event.resultJson };
    }
  } else if (typeof event?.resultJson === 'object' && event?.resultJson !== null) {
    resultJson = event.resultJson;
  } else if (typeof event?.result === 'object' && event?.result !== null) {
    resultJson = event.result;
  }

  const pieces = [];
  if (typeof event?.message === 'string') pieces.push(event.message);
  if (typeof event?.purpose === 'string') pieces.push(event.purpose);
  if (typeof event?.error === 'string') pieces.push(event.error);
  if (typeof event?.help_message === 'string') pieces.push(event.help_message);

  for (const [k, v] of Object.entries(resultJson)) {
    if (typeof v === 'string') pieces.push(`${k}: ${v}`);
    if (typeof v === 'number' || typeof v === 'boolean') pieces.push(`${k}: ${String(v)}`);
  }
  const combinedText = pieces.join(' ');

  const rawStatus = String(resultJson.status || resultJson.actionStatus || '').toUpperCase();

  if (rawStatus === 'LOGIN_REQUIRED' || rawStatus === 'AUTH_REQUIRED' || resultJson.requires_login === true || resultJson.login_required === true) {
    const missing = Array.isArray(resultJson.missingFields) && resultJson.missingFields.length > 0
      ? resultJson.missingFields
      : ['account_password', 'login_email'];
    return {
      status: 'LOGIN_REQUIRED',
      category: 'login_missing',
      reason: resultJson.summary || resultJson.reason || `An existing account or login is required on ${urlDomain} to complete this registration.`,
      message: resultJson.message || `Login required on ${urlDomain}. Please provide your account password or sign up.`,
      missingFields: missing,
      actionRequired: resultJson.promptToUser || `Please provide your ${urlDomain} account email & password (or sign-up details) so the agent can log in and finalize your booking.`,
      details: resultJson,
    };
  }

  if (rawStatus === 'MISSING_DATA' || rawStatus === 'DATA_REQUIRED' || (Array.isArray(resultJson.missingFields) && resultJson.missingFields.length > 0 && rawStatus !== 'CONFIRMED')) {
    const missing = Array.isArray(resultJson.missingFields) && resultJson.missingFields.length > 0
      ? resultJson.missingFields
      : ['phone_number'];
    return {
      status: 'MISSING_DATA',
      category: 'data_missing',
      reason: resultJson.summary || resultJson.reason || `Required personal information (${missing.join(', ')}) is missing to book on ${urlDomain}.`,
      message: resultJson.message || `Personal registration data is missing for ${urlDomain}.`,
      missingFields: missing,
      actionRequired: resultJson.promptToUser || `Please share your mobile phone number or missing details to finish booking.`,
      details: resultJson,
    };
  }

  if (rawStatus === 'CAPTCHA_DETECTED') {
    return {
      status: 'CAPTCHA_DETECTED',
      category: 'captcha',
      reason: `A security challenge (CAPTCHA) appeared on ${urlDomain}.`,
      message: `Security challenge detected on ${urlDomain}.`,
      actionRequired: 'Please open the website to solve the verification or register manually.',
      details: resultJson,
    };
  }

  if (
    rawStatus === 'CLASS_FULL' ||
    rawStatus === 'EVENT_FULL' ||
    rawStatus === 'SOLD_OUT' ||
    rawStatus === 'SALES_ENDED' ||
    rawStatus === 'REGISTRATION_CLOSED' ||
    rawStatus === 'EVENT_ENDED' ||
    rawStatus === 'EVENT_PASSED'
  ) {
    return {
      status: 'CLASS_FULL',
      category: 'sold_out',
      reason: resultJson.summary || `This session on ${urlDomain} is sold out, closed, or sales have ended.`,
      message: `Session is sold out or registration is closed on ${urlDomain}.`,
      actionRequired: 'Would you like to search for an alternative session or time?',
      details: resultJson,
    };
  }

  if (rawStatus === 'PAYMENT_REQUIRED') {
    return {
      status: 'PAYMENT_REQUIRED',
      category: 'payment_needed',
      reason: resultJson.summary || `Payment or class credits are required on ${urlDomain}.`,
      message: `Payment required to register on ${urlDomain}.`,
      actionRequired: 'Please review membership passes or payment options on the website.',
      details: resultJson,
    };
  }

  // Semantic Analysis
  const hasLoginKeywords = /\b(login|log\s*in|sign\s*in|signin|password|passcode|credentials?|account\s+required|create\s+(an\s+)?account|member\s+(portal|login|account)|requires\s+(an\s+)?account)\b/i.test(combinedText);
  const hasPhoneKeywords = /\b(phone|mobile|cell|telephone)\b/i.test(combinedText);
  const hasPersonalDataKeywords = /\b(personal\s+(data|details|info)|emergency\s+contact|waiver|date\s+of\s+birth|dob)\b/i.test(combinedText);
  const hasRequirementSignals = /\b(missing|required|require|requires|prompted|needed|need|needs|asks?\s+for|must\s+provide|not\s+provided|unprovided|enter\s+your|please\s+(enter|provide))\b/i.test(combinedText);
  const hasBlockSignals = /\b(unable|could\s*not|cannot|did\s*not|stopped|prevented|failed|incomplete|blocked|halted|interrupted|wall)\b/i.test(combinedText);

  if (hasLoginKeywords && (hasRequirementSignals || hasBlockSignals || /\b(login\s*wall|must\s+be\s+logged\s+in|already\s+have\s+an\s+account|sign\s+in\s+to\s+book)\b/i.test(combinedText))) {
    const missing = ['account_password', 'login_email'];
    if (hasPhoneKeywords) missing.push('phone_number');
    return {
      status: 'LOGIN_REQUIRED',
      category: 'login_missing',
      reason: resultJson.summary || `An account login or password is required on ${urlDomain} to complete this registration.`,
      message: `Login credentials required on ${urlDomain}.`,
      missingFields: missing,
      actionRequired: `Please provide your ${urlDomain} account password or phone number so the agent can log in and finalize your booking.`,
      details: resultJson,
    };
  }

  if ((hasPhoneKeywords || hasPersonalDataKeywords) && (hasRequirementSignals || hasBlockSignals)) {
    const missing = [];
    if (hasPhoneKeywords) missing.push('phone_number');
    if (/waiver/i.test(combinedText)) missing.push('waiver_signature');
    if (/emergency/i.test(combinedText)) missing.push('emergency_contact');
    if (missing.length === 0) missing.push('personal_data');

    return {
      status: 'MISSING_DATA',
      category: 'data_missing',
      reason: resultJson.summary || `Required personal information (${missing.join(', ')}) is missing to book on ${urlDomain}.`,
      message: `Personal registration data missing on ${urlDomain}.`,
      missingFields: missing,
      actionRequired: `Please share your mobile phone number to finish booking.`,
      details: resultJson,
    };
  }

  if (/\b(captcha|recaptcha|hcaptcha|cloudflare|turnstile|bot\s+detection|security\s+challenge)\b/i.test(combinedText)) {
    return {
      status: 'CAPTCHA_DETECTED',
      category: 'captcha',
      reason: `A security challenge (CAPTCHA) was presented on ${urlDomain}.`,
      message: `Security challenge detected on ${urlDomain}.`,
      actionRequired: 'Manual verification required on the website.',
      details: resultJson,
    };
  }

  if (
    /\b(class\s+full|event\s+full|sold\s+out|sales\s*ended|registration\s*(is\s*)?closed|event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed|waitlist(ed)?|no\s+spots\s+left|at\s+capacity|tickets?\s+unavailable)\b/i.test(
      combinedText
    )
  ) {
    return {
      status: 'CLASS_FULL',
      category: 'sold_out',
      reason: `This class or session on ${urlDomain} is sold out, closed, or sales have ended.`,
      message: `Session is fully booked or registration is closed on ${urlDomain}.`,
      actionRequired: 'Would you like to search for an alternative session or time?',
      details: resultJson,
    };
  }

  if (/\b(payment\s+required|credit\s+card\s+required|paid\s+class|membership\s+required|buy\s+pass)\b/i.test(combinedText)) {
    return {
      status: 'PAYMENT_REQUIRED',
      category: 'payment_needed',
      reason: `Payment or a studio pass is required to complete this booking on ${urlDomain}.`,
      message: `Payment or pass required on ${urlDomain}.`,
      actionRequired: 'This session requires payment or credit pass on the studio website.',
      details: resultJson,
    };
  }

  if (event?.status === 'FAILED' || event?.error || hasBlockSignals) {
    const errorMsg =
      resultJson.summary ||
      resultJson.reason ||
      event?.error ||
      event?.help_message ||
      event?.message ||
      'The browser task could not be completed.';
    return {
      status: 'FAILED',
      category: 'general_failure',
      reason: errorMsg,
      message: `Booking not completed on ${urlDomain}.`,
      details: resultJson,
    };
  }

  const hasConfirmationId = Boolean(resultJson.bookingId || resultJson.ticketId || resultJson.confirmationNumber || resultJson.bookingRef);
  const hasExplicitSuccessStatus = rawStatus === 'CONFIRMED' || rawStatus === 'SUCCESS' || resultJson.confirmed === true;
  const hasConfirmationText = /\b(confirmed|successfully\s+(registered|booked)|registration\s+(is\s+)?complete|reservation\s+confirmed|rsvp\s+confirmed)\b/i.test(combinedText);
  const hasExtractedResearchData = Boolean(resultJson.extractedData || resultJson.summary || resultJson.answer || resultJson.findings);

  if (hasConfirmationId || hasExplicitSuccessStatus || hasConfirmationText || hasExtractedResearchData) {
    const successMsg =
      resultJson.summary ||
      resultJson.message ||
      event?.message ||
      'Registration confirmed successfully!';
    return {
      status: 'SUCCESS',
      category: 'success',
      reason: successMsg,
      message: successMsg,
      details: resultJson,
    };
  }

  return {
    status: 'FAILED',
    category: 'general_failure',
    reason: `Registration was attempted on ${urlDomain}, but was not finalized. No confirmation was received.`,
    message: `Session could not be confirmed on ${urlDomain}.`,
    details: resultJson,
  };
}




