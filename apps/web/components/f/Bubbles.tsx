"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { Clip, Kind } from "@/data/mira";
import { fmtSecs } from "@/lib/f/store";
import { usePlayer } from "@/lib/f/player";
import { I, KIND_ICON, KIND_ONE, Paint, SPRING, haptic } from "./ui";

// Force speaks in soft grey; you speak in ink. Flat, like Wabi: no shadows on messages.
export function Bubble({ from, children, joinTop, joinBottom, onClick }: { from: "me" | "force"; children: React.ReactNode; joinTop?: boolean; joinBottom?: boolean; onClick?: () => void }) {
  const r = 20;
  const j = 6;
  const radius = from === "me" ? `${r}px ${joinTop ? j : r}px ${joinBottom ? j : r}px ${r}px` : `${joinTop ? j : r}px ${r}px ${r}px ${joinBottom ? j : r}px`;
  const cls = `max-w-[290px] whitespace-pre-wrap px-[14px] py-[9px] t-body ${from === "me" ? "bg-ink text-paper" : "bg-fill text-ink"}`;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`press flex items-center gap-2 text-left ${cls}`} style={{ borderRadius: radius }}>
        <span>{children}</span>
        <I.Chevron size={14} className="shrink-0 text-ink-3" />
      </button>
    );
  return (
    <div className={cls} style={{ borderRadius: radius }}>
      {children}
    </div>
  );
}

export function Typing() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-10 items-center gap-[5px] rounded-[20px] bg-fill px-[14px]" role="status" aria-label="Force is writing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-[7px] w-[7px] rounded-full bg-ink-3"
          animate={reduce ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function AudioBubble({ clip, compact }: { clip: Clip; compact?: boolean }) {
  const p = usePlayer(clip);
  return (
    <button
      type="button"
      onClick={p.toggle}
      aria-label={`${p.playing ? "Pause" : "Play"} ${clip.name}`}
      className={`press relative flex items-center gap-3 overflow-hidden text-left ${compact ? "h-14 w-full rounded-[18px] bg-fill px-3" : "min-w-[220px] max-w-[290px] rounded-[20px] bg-ink px-[14px] py-[9px] text-paper"}`}
    >
      <span className={`grid h-6 w-6 shrink-0 place-items-center ${compact ? "text-ink" : ""}`}>{p.playing ? <I.Pause size={16} /> : <I.Wave size={20} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate t-body">{clip.name}</span>
        <span className={`block t-num ${compact ? "text-ink-3" : "opacity-60"}`}>{p.t > 0 ? `${fmtSecs(p.t)} / ${fmtSecs(clip.secs)}` : `Audio · ${fmtSecs(clip.secs)}`}</span>
      </span>
      <span className={`absolute inset-x-0 bottom-0 h-[2px] origin-left ${compact ? "bg-ink" : "bg-paper"}`} style={{ scale: `${p.progress} 1`, opacity: p.t > 0 ? 0.8 : 0 }} />
    </button>
  );
}

export function MediaBubble({ kind, src, name }: { kind: "image" | "video"; src: string; name: string }) {
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  if (kind === "image")
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} draggable={false} className="max-h-[300px] max-w-[240px] rounded-[24px] object-cover" />;
  return (
    <button
      type="button"
      className="press relative overflow-hidden rounded-[24px]"
      onClick={() => {
        const el = v.current;
        if (!el) return;
        if (el.paused) el.play().then(() => setPlaying(true)).catch(() => {});
        else {
          el.pause();
          setPlaying(false);
        }
      }}
      aria-label={playing ? "Pause video" : "Play video"}
    >
      <video ref={v} src={src} playsInline muted loop preload="metadata" className="block max-h-[300px] max-w-[240px] object-cover" />
      {!playing && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-11 w-11 place-items-center rounded-full text-ink backdrop-blur" style={{ background: "rgb(255 255 255 / 0.9)" }}>
            <I.Play size={16} />
          </span>
        </span>
      )}
    </button>
  );
}

// Pull a message to either side to take it further: words go to a thought thread, voice to
// voice signals. The action shows on the side you uncover; pull far, or flick, and it goes
// straight there. Short pulls snap open so you can tap it instead.
export function Swipeable({ kind, onAct, children }: { kind: Kind; onAct: () => void; children: React.ReactNode }) {
  const x = useMotionValue(0);
  const pill = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(150);
  const open = useRef(0); // -1 opened to the left, 1 to the right
  const dragged = useRef(false);
  const g = useRef<{ id: number; x: number; y: number; base: number; dir: "h" | "v" | null; hist: { x: number; t: number }[]; armed: boolean } | null>(null);
  const reveal = useTransform(x, (v) => Math.min(1, Math.max(0, (Math.abs(v) - 10) / (w * 0.8))));
  const scale = useTransform(reveal, [0, 1], [0.85, 1]);
  // Your messages sit against the right edge, so a pull to the right only nudges the bubble
  // (it resists) while the action appears in the open space beside it.
  const shown = useTransform(x, (v) => (v > 0 ? v * 0.16 : v));
  const [side, setSide] = useState<1 | -1>(-1);

  useLayoutEffect(() => {
    if (pill.current) setW(pill.current.offsetWidth + 8);
  }, []);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (open.current && !root.current?.contains(e.target as Node)) {
        open.current = 0;
        animate(x, 0, SPRING.ui);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [x]);

  const rubber = (v: number) => {
    const lim = w * 1.6;
    const a = Math.abs(v);
    return Math.sign(v) * (a < lim ? a : lim + (a - lim) * 0.3);
  };
  const go = () => {
    open.current = 0;
    animate(x, 0, SPRING.ui);
    onAct();
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragged.current = false;
    g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, base: x.get(), dir: null, hist: [{ x: e.clientX, t: e.timeStamp }], armed: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.dir && Math.hypot(dx, dy) > 8) {
      s.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (s.dir === "h") {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
        dragged.current = true;
        window.getSelection()?.removeAllRanges();
      }
    }
    if (s.dir !== "h") return;
    e.preventDefault();
    s.hist.push({ x: e.clientX, t: e.timeStamp });
    if (s.hist.length > 5) s.hist.shift();
    const v = rubber(s.base + dx);
    if (v) setSide(v < 0 ? -1 : 1);
    x.set(v);
    // One tick as you pass the point where letting go takes you straight there.
    const armed = Math.abs(v) > w * 1.4;
    if (armed !== s.armed) {
      s.armed = armed;
      if (armed) haptic();
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const s = g.current;
    g.current = null;
    if (!s || s.dir !== "h") return;
    const h = s.hist;
    const vel = h.length > 1 ? (h[h.length - 1].x - h[0].x) / Math.max(1, h[h.length - 1].t - h[0].t) : 0; // px/ms
    const cur = x.get();
    const dir = Math.sign(cur) || 1;
    const along = vel * dir; // speed in the direction it's open
    if (Math.abs(cur) > w * 1.4 || (along > 1 && Math.abs(cur) > w * 0.5)) {
      haptic("soft");
      animate(x, 0, { ...SPRING.flick, velocity: vel * 1000 });
      open.current = 0;
      onAct();
    } else if (Math.abs(cur) > w * 0.4 || along > 0.35) {
      open.current = dir;
      animate(x, dir * w, { ...SPRING.flick, velocity: vel * 1000 });
    } else {
      open.current = 0;
      animate(x, 0, { ...SPRING.ui, velocity: vel * 1000 });
    }
    void e;
  };

  return (
    <div ref={root} data-swipe className="relative flex max-w-full" style={{ touchAction: "pan-y" }}>
      <motion.button
        ref={pill}
        type="button"
        onClick={go}
        className="pill absolute top-1/2 z-0 h-10 -translate-y-1/2 gap-2 pl-3 pr-4 t-meta"
        style={side < 0 ? { opacity: reveal, scale, right: 0 } : { opacity: reveal, scale, left: -12, zIndex: 2, transformOrigin: "left center" }}
        aria-label={KIND_ONE[kind]}
        tabIndex={-1}
      >
        <Paint name={KIND_ICON[kind]} h={18} />
        <span className="whitespace-nowrap">{KIND_ONE[kind]}</span>
      </motion.button>
      <motion.div
        className="relative z-[1] flex max-w-full select-none"
        style={{ x: shown, WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          g.current = null;
          animate(x, open.current * w, SPRING.ui);
        }}
        onClickCapture={(e) => {
          // A drag isn't a tap: don't let it play the clip underneath.
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
            dragged.current = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </motion.div>
    </div>
  );
}
