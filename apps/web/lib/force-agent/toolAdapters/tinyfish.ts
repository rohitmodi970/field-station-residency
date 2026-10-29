import { createAdminClient } from '@/utils/supabase/admin';
import { generateDeterministicEmbedding, buildUniversalGoal as helperBuildUniversalGoal } from '../memoryHelpers.js';
import type {
  TinyfishAgentProfile,
  TinyfishExecuteParams,
  ToolAdapter,
  ToolHealth,
  ToolResult,
} from '../types';

export interface AgentEvent {
  type: 'LOG' | 'PROGRESS' | 'STREAMING_URL' | 'COMPLETE' | 'ERROR';
  message: string;
  runId?: string;
  streamingUrl?: string;
  status?: 'SUCCESS' | 'FAILED';
  result?: Record<string, unknown> | null;
}

export interface TinyfishCompletionPayload {
  eventUrl?: string;
  url?: string;
  runId?: string;
  status: 'SUCCESS' | 'FAILED' | 'LOGIN_REQUIRED' | 'MISSING_DATA' | 'CAPTCHA_DETECTED' | 'CLASS_FULL' | 'PAYMENT_REQUIRED';
  message: string;
  category?: 'success' | 'login_missing' | 'data_missing' | 'captcha' | 'sold_out' | 'payment_needed' | 'general_failure';
  result?: Record<string, unknown> | null;
  rawEvent?: Record<string, unknown>;
}

export interface ClassifiedOutcome {
  status: 'SUCCESS' | 'FAILED' | 'LOGIN_REQUIRED' | 'MISSING_DATA' | 'CAPTCHA_DETECTED' | 'CLASS_FULL' | 'PAYMENT_REQUIRED';
  category: 'success' | 'login_missing' | 'data_missing' | 'captcha' | 'sold_out' | 'payment_needed' | 'general_failure';
  reason: string;
  message: string;
  missingFields?: string[];
  actionRequired?: string;
  details?: Record<string, unknown>;
}

function getHostLabel(rawUrl?: string): string {
  if (!rawUrl) return 'the website';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return (rawUrl || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'the website';
  }
}

export function classifyBrowserOutcome(
  event: Record<string, unknown>,
  targetUrl?: string
): ClassifiedOutcome {
  const urlDomain = getHostLabel(targetUrl);

  // Safely parse resultJson whether it is an object, JSON string, or raw text
  let resultJson: Record<string, unknown> = {};
  if (typeof event.resultJson === 'string') {
    try {
      const parsed = JSON.parse(event.resultJson);
      if (typeof parsed === 'object' && parsed !== null) {
        resultJson = parsed as Record<string, unknown>;
      } else {
        resultJson = { raw: event.resultJson };
      }
    } catch {
      resultJson = { raw: event.resultJson };
    }
  } else if (typeof event.resultJson === 'object' && event.resultJson !== null) {
    resultJson = event.resultJson as Record<string, unknown>;
  } else if (typeof event.result === 'object' && event.result !== null) {
    resultJson = event.result as Record<string, unknown>;
  }

  // Combine all narrative text from the event for semantic inspection
  const pieces: string[] = [];
  if (typeof event.message === 'string') pieces.push(event.message);
  if (typeof event.purpose === 'string') pieces.push(event.purpose);
  if (typeof event.error === 'string') pieces.push(event.error);
  if (typeof event.help_message === 'string') pieces.push(event.help_message);

  for (const [k, v] of Object.entries(resultJson)) {
    if (typeof v === 'string') pieces.push(`${k}: ${v}`);
    if (typeof v === 'number' || typeof v === 'boolean') pieces.push(`${k}: ${String(v)}`);
  }
  const combinedText = pieces.join(' ');

  // 1. Explicit Status / Outcome check
  const rawStatus = String(resultJson.status || resultJson.actionStatus || '').toUpperCase();

  if (rawStatus === 'LOGIN_REQUIRED' || rawStatus === 'AUTH_REQUIRED' || resultJson.requires_login === true || resultJson.login_required === true) {
    const missing = Array.isArray(resultJson.missingFields) && resultJson.missingFields.length > 0
      ? (resultJson.missingFields as string[])
      : ['account_password', 'login_email'];
    return {
      status: 'LOGIN_REQUIRED',
      category: 'login_missing',
      reason: (resultJson.summary as string) || (resultJson.reason as string) || `An existing account or login is required on ${urlDomain} to complete this registration.`,
      message: (resultJson.message as string) || `Login required on ${urlDomain}. Please provide your account password or sign up.`,
      missingFields: missing,
      actionRequired: (resultJson.promptToUser as string) || `Please provide your ${urlDomain} account email & password (or sign-up details) so the agent can log in and finalize your booking.`,
      details: resultJson,
    };
  }

  if (rawStatus === 'MISSING_DATA' || rawStatus === 'DATA_REQUIRED' || (Array.isArray(resultJson.missingFields) && (resultJson.missingFields as string[]).length > 0 && rawStatus !== 'CONFIRMED')) {
    const missing = Array.isArray(resultJson.missingFields) && resultJson.missingFields.length > 0
      ? (resultJson.missingFields as string[])
      : ['phone_number'];
    return {
      status: 'MISSING_DATA',
      category: 'data_missing',
      reason: (resultJson.summary as string) || (resultJson.reason as string) || `Required personal information (${missing.join(', ')}) is missing to book on ${urlDomain}.`,
      message: (resultJson.message as string) || `Personal registration data is missing for ${urlDomain}.`,
      missingFields: missing,
      actionRequired: (resultJson.promptToUser as string) || `Please share your mobile phone number or missing details to finish booking.`,
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
      reason: (resultJson.summary as string) || `This session on ${urlDomain} is sold out, closed, or sales have ended.`,
      message: `Session is sold out or registration is closed on ${urlDomain}.`,
      actionRequired: 'Would you like to search for an alternative session or time?',
      details: resultJson,
    };
  }

  if (rawStatus === 'PAYMENT_REQUIRED') {
    return {
      status: 'PAYMENT_REQUIRED',
      category: 'payment_needed',
      reason: (resultJson.summary as string) || `Payment or class credits are required on ${urlDomain}.`,
      message: `Payment required to register on ${urlDomain}.`,
      actionRequired: 'Please review membership passes or payment options on the website.',
      details: resultJson,
    };
  }

  // 2. Comprehensive Semantic Analysis
  const hasLoginKeywords = /\b(login|log\s*in|sign\s*in|signin|password|passcode|credentials?|account\s+required|create\s+(an\s+)?account|member\s+(portal|login|account)|requires\s+(an\s+)?account)\b/i.test(combinedText);
  const hasPhoneKeywords = /\b(phone|mobile|cell|telephone)\b/i.test(combinedText);
  const hasPersonalDataKeywords = /\b(personal\s+(data|details|info)|emergency\s+contact|waiver|date\s+of\s+birth|dob)\b/i.test(combinedText);
  const hasRequirementSignals = /\b(missing|required|require|requires|prompted|needed|need|needs|asks?\s+for|must\s+provide|not\s+provided|unprovided|enter\s+your|please\s+(enter|provide))\b/i.test(combinedText);
  const hasBlockSignals = /\b(unable|could\s*not|cannot|did\s*not|stopped|prevented|failed|incomplete|blocked|halted|interrupted|wall)\b/i.test(combinedText);

  // If login is mentioned with requirement or blockage
  if (hasLoginKeywords && (hasRequirementSignals || hasBlockSignals || /\b(login\s*wall|must\s+be\s+logged\s+in|already\s+have\s+an\s+account|sign\s+in\s+to\s+book)\b/i.test(combinedText))) {
    const missing: string[] = ['account_password', 'login_email'];
    if (hasPhoneKeywords) missing.push('phone_number');
    return {
      status: 'LOGIN_REQUIRED',
      category: 'login_missing',
      reason: (resultJson.summary as string) || `An account login or password is required on ${urlDomain} to complete this registration.`,
      message: `Login credentials required on ${urlDomain}.`,
      missingFields: missing,
      actionRequired: `Please provide your ${urlDomain} account password or phone number so the agent can log in and finalize your booking.`,
      details: resultJson,
    };
  }

  // If phone or personal data is required / missing
  if ((hasPhoneKeywords || hasPersonalDataKeywords) && (hasRequirementSignals || hasBlockSignals)) {
    const missing: string[] = [];
    if (hasPhoneKeywords) missing.push('phone_number');
    if (/waiver/i.test(combinedText)) missing.push('waiver_signature');
    if (/emergency/i.test(combinedText)) missing.push('emergency_contact');
    if (missing.length === 0) missing.push('personal_data');

    return {
      status: 'MISSING_DATA',
      category: 'data_missing',
      reason: (resultJson.summary as string) || `Required personal information (${missing.join(', ')}) is missing to book on ${urlDomain}.`,
      message: `Personal registration data missing on ${urlDomain}.`,
      missingFields: missing,
      actionRequired: `Please share your mobile phone number to finish booking.`,
      details: resultJson,
    };
  }

  // CAPTCHA / bot challenge
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

  // Sold out / full / closed / sales ended
  if (
    /\b(class\s+full|event\s+full|sold\s+out|sales\s*ended|registration\s*(is\s*)?closed|event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed|waitlist(ed)?|no\s+spots\s+left|at\s+capacity|tickets?\s+unavailable)\b/i.test(
      combinedText
    )
  ) {
    return {
      status: 'CLASS_FULL',
      category: 'sold_out',
      reason: (resultJson.summary as string) || `This class or session on ${urlDomain} is sold out, closed, or sales have ended.`,
      message: `Session is fully booked or registration is closed on ${urlDomain}.`,
      actionRequired: 'Would you like to search for an alternative session or time?',
      details: resultJson,
    };
  }

  // Payment required
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

  // Generic failure / inability mentioned in text
  if (event.status === 'FAILED' || event.error || hasBlockSignals) {
    const errorMsg =
      (resultJson.summary as string) ||
      (resultJson.reason as string) ||
      (event.error as string) ||
      (event.help_message as string) ||
      (event.message as string) ||
      'The browser task could not be completed.';
    return {
      status: 'FAILED',
      category: 'general_failure',
      reason: errorMsg,
      message: `Booking not completed on ${urlDomain}.`,
      details: resultJson,
    };
  }

  // 3. Positive Confirmation Check: NEVER assume success without evidence
  const hasConfirmationId = Boolean(resultJson.bookingId || resultJson.ticketId || resultJson.confirmationNumber || resultJson.bookingRef);
  const hasExplicitSuccessStatus = rawStatus === 'CONFIRMED' || rawStatus === 'SUCCESS' || resultJson.confirmed === true;
  const hasConfirmationText = /\b(confirmed|successfully\s+(registered|booked)|registration\s+(is\s+)?complete|reservation\s+confirmed|rsvp\s+confirmed)\b/i.test(combinedText);
  const hasExtractedResearchData = Boolean(resultJson.extractedData || resultJson.summary || resultJson.answer || resultJson.findings);

  if (hasConfirmationId || hasExplicitSuccessStatus || hasConfirmationText || hasExtractedResearchData) {
    const successMsg =
      (resultJson.summary as string) ||
      (resultJson.message as string) ||
      (event.message as string) ||
      'Registration confirmed successfully!';
    return {
      status: 'SUCCESS',
      category: 'success',
      reason: successMsg,
      message: successMsg,
      details: resultJson,
    };
  }

  // Fallback: If registration was attempted without explicit confirmation, it did NOT confirm
  return {
    status: 'FAILED',
    category: 'general_failure',
    reason: `Registration was attempted on ${urlDomain}, but was not finalized. No confirmation was received.`,
    message: `Session could not be confirmed on ${urlDomain}.`,
    details: resultJson,
  };
}

export interface TinyfishStreamHooks {
  onComplete?: (payload: TinyfishCompletionPayload) => void | Promise<void>;
}

const TINYFISH_API_URL = 'https://agent.tinyfish.ai/v1/automation/run-sse';

export function buildUniversalGoal(params: {
  prompt?: string;
  url?: string;
  profile?: TinyfishAgentProfile;
  taskType?: 'research' | 'action' | 'registration' | 'browse';
  location?: any;
}): string {
  return helperBuildUniversalGoal(params);
}

export function buildGoal(profile: TinyfishAgentProfile): string {
  const lines: string[] = [
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
    `Full Name: ${profile.name}`,
    `Email: ${profile.email}`,
  ];

  if (profile.bio) lines.push(`Bio / About: ${profile.bio}`);
  if (profile.linkedin) lines.push(`LinkedIn: ${profile.linkedin}`);
  if (profile.twitter) lines.push(`Twitter / X: ${profile.twitter}`);
  if (profile.company) lines.push(`Company: ${profile.company}`);
  if (profile.role) lines.push(`Role / Title: ${profile.role}`);
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.website) lines.push(`Website: ${profile.website}`);

  if (profile.customAnswers && Object.keys(profile.customAnswers).length > 0) {
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

export function normalizeEventUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

export function toCleanText(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export async function fetchEventMetadata(
  eventUrl: string
): Promise<{ title: string; description: string; host: string }> {
  let host = 'unknown host';
  try {
    host = new URL(eventUrl).host.replace(/^www\./, '');
  } catch {
    // keep fallback host
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(eventUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'ForceAgent/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { title: 'Untitled Event', description: '', host };
    }

    const html = await response.text();
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const ogDescription = html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i
    )?.[1];
    const metaDescription = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
    )?.[1];

    const title = toCleanText(ogTitle || titleTag || 'Untitled Event');
    const description = toCleanText(ogDescription || metaDescription || '').slice(0, 280);

    return { title, description, host };
  } catch {
    return { title: 'Untitled Event', description: '', host };
  }
}

async function upsertKnowledgeItem(args: {
  userId: string;
  knowledgeType: 'memory' | 'raw';
  category: 'behavior' | 'life_event';
  content: string;
  confidence: number;
}) {
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const contentSnippet = args.content.slice(0, 120).replace(/'/g, "''");

    const { data: existing } = await admin
      .from('user_knowledge')
      .select('id, confidence, evidence_count')
      .eq('user_id', args.userId)
      .eq('knowledge_type', args.knowledgeType)
      .eq('category', args.category)
      .eq('is_active', true)
      .ilike('content', `%${contentSnippet}%`)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await admin
        .from('user_knowledge')
        .update({
          confidence: Math.min(1, Math.max(existing.confidence || 0.6, args.confidence) + 0.03),
          evidence_count: (existing.evidence_count || 1) + 1,
          last_seen_at: nowIso,
        })
        .eq('id', existing.id);
      return;
    }

    await admin.from('user_knowledge').insert({
      user_id: args.userId,
      knowledge_type: args.knowledgeType,
      category: args.category,
      content: args.content,
      confidence: args.confidence,
      embedding: generateDeterministicEmbedding(args.content),
      first_seen_at: nowIso,
      last_seen_at: nowIso,
    });
  } catch (err) {
    console.error('[TinyFish Adapter] upsertKnowledgeItem error:', err);
  }
}

export async function persistTinyfishUsageContext(
  userId: string,
  payload: TinyfishCompletionPayload
): Promise<void> {
  const targetUrl = payload.url || payload.eventUrl || '';
  const normalizedUrl = normalizeEventUrl(targetUrl);
  const eventMeta = await fetchEventMetadata(normalizedUrl);
  const statusPhrase = payload.status === 'SUCCESS' ? 'completed' : 'attempted';
  const resultText =
    typeof payload.result?.confirmationText === 'string'
      ? payload.result.confirmationText
      : typeof payload.result?.message === 'string'
        ? payload.result.message
        : typeof payload.result?.extractedData === 'string'
          ? payload.result.extractedData
          : '';

  const isLuma = eventMeta.host.includes('lu.ma') || eventMeta.host.includes('luma');
  const memoryContent = isLuma
    ? `Shows a pattern of using Force Agent to register for events on ${eventMeta.host}, including "${eventMeta.title}".`
    : `Shows a pattern of using Force Agent to research and automate browser workflows on ${eventMeta.host}, including "${eventMeta.title}".`;

  const rawParts = [
    `TinyFish ${statusPhrase} browser automation for "${eventMeta.title}".`,
    `Target URL: ${normalizedUrl}.`,
    `Outcome: ${payload.message}.`,
  ];

  if (eventMeta.description) rawParts.push(`Context: ${eventMeta.description}.`);
  if (resultText) rawParts.push(`Result context: ${toCleanText(resultText).slice(0, 260)}.`);

  await Promise.all([
    upsertKnowledgeItem({
      userId,
      knowledgeType: 'memory',
      category: 'behavior',
      content: memoryContent,
      confidence: 0.72,
    }),
    upsertKnowledgeItem({
      userId,
      knowledgeType: 'raw',
      category: 'life_event',
      content: rawParts.join(' '),
      confidence: payload.status === 'SUCCESS' ? 0.9 : 0.78,
    }),
  ]);
}

export interface CreateBrowserStreamOptions {
  url?: string;
  eventUrl?: string;
  goal?: string;
  prompt?: string;
  taskType?: 'research' | 'action' | 'registration' | 'browse';
  profile?: TinyfishAgentProfile;
  hooks?: TinyfishStreamHooks;
}

export async function createBrowserStream(
  options: CreateBrowserStreamOptions
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.TINYFISH_API_KEY;
  const encoder = new TextEncoder();

  const send = (event: AgentEvent): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

  if (!apiKey || apiKey === 'your_tinyfish_api_key_here') {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          send({
            type: 'ERROR',
            message: 'TinyFish API key is not configured. Set TINYFISH_API_KEY in your .env file.',
          })
        );
        controller.close();
      },
    });
  }

  const targetUrl =
    options.url ||
    options.eventUrl ||
    (options.prompt ? `https://www.google.com/search?q=${encodeURIComponent(options.prompt)}` : 'https://www.google.com');

  let goal = options.goal;
  if (!goal) {
    goal = buildUniversalGoal({
      prompt: options.prompt,
      url: targetUrl,
      profile: options.profile,
      taskType: options.taskType,
    });
  } else if (options.profile && !goal.includes('=== USER PROFILE DATA ===')) {
    const profileLines: string[] = ['', '=== USER PROFILE DATA ==='];
    if (options.profile.name) profileLines.push(`Full Name: ${options.profile.name}`);
    if (options.profile.email) profileLines.push(`Email: ${options.profile.email}`);
    if (options.profile.phone) profileLines.push(`Phone: ${options.profile.phone}`);
    if (options.profile.company) profileLines.push(`Company: ${options.profile.company}`);
    if (options.profile.role) profileLines.push(`Role / Title: ${options.profile.role}`);
    if (options.profile.customAnswers && Object.keys(options.profile.customAnswers).length > 0) {
      profileLines.push('');
      profileLines.push('=== CREDENTIALS & CUSTOM DATA ===');
      for (const [key, val] of Object.entries(options.profile.customAnswers)) {
        profileLines.push(`${key}: ${val}`);
      }
    }
    profileLines.push('');
    profileLines.push('=== LOGIN & REGISTRATION RULES ===');
    profileLines.push("- If an account login/password or member sign-in is required:");
    profileLines.push("  - If guest registration or email RSVP is available, use guest checkout.");
    profileLines.push("  - If login credentials (email & password) are provided above, enter them and sign in to complete registration.");
    profileLines.push("  - If account registration is required to book, sign up with the user profile details.");
    profileLines.push("  - Only report 'LOGIN_REQUIRED' if an account password or verification code is strictly demanded and missing.");
    goal = `${goal}\n${profileLines.join('\n')}`;
  }

  // Ensure active credentials and login execution instructions are always present when credentials exist
  if (options.profile) {
    const creds = options.profile.customAnswers || {};
    const hasCreds = Boolean(
      creds['password'] ||
      creds['account_password'] ||
      creds['username'] ||
      creds['user_id'] ||
      creds['login_id'] ||
      creds['login_email']
    );

    if (hasCreds && !goal.includes('=== MANDATORY ACCOUNT LOGIN & AUTHENTICATION PROTOCOL ===')) {
      const authLines: string[] = [
        '',
        '=== MANDATORY ACCOUNT LOGIN & AUTHENTICATION PROTOCOL ===',
        'You have been provided with active member / user account credentials below:',
      ];
      if (creds['username'] || creds['user_id'] || creds['login_id']) {
        authLines.push(`• Member User ID / Username: ${creds['username'] || creds['user_id'] || creds['login_id']}`);
      }
      if (creds['login_email'] || options.profile.email) {
        authLines.push(`• Account Email: ${creds['login_email'] || options.profile.email}`);
      }
      if (creds['account_password'] || creds['password']) {
        authLines.push(`• Account Password: ${creds['account_password'] || creds['password']}`);
      }
      if (options.profile.phone) {
        authLines.push(`• Mobile Phone: ${options.profile.phone}`);
      }
      authLines.push('');
      authLines.push('LOGIN EXECUTION INSTRUCTIONS:');
      authLines.push("1. Check if the website has a 'Log In', 'Sign In', or member icon on the page or in the schedule container.");
      authLines.push("   - Or click 'Book' / 'Register' for the desired class, which opens the login dialog.");
      authLines.push('2. In the login modal or page:');
      authLines.push("   - Enter the User ID / Username or Email into the login input.");
      authLines.push("   - Enter the Password into the password input.");
      authLines.push("   - Click 'Log In' / 'Sign In' and wait for authentication.");
      authLines.push('3. Once authenticated:');
      authLines.push('   - Proceed to the requested class session on the schedule and confirm the booking.');
      authLines.push('   - Complete the reservation and wait for the confirmation screen.');
      authLines.push("- Do NOT report 'LOGIN_REQUIRED' without entering these credentials to log in.");

      goal = `${goal}\n${authLines.join('\n')}`;
    }
  }

  let tfResponse: Response;
  try {
    tfResponse = await fetch(TINYFISH_API_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        goal,
        browser_profile: 'stealth',
        proxy_config: { enabled: true, country_code: 'US' },
      }),
    });
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown network error';
    return new ReadableStream({
      start(controller) {
        controller.enqueue(send({ type: 'ERROR', message: `Network error calling TinyFish: ${msg}` }));
        controller.close();
      },
    });
  }

  if (!tfResponse.ok && !tfResponse.body) {
    const text = await tfResponse.text().catch(() => 'Unknown error');
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          send({
            type: 'ERROR',
            message: `TinyFish returned HTTP ${tfResponse.status}: ${text}`,
          })
        );
        controller.close();
      },
    });
  }

  const tfReader = tfResponse.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(send({ type: 'LOG', message: 'Starting autonomous web agent...' }));
      controller.enqueue(send({ type: 'LOG', message: `Target: ${targetUrl}` }));
      if (options.profile?.name) {
        controller.enqueue(
          send({
            type: 'LOG',
            message: `Operating as: ${options.profile.name}${options.profile.email ? ` (${options.profile.email})` : ''}`,
          })
        );
      }
      controller.enqueue(send({ type: 'LOG', message: 'Sending task to TinyFish Web Agent...' }));

      let buffer = '';

      try {
        while (true) {
          const { done, value } = await tfReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop()!;

          for (const part of parts) {
            for (const line of part.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              let event: Record<string, unknown>;
              try {
                event = JSON.parse(jsonStr);
              } catch {
                continue;
              }

              switch (event.type) {
                case 'STARTED':
                  controller.enqueue(
                    send({
                      type: 'LOG',
                      message: `Agent started (run: ${event.runId})`,
                      runId: event.runId as string,
                    })
                  );
                  break;

                case 'STREAMING_URL':
                  controller.enqueue(
                    send({
                      type: 'STREAMING_URL',
                      message: 'Live browser stream available',
                      streamingUrl: event.streamingUrl as string,
                      runId: event.runId as string,
                    })
                  );
                  break;

                case 'PROGRESS':
                  controller.enqueue(
                    send({
                      type: 'PROGRESS',
                      message: (event.purpose as string) || 'Working...',
                      runId: event.runId as string,
                    })
                  );
                  break;

                case 'COMPLETE': {
                  const classification = classifyBrowserOutcome(event, targetUrl);

                  const completionPayload: TinyfishCompletionPayload = {
                    eventUrl: targetUrl,
                    url: targetUrl,
                    runId: event.runId as string,
                    status: classification.status,
                    category: classification.category,
                    message: classification.message,
                    result: {
                      status: classification.status,
                      category: classification.category,
                      summary: classification.reason,
                      actionRequired: classification.actionRequired,
                      missingFields: classification.missingFields,
                      details: classification.details,
                      ...(typeof event.resultJson === 'object' && event.resultJson ? (event.resultJson as Record<string, unknown>) : {}),
                    },
                    rawEvent: event,
                  };

                  controller.enqueue(
                    send({
                      type: 'COMPLETE',
                      status: classification.status as any,
                      message: classification.message,
                      result: completionPayload.result,
                      runId: completionPayload.runId,
                    })
                  );

                  if (options.hooks?.onComplete) {
                    Promise.resolve(options.hooks.onComplete(completionPayload)).catch((hookErr) => {
                      console.error('[TinyFish] onComplete hook failed:', hookErr);
                    });
                  }
                  break;
                }

                case 'HEARTBEAT':
                  break;

                default:
                  controller.enqueue(
                    send({
                      type: 'LOG',
                      message: `Agent event: ${event.type}`,
                    })
                  );
              }
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Stream reading error';
        controller.enqueue(send({ type: 'ERROR', message: msg }));
      } finally {
        controller.close();
      }
    },
  });
}

export async function createRegistrationStream(
  eventUrl: string,
  profile: TinyfishAgentProfile,
  hooks?: TinyfishStreamHooks
): Promise<ReadableStream<Uint8Array>> {
  return createBrowserStream({
    url: eventUrl,
    eventUrl,
    profile,
    taskType: 'registration',
    hooks,
  });
}

export const tinyfishAdapter: ToolAdapter<TinyfishExecuteParams, unknown> = {
  name: 'tinyfish',

  async execute(params: TinyfishExecuteParams): Promise<ToolResult<unknown>> {
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
        if (!params.userId || !params.payload) {
          return { ok: false, error: 'userId and payload are required for persist action' };
        }
        await persistTinyfishUsageContext(params.userId, params.payload);
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
        const stream = await createBrowserStream({
          url: targetUrl,
          eventUrl: targetUrl,
          goal: params.goal,
          prompt: params.prompt,
          taskType: params.taskType,
          profile: params.profile,
        });
        return { ok: true, data: { stream, url: targetUrl } };
      }

      return { ok: false, error: `Unsupported action "${action}"` };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'TinyFish adapter execution failed',
      };
    }
  },

  async health(): Promise<ToolHealth> {
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

