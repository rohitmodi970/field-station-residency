"use client";

import { X } from "lucide-react";
import { PrivacyNote } from "@/components/shared-cognition/PrivacyNote";
import { CheckInsControl } from "@/components/shared-cognition/CheckInsControl";

interface MobileStatusSheetProps {
  open: boolean;
  partnerName: string;
  enabledByMe: boolean;
  enabledByPartner: boolean;
  isUpdating: boolean;
  onToggleCheckIns: () => void;
  onClose: () => void;
}

export function MobileStatusSheet({
  open,
  partnerName,
  enabledByMe,
  enabledByPartner,
  isUpdating,
  onToggleCheckIns,
  onClose,
}: MobileStatusSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close status details" onClick={onClose} className="absolute inset-0 bg-[#2E2012]/25" />
      <section role="dialog" aria-modal="true" aria-labelledby="mobile-status-title" className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[#D7C8B8] bg-[#FBF7F1] pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(63,43,17,0.18)]">
        <div className="flex items-center justify-between border-b border-[#E6DFD5] px-5 py-4">
          <h2 id="mobile-status-title" className="font-serif text-lg text-[#2E2012]">Connection status</h2>
          <button type="button" aria-label="Close status details" onClick={onClose} className="rounded-lg p-2 text-[#7A5A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F6958]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-[#E6DFD5]">
          <PrivacyNote />
          <CheckInsControl partnerName={partnerName} enabledByMe={enabledByMe} enabledByPartner={enabledByPartner} isUpdating={isUpdating} onToggle={onToggleCheckIns} />
        </div>
      </section>
    </div>
  );
}
