"use client";

import { ArrowUpRight, BookOpen, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Grant } from "@/components/shared-cognition/ConsentGrantCard";

interface EntryRowProps {
  grant: Grant;
  isSentByMe: boolean;
  partnerName: string;
  onRevoke: () => void;
  isRevoking: boolean;
  mobile?: boolean;
}

function formatSharedDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dateLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (date.toDateString() === today.toDateString()) return `Today · ${dateLabel}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${dateLabel}`;
  return dateLabel;
}

export function EntryRow({ grant, isSentByMe, partnerName, onRevoke, isRevoking, mobile = false }: EntryRowProps) {
  const snapshot = grant.shared_entry_snapshots?.[0];
  const title = snapshot?.title_encrypted && snapshot.title_encrypted !== "none"
    ? snapshot.title_encrypted
    : "Untitled entry";
  const topics = snapshot?.topics || grant.topics || [];
  const isActive = grant.status === "active";

  return (
    <article className="flex flex-col gap-3 border-b border-[#EAE1D6] bg-[#FFFDF9] px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#F4EDE2] px-2 py-1 text-[10px] font-medium text-[#7A5A3A]">
            {isSentByMe ? "You shared" : "Shared with you"}
          </span>
          <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${isActive ? "bg-[#E7F2E8] text-[#39734B]" : "bg-[#EEE9E2] text-[#8B7665]"}`}>
            {isActive ? "Active" : "Revoked"}
          </span>
        </div>
        <h3 className="mt-2 flex items-center gap-2 truncate font-serif text-base text-[#2E2012]">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#9F6958]" />
          <span className="truncate">{title}</span>
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#8B7665]">
          <span>{formatSharedDate(grant.granted_at)}</span>
          {topics.map((topic) => (
            <span key={topic} className="rounded-md border border-[#E6DFD5] bg-[#F4EDE2] px-1.5 py-0.5 text-[#7A5A3A]">#{topic}</span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isActive && (
          <Link
            href={`/shared-entry/${grant.id}`}
            target="_blank"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[#9F6958] transition-colors hover:bg-[#F4EDE2] hover:text-[#865545]"
          >
            Read <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
        {isSentByMe && isActive && !mobile && (
          <ConfirmDialog
            trigger={<Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-[#8B7665] hover:bg-[#FDECEC] hover:text-red-700">Revoke</Button>}
            title="Revoke this entry?"
            description={`This will remove the shared entry from ${partnerName}.`}
            confirmLabel="Revoke entry"
            confirmLoadingLabel="Revoking..."
            onConfirm={onRevoke}
            loading={isRevoking}
            confirmTone="danger"
          />
        )}
        {isSentByMe && isActive && mobile && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button type="button" aria-label="Entry actions" className="inline-flex rounded-lg p-2 text-[#8B7665] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F6958]">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="border border-[#E6DFD5] bg-[#FFFDF9] shadow-[0_12px_28px_rgba(63,43,17,0.14)]">
              <ConfirmDialog trigger={<button type="button" className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50">Revoke entry</button>} title="Revoke this entry?" description={`This will remove the shared entry from ${partnerName}.`} confirmLabel="Revoke entry" confirmLoadingLabel="Revoking..." onConfirm={onRevoke} loading={isRevoking} confirmTone="danger" />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
}
