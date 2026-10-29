"use client";

import { UserRound } from "lucide-react";

interface IdentityBlockProps {
  name: string;
  email?: string;
  username?: string;
  profileImage?: string | null;
  connectedSince: string;
}

export function IdentityBlock({
  name,
  email,
  username,
  profileImage,
  connectedSince,
}: IdentityBlockProps) {
  const secondaryLabel = username ? `@${username}` : email || "Force connection";

  return (
    <section className="space-y-4 p-5">
      <div className="flex items-start gap-3.5">
        {profileImage ? (
          <img
            src={profileImage}
            alt={name}
            className="h-14 w-14 rounded-2xl border border-[#D7C8B8] object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9F6958] text-xl font-semibold text-white">
            {name.charAt(0).toUpperCase() || <UserRound className="h-6 w-6" />}
          </div>
        )}
        <div className="min-w-0 pt-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9F6958]">Connection</p>
          <h1 title={name} className="mt-1 truncate font-serif text-2xl leading-tight text-[#2E2012]">{name}</h1>
          <p title={secondaryLabel} className="mt-1 truncate text-xs text-[#7A5A3A]">{secondaryLabel}</p>
        </div>
      </div>
      <span className="inline-flex rounded-full border border-[#D7C8B8] bg-[#FFFDF9] px-2.5 py-1 text-[11px] font-medium text-[#7A5A3A]">
        Connected since {connectedSince}
      </span>
    </section>
  );
}
