'use client';
// apps/web/components/security/DeviceApprovalProvider.tsx
/**
 * Thin client wrapper that resolves the current userId via Supabase auth
 * and mounts DeviceApprovalHandler so trusted devices receive Realtime
 * approval requests from new devices.
 *
 * Trust detection (in priority order — stops at first true):
 *   1. getDeviceId()  — device has gone through Phase-1 lazy migration
 *                       (most devices with device_keys row in Supabase)
 *   2. retrieveMasterKeyFromIndexedDB()  — device has the master key cached
 *                       in IndexedDB (legacy devices that pre-date Phase 1,
 *                       or devices that were set up before lazy migration ran)
 *
 * A brand-new/incognito device has neither → handler stays off.
 * A requesting device (same browser) has its own request filtered out
 * by the exclude_device_id param in the pending API.
 *
 * Mount this once in the user layout.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import DeviceApprovalHandler from './DeviceApprovalHandler';

export default function DeviceApprovalProvider() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isTrusted, setIsTrusted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkTrust = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (cancelled || !data.user) return;
        const uid = data.user.id;
        setUserId(uid);

        const { getDeviceId, restoreEncryptionFromCache } = await import(
          '@/utils/encryption/keyManager'
        );

        // Check 1 — device credentials in IndexedDB (Phase-1 lazy-migrated device)
        const localDeviceId = await getDeviceId();
        if (localDeviceId) {
          console.log('[DeviceApprovalProvider] Trusted via deviceId:', localDeviceId);
          if (!cancelled) setIsTrusted(true);
          return;
        }

        // Check 2 — master key in IndexedDB (legacy device pre-dating Phase 1)
        // restoreEncryptionFromCache returns true if the key was found and loaded.
        const hasCachedKey = await restoreEncryptionFromCache(uid);
        if (hasCachedKey) {
          console.log('[DeviceApprovalProvider] Trusted via cached master key (legacy device)');
          if (!cancelled) setIsTrusted(true);
          return;
        }

        console.log('[DeviceApprovalProvider] Not trusted — no deviceId or cached key found');
      } catch (err) {
        // IndexedDB unavailable or auth error — fail safe, handler stays off
        console.warn('[DeviceApprovalProvider] Trust check error:', err);
      }
    };

    checkTrust();
    return () => { cancelled = true; };
  }, []);

  if (!userId || !isTrusted) return null;
  return <DeviceApprovalHandler userId={userId} />;
}
