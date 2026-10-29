// apps/web/app/(user)/layout.tsx - User Layout

import type { ReactNode } from "react";
import { WaterNavBar } from '@/components/Navigation';
import { NotificationProvider } from '@/components/notifications';
import { CompanionFloatingToast } from '@/components/companion/CompanionFloatingToast';
import { ProactiveNudgeRunner } from '@/components/companion/ProactiveNudgeRunner';
import DeviceApprovalProvider from '@/components/security/DeviceApprovalProvider';
import EncryptionGate from '@/components/security/EncryptionGate';
import RecoveryCodesBanner from '@/components/security/RecoveryCodesBanner';

export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <NotificationProvider>
      {/* Phase 4: listen for device-approval requests on trusted devices */}
      <DeviceApprovalProvider />

      {/* Recovery codes warning — rendered at layout level so it is always
          fixed to the viewport, not inside any scrollable page container. */}
      <RecoveryCodesBanner />

      {/*
        Phase 1-5 EncryptionGate — runs ONCE per session.
        Blocks ALL child pages if this device is not yet trusted.
        Handles: new_device → NewDeviceVerification
                 legacy_otp_required → LegacyMigrationGate
                 recovery_codes_missing → RecoveryCodesBanner (non-blocking)
                 
                 ready / passthrough → renders children
                 
      */}
      <EncryptionGate>
        <main className="min-h-screen">
          {children}
        </main>
      </EncryptionGate>

      {/* Phase 7: Ambient Proactive Companion Trigger & Floating Toast across all pages */}
      <ProactiveNudgeRunner />
      <CompanionFloatingToast />

      {/* WaterNavBar shared across all (user) routes */}
      <WaterNavBar />
    </NotificationProvider>
  );
}

