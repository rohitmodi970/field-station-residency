"use client";

// The top of every page, floating over the content: a round back button, the title centred,
// room for one thing on the right. What scrolls under it blurs away.

import { f } from "@/lib/f/store";
import { I } from "./ui";

export function BlurTop({ height = 72 }: { height?: number }) {
  return (
    <div className="blur-top" style={{ height: `calc(var(--sat) + ${height}px)` }} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

// Above a bottom bar: what scrolls into it blurs and fades, so there's never a hard edge.
export function BlurBottom({ height = 40 }: { height?: number }) {
  return (
    <div className="blur-bottom" style={{ height }} aria-hidden>
      <i />
      <i />
      <i />
    </div>
  );
}

// Memory lives to the left of the chat, so its pages go back from the left; the Energy map
// lives to the right, so its pages go back from the right.
export default function Nav({ title, right, onBack, side = "left" }: { title?: React.ReactNode; right?: React.ReactNode; onBack?: () => void; side?: "left" | "right" }) {
  const back = (
    <button type="button" aria-label="Back" onClick={onBack ?? (() => f.pop())} className="press pill hit h-11 w-11 justify-center p-0">
      {side === "left" ? <I.Back size={22} /> : <I.Chevron size={22} />}
    </button>
  );
  const other = right ?? <span className="w-11" aria-hidden />;
  return (
    <>
      <BlurTop />
      <header className="absolute inset-x-0 top-0 z-[2] flex h-14 items-center justify-between px-4">
        {side === "left" ? back : other}
        {title && <h1 className="absolute left-1/2 flex max-w-[60%] -translate-x-1/2 items-center gap-2 truncate t-nav text-ink">{title}</h1>}
        {side === "left" ? other : back}
      </header>
    </>
  );
}
