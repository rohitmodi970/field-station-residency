"use client";

// The whole app is one light canvas with paper laid over it.
//   Home / companion: the conversation, straight on the canvas.
//   Memory (the world, your side quests, your moments) and the Energy map: full pages that
//   grow out of the two pills at the top of home.
//   Pattern maps: a card that rises over whatever you're on.

import { useEffect, useRef } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue } from "motion/react";
import { f, tapped, useF, type Screen } from "@/lib/f/store";
import Companion from "./Companion";
import EntryView from "./EntryView";
import Memory from "./Memory";
import Energy, { DivePage, DmPage } from "./Energy";
import Onboarding from "./Onboarding";
import Profile from "./Profile";
import { QuestPage } from "./Quests";
import SheetHost from "./Sheet";
import ResidencyOnboarding from "../r/Onboarding";
import Persona from "../r/Persona";
import Residents from "../r/Residents";
import ConnectionPage from "../r/Connection";
import { BlurTop } from "./Nav";
import { useR } from "@/lib/f/residency";
import { SPRING, haptic } from "./ui";

const keyOf = (s: Screen) => ("id" in s ? `${s.name}-${s.id}` : s.name);
// Which side a page belongs to: memory pages close with a sideways swipe. Where a page grows
// from is the spot you tapped (store.from); the corner of its pill is only the fallback.
const surfaceOf = (s: Screen) => (["energy", "dm", "dive", "profile", "force", "persona", "connection"].includes(s.name) ? "energy-surface" : "memory-surface");

function Page({ s }: { s: Screen }) {
  switch (s.name) {
    case "memory":
      return <Memory />;
    case "entry":
      return <EntryView id={s.id} />;
    case "quest":
      return <QuestPage id={s.id} />;
    case "energy":
      return <Energy focus={s.focus} />;
    case "dive":
      return <DivePage id={s.id} from={s.from} />;
    case "dm":
      return <DmPage id={s.id} />;
    case "profile":
      return <Profile />;
    case "force":
      return <Companion bare />;
    case "persona":
      return <Persona />;
    case "connection":
      return <ConnectionPage id={s.id} say={s.say} />;
  }
}

function Panel() {
  const stack = useF((s) => s.stack);
  const from = useF((s) => s.from);
  const top = stack[stack.length - 1];
  // Memory sits to the left of the chat: swipe it back to the left and it follows your finger
  // off the screen. Every other page goes back the iOS way, from the left edge.
  const dir = -1;
  const pageSwipe = !!top && surfaceOf(stack[0]) === "memory-surface";
  const x = useMotionValue(0);
  const g = useRef<{ id: number; x0: number; y0: number; edge: boolean; on: boolean | null; hist: { x: number; t: number }[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const start = (e: React.PointerEvent, edge: boolean) => {
    if (!edge && (!pageSwipe || (e.target as HTMLElement).closest("canvas, .scroll-row, [data-swipe], input, textarea, [role=dialog], [draggable=true]"))) return;
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, edge, on: edge ? true : null, hist: [{ x: e.clientX, t: e.timeStamp }] };
    if (edge)
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
  };
  const onMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (s.on === null) {
      if (Math.hypot(dx, dy) < 12) return;
      // Only a clearly sideways pull, in the closing direction, takes the page
      s.on = Math.abs(dx) > Math.abs(dy) * 1.6 && Math.sign(dx) === dir;
      if (!s.on) {
        g.current = null;
        return;
      }
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    }
    s.hist.push({ x: e.clientX, t: e.timeStamp });
    if (s.hist.length > 5) s.hist.shift();
    const d = s.edge ? Math.max(0, dx) : dir > 0 ? Math.max(0, dx) : Math.min(0, dx);
    x.set(d);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = g.current;
    g.current = null;
    if (!s || s.id !== e.pointerId || !s.on) return;
    const w = box.current?.clientWidth ?? 393;
    const h = s.hist;
    const vel = h.length > 1 ? (h[h.length - 1].x - h[0].x) / Math.max(1, h[h.length - 1].t - h[0].t) : 0;
    const way = s.edge ? 1 : dir;
    if (Math.abs(x.get()) > w * 0.3 || vel * way > 0.6) {
      haptic("soft");
      animate(x, way * w, { ...SPRING.move, velocity: vel * 1000 }).then(() => {
        f.pop();
        x.set(0);
      });
    } else animate(x, 0, { ...SPRING.ui, velocity: vel * 1000 });
  };

  return (
    <AnimatePresence>
      {top && (
        <motion.div
          key="paper"
          ref={box}
          className="absolute inset-0 z-20 overflow-hidden bg-canvas"
          style={{ transformOrigin: from ? `${from.x}px ${from.y}px` : surfaceOf(stack[0]) === "energy-surface" ? "100% 0%" : "0% 0%", borderRadius: 36 }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, borderRadius: 0 }}
          exit={{ scale: 0.5, opacity: 0, borderRadius: 36, transition: { type: "spring", duration: 0.26, bounce: 0 } }}
          transition={SPRING.surface}
        >
          {stack.length > 1 && <div className="absolute inset-0 bg-canvas opacity-60" aria-hidden />}
          <motion.div key={keyOf(top)} className="absolute inset-0 bg-canvas" style={{ paddingTop: top.name === "dive" || top.name === "force" ? 0 : "var(--sat)", paddingBottom: top.name === "dive" || top.name === "force" ? 0 : "var(--sab)", x }} onPointerDown={(e) => start(e, false)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <Page s={top} />
          </motion.div>
          <div className="absolute inset-y-0 left-0 z-30 w-3" style={{ touchAction: "pan-y" }} onPointerDown={(e) => start(e, true)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Toast() {
  const toast = useF((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => f.clearToast(), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div key="toast" className="pointer-events-none absolute inset-x-0 top-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }} transition={{ duration: 0.18 }}>
          {/* What's underneath blurs away, so the message reads as sitting above the page */}
          <BlurTop height={128} />
          <div className="absolute inset-x-0 flex justify-center px-4" style={{ top: "calc(var(--sat) + 64px)" }}>
            <motion.div
              key={toast.key}
              role="status"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={SPRING.ui}
              className="pointer-events-auto flex h-11 max-w-full items-center rounded-full px-5 t-label font-medium text-ink backdrop-blur-xl"
              style={{ background: "rgb(255 255 255 / 0.82)", boxShadow: "var(--lift-2)" }}
            >
              <span className="truncate">{toast.text}</span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// residency: the build for the residency. Home is the conversations, not the chat, and the
// way in is its own (connectors, three questions, the persona, people like you).
export default function App({ residency = false }: { residency?: boolean }) {
  const open = useF((s) => s.stack.length > 0);
  const sheet = useF((s) => !!s.sheet);
  const onboarded = useF((s) => s.onboarded);
  const rDone = useR((s) => s.done);
  // Escape closes the top-most layer: a sheet, then the paper.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const st = useF.getState();
      if (st.sheet) f.closeSheet();
      else if (st.stack.length) f.pop();
    };
    window.addEventListener("keydown", on);
    // Remember where each touch lands, in the app's own coordinates, so a page can grow from it.
    const touch = (e: PointerEvent) => {
      const r = document.querySelector("[data-app]")?.getBoundingClientRect();
      if (!r) return;
      tapped.x = e.clientX - r.left;
      tapped.y = e.clientY - r.top;
    };
    document.addEventListener("pointerdown", touch, true);
    return () => {
      window.removeEventListener("keydown", on);
      document.removeEventListener("pointerdown", touch, true);
    };
  }, []);
  return (
    <LayoutGroup>
      <motion.div data-app className="absolute inset-0" animate={{ scale: open ? 0.96 : 1, opacity: open ? 0 : 1 }} transition={SPRING.move} aria-hidden={open || sheet || (residency && !rDone)} inert={open || sheet || (residency && !rDone)}>
        {residency ? <Residents /> : <Companion />}
      </motion.div>
      <div inert={sheet} aria-hidden={sheet || undefined}>
        <Panel />
      </div>
      <SheetHost />
      <Toast />
      <AnimatePresence>{residency ? !rDone && <ResidencyOnboarding key="residency" /> : !onboarded && <Onboarding key="onboarding" />}</AnimatePresence>
    </LayoutGroup>
  );
}
