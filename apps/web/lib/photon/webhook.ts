/**
 * Photon Webhook Processor & Cognitive Gateway
 * Authenticates incoming webhooks from Spectrum / Photon, resolves user identities,
 * executes multimodal transcription (audio/photos), routes through the Force Agent Brain,
 * and dispatches outbound conversational replies to WhatsApp & iMessage.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { resolvePhotonUser, normalizePhoneNumber } from './userResolver';
import { processIncomingVoiceNote, processIncomingImage } from './mediaConnector';
import { sendPhotonMessage } from './outboundClient';
import type { UserLocation } from '@/lib/force-agent/types';

export interface PhotonPayload {
  event?: string;
  id?: string;
  webhook_id?: string;
  space?: {
    id?: string;
    platform?: string;
    type?: string;
    phone?: string;
  };
  message?: {
    id?: string;
    timestamp?: string;
    sender?: {
      id?: string;
      platform?: string;
      name?: string;
    };
    content?: {
      type?: string;
      text?: string;
      url?: string;
      mime_type?: string;
      caption?: string;
      items?: Array<Record<string, unknown>>;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface PhotonProcessResult {
  ok: boolean;
  handled: boolean;
  userId?: string | null;
  platform?: string;
  senderId?: string;
  messageId?: string;
  replySent?: boolean;
  replyText?: string;
  sideEffects?: Record<string, unknown>;
  status?: string;
  reason?: string;
  error?: string;
}

// In-memory idempotency cache (keyed by messageId) to prevent replay/duplicate processing
const processedMessageIds = new Map<string, number>();
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export interface SocialThreadTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// In-memory conversation thread cache (keyed by platform:senderId)
const socialThreadCache = new Map<string, SocialThreadTurn[]>();

function getThreadKey(platform: string, senderId: string): string {
  return `${(platform || 'telegram').toLowerCase()}:${(senderId || '').toLowerCase().trim()}`;
}

export function getRecentThreadTurns(platform: string, senderId: string, limit = 12): SocialThreadTurn[] {
  const key = getThreadKey(platform, senderId);
  const turns = socialThreadCache.get(key) || [];
  return turns.slice(-limit);
}

export function recordThreadTurn(
  platform: string,
  senderId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  if (!senderId || !content) return;
  const key = getThreadKey(platform, senderId);
  const turns = socialThreadCache.get(key) || [];
  turns.push({
    role,
    content: content.trim(),
    timestamp: new Date().toISOString(),
  });
  if (turns.length > 40) {
    turns.splice(0, turns.length - 40);
  }
  socialThreadCache.set(key, turns);
}

export async function getRecentThreadTurnsWithDb(
  adminClient: any,
  platform: string,
  senderId: string,
  userId?: string | null,
  limit = 12
): Promise<SocialThreadTurn[]> {
  const inMemory = getRecentThreadTurns(platform, senderId, limit);
  if (inMemory.length > 0) {
    return inMemory;
  }

  if (!adminClient) return [];

  try {
    let query = adminClient
      .from('photon_messages')
      .select('content_text, raw_payload, created_at')
      .eq('platform', platform)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (senderId) {
      query = query.eq('platform_id', senderId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return [];

    const turns: SocialThreadTurn[] = [];
    for (const row of [...data].reverse()) {
      if (!row.content_text) continue;
      const role =
        row.raw_payload?.role ||
        (row.raw_payload?.direction === 'outbound' ? 'assistant' : 'user');
      const turn: SocialThreadTurn = {
        role: role === 'assistant' ? 'assistant' : 'user',
        content: row.content_text,
        timestamp: row.created_at,
      };
      turns.push(turn);
      recordThreadTurn(platform, senderId, turn.role, turn.content);
    }
    return turns;
  } catch {
    return [];
  }
}

// In-memory fallback ledger for dev/testing when tables don't exist
const inMemoryPhotonMessages: Array<{ payload: PhotonPayload; userId: string | null; receivedAt: string }> = [];

function getSecret(): string {
  let secret = process.env.WEBHOOK_SECRET || process.env.PHOTON_WEBHOOK_SECRET || '';
  if (!secret) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('PHOTON_WEBHOOK_SECRET=')) {
            secret = trimmed.replace('PHOTON_WEBHOOK_SECRET=', '').trim();
            break;
          }
        }
      }
    } catch (_) {}
  }
  return secret;
}

/**
 * Verify HMAC SHA-256 signature and replay drift guard (±300 seconds)
 */
export function verifySignature(
  rawBody: Buffer,
  timestamp: string,
  signature: string,
  secret = getSecret(),
  msgId?: string
): boolean {
  if (!secret || !timestamp || !signature) {
    return false;
  }

  // Check timestamp drift to prevent replay attacks (±300 seconds)
  const parsedTimestamp = parseInt(timestamp, 10);
  if (!isNaN(parsedTimestamp)) {
    const nowSec = Math.floor(Date.now() / 1000);
    // Support both second and millisecond timestamps
    const normalizedTsSec = parsedTimestamp > 1e11 ? Math.floor(parsedTimestamp / 1000) : parsedTimestamp;
    if (Math.abs(nowSec - normalizedTsSec) > 300) {
      console.warn(`[Photon Webhook] Timestamp drift too large (${Math.abs(nowSec - normalizedTsSec)}s > 300s)`);
      return false;
    }
  }

  // Standard Photon / Svix Webhook signature (whsec_... and v1,...)
  if (secret.startsWith('whsec_') || signature.startsWith('v1,')) {
    try {
      const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
      const toSign = (msgId ? `${msgId}.${timestamp}.` : '') + rawBody.toString('utf8');
      const expected = `v1,${createHmac('sha256', key).update(toSign).digest('base64')}`;

      // Check all signatures in header (space-delimited)
      const sigs = signature.split(' ');
      return sigs.some((sig) => {
        try {
          return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
        } catch {
          return false;
        }
      });
    } catch (err) {
      console.warn('[Photon Webhook] Svix signature verification error:', err);
      return false;
    }
  }

  // Legacy Slack/Spectrum format (v0=...)
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

/**
 * Check and record message idempotency
 */
function isDuplicateMessage(messageId?: string): boolean {
  if (!messageId) return false;
  const now = Date.now();

  // Prune expired entries
  for (const [id, time] of processedMessageIds.entries()) {
    if (now - time > IDEMPOTENCY_WINDOW_MS) {
      processedMessageIds.delete(id);
    }
  }

  if (processedMessageIds.has(messageId)) {
    return true;
  }

  processedMessageIds.set(messageId, now);
  return false;
}

/**
 * Audit log helper
 */
async function recordAuditLog(
  adminClient: any,
  row: {
    user_id: string | null;
    platform: string;
    sender_id: string;
    message_id?: string | null;
    webhook_id?: string | null;
    event_type: string;
    status: string;
    error_message?: string;
  }
) {
  if (!adminClient) return;
  try {
    await adminClient.from('photon_webhook_logs').insert(row);
  } catch (err: any) {
    // Graceful skip if table not created
  }
}

/**
 * Storing message record in photon_messages
 */
async function recordPhotonMessage(
  adminClient: any,
  data: {
    user_id: string | null;
    platform: string;
    platform_id?: string | null;
    message_id?: string | null;
    direction: 'inbound' | 'outbound';
    content_type: string;
    content_text?: string | null;
    media_url?: string | null;
    raw_payload?: any;
  }
) {
  if (!adminClient) return;
  try {
    await adminClient.from('photon_messages').insert({
      user_id: data.user_id,
      platform: data.platform,
      platform_id: data.platform_id,
      message_id: data.message_id,
      event_type: 'messages',
      content_type: data.content_type || 'text',
      content_text: data.content_text,
      raw_payload: {
        direction: data.direction,
        role: data.direction === 'inbound' ? 'user' : 'assistant',
        media_url: data.media_url,
        ...(data.raw_payload || {}),
      },
    });
  } catch (err: any) {
    console.warn('[Photon Webhook] recordPhotonMessage error:', err?.message || err);
  }
}

/**
 * Fast server-side reverse geocoding to resolve coordinates into human-readable city and region
 */
export async function reverseGeocodeServer(
  lat: number,
  lon: number
): Promise<{ city?: string; region?: string; country?: string; formattedAddress?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const bdc = await res.json();
      const city = bdc.city || bdc.locality || '';
      const region = bdc.principalSubdivision || '';
      const country = bdc.countryName || '';
      return {
        city: city || undefined,
        region: region || undefined,
        country: country || undefined,
        formattedAddress: [city, region, country].filter(Boolean).join(', '),
      };
    }
  } catch (_) {}

  return {};
}

/**
 * Detects user location from incoming GPS pins, text coordinates, user profile, or phone number area codes
 */
export function extractLocationFromPayload(
  rawObj: any,
  senderId: string,
  user?: any,
  text?: string
): UserLocation | undefined {
  // 1. Direct location attachment (Telegram / WhatsApp location pin)
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

  // 2. Text-based coordinate regex (e.g. "22.5726, 88.3639")
  if (text) {
    const coordMatch = text.match(/(-?\d{1,2}\.\d{3,})\s*[,|\s]\s*(-?\d{1,3}\.\d{3,})/);
    if (coordMatch && coordMatch[1] && coordMatch[2]) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { latitude: lat, longitude: lon };
      }
    }
  }

  // 3. User profile location if linked
  if (user?.location) {
    if (typeof user.location === 'object' && user.location.latitude) {
      return user.location;
    }
    if (typeof user.location === 'string') {
      return { latitude: 0, longitude: 0, city: user.location };
    }
  }

  // 4. Phone number area code heuristics (WhatsApp / iMessage)
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

/**
 * Core processing pipeline: Payload -> User -> Media -> Brain -> Outbound
 */
export async function processPhotonPayload(
  payload: PhotonPayload,
  adminClient?: any,
  baseUrl?: string
): Promise<PhotonProcessResult> {
  let client = adminClient ?? null;

  if (!client) {
    try {
      client = createAdminClient();
    } catch {
      // Supabase admin client not available, run in decoupled mode
    }
  }

  const rawObj = (payload.data?.object as any) || payload.message || payload;
  const rawContent = rawObj.content || {};
  const sender = rawObj.sentBy || rawObj.sender;
  const platform = (rawObj.platform || payload.space?.platform || rawObj.space?.platform || sender?.platform || 'telegram').toLowerCase();
  const senderId = (sender?.handle as string) || (sender?.id as string) || (rawObj.space?.id as string) || (payload.space?.id as string) || '';
  const messageId = (rawObj.id as string) || (payload.id as string) || `msg_${Date.now()}`;
  const contentType = (rawContent.type as string) || 'text';
  let contentText = rawContent.text || (typeof rawContent === 'string' ? rawContent : '');
  const mediaUrl = rawContent.url || rawContent.media_url;
  const spaceId = rawObj.space?.id || payload.space?.id || '';
  const senderName = sender?.metadata?.displayName || sender?.name || '';

  if (sender?.kind === 'agent' || rawObj.sentBy?.kind === 'agent' || rawObj.status === 'delivered' || rawObj.status === 'dispatched') {
    return {
      ok: true,
      handled: true,
      status: 'ignored_agent_message',
      messageId,
      platform,
      senderId,
    };
  }

  // 1. Idempotency Check
  if (isDuplicateMessage(messageId)) {
    console.info(`[Photon Webhook] Duplicate message skipped: ${messageId}`);
    return {
      ok: true,
      handled: true,
      status: 'duplicate_skipped',
      messageId,
      platform,
      senderId,
    };
  }

  // 2. User Identity Resolution
  const userResolution = await resolvePhotonUser(client, platform, senderId, baseUrl);
  const user = userResolution.user;

  // Audit initial receipt
  void recordAuditLog(client, {
    user_id: user?.id ?? null,
    platform,
    sender_id: senderId,
    message_id: messageId,
    webhook_id: payload.id || payload.webhook_id,
    event_type: payload.event || 'messages',
    status: user ? 'received' : 'unlinked_user',
  });

  // If user is unlinked: dispatch 1-click connect invitation back to WhatsApp/iMessage
  if (!user?.id) {
    console.info(`[Photon Webhook] Unlinked sender ${senderId} on ${platform}. Sending connection invite.`);
    const inviteText =
      userResolution.invitationText ||
      `Hey! I'm Force. 👋 Connect your account here to get started: ${userResolution.connectUrl || 'https://force.app'}`;

    const outboundResult = await sendPhotonMessage({
      platform: platform as any,
      recipientId: senderId,
      spaceId: spaceId,
      senderId: (rawObj.receivedBy?.id as string) || 'pho_usr_48xqgpwv4bg6ksfbz7z4b734xe',
      text: inviteText,
      replyToMessageId: messageId,
    });

    return {
      ok: true,
      handled: true,
      status: 'unlinked_invitation_sent',
      platform,
      senderId,
      messageId,
      replySent: outboundResult.ok,
      replyText: inviteText,
    };
  }

  // Record inbound message
  void recordPhotonMessage(client, {
    user_id: user.id,
    platform,
    platform_id: senderId,
    message_id: messageId,
    direction: 'inbound',
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    raw_payload: payload,
  });

  // 3. Multimodal Processing
  let audioTranscript: string | undefined;
  if (contentType === 'voice' || contentType === 'audio' || (mediaUrl && /\.(ogg|m4a|mp3|wav)$/i.test(mediaUrl))) {
    try {
      const audioResult = await processIncomingVoiceNote({
        mediaUrl,
        mockTranscript: rawContent?.transcript as string | undefined,
      });
      audioTranscript = audioResult.transcript;
      contentText = audioTranscript || contentText;
    } catch (err: any) {
      console.warn('[Photon Webhook] Voice transcription warning:', err.message);
    }
  } else if (contentType === 'image' && mediaUrl) {
    try {
      const imgResult = await processIncomingImage({
        mediaUrl,
        caption: rawContent?.caption || rawContent?.text,
      });
      contentText = imgResult.visualDescription || contentText;
    } catch (err: any) {
      console.warn('[Photon Webhook] Image processing warning:', err.message);
    }
  }

  // 4. THE FORCE AGENT BRAIN (With Telegram Typing Indicator)
  let stopTyping: (() => void) | undefined;
  if (platform === 'telegram' && senderId) {
    try {
      const { startTelegramTypingLoop } = await import('@/lib/telegram/chatAction');
      stopTyping = startTelegramTypingLoop(senderId);
    } catch (err: any) {
      console.warn('[Photon Webhook] Could not start typing indicator:', err?.message || err);
    }
  }

  // Detect user location from incoming GPS pin, text coordinates, user profile, or phone number area code
  let resolvedLocation = extractLocationFromPayload(rawObj, senderId, user, contentText);

  const hasDirectLocation =
    Boolean(rawObj.location) ||
    Boolean(rawObj.message?.location) ||
    Boolean(rawContent.location) ||
    contentType === 'location' ||
    (typeof rawContent.latitude === 'number' && typeof rawContent.longitude === 'number');

  if (hasDirectLocation && resolvedLocation) {
    if (!resolvedLocation.city) {
      const geo = await reverseGeocodeServer(resolvedLocation.latitude, resolvedLocation.longitude);
      if (geo.city) resolvedLocation.city = geo.city;
      if (geo.region) resolvedLocation.region = geo.region;
      if (geo.country) resolvedLocation.country = geo.country;
      if (geo.formattedAddress) resolvedLocation.formattedAddress = geo.formattedAddress;
    }

    if (!contentText || contentText.trim() === '') {
      const locLabel =
        resolvedLocation.city ||
        resolvedLocation.formattedAddress ||
        `${resolvedLocation.latitude.toFixed(4)}, ${resolvedLocation.longitude.toFixed(4)}`;
      contentText = `I am sharing my live location coordinates: ${resolvedLocation.latitude.toFixed(6)}, ${resolvedLocation.longitude.toFixed(6)} (${locLabel}). Where am I right now, and what are the best local spots or activities around here?`;
    }

    // Persist to user record if client is available
    if (client && user?.id) {
      void client
        .from('users')
        .update({
          location:
            resolvedLocation.city ||
            resolvedLocation.formattedAddress ||
            `${resolvedLocation.latitude},${resolvedLocation.longitude}`,
        })
        .eq('id', user.id);
    }
  }

  // Load complete conversation thread history (in-memory + database)
  const recentThreadTurns = await getRecentThreadTurnsWithDb(client, platform, senderId, user?.id, 14);

  // Record this inbound user turn into memory cache
  recordThreadTurn(platform, senderId, 'user', contentText);

  let brainResult: any;
  try {
    const { forceAgentOrchestrator } = await import('@/lib/force-agent/orchestrator');
    brainResult = await forceAgentOrchestrator.handle({
      userId: user.id,
      type: 'social_interaction',
      tool: 'photon',
      query: contentText,
      location: resolvedLocation,
      socialContext: {
        platform: platform as any,
        senderId,
        senderName: senderName || user.fullName || undefined,
        messageId,
        mediaType: contentType as any,
        mediaUrl,
        audioTranscript,
        recentThreadTurns,
      },
    });
  } finally {
    if (stopTyping) {
      stopTyping();
    }
  }

  const replyText = brainResult.outboundSocialReply?.text || brainResult.message || "Got it, saved to your memory!";

  // Record outbound assistant turn into conversation cache
  recordThreadTurn(platform, senderId, 'assistant', replyText);

  // 5. Outbound Real-Time Reply Dispatch
  const outboundResult = await sendPhotonMessage({
    platform: platform as any,
    recipientId: senderId,
    spaceId: spaceId,
    senderId: (rawObj.receivedBy?.id as string) || 'pho_usr_48xqgpwv4bg6ksfbz7z4b734xe',
    text: replyText,
    mediaUrl: brainResult.outboundSocialReply?.mediaUrl,
    replyToMessageId: messageId,
  });

  // Record outbound message
  void recordPhotonMessage(client, {
    user_id: user.id,
    platform,
    platform_id: senderId,
    message_id: outboundResult.messageId,
    direction: 'outbound',
    content_type: 'text',
    content_text: replyText,
  });

  return {
    ok: true,
    handled: true,
    userId: user.id,
    platform,
    senderId,
    messageId,
    replySent: outboundResult.ok,
    replyText,
    sideEffects: brainResult.sideEffects,
    status: 'completed',
  };
}

/**
 * Handle incoming event routing
 */
export async function handlePhotonMessage(
  payload: PhotonPayload,
  adminClient?: any,
  baseUrl?: string
): Promise<PhotonProcessResult> {
  const rawObj = (payload.data?.object as any) || payload.message || payload;
  const message = payload.message || (payload.data?.object as any);
  const content = message?.content;
  const eventType = (payload.event || payload.type || '').toLowerCase();

  // Prevent echo loops: ignore delivery/dispatch acknowledgements and messages from the bot itself
  if (
    eventType.includes('delivered') ||
    eventType.includes('dispatched') ||
    eventType.includes('read') ||
    eventType.includes('sent') ||
    rawObj.sentBy?.kind === 'agent' ||
    rawObj.status === 'delivered' ||
    rawObj.status === 'dispatched'
  ) {
    return { ok: true, handled: true, status: 'ignored_outbound_acknowledgement' };
  }

  if (
    eventType === 'message.received' ||
    eventType === 'messages' ||
    eventType === 'message' ||
    rawObj.sentBy?.kind === 'human' ||
    rawObj.status === 'received'
  ) {
    if (content?.type === 'group' && Array.isArray(content?.items)) {
      for (const item of content.items) {
        await handlePhotonMessage(
          { ...payload, message: { ...message, content: item as any } },
          adminClient,
          baseUrl
        );
      }
      return { ok: true, handled: true, status: 'group_processed' };
    }

    return processPhotonPayload(payload, adminClient, baseUrl);
  }

  return { ok: true, handled: false, reason: 'unsupported_event' };
}
