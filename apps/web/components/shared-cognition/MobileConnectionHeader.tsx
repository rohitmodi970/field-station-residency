"use client";

import { ArrowLeft, MoreHorizontal, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface MobileConnectionHeaderProps {
  name: string;
  profileImage?: string | null;
  isRemoving: boolean;
  onRemove: () => void;
}

export function MobileConnectionHeader({ name, profileImage, isRemoving, onRemove }: MobileConnectionHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#E6DFD5] bg-[#FBF7F1]/95 px-3 backdrop-blur-md lg:hidden">
      <button type="button" aria-label="Back to connections" onClick={() => router.push('/connections')} className="rounded-lg p-2 text-[#7A5A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F6958]">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 items-center gap-2">
        {profileImage ? <img src={profileImage} alt="" className="h-8 w-8 rounded-xl object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9F6958] text-sm font-semibold text-white">{name.charAt(0).toUpperCase() || <UserRound className="h-4 w-4" />}</span>}
        <span title={name} className="max-w-48 truncate font-serif text-base text-[#2E2012]">{name}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button type="button" aria-label="Connection actions" className="inline-flex rounded-lg p-2 text-[#7A5A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F6958]">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border border-[#E6DFD5] bg-[#FFFDF9] shadow-[0_12px_28px_rgba(63,43,17,0.14)]">
          <ConfirmDialog trigger={<button type="button" className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50">Remove connection</button>} title="Remove this connection?" description="Shared entries will no longer be visible to either person." confirmLabel="Remove connection" confirmLoadingLabel="Removing..." onConfirm={onRemove} loading={isRemoving} confirmTone="danger" />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
