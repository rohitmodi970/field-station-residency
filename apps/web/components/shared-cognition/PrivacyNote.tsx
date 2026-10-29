"use client";

import { ShieldCheck } from "lucide-react";

export function PrivacyNote() {
  return (
    <section className="border-t border-[#E6DFD5] p-5">
      <div className="rounded-xl border border-[#E6DFD5] bg-[#FFFDF9] p-3.5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9F6958]" />
          <div>
            <p className="text-xs font-semibold text-[#2E2012]">Private by default</p>
            <p className="mt-1 text-xs leading-5 text-[#7A5A3A]">Only entries you choose to share appear here.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
