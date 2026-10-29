"use client";

import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import type { Grant } from "@/components/shared-cognition/ConsentGrantCard";
import { EntryRow } from "@/components/shared-cognition/EntryRow";

type EntryFilter = "all" | "sent" | "received";

interface EntriesTabProps {
  sentGrants: Grant[];
  receivedGrants: Grant[];
  partnerName: string;
  onUpdate: () => void;
  mobile?: boolean;
}

export function EntriesTab({ sentGrants, receivedGrants, partnerName, onUpdate, mobile = false }: EntriesTabProps) {
  const [filter, setFilter] = useState<EntryFilter>("all");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const revoke = async (grantId: string) => {
    setRevokingId(grantId);
    try {
      const response = await fetch(`/api/consent/${grantId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to revoke entry");
      onUpdate();
    } finally {
      setRevokingId(null);
    }
  };

  const groups = useMemo(() => {
    if (filter === "sent") return [{ label: "Shared by you", grants: sentGrants, isSentByMe: true }];
    if (filter === "received") return [{ label: "Shared with you", grants: receivedGrants, isSentByMe: false }];
    return [
      { label: "Shared by you", grants: sentGrants, isSentByMe: true },
      { label: `Shared by ${partnerName}`, grants: receivedGrants, isSentByMe: false },
    ];
  }, [filter, partnerName, receivedGrants, sentGrants]);

  const visibleCount = sentGrants.length + receivedGrants.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter entries">
        {([
          ["all", "All"],
          ["sent", "Shared by you"],
          ["received", "Shared with you"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${filter === value ? "border-[#9F6958] bg-[#9F6958] text-white" : "border-[#DCCDBD] bg-[#FFFDF9] text-[#7A5A3A] hover:border-[#9F6958]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleCount === 0 && filter === "received" ? (
        <div className="rounded-xl border border-dashed border-[#D7C8B8] bg-[#FFFDF9] px-6 py-12 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-[#9F6958]" />
          <p className="mt-3 font-serif text-base text-[#2E2012]">Nothing shared yet</p>
          <p className="mt-1 text-xs text-[#7A5A3A]">When {partnerName} shares an entry, it appears here.</p>
        </div>
      ) : visibleCount === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D7C8B8] bg-[#FFFDF9] px-6 py-12 text-center text-xs text-[#7A5A3A]">No shared entries yet.</div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => group.grants.length > 0 && (
            <section key={group.label}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2 className="font-serif text-sm text-[#2E2012]">{group.label}</h2>
                <span className="text-[11px] text-[#8B7665]">({group.grants.length})</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-[#E6DFD5] bg-[#FFFDF9]">
                {group.grants.map((grant) => (
                  <EntryRow
                    key={grant.id}
                    grant={grant}
                    isSentByMe={group.isSentByMe}
                    partnerName={partnerName}
                    onRevoke={() => revoke(grant.id)}
                    isRevoking={revokingId === grant.id}
                    mobile={mobile}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
