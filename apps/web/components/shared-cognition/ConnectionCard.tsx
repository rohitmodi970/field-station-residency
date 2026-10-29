"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IdentityBlock } from "@/components/shared-cognition/IdentityBlock";
import { PrivacyNote } from "@/components/shared-cognition/PrivacyNote";
import { CheckInsControl } from "@/components/shared-cognition/CheckInsControl";

interface ConnectionCardProps {
  name: string;
  email?: string;
  username?: string;
  profileImage?: string | null;
  connectedSince: string;
  enabledByMe: boolean;
  enabledByPartner: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  onShare: () => void;
  onToggleCheckIns: () => void;
  onRemove: () => void;
}

export function ConnectionCard({
  name,
  email,
  username,
  profileImage,
  connectedSince,
  enabledByMe,
  enabledByPartner,
  isUpdating,
  isRemoving,
  onShare,
  onToggleCheckIns,
  onRemove,
}: ConnectionCardProps) {
  return (
    <aside className="overflow-visible rounded-2xl border border-[#E6DFD5] bg-[#F4EDE2] shadow-[0_12px_32px_rgba(63,43,17,0.08)] lg:sticky lg:top-6">
      <IdentityBlock
        name={name}
        email={email}
        username={username}
        profileImage={profileImage}
        connectedSince={connectedSince}
      />

      <div className="border-t border-[#E6DFD5] px-5 py-4">
        <Button
          type="button"
          onClick={onShare}
          className="h-10 w-full gap-1.5 bg-[#9F6958] text-sm font-medium text-white shadow-sm hover:bg-[#865545]"
        >
          <Plus className="h-4 w-4" /> Share entry
        </Button>
      </div>

      <PrivacyNote />
      <CheckInsControl
        partnerName={name}
        enabledByMe={enabledByMe}
        enabledByPartner={enabledByPartner}
        isUpdating={isUpdating}
        onToggle={onToggleCheckIns}
      />

      <div className="flex justify-end border-t border-[#E6DFD5] px-5 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#7A5A3A] hover:bg-[#FFFDF9] hover:text-[#9F6958]" aria-label="Connection actions">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border border-[#E6DFD5] bg-[#FFFDF9] shadow-[0_12px_28px_rgba(63,43,17,0.14)]">
            <ConfirmDialog
              trigger={<button type="button" className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50">Remove connection</button>}
              title="Remove this connection?"
              description="Shared entries will no longer be visible to either person."
              confirmLabel="Remove connection"
              confirmLoadingLabel="Removing..."
              onConfirm={onRemove}
              loading={isRemoving}
              confirmTone="danger"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
