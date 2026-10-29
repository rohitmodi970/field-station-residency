"use client";

import Image from "next/image";

interface CheckInsControlProps {
  partnerName: string;
  enabledByMe: boolean;
  enabledByPartner: boolean;
  isUpdating: boolean;
  onToggle: () => void;
}

export function CheckInsControl({
  partnerName,
  enabledByMe,
  enabledByPartner,
  isUpdating,
  onToggle,
}: CheckInsControlProps) {
  const partnerFirstName = partnerName.split(" ")[0] || partnerName;
  const status = enabledByMe && enabledByPartner
    ? "Active"
    : enabledByMe
      ? `Waiting for ${partnerFirstName}`
      : "Off";

  return (
    <section className="border-t border-[#E6DFD5] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-1 flex h-8 w-10 items-center justify-center rounded-lg bg-[#9F6958] text-white">
            <span className="font-serif text-sm font-bold leading-none" aria-hidden="true"><Image src="/logo2.png" alt="" width={20} height={20} /></span>
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-sm font-semibold text-[#2E2012]">Check-ins</h2>
              <span className="rounded-full border border-[#D7C8B8] bg-[#FFFDF9] px-2 py-0.5 text-[10px] font-medium text-[#7A5A3A]">
                {status}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#7A5A3A]">Enable this together for gentle prompts from Force.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabledByMe}
          aria-label="Enable check-ins for this connection"
          disabled={isUpdating}
          onClick={onToggle}
          className={`relative mt-1 h-6 w-10 shrink-0 rounded-full border transition-colors ${
            enabledByMe ? "border-[#9F6958] bg-[#9F6958]" : "border-[#CDBEAE] bg-[#E6DFD5]"
          } ${isUpdating ? "cursor-wait opacity-60" : ""}`}
        >
          <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform ${enabledByMe ? "translate-x-4.5" : "translate-x-0.5"}`} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-[#E6DFD5] bg-[#FFFDF9] px-2.5 py-2 text-[#7A5A3A]">You: <strong className="font-medium text-[#2E2012]">{enabledByMe ? "On" : "Off"}</strong></div>
        <div className="rounded-lg border border-[#E6DFD5] bg-[#FFFDF9] px-2.5 py-2 text-[#7A5A3A]">{partnerFirstName}: <strong className="font-medium text-[#2E2012]">{enabledByPartner ? "On" : "Off"}</strong></div>
      </div>
    </section>
  );
}
