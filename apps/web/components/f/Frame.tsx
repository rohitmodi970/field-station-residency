"use client";

// The phone. On a desktop it's drawn as an iPhone; on a phone it's the screen itself.
// The app area follows the visual viewport, so when the iOS keyboard opens the layout shrinks
// to sit above it instead of the page being scrolled underneath.

import { useEffect, useState } from "react";

function StatusBar() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const t = () => {
      const d = new Date();
      setTime(`${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    t();
    const id = setInterval(t, 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="frame-only pointer-events-none absolute inset-x-0 top-0 z-[90]" aria-hidden>
      <div className="flex items-center justify-between px-[38px] pt-[2px] text-ink" style={{ height: 54 }}>
        <span className="w-[54px] text-center text-[15px] font-medium tracking-[-0.02em]">{time}</span>
        <span className="flex items-center gap-[6px]">
          <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
            <rect x="0" y="8" width="3" height="4" rx="1" />
            <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
            <rect x="10" y="3" width="3" height="9" rx="1" />
            <rect x="15" y="0" width="3" height="12" rx="1" />
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
            <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4 10.4 10.4 0 0 0 .8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.5c1.4 0 2.6.5 3.6 1.4l1.2-1.3A7 7 0 0 0 8 3.9a7 7 0 0 0-4.8 1.9l1.2 1.3c1-.9 2.2-1.4 3.6-1.4ZM8 9.2c.5 0 1 .2 1.3.5L8 11.6 6.7 9.7c.3-.3.8-.5 1.3-.5Z" />
          </svg>
          <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
            <rect x=".5" y=".5" width="23" height="12" rx="3.8" stroke="currentColor" opacity=".4" />
            <rect x="2" y="2" width="17" height="9" rx="2.4" fill="currentColor" />
            <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".45" />
          </svg>
        </span>
      </div>
    </div>
  );
}

export function useViewport() {
  const [vp, setVp] = useState<{ h: number | null; top: number; kb: boolean }>({ h: null, top: 0, kb: false });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || window.matchMedia("(min-width: 768px)").matches) return;
    const on = () => {
      const kb = window.innerHeight - vv.height > 120;
      setVp({ h: vv.height, top: vv.offsetTop, kb });
      // iOS scrolls the page to show a focused field; we already moved the field, so undo it.
      if (window.scrollY) window.scrollTo(0, 0);
    };
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
    };
  }, []);
  return vp;
}

export default function Frame({ children }: { children: React.ReactNode }) {
  const vp = useViewport();
  return (
    <div className="stage">
      <div className="frame">
        <div className="device" data-kb={vp.kb || undefined}>
          <div className="ground" aria-hidden />
          <div className="absolute inset-x-0 top-0" style={{ height: vp.h ?? "100%", translate: vp.top ? `0 ${vp.top}px` : undefined, transition: "height 260ms cubic-bezier(0.2, 0.8, 0.2, 1), translate 260ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
            {children}
          </div>
          <StatusBar />
          <div className="frame-only pointer-events-none absolute left-1/2 top-[11px] z-[95] h-[37px] w-[124px] -translate-x-1/2 rounded-full bg-[#050505]" aria-hidden />
          <div className="frame-only pointer-events-none absolute bottom-[8px] left-1/2 z-[95] h-[5px] w-[139px] -translate-x-1/2 rounded-full bg-ink opacity-60" aria-hidden />
        </div>
      </div>
    </div>
  );
}
