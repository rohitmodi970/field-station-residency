"use client";

import type { ReactNode } from "react";

interface ForcePageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ForcePageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
}: ForcePageShellProps) {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[#FAF7F2] pb-28 font-sans antialiased text-[#1F1A16] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(242,182,138,0.22)_0,transparent_34%),radial-gradient(circle_at_94%_14%,rgba(237,205,147,0.22)_0,transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(137,94,60,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(137,94,60,0.06)_1px,transparent_1px)] bg-size-[42px_42px] opacity-60 mask-[linear-gradient(to_bottom,black,transparent_72%)]" />

      <div className="relative mx-auto w-full max-w-5xl px-4 pt-8 sm:px-8 sm:pt-12 lg:px-10">
        <header className="mb-7 flex items-start justify-between gap-4 sm:mb-8">
          <div className="flex min-w-0 items-start gap-4">
          <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#8f4d30] p-2 shadow-[0_8px_20px_rgba(143,77,48,0.18)]">
            <img src="/logo.svg" alt="Force" className="h-full w-full object-contain brightness-0 invert" />
          </div>
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f4d30]">
                {eyebrow}
              </p>
            )}
            <h1 className="font-serif text-3xl font-normal tracking-tight text-[#2E2012] sm:text-4xl">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7A5A3A]">{description}</p>}
          </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
        </header>

        {children}
      </div>
    </main>
  );
}
