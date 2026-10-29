/**
 * Photon Outbound Messaging Engine
 * Handles bidirectional dispatch to WhatsApp, iMessage, Telegram, and SMS.
 * Enforces platform-native typography, rate-limiting, retries, and local mock fallback.
 */

import { randomUUID } from 'crypto';

export interface SendPhotonMessageOptions {
  platform: 'whatsapp' | 'imessage' | 'telegram' | 'sms';
  recipientId: string; // E.164 phone or platform handle
  text: string;
  spaceId?: string;
  senderId?: string;
  projectId?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'document';
  replyToMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendPhotonMessageResult {
  ok: boolean;
  messageId: string;
  platform: string;
  recipientId: string;
  formattedText: string;
  timestamp: string;
  mocked?: boolean;
  error?: string;
}

export interface OutboundLogEntry {
  id: string;
  options: SendPhotonMessageOptions;
  formattedText: string;
  timestamp: string;
  status: 'sent' | 'mocked' | 'failed';
  error?: string;
}

// In-memory ledger for tests, simulation, and local development
const inMemoryOutboundLog: OutboundLogEntry[] = [];

// Sliding window rate limiter state: recipientId -> timestamps[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 20;

/**
 * Extracts embedded image markdown or direct image URLs from a message
 */
export function extractMediaFromText(text: string): { cleanedText: string; mediaUrl?: string } {
  if (!text) return { cleanedText: '' };

  let mediaUrl: string | undefined;

  // 1. Check for markdown image: ![Caption](https://...)
  const mdImgMatch = text.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
  if (mdImgMatch) {
    mediaUrl = mdImgMatch[1];
  } else {
    // 2. Check for direct image URL in text
    const directImgMatch = text.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif|svg)(?:\?[^\s)]*)?)/i);
    if (directImgMatch) {
      mediaUrl = directImgMatch[1];
    }
  }

  // Remove raw markdown image syntax ![alt](url) from text body so chat bubbles stay clean
  const cleanedText = text.replace(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g, '').trim();

  return { cleanedText, mediaUrl };
}

/**
 * Format markdown for platform-specific chat bubbles
 */
export function formatMessageForPlatform(text: string, platform: string): string {
  if (!text) return '';

  let cleaned = text.trim();

  // Strip standalone markdown image syntax if still present
  cleaned = cleaned.replace(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g, '').trim();

  // Normalize bullet markers so asterisks as list bullets don't corrupt bold markdown parsing
  cleaned = cleaned.replace(/^[\t ]*[-*][\t ]+/gm, '• ');

  switch (platform.toLowerCase()) {
    case 'whatsapp':
      // Convert standard markdown bold **bold** to WhatsApp *bold*
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '*$1*');
      // Convert standard markdown headers ### Header to *Header*
      cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, '*$1*');
      // Convert markdown links [Label](url) to *Label*: url so WhatsApp autolinks it cleanly
      cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '*$1*: $2');
      return cleaned;

    case 'imessage':
    case 'sms':
      // iMessage & SMS do not natively support markdown asterisks; strip them for clean bubble typography
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
      cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
      cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, '$1');
      // Convert markdown links [Label](url) to Label: url for native iOS link previews
      cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2');
      return cleaned;

    case 'telegram':
      // Convert standard markdown bold **bold** to Telegram *bold*
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '*$1*');
      // Convert standard markdown headers ### Header to *Header*
      cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, '*$1*');
      // Convert markdown links [Label](url) to Label: url so Telegram autolinks it without MarkdownV2 escape errors
      cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2');
      return cleaned;

    default:
      return cleaned;
  }
}

/**
 * Check if recipient is within rate limits
 */
function checkRateLimit(recipientId: string): boolean {
  const now = Date.now();
  const history = rateLimitMap.get(recipientId) || [];
  const validHistory = history.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (validHistory.length >= MAX_MESSAGES_PER_WINDOW) {
    return false;
  }

  validHistory.push(now);
  rateLimitMap.set(recipientId, validHistory);
  return true;
}

/**
 * Dispatches an outbound message to a user's phone or social platform.
 */
export async function sendPhotonMessage(
  options: SendPhotonMessageOptions
): Promise<SendPhotonMessageResult> {
  const { platform, recipientId, text, mediaUrl, mediaType, replyToMessageId } = options;
  const timestamp = new Date().toISOString();
  const messageId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Automatically extract image URLs from markdown if not explicitly provided
  const extracted = extractMediaFromText(text);
  const resolvedMediaUrl = mediaUrl || extracted.mediaUrl;
  const formattedText = formatMessageForPlatform(extracted.cleanedText, platform);

  // Rate limit check
  if (!checkRateLimit(recipientId)) {
    const errorMsg = `Rate limit exceeded for recipient ${recipientId} (max ${MAX_MESSAGES_PER_WINDOW}/min)`;
    console.warn(`[Photon Outbound] ${errorMsg}`);
    return {
      ok: false,
      messageId,
      platform,
      recipientId,
      formattedText,
      timestamp,
      error: errorMsg,
    };
  }

  let photonApiUrl = process.env.PHOTON_API_URL || process.env.SPECTRUM_API_URL;
  let photonApiKey = process.env.PHOTON_API_KEY || process.env.SPECTRUM_API_KEY;

  if (!photonApiUrl || !photonApiKey) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!photonApiKey && trimmed.startsWith('PHOTON_API_KEY=')) {
            photonApiKey = trimmed.replace('PHOTON_API_KEY=', '').trim();
          }
          if (!photonApiUrl && trimmed.startsWith('PHOTON_API_URL=')) {
            photonApiUrl = trimmed.replace('PHOTON_API_URL=', '').trim();
          }
        }
      }
    } catch (_) {}
  }

  // If live credentials are not present or running in test/dev mode, use local ledger
  if (!photonApiUrl || !photonApiKey) {
    const entry: OutboundLogEntry = {
      id: messageId,
      options,
      formattedText,
      timestamp,
      status: 'mocked',
    };
    inMemoryOutboundLog.push(entry);

    console.info(`[Photon Outbound Mock] Dispatched to ${platform}:${recipientId} -> "${formattedText}"`);

    return {
      ok: true,
      messageId,
      platform,
      recipientId,
      formattedText,
      timestamp,
      mocked: true,
    };
  }

  // Live Gateway HTTP Dispatch with retry
  let attempts = 0;
  const maxAttempts = 3;
  let lastError: Error | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const projectId = options.projectId || process.env.PHOTON_PROJECT_ID || 'pho_prj_01m50dpdf7esk80f1d0edxenz4';
      const spaceId = options.spaceId;
      const botSenderId = options.senderId || 'pho_usr_48xqgpwv4bg6ksfbz7z4b734xe';

      let response: Response;

      if (projectId && spaceId) {
        // Live Photon Verified Spaces Message Dispatch
        response = await fetch(`${photonApiUrl.replace(/\/$/, '')}/v1/projects/${projectId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${photonApiKey}`,
            'Idempotency-Key': randomUUID(),
          },
          body: JSON.stringify({
            spaceId,
            senderId: botSenderId,
            content: {
              type: 'text',
              format: platform === 'telegram' ? 'markdown' : 'plain',
              text: formattedText,
            },
          }),
        });
      } else {
        // Fallback Universal Gateway Route
        response = await fetch(`${photonApiUrl.replace(/\/$/, '')}/v1/messages/outbound`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${photonApiKey}`,
            'Idempotency-Key': randomUUID(),
            'X-Client-Id': 'force-core-agent',
          },
          body: JSON.stringify({
            platform,
            recipient: recipientId,
            text: formattedText,
            media_url: resolvedMediaUrl,
            media_type: mediaType || (resolvedMediaUrl ? 'image' : undefined),
            reply_to: replyToMessageId,
            metadata: options.metadata || {},
          }),
        });
      }

      if (!response.ok && response.status !== 202) {
        const errorBody = await response.text();
        throw new Error(`Photon Gateway HTTP ${response.status}: ${errorBody}`);
      }

      const resData = await response.json();
      const confirmedMessageId = resData.messageId || resData.id || messageId;

      inMemoryOutboundLog.push({
        id: confirmedMessageId,
        options,
        formattedText,
        timestamp,
        status: 'sent',
      });

      return {
        ok: true,
        messageId: confirmedMessageId,
        platform,
        recipientId,
        formattedText,
        timestamp,
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[Photon Outbound] Attempt ${attempts}/${maxAttempts} failed: ${err.message}`);
      if (attempts < maxAttempts) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 150));
      }
    }
  }

  // Fallback: If Photon gateway failed and this is Telegram, dispatch directly via Telegram Bot API
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  if (platform === 'telegram' && telegramBotToken && recipientId) {
    try {
      if (resolvedMediaUrl) {
        try {
          const photoRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: recipientId,
              photo: resolvedMediaUrl,
              caption: formattedText.length <= 1024 ? formattedText : undefined,
            }),
          });
          if (photoRes.ok && formattedText.length <= 1024) {
            const tgData = await photoRes.json();
            const tgMsgId = `tg_${tgData.result?.message_id || Date.now()}`;
            inMemoryOutboundLog.push({
              id: tgMsgId,
              options,
              formattedText,
              timestamp,
              status: 'sent',
            });
            return {
              ok: true,
              messageId: tgMsgId,
              platform,
              recipientId,
              formattedText,
              timestamp,
            };
          }
        } catch (photoErr: any) {
          console.warn('[Photon Outbound] Direct Telegram sendPhoto failed:', photoErr.message);
        }
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipientId,
          text: formattedText,
        }),
      });
      if (tgRes.ok) {
        const tgData = await tgRes.json();
        const tgMsgId = `tg_${tgData.result?.message_id || Date.now()}`;
        inMemoryOutboundLog.push({
          id: tgMsgId,
          options,
          formattedText,
          timestamp,
          status: 'sent',
        });
        return {
          ok: true,
          messageId: tgMsgId,
          platform,
          recipientId,
          formattedText,
          timestamp,
        };
      }
    } catch (tgErr: any) {
      console.warn('[Photon Outbound] Direct Telegram fallback failed:', tgErr.message);
    }
  }

  const finalError = lastError ? lastError.message : 'Unknown gateway dispatch failure';
  inMemoryOutboundLog.push({
    id: messageId,
    options,
    formattedText,
    timestamp,
    status: 'failed',
    error: finalError,
  });

  return {
    ok: false,
    messageId,
    platform,
    recipientId,
    formattedText,
    timestamp,
    error: finalError,
  };
}

/**
 * Access the in-memory outbound dispatch ledger (useful for tests & monitoring)
 */
export function getOutboundLog(): OutboundLogEntry[] {
  return [...inMemoryOutboundLog];
}

/**
 * Reset the ledger and rate limits (useful for test suites)
 */
export function clearOutboundLog(): void {
  inMemoryOutboundLog.length = 0;
  rateLimitMap.clear();
}
