// apps/web/app/api/encryption/device-status/route.ts
/**
 * Device Status API — Security Architecture v2 (Phase 2)
 *
 * GET /api/encryption/device-status?device_id=<uuid>
 *
 * When `device_id` is supplied (Phase 1+ clients that have completed lazy
 * migration), checks whether THAT specific device has a device_keys row.
 * Returns { hasDeviceKey, deviceCount, isLegacyUser: false }
 *
 * When `device_id` is omitted (V1 / legacy clients), runs both
 * device_keys and recovery_codes counts in parallel and returns:
 *   - hasDeviceKey  — whether ANY device is registered
 *   - isLegacyUser  — true when device_keys=0 AND recovery_codes=0
 *                     (pre-V2 user; route to email-OTP migration gate)
 *
 * Response shape:
 *   { hasDeviceKey: boolean, deviceCount: number, isLegacyUser: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;
    const supabase = authResult.supabase;

    const deviceId = req.nextUrl.searchParams.get('device_id');

    // Fetch user settings and TOTP status to check 2FA status
    const [{ data: settingsData }, { data: totpRow }] = await Promise.all([
      supabase
        .from('user_settings')
        .select('totp_enabled, vault_password_set, oauth_vault_mode')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('totp_settings')
        .select('enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const isTotpActive = Boolean(settingsData?.totp_enabled || totpRow?.enabled);

    // ── Precise check: does THIS specific device have a device_keys row? ──────
    if (deviceId) {
      const [{ data: deviceData, error: deviceError }, { count: recoveryCount }] = await Promise.all([
        supabase
          .from('device_keys')
          .select('encrypted_key, key_iv')
          .eq('user_id', user.id)
          .eq('device_id', deviceId)
          .maybeSingle(),
        supabase
          .from('recovery_codes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('used_at', null),
      ]);

      if (deviceError) {
        console.error('[device-status] Query error (device_id path):', deviceError);
        return NextResponse.json({ error: 'Failed to check device status' }, { status: 500 });
      }

      const twoFactorEnabled = Boolean(
        isTotpActive ||
        (recoveryCount ?? 0) > 0
      );

      return NextResponse.json({
        hasDeviceKey: !!deviceData,
        deviceCount: deviceData ? 1 : 0,
        // Return the wrapped key so the client can use device-secret restore
        encrypted_key: deviceData?.encrypted_key ?? null,
        key_iv: deviceData?.key_iv ?? null,
        two_factor_enabled: twoFactorEnabled,
        hasTOTP: isTotpActive,
        hasRecoveryCode: (recoveryCount ?? 0) > 0,
        // A client that sends device_id has already completed lazy migration → never legacy
        isLegacyUser: false,
      });
    }

    // ── Fallback: no device_id → V1 / legacy client ───────────────────────────
    // Run counts in parallel for performance
    const [deviceResult, recoveryResult] = await Promise.all([
      supabase
        .from('device_keys')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('recovery_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('used_at', null),
    ]);

    if (deviceResult.error) {
      console.error('[device-status] device_keys query error:', deviceResult.error);
      return NextResponse.json({ error: 'Failed to check device status' }, { status: 500 });
    }

    const deviceCount = deviceResult.count ?? 0;
    const recoveryCount = recoveryResult.count ?? 0;
    const twoFactorEnabled = Boolean(
      isTotpActive ||
      recoveryCount > 0
    );

    // V1 user heuristic: no device keys AND no recovery codes → pre-dates V2
    const isLegacyUser = deviceCount === 0 && recoveryCount === 0;

    return NextResponse.json({
      hasDeviceKey: deviceCount > 0,
      deviceCount,
      two_factor_enabled: twoFactorEnabled,
      hasTOTP: isTotpActive,
      hasRecoveryCode: recoveryCount > 0,
      isLegacyUser,
    });
  } catch (err) {
    console.error('[device-status] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
