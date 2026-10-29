import { createAdminClient } from '@/utils/supabase/admin';
import { PhotonPayload } from '@/lib/photon/webhook';

export interface TelegramWebhookPayload {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  [key: string]: any;
}

export interface TelegramMessage {
  message_id?: number;
  date?: number;
  text?: string;
  chat?: {
    id?: number;
    type?: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
  };
  from?: {
    id?: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

function normalizeIdentifier(value?: string | null): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
}

export function verifyTelegramSecret(secretToken: string): boolean {
  if (!secretToken || !getSecret()) {
    return false;
  }
  return secretToken === getSecret();
}

async function findUserForTelegram(adminClient: any, senderId?: string, senderUsername?: string) {
  const normalizedId = normalizeIdentifier(senderId);
  const normalizedUsername = normalizeIdentifier(senderUsername);

  if (!normalizedId && !normalizedUsername) {
    return null;
  }

  try {
    const { data, error } = await adminClient
      .from('users')
      .select('id, phone, email, username')
      .limit(1000);

    if (error) {
      console.error('[Telegram] User lookup failed:', error);
      return null;
    }

    const user = (data ?? []).find((user: any) => {
      const usernameMatch = normalizeIdentifier(user.username);
      const phoneMatch = normalizeIdentifier(user.phone);
      const emailMatch = normalizeIdentifier(user.email);

      return (
        (normalizedUsername && usernameMatch && usernameMatch === normalizedUsername) ||
        (normalizedId && phoneMatch && phoneMatch === normalizedId) ||
        (normalizedId && emailMatch && emailMatch === normalizedId)
      );
    }) || null;

    if (!user) {
      console.warn('[Telegram] No user matched sender:', {
        senderId,
        senderUsername,
        normalizedId,
        normalizedUsername,
      });
    }

    return user;
  } catch (error) {
    console.error('[Telegram] User lookup failed:', error);
    return null;
  }
}

async function createJournalEntry(adminClient: any, userId: string, message: TelegramMessage) {
  const text = message.text ?? JSON.stringify(message ?? {});
  const journalId = `telegram_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { error } = await adminClient.from('journals').insert({
    user_id: userId,
    journal_id: journalId,
    title: 'Telegram message',
    content: text,
    journal_type: 'telegram',
    save_source: 'telegram',
    date: new Date().toISOString(),
  });

  if (error) {
    console.error('[Telegram] Failed to create journal entry:', error);
  } else {
    console.info('[Telegram] Created journal entry for user:', userId, 'journal_id:', journalId);
  }
}

export async function handleTelegramWebhook(payload: TelegramWebhookPayload, adminClient?: any) {
  let client = adminClient ?? null;

  if (!client) {
    try {
      client = createAdminClient();
    } catch (error) {
      console.warn('[Telegram] Supabase admin client unavailable.', error);
    }
  }

  const message = payload.message || payload.edited_message || payload.channel_post;
  if (!message) {
    return { ok: true, handled: false, reason: 'no_message' };
  }

  const sender = message.from;
  const senderId = sender?.id ? String(sender.id) : undefined;
  const senderUsername = sender?.username || message.chat?.username || undefined;
  const contentText = message.text ?? '';
  const platform = 'telegram';

  console.info('[Telegram] Incoming message', {
    senderId,
    senderUsername,
    platform,
    messageId: message.message_id,
    text: contentText,
  });

  if (!client) {
    return { ok: false, handled: false, reason: 'supabase_unavailable' };
  }

  let messageText = contentText;
  if (!messageText && message.location) {
    messageText = `I am sharing my live location coordinates: ${message.location.latitude}, ${message.location.longitude}. Where am I and what are the best local spots or activities around here?`;
  }

  const telegramToPhotonPayload: PhotonPayload = {
    event: 'messages',
    space: {
      id: String(message.chat?.id || senderId || ''),
      platform: 'telegram',
      type: message.chat?.type || 'private',
    },
    message: {
      id: message.message_id ? String(message.message_id) : undefined,
      timestamp: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
      sender: {
        id: senderId,
        platform: 'telegram',
      },
      content: {
        type: message.location ? 'location' : 'text',
        text: messageText,
        ...(message.location ? { location: message.location, latitude: message.location.latitude, longitude: message.location.longitude } : {}),
      },
      ...(message.location ? { location: message.location } : {}),
    },
  };

  const { handlePhotonMessage } = await import('@/lib/photon/webhook');
  const photonResult = await handlePhotonMessage(telegramToPhotonPayload, client);

  if (photonResult?.handled) {
    return {
      ok: true,
      handled: true,
      photon: true,
      photonResult,
      senderId,
      senderUsername,
      platform,
    };
  }

  const user = await findUserForTelegram(client, senderId, senderUsername);
  if (!user?.id) {
    return {
      ok: true,
      handled: false,
      reason: 'user_not_found',
      senderId,
      senderUsername,
    };
  }

  await createJournalEntry(client, user.id, message);

  return {
    ok: true,
    handled: true,
    photon: false,
    userId: user.id,
    senderId,
    senderUsername,
    platform,
  };
}
