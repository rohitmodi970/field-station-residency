'use client';
// apps/web/components/security/EncryptionGate.tsx
/**
 * EncryptionGate — Phase 1-5 Security Architecture
 *
 * Mounted ONCE in (user)/layout.tsx, wrapping ALL authenticated pages.
 *
 * On mount it calls ensureEncryptionReady(). Based on the result:
 *
 *   ready                  → renders children normally
 *   new_device             → full-page NewDeviceVerification modal
 *   legacy_otp_required    → full-page LegacyMigrationGate
 *   needs_unlock / error   → renders children anyway (page-level fallback)
 *
 * Once the user passes the gate, state is set to 'ready' and children
 * are rendered. The gate will NOT re-run on navigation — it runs once
 * per layout mount (i.e. once per login session in this tab).
 *
 * The DeviceApprovalProvider (already in layout) handles the receiving
 * side — showing a popup on trusted devices when a new device requests access.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ensureEncryptionReady, type EncryptionReadinessResult } from '@/utils/encryption';
import { retrieveCredential, clearCredential } from '@/utils/encryption/credentialTransit';
import NewDeviceVerification from './NewDeviceVerification';
import LegacyMigrationGate from './LegacyMigrationGate';

type GateState =
  | 'checking'       // running ensureEncryptionReady
  | 'ready'          // encryption available, render children
  | 'new_device'     // device not trusted — show NewDeviceVerification
  | 'legacy'         // V1 user — show LegacyMigrationGate
  | 'passthrough';   // non-blocking statuses: needs_unlock / error

interface EncryptionGateProps {
  children: React.ReactNode;
}

export default function EncryptionGate({ children }: EncryptionGateProps) {
  const [gateState, setGateState] = useState<GateState>('checking');
  const [encResult, setEncResult] = useState<EncryptionReadinessResult | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  // ── Credential transit: hoisted unconditionally (Rules of Hooks) ──────────
  // When the gate resolves to new_device, retrieve the credential that
  // LoginFormNew stored. Single-use — cleared after NDV succeeds.
  const [transitCredential, setTransitCredential] = useState<string>('');

  useEffect(() => {
    if (gateState === 'new_device') {
      retrieveCredential().then((c) => {
        if (c) setTransitCredential(c);
      });
    }
  }, [gateState]);
  // ─────────────────────────────────────────────────────────────

  const runCheck = useCallback(async () => {
    setGateState('checking');
    try {
      const { createClient } = await import('@/utils/supabase/client');
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) {
        // Not authenticated — middleware handles redirect
        setGateState('passthrough');
        return;
      }
      setUserEmail(user.email ?? undefined);

      const result = await ensureEncryptionReady({
        userId: user.id,
        isOAuthUser: user.app_metadata?.provider !== 'email',
      });
      setEncResult(result);

      if (result.ready) {
        setGateState('ready');
      } else if (result.status === 'new_device') {
        setGateState('new_device');
      } else if (result.status === 'legacy_otp_required') {
        setGateState('legacy');
      } else {
        // needs_unlock / error — don't block; individual pages handle these
        setGateState('passthrough');
      }
    } catch (err) {
      console.error('[EncryptionGate] Check failed:', err);
      setGateState('passthrough'); // fail open — never lock users out on error
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // ── Checking spinner ─────────────────────────────────────────────────────
  if (gateState === 'checking') {
    return (
      <>
        {/* Render children hidden so layout doesn't flash on fast loads */}
        <div className="pointer-events-none opacity-0 select-none" aria-hidden>
          {children}
        </div>
        <div
          className="fixed inset-0 z-[8999] flex items-center justify-center"
          style={{ background: 'var(--color-background-primary, #fff)' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-4 border-[rgba(159,105,88,0.15)]" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#9f6958] border-t-transparent" />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Securing your session…
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── New device gate ────────────────────────────────────────────
  if (gateState === 'new_device' && encResult) {
    return (
      <NewDeviceVerification
        userId={encResult.userId!}
        userEmail={userEmail}
        credential={transitCredential}
        isOAuthUser={encResult.isOAuthUser!}
        hasTOTP={encResult.hasTOTP ?? false}
        hasRecoveryCode={encResult.hasRecoveryCode ?? false}
        onSuccess={() => {
          clearCredential(); // clear any leftover transit credential
          setTransitCredential('');
          setGateState('ready');
        }}
      />
    );
  }

  // ── Legacy OTP gate ──────────────────────────────────────────────────────
  if (gateState === 'legacy' && encResult) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white px-6">
        <LegacyMigrationGate
          userId={encResult.userId!}
          isOAuthUser={encResult.isOAuthUser!}
          onVerified={() => runCheck()}
        />
      </div>
    );
  }

  // ── Ready / passthrough ──────────────────────────────────────────────────
  return <>{children}</>;
}
