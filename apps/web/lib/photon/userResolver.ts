/**
 * Photon User Resolver & Identity Connector
 * Resolves incoming social handles (WhatsApp, iMessage, Telegram) to Force users via
 * E.164 normalization, external_accounts mapping, and users table lookup.
 */

import { createHmac } from 'crypto';

export interface ResolvedPhotonUser {
  id: string;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  isNewLink?: boolean;
}

export interface UserResolutionResult {
  user: ResolvedPhotonUser | null;
  isLinked: boolean;
  normalizedSenderId: string;
  connectUrl?: string;
  invitationText?: string;
}

/**
 * Normalizes phone numbers to international standard (E.164 without dashes or spaces)
 * e.g., "+91 98765-43210" -> "+919876543210" or "919876543210"
 */
export function normalizePhoneNumber(raw: string = ''): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) return '';
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Strip all non-alphanumeric chars for robust fallback matching
 */
export function normalizeIdentifier(value?: string | null): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Generates a signed, 1-click account linking URL for unlinked phone numbers
 */
export function generateConnectInvitation(
  platform: string,
  senderId: string,
  baseUrl?: string
): { connectUrl: string; invitationText: string } {
  const secret = process.env.WEBHOOK_SECRET || process.env.PHOTON_WEBHOOK_SECRET || 'force-connect-secret';
  const timestamp = Math.floor(Date.now() / 1000);
  const rawPayload = `${platform}:${senderId}:${timestamp}`;
  const token = createHmac('sha256', secret).update(rawPayload).digest('hex').slice(0, 16);

  // Sanitize baseUrl: NEVER use localhost in an invitation sent to mobile (SMS/iMessage/WhatsApp)
  let resolvedBaseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || '';
  if (!resolvedBaseUrl || resolvedBaseUrl.includes('localhost') || resolvedBaseUrl.includes('127.0.0.1')) {
    resolvedBaseUrl = 'https://www.findmyforce.com';
  }

  const connectUrl = `${resolvedBaseUrl.replace(/\/$/, '')}/connect?platform=${encodeURIComponent(
    platform
  )}&sender=${encodeURIComponent(senderId)}&t=${timestamp}&sig=${token}`;

  const platformLabel = platform === 'whatsapp' ? 'WhatsApp' : platform === 'imessage' ? 'iMessage' : platform;

  const invitationText =
    `Hey! I'm Force. 👋\n\n` +
    `It looks like your ${platformLabel} isn't linked to your Force account yet. ` +
    `Connect it with one tap to start capturing voice notes, reflections, and sidequests:\n\n` +
    `${connectUrl}`;

  return { connectUrl, invitationText };
}

/**
 * Resolve a user given a platform and incoming sender identifier
 */
export async function resolvePhotonUser(
  adminClient: any,
  platform: string,
  senderId?: string,
  baseUrl?: string
): Promise<UserResolutionResult> {
  if (!senderId) {
    return {
      user: null,
      isLinked: false,
      normalizedSenderId: '',
    };
  }

  const normalizedPhone = normalizePhoneNumber(senderId);
  const normalizedId = normalizeIdentifier(senderId);
  const normalizedPhoneOnlyDigits = normalizeIdentifier(normalizedPhone);

  if (!adminClient) {
    return {
      user: null,
      isLinked: false,
      normalizedSenderId: normalizedPhone || senderId,
      ...generateConnectInvitation(platform, senderId, baseUrl),
    };
  }

  try {
    // 1. Check external_accounts mapping table
    try {
      const { data: mapping, error: mappingError } = await adminClient
        .from('external_accounts')
        .select('user_id, external_id')
        .eq('provider', platform)
        .in('external_id', [senderId, normalizedPhone, normalizedPhoneOnlyDigits])
        .limit(1);

      if (!mappingError && mapping && mapping.length > 0 && mapping[0]?.user_id) {
        const userId = mapping[0].user_id;
        const { data: userRec } = await adminClient
          .from('users')
          .select('id, phone, email, username, name')
          .eq('id', userId)
          .maybeSingle();

        return {
          user: {
            id: userId,
            phone: userRec?.phone ?? normalizedPhone,
            email: userRec?.email,
            fullName: userRec?.name || userRec?.full_name || userRec?.username,
          },
          isLinked: true,
          normalizedSenderId: normalizedPhone || senderId,
        };
      }
    } catch (mapErr) {
      console.warn('[Photon UserResolver] external_accounts query skipped/error:', mapErr);
    }

    // 2. Direct lookup on users table by phone or email
    try {
      const { data: users, error: userError } = await adminClient
        .from('users')
        .select('id, phone, email, username, name')
        .or(
          `phone.eq.${senderId},phone.eq.${normalizedPhone},email.eq.${senderId},phone.eq.${normalizedPhoneOnlyDigits}`
        )
        .limit(5);

      if (!userError && users && users.length > 0) {
        const found = users[0];
        return {
          user: {
            id: found.id,
            phone: found.phone,
            email: found.email,
            fullName: found.name || found.full_name || found.username,
          },
          isLinked: true,
          normalizedSenderId: normalizedPhone || senderId,
        };
      }
    } catch (userErr) {
      console.warn('[Photon UserResolver] users direct query skipped/error:', userErr);
    }

    // 3. Fallback: batch fetch and match in JavaScript (handles messy prefix variations)
    try {
      const { data: batchUsers, error: batchError } = await adminClient
        .from('users')
        .select('id, phone, email, username, name')
        .limit(500);

      if (!batchError && batchUsers && Array.isArray(batchUsers)) {
        const matched = batchUsers.find((u: any) => {
          if (!u) return false;
          const uPhone = normalizeIdentifier(u.phone);
          const uEmail = normalizeIdentifier(u.email);
          return (
            (uPhone && (uPhone === normalizedId || uPhone === normalizedPhoneOnlyDigits)) ||
            (uEmail && uEmail === normalizedId)
          );
        });

        if (matched) {
          return {
            user: {
              id: matched.id,
              phone: matched.phone,
              email: matched.email,
              fullName: matched.name || matched.full_name || matched.username,
            },
            isLinked: true,
            normalizedSenderId: normalizedPhone || senderId,
          };
        }
      }
    } catch (batchErr) {
      console.warn('[Photon UserResolver] batch lookup skipped/error:', batchErr);
    }

    // User not found in database: return unlinked with invitation payload
    const invitation = generateConnectInvitation(platform, senderId, baseUrl);
    return {
      user: null,
      isLinked: false,
      normalizedSenderId: normalizedPhone || senderId,
      connectUrl: invitation.connectUrl,
      invitationText: invitation.invitationText,
    };
  } catch (error) {
    console.error('[Photon UserResolver] Error during user resolution:', error);
    return {
      user: null,
      isLinked: false,
      normalizedSenderId: normalizedPhone || senderId,
    };
  }
}
