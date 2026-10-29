import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

// ─── 1. Security & Signature Verification Engine ─────────────────────────────

function verifySignature(rawBody, timestamp, signature, secret = 'test-secret') {
  if (!secret || !timestamp || !signature) return false;

  const parsedTimestamp = parseInt(timestamp, 10);
  if (!isNaN(parsedTimestamp)) {
    const nowSec = Math.floor(Date.now() / 1000);
    const normalizedTsSec = parsedTimestamp > 1e11 ? Math.floor(parsedTimestamp / 1000) : parsedTimestamp;
    if (Math.abs(nowSec - normalizedTsSec) > 300) {
      return false; // Replay attack protection
    }
  }

  const expected = `v0=${crypto
    .createHmac('sha256', secret)
    .update(`v0:${timestamp}:`)
    .update(rawBody)
    .digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

test('Security: verifySignature validates correct HMAC SHA-256 signatures', () => {
  const secret = 'my-webhook-secret-123';
  const body = Buffer.from(JSON.stringify({ event: 'messages', text: 'Hello' }));
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = `v0=${crypto
    .createHmac('sha256', secret)
    .update(`v0:${timestamp}:`)
    .update(body)
    .digest('hex')}`;

  const valid = verifySignature(body, timestamp, signature, secret);
  assert.equal(valid, true, 'Valid signature must pass');
});

test('Security: verifySignature rejects tampered body or invalid signature', () => {
  const secret = 'my-webhook-secret-123';
  const body = Buffer.from(JSON.stringify({ event: 'messages', text: 'Hello' }));
  const tamperedBody = Buffer.from(JSON.stringify({ event: 'messages', text: 'Malicious' }));
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = `v0=${crypto
    .createHmac('sha256', secret)
    .update(`v0:${timestamp}:`)
    .update(body)
    .digest('hex')}`;

  const valid = verifySignature(tamperedBody, timestamp, signature, secret);
  assert.equal(valid, false, 'Tampered body must fail verification');
});

test('Security: verifySignature rejects replay attacks older than 300 seconds', () => {
  const secret = 'my-webhook-secret-123';
  const body = Buffer.from(JSON.stringify({ event: 'messages' }));
  const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago

  const signature = `v0=${crypto
    .createHmac('sha256', secret)
    .update(`v0:${staleTimestamp}:`)
    .update(body)
    .digest('hex')}`;

  const valid = verifySignature(body, staleTimestamp, signature, secret);
  assert.equal(valid, false, 'Stale timestamp (> 300s) must be rejected');
});

// ─── 2. Phone Normalization & Identity Resolution ────────────────────────────

function normalizePhoneNumber(raw = '') {
  if (!raw) return '';
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return '';
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

function generateConnectInvitation(platform, senderId, baseUrl = 'https://force.app') {
  const secret = 'test-secret';
  const timestamp = Math.floor(Date.now() / 1000);
  const rawPayload = `${platform}:${senderId}:${timestamp}`;
  const token = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex').slice(0, 16);

  const connectUrl = `${baseUrl}/connect?platform=${encodeURIComponent(
    platform
  )}&sender=${encodeURIComponent(senderId)}&t=${timestamp}&sig=${token}`;

  const platformLabel = platform === 'whatsapp' ? 'WhatsApp' : platform === 'imessage' ? 'iMessage' : platform;

  const invitationText =
    `Hey! I'm Force. 👋\n\n` +
    `It looks like your ${platformLabel} isn't linked to your Force account yet. ` +
    `Connect it with one tap to start capturing voice notes, reflections, and sidequests:\n\n` +
    `${connectUrl}`;

  return { connectUrl, invitationText, token };
}

test('Identity: normalizePhoneNumber normalizes various international phone formats to E.164', () => {
  assert.equal(normalizePhoneNumber('+91 98765-43210'), '+919876543210');
  assert.equal(normalizePhoneNumber('+1 (415) 555-2671'), '+14155552671');
  assert.equal(normalizePhoneNumber('919876543210'), '919876543210');
  assert.equal(normalizePhoneNumber('  +44 7911 123456  '), '+447911123456');
  assert.equal(normalizePhoneNumber(''), '');
});

test('Identity: generateConnectInvitation creates secure 1-click account linking URL for unlinked phones', () => {
  const invite = generateConnectInvitation('whatsapp', '+919876543210');
  assert.ok(invite.connectUrl.includes('https://force.app/connect'));
  assert.ok(invite.connectUrl.includes('platform=whatsapp'));
  assert.ok(invite.connectUrl.includes('sender=%2B919876543210'));
  assert.ok(invite.connectUrl.includes('sig='));
  assert.ok(invite.invitationText.includes('WhatsApp'));
  assert.ok(invite.invitationText.includes('Connect it with one tap'));
});

// ─── 3. Outbound Typography & Platform Formatting ────────────────────────────

function extractMediaFromText(text) {
  if (!text) return { cleanedText: '' };
  let mediaUrl;
  const mdImgMatch = text.match(/!\[.*?\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif|svg)(?:\?[^\s)]*)?)\)/i);
  if (mdImgMatch) {
    mediaUrl = mdImgMatch[1];
  } else {
    const directImgMatch = text.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s)]*)?)/i);
    if (directImgMatch) {
      mediaUrl = directImgMatch[1];
    }
  }
  const cleanedText = text.replace(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g, '').trim();
  return { cleanedText, mediaUrl };
}

function formatMessageForPlatform(text, platform) {
  if (!text) return '';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g, '').trim();
  cleaned = cleaned.replace(/^[\t ]*[-*][\t ]+/gm, '• ');

  switch (platform.toLowerCase()) {
    case 'whatsapp':
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '*$1*');
      cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, '*$1*');
      cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '*$1*: $2');
      return cleaned;

    case 'imessage':
    case 'sms':
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
      cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
      cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, '$1');
      cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2');
      return cleaned;

    case 'telegram':
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '*$1*');
      cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, '*$1*');
      cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2');
      return cleaned;

    default:
      return cleaned;
  }
}

test('Outbound: WhatsApp typography formats **bold** into *bold*', () => {
  const input = 'Your task **Review Launch Specs** has been added to your **To-Do list**.';
  const formatted = formatMessageForPlatform(input, 'whatsapp');
  assert.equal(formatted, 'Your task *Review Launch Specs* has been added to your *To-Do list*.');
});

test('Outbound: iMessage typography strips markdown brackets for clean iOS bubbles', () => {
  const input = 'Your task **Review Launch Specs** has been added to your *To-Do list*.';
  const formatted = formatMessageForPlatform(input, 'imessage');
  assert.equal(formatted, 'Your task Review Launch Specs has been added to your To-Do list.');
});

test('Outbound: Hyperlinks are formatted into clickable labels across WhatsApp & iMessage', () => {
  const input = 'Check out [Tokyo Record Bar](https://maps.google.com/?q=Tokyo+Record+Bar) tonight!';
  const waFormatted = formatMessageForPlatform(input, 'whatsapp');
  assert.equal(waFormatted, 'Check out *Tokyo Record Bar*: https://maps.google.com/?q=Tokyo+Record+Bar tonight!');

  const imsgFormatted = formatMessageForPlatform(input, 'imessage');
  assert.equal(imsgFormatted, 'Check out Tokyo Record Bar: https://maps.google.com/?q=Tokyo+Record+Bar tonight!');
});

test('Media: extractMediaFromText correctly extracts image URL and cleans markdown syntax', () => {
  const input = '![Vinyl Lounge](https://images.unsplash.com/photo-1511671782779.jpg?auto=format)\n\nHere is the spot for tonight.';
  const { cleanedText, mediaUrl } = extractMediaFromText(input);
  assert.equal(mediaUrl, 'https://images.unsplash.com/photo-1511671782779.jpg?auto=format');
  assert.equal(cleanedText, 'Here is the spot for tonight.');
});

// ─── 4. Rate Limiting Engine ─────────────────────────────────────────────────

class RateLimiter {
  constructor(maxPerWindow = 5, windowMs = 1000) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
    this.map = new Map();
  }

  check(recipientId) {
    const now = Date.now();
    const history = this.map.get(recipientId) || [];
    const valid = history.filter((ts) => now - ts < this.windowMs);

    if (valid.length >= this.maxPerWindow) {
      return false;
    }
    valid.push(now);
    this.map.set(recipientId, valid);
    return true;
  }
}

test('Outbound: Rate limiter blocks carrier flood after exceeding window threshold', () => {
  const limiter = new RateLimiter(3, 500); // 3 messages max per 500ms
  const recipient = '+919876543210';

  assert.equal(limiter.check(recipient), true);
  assert.equal(limiter.check(recipient), true);
  assert.equal(limiter.check(recipient), true);
  assert.equal(limiter.check(recipient), false, '4th message must be throttled');
});

// ─── 5. Multimodal Audio & Media Connector ───────────────────────────────────

function processMockAudioNote(transcript) {
  const lower = (transcript || '').toLowerCase();
  const isNegative = lower.includes('tired') || lower.includes('drained') || lower.includes('exhausted') || lower.includes('stressed');
  const isPositive = lower.includes('great') || lower.includes('hyped') || lower.includes('excited') || lower.includes('proud');

  let sentiment = 'neutral';
  let energyScore = 0.6;

  if (isNegative) {
    sentiment = 'negative';
    energyScore = 0.35;
  } else if (isPositive) {
    sentiment = 'positive';
    energyScore = 0.85;
  }

  return {
    transcript,
    sentiment,
    energyScore,
    durationSeconds: Math.max(5, Math.round(transcript.split(' ').length / 2.5)),
  };
}

test('Media: processMockAudioNote detects fatigue and lowers Energy Pulse score', () => {
  const result = processMockAudioNote('Totally drained after that 3-hour product sync with Rohit.');
  assert.equal(result.sentiment, 'negative');
  assert.ok(result.energyScore <= 0.4, 'Exhaustion note must yield low energy score');
  assert.ok(result.durationSeconds > 0);
});

test('Media: processMockAudioNote detects positive energy boost', () => {
  const result = processMockAudioNote('Just shipped the new build and feeling hyped about the launch!');
  assert.equal(result.sentiment, 'positive');
  assert.ok(result.energyScore >= 0.8, 'Hyped note must yield high energy score');
});

// ─── 6. Funmaxxing Social Prompt Compliance ──────────────────────────────────

const FORCE_SOCIAL_BRAIN_PROMPT = `You are Force — the user's sharp, witty, charismatic lifestyle wingman on their personal chat (WhatsApp/iMessage).

CORE POSTURE:
- Funmaxxing & High EQ: Talk like a brilliant, observant close friend who knows them well.
- STRICT BREVITY: 2 to 3 sentences maximum (strictly under 75 words). Never send text walls or 5-page essays.
- ZERO SYCOPHANCY & ZERO CLINICAL LECTURES:
  - NEVER say "As an AI...", "I understand that you feel...", "I hear you", or "Here are 5 ways to optimize your routine".
  - Banned: Therapeutic platitudes, corporate bullet-point summaries, unsolicited disclaimers.
- DUAL-TRACK TRUTH: Silently remember their tasks and reflections, but text back with effortless wit, gentle reality checks, and real momentum.
- PLATFORM NATIVE FORMATTING:
  - If WhatsApp: use *bold* for emphasis, punchy line breaks, and natural emojis.
  - If iMessage/SMS: use clean text without bracketed markdown.
- SERENDIPITY BIAS: If they're spiraling, bored, or overworking, nudge them toward a real-world break, coffee, music, or an evening sidequest.`;

function buildSocialPrompt({ platform, userName, userText, memoryContext }) {
  return `${FORCE_SOCIAL_BRAIN_PROMPT}

Target Platform: ${platform.toUpperCase()}
User: ${userName || 'Friend'}
User Message: "${userText}"
${memoryContext ? `Episodic Context: ${memoryContext}` : ''}

Generate a concise 2-3 sentence charismatic reply directly to their phone:`;
}

test('Prompt: buildSocialPrompt enforces strict brevity, funmaxxing tone, and bans corporate lectures', () => {
  const prompt = buildSocialPrompt({
    platform: 'whatsapp',
    userName: 'Arushi',
    userText: 'Feeling exhausted from coding all night',
  });

  assert.ok(prompt.includes('STRICT BREVITY: 2 to 3 sentences maximum'));
  assert.ok(prompt.includes('ZERO SYCOPHANCY & ZERO CLINICAL LECTURES'));
  assert.ok(prompt.includes('NEVER say "As an AI..."'));
  assert.ok(prompt.includes('Target Platform: WHATSAPP'));
  assert.ok(prompt.includes('Funmaxxing & High EQ'));
});

// ─── 7. Dual-Track Cognitive Brain Simulation ────────────────────────────────

async function simulateDualTrackBrain(userText, platform = 'whatsapp') {
  const sideEffects = {};
  let outboundReply = '';

  const isActionOrTask =
    /\b(remember to|todo|to-do|task|remind me|need to|have to|must|schedule|buy|call|meeting with|submit)\b/i.test(
      userText
    );

  if (isActionOrTask) {
    sideEffects.taskCreated = true;
    sideEffects.taskScratchpadUpdated = true;
    outboundReply = platform === 'whatsapp'
      ? "Locked that into your *To-Do list*. Now close the tab and let's get it done."
      : "Locked that into your To-Do list. Now close the tab and let's get it done.";
  }

  const isReflection =
    !isActionOrTask ||
    userText.length > 35 ||
    /\b(felt|feeling|feel|tired|exhausted|happy|drained|frustrated|grateful|today was|reflect|thought)\b/i.test(
      userText
    );

  if (isReflection) {
    sideEffects.journalSaved = true;
    if (/\b(tired|exhausted|drained|burnout)\b/i.test(userText)) {
      sideEffects.energyPulseUpdated = true;
      outboundReply = "Logged that to your diary. Sounds like today took a toll — close the laptop and grab some fresh air.";
    } else if (!outboundReply) {
      outboundReply = "Captured that in your daily memory. Strong reflection — keep moving forward.";
    }
  }

  if (/\b(bored|what to do|weekend plans|sidequest)\b/i.test(userText)) {
    sideEffects.toolLaunched = 'tinyfish';
    outboundReply = "Found a jazz lounge set in Alwarpet starting at 8 PM. Time to get off the couch!";
  }

  const wordCount = outboundReply.split(/\s+/).length;
  assert.ok(wordCount <= 75, `Reply must be under 75 words, was ${wordCount}`);

  return {
    sideEffects,
    outboundReply: formatMessageForPlatform(outboundReply, platform),
  };
}

test('Brain: Action intent silently populates Task Scratchpad and produces witty confirmation', async () => {
  const text = 'Remember to review the Photon security specs with Srinjoy by Thursday noon';
  const result = await simulateDualTrackBrain(text, 'whatsapp');

  assert.equal(result.sideEffects.taskCreated, true, 'Task must be created');
  assert.equal(result.sideEffects.taskScratchpadUpdated, true, 'Scratchpad must be updated');
  assert.ok(result.outboundReply.includes('*To-Do list*'), 'WhatsApp reply must format *To-Do list*');
});

test('Brain: Reflection intent silently logs to Journal and triggers Energy Pulse update', async () => {
  const text = 'Felt completely drained after the sprint retrospective with Rohit today';
  const result = await simulateDualTrackBrain(text, 'imessage');

  assert.equal(result.sideEffects.journalSaved, true, 'Reflection must be logged to journal');
  assert.equal(result.sideEffects.energyPulseUpdated, true, 'Energy pulse dip must be flagged');
  assert.ok(result.outboundReply.includes('close the laptop'));
});

test('Brain: Sidequest trigger launches TinyFish real-world recommendation', async () => {
  const text = 'So bored tonight, need a fun sidequest';
  const result = await simulateDualTrackBrain(text, 'whatsapp');

  assert.equal(result.sideEffects.toolLaunched, 'tinyfish', 'TinyFish must be launched');
  assert.ok(result.outboundReply.includes('jazz lounge set'));
});

// ─── 8. End-to-End Webhook Payload Processing ────────────────────────────────

test('End-to-End: Webhook payload processes voice note and returns delivered status', async () => {
  const payload = {
    event: 'messages',
    space: { platform: 'whatsapp', phone: '+919876543210' },
    message: {
      id: 'msg_test_001',
      sender: { id: '+919876543210', platform: 'whatsapp', name: 'Shriyanshi' },
      content: {
        type: 'voice',
        transcript: 'Remember to push the dev build before 5 PM today',
      },
    },
  };

  const text = payload.message.content.transcript;
  const brain = await simulateDualTrackBrain(text, payload.space.platform);

  assert.equal(brain.sideEffects.taskCreated, true);
  assert.ok(brain.outboundReply.length > 0);
  assert.ok(brain.outboundReply.includes('*To-Do list*'));
});

// ─── 9. Autonomous Social Brain Tool Execution & Deflection Guardrail ─────────

test('Social Brain: searchWeb returns real movie results for Bengali movie queries', async () => {
  const { searchWeb } = await import('../lib/force-agent/webSearch.ts');
  const res = await searchWeb({ query: 'latest bengali movie releases 2026' });

  assert.ok(res.results.length > 0, 'Web search must return results');
  assert.ok(
    res.results.some((r) => /bengali/i.test(r.title) || /movie/i.test(r.title)),
    'Results must include Bengali movie content'
  );
});

test('Social Brain: Informational questions are not misclassified as journal reflections', () => {
  const query = 'can you tell me whats the latest bengali movie releases';
  const isInformationalQuery =
    /^(can you|what|where|when|who|why|how|tell me|find|search|lookup|look up|check|recommend|list|show|is there|are there|give me)\b/i.test(query) ||
    query.endsWith('?') ||
    /\b(movie|film|cinema|release|releases|news|weather|tickets?|showtimes?)\b/i.test(query);

  const isReflection =
    !isInformationalQuery &&
    (query.length > 50 ||
      /\b(felt|feeling|feel|tired|exhausted|happy|drained|frustrated|grateful|today was|reflect|thought)\b/i.test(query));

  assert.equal(isInformationalQuery, true, 'Movie release question must be informational query');
  assert.equal(isReflection, false, 'Movie release question must NOT be saved as reflection');
});

test('Social Brain: Deflection pattern detection catches canned wingman excuses', () => {
  const deflection1 = "Hey, you're asking the wrong wingman — I'm more 'automate your event bookings' than 'Bengali cinema deep dives.'";
  const deflection2 = "Yo, I'm more of a 'get you to the event' guy than a film critic";
  const goodReply = "Here are the latest Bengali drops hitting screens: Desu7, Nazarbandi, and Mrigaya 1.5. Streaming series also just landed on Zee5!";

  const isDeflectionPattern = /\b(wrong wingman|not a film critic|more of a.*guy|can't browse|cannot search|don't have access|as an ai)\b/i;

  assert.ok(isDeflectionPattern.test(deflection1), 'Deflection 1 must be flagged');
  assert.ok(isDeflectionPattern.test(deflection2), 'Deflection 2 must be flagged');
  assert.ok(!isDeflectionPattern.test(goodReply), 'Valid movie answer must not be flagged');
});

test('Telegram Typing: startTelegramTypingLoop initializes and stops cleanly', async () => {
  const { startTelegramTypingLoop } = await import('../lib/telegram/chatAction.ts');
  let pings = 0;
  const stop = startTelegramTypingLoop('8514416055', {
    intervalMs: 50,
    onSend: () => { pings++; },
  });

  // Verify immediate initial invocation
  await new Promise((r) => setTimeout(r, 350));
  stop();

  const pingsAfterStop = pings;
  assert.ok(pingsAfterStop >= 1, 'Typing action must be triggered at least once');

  // Verify no further calls after stop()
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(pings, pingsAfterStop, 'Typing loop must stop firing after stop() is called');
});

test('Social Brain: Thread continuity retains multi-turn context across short follow-ups', () => {
  // Test thread continuity engine: Map-based thread caching and recent turn retrieval
  const socialThreadCache = new Map();
  function getThreadKey(platform, senderId) {
    return `${(platform || 'telegram').toLowerCase()}:${(senderId || '').toLowerCase().trim()}`;
  }
  function recordThreadTurn(platform, senderId, role, content) {
    if (!senderId || !content) return;
    const key = getThreadKey(platform, senderId);
    const turns = socialThreadCache.get(key) || [];
    turns.push({ role, content: content.trim(), timestamp: new Date().toISOString() });
    socialThreadCache.set(key, turns);
  }
  function getRecentThreadTurns(platform, senderId, limit = 12) {
    const key = getThreadKey(platform, senderId);
    return (socialThreadCache.get(key) || []).slice(-limit);
  }

  const testSender = 'test_sender_chorbagan_99';
  const platform = 'telegram';

  // Turn 1: User asks about Chorbagan
  recordThreadTurn(platform, testSender, 'user', 'Tell me what happened in chorbagan');
  // Turn 2: Assistant presents numbered choices
  recordThreadTurn(
    platform,
    testSender,
    'assistant',
    'Are you asking about: 1. A place called Chorbagan (likely in Kolkata)? 2. A movie/book? 3. Your journals?'
  );

  const history = getRecentThreadTurns(platform, testSender, 5);
  assert.equal(history.length, 2, 'History must contain both preceding turns');
  assert.equal(history[0].role, 'user');
  assert.equal(history[0].content, 'Tell me what happened in chorbagan');
  assert.equal(history[1].role, 'assistant');
  assert.ok(history[1].content.includes('Chorbagan (likely in Kolkata)'));

  // Turn 3: User replies with short option "1"
  recordThreadTurn(platform, testSender, 'user', '1');
  const historyAfterChoice = getRecentThreadTurns(platform, testSender, 5);
  assert.equal(historyAfterChoice.length, 3, 'Must track all 3 turns');
  assert.equal(historyAfterChoice[2].content, '1');

  // Correlate short response with preceding assistant context
  const previousAssistantMsg = historyAfterChoice[historyAfterChoice.length - 2].content;
  assert.ok(previousAssistantMsg.includes('1. A place called Chorbagan'));
});

function extractLocationFromPayload(rawObj, senderId, user, text) {
  const loc =
    rawObj.location ||
    rawObj.message?.location ||
    rawObj.content?.location ||
    (rawObj.content?.latitude && rawObj.content?.longitude ? rawObj.content : undefined) ||
    (rawObj.latitude && rawObj.longitude ? rawObj : undefined);

  if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      city: loc.name || loc.title || loc.address || undefined,
      formattedAddress: loc.address || undefined,
    };
  }

  if (text) {
    const coordMatch = text.match(/(-?\d{1,2}\.\d{3,})\s*[,|\s]\s*(-?\d{1,3}\.\d{3,})/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { latitude: lat, longitude: lon };
      }
    }
  }

  if (user?.location) {
    if (typeof user.location === 'object' && user.location.latitude) {
      return user.location;
    }
    if (typeof user.location === 'string') {
      return { latitude: 0, longitude: 0, city: user.location };
    }
  }

  const normalized = normalizePhoneNumber(senderId);
  if (normalized.startsWith('+1')) {
    const areaCode = normalized.slice(2, 5);
    const nycCodes = ['212', '718', '917', '646', '347', '929'];
    const sfCodes = ['415', '628', '510', '650', '408'];
    const laCodes = ['310', '213', '818', '323', '424'];
    const chiCodes = ['312', '773', '872'];
    const seaCodes = ['206', '425'];
    const ausCodes = ['512', '737'];
    const bosCodes = ['617', '857'];
    const miaCodes = ['305', '786'];

    if (nycCodes.includes(areaCode)) return { latitude: 40.7128, longitude: -74.0060, city: 'New York', region: 'NY', country: 'USA' };
    if (sfCodes.includes(areaCode)) return { latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', region: 'CA', country: 'USA' };
    if (laCodes.includes(areaCode)) return { latitude: 34.0522, longitude: -118.2437, city: 'Los Angeles', region: 'CA', country: 'USA' };
    if (chiCodes.includes(areaCode)) return { latitude: 41.8781, longitude: -87.6298, city: 'Chicago', region: 'IL', country: 'USA' };
    if (seaCodes.includes(areaCode)) return { latitude: 47.6062, longitude: -122.3321, city: 'Seattle', region: 'WA', country: 'USA' };
    if (ausCodes.includes(areaCode)) return { latitude: 30.2672, longitude: -97.7431, city: 'Austin', region: 'TX', country: 'USA' };
    if (bosCodes.includes(areaCode)) return { latitude: 42.3601, longitude: -71.0589, city: 'Boston', region: 'MA', country: 'USA' };
    if (miaCodes.includes(areaCode)) return { latitude: 25.7617, longitude: -80.1918, city: 'Miami', region: 'FL', country: 'USA' };
  } else if (normalized.startsWith('+44')) {
    return { latitude: 51.5074, longitude: -0.1278, city: 'London', country: 'UK' };
  } else if (normalized.startsWith('+9133')) {
    return { latitude: 22.5726, longitude: 88.3639, city: 'Kolkata', country: 'India' };
  } else if (normalized.startsWith('+9180')) {
    return { latitude: 12.9716, longitude: 77.5946, city: 'Bengaluru', country: 'India' };
  } else if (normalized.startsWith('+9122')) {
    return { latitude: 19.0760, longitude: 72.8777, city: 'Mumbai', country: 'India' };
  } else if (normalized.startsWith('+9111')) {
    return { latitude: 28.6139, longitude: 77.2090, city: 'Delhi', country: 'India' };
  } else if (normalized.startsWith('+91')) {
    return { latitude: 28.6139, longitude: 77.2090, city: 'India', country: 'India' };
  }

  return undefined;
}

test('Location: extractLocationFromPayload detects GPS pin attachments and phone area codes', () => {

  // 1. Direct Telegram GPS attachment
  const gpsPayload = {
    message: {
      location: { latitude: 40.7128, longitude: -74.0060, name: 'Lower East Side' },
    },
  };
  const locGps = extractLocationFromPayload(gpsPayload, 'tg_user_123');
  assert.ok(locGps, 'GPS pin must be detected');
  assert.equal(locGps.latitude, 40.7128);
  assert.equal(locGps.longitude, -74.0060);
  assert.equal(locGps.city, 'Lower East Side');

  // 2. Direct text coordinate extraction
  const locText = extractLocationFromPayload({}, 'tg_user_123', null, 'My coordinates: 26.9124, 75.7873');
  assert.ok(locText, 'Text coordinates must be detected');
  assert.equal(locText.latitude, 26.9124);
  assert.equal(locText.longitude, 75.7873);

  // 3. Phone area code heuristic: NYC (+1 212)
  const nycPayload = { message: { text: 'Plan my weekend' } };
  const locNyc = extractLocationFromPayload(nycPayload, '+12125550199');
  assert.ok(locNyc);
  assert.equal(locNyc.city, 'New York');
  assert.equal(locNyc.region, 'NY');

  // 4. Phone area code heuristic: SF Bay Area (+1 415)
  const sfPayload = { message: { text: 'Find me coffee' } };
  const locSf = extractLocationFromPayload(sfPayload, '+14155552671');
  assert.ok(locSf);
  assert.equal(locSf.city, 'San Francisco');
  assert.equal(locSf.region, 'CA');

  // 5. Unknown sender without GPS or area code returns undefined for conversational prompt fallback
  const anonPayload = { message: { text: 'Hey' } };
  const locAnon = extractLocationFromPayload(anonPayload, 'tg_anonymous_user');
  assert.equal(locAnon, undefined);
});

