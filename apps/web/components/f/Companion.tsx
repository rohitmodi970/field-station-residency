"use client";

// Home is the conversation with Force. A hello, a few replies you can tap, and the field:
// type, or hold the mic and talk. Hold anywhere on the conversation and voice mode runs out
// from under your finger. Hold a message to map it. Everything you say is kept as a moment on
// the side quest it belongs to; there's nothing to save. Memory is to the left (its pill, or
// a swipe to the right); the Energy map and You open from their pills.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MIRA_FACE, PEOPLE } from "@/data/social";
import { f, useF, type Msg } from "@/lib/f/store";
import { AudioBubble, Bubble, MediaBubble, Swipeable, Typing } from "./Bubbles";
import Composer from "./Composer";
import Face from "./Face";
import { BlurTop } from "./Nav";
import VoiceMode from "./VoiceMode";
import { I, Logo, Paint, SPRING, haptic } from "./ui";

// The two places you can go. Memory on the left, the Energy map on the right.
function TopPill({ to, label, icon, flip }: { to: "memory" | "energy"; label: string; icon: React.ReactNode; flip?: boolean }) {
  return (
    <button type="button" onClick={() => f.push({ name: to })} className={`press pill h-11 gap-2 t-body font-medium ${flip ? "flex-row-reverse pl-4 pr-[6px]" : "pl-[6px] pr-4"}`}>
      {icon}
      {label}
    </button>
  );
}

function EnergyIcon() {
  return (
    <span className="relative block h-[30px] w-10">
      <span className="absolute left-0 top-0">
        <Face face={PEOPLE[0].face} size={30} />
      </span>
      <span className="absolute left-[10px] top-0 rounded-full ring-2 ring-paper">
        <Face face={PEOPLE[2].face} size={30} />
      </span>
    </span>
  );
}

function Message({ m, first, lastOfGroup, gap }: { m: Msg; first: boolean; lastOfGroup: boolean; gap: boolean }) {
  const reduce = useReducedMotion();
  const mine = m.from === "me";
  let body: React.ReactNode;
  if (m.kind === "typing") body = <Typing />;
  else if (m.kind === "note")
    body = (
      <button type="button" onClick={() => (m.quest ? f.push({ name: "quest", id: m.quest }) : f.push({ name: "memory" }))} className="press flex h-8 items-center gap-[6px] pl-1 t-meta text-ink-3">
        <Logo size={12} className="text-ink-3" />
        {m.text}
        <I.Chevron size={14} />
      </button>
    );
  else if (m.from === "force")
    body = (
      <Bubble from="force" joinTop={!first} joinBottom={!lastOfGroup}>
        {m.text}
      </Bubble>
    );
  else if (m.kind === "text")
    body = (
      <Swipeable kind="pattern" onAct={() => f.open({ label: "One message", entryIds: [], text: m.text })}>
        <span data-msg={m.id} className="flex">
          <Bubble from="me" joinTop={!first} joinBottom={!lastOfGroup}>
            {m.text}
          </Bubble>
        </span>
      </Swipeable>
    );
  else if (m.kind === "audio")
    body = (
      <Swipeable kind="voice" onAct={() => f.open({ label: m.clip.name, entryIds: [], text: m.clip.transcript, clips: [m.clip] }, undefined, "voice")}>
        <span data-msg={m.id} className="flex">
          <AudioBubble clip={m.clip} />
        </span>
      </Swipeable>
    );
  else
    body = (
      <Swipeable kind="pattern" onAct={() => f.open(f.chatScope())}>
        <span data-msg={m.id} className="flex">
          <MediaBubble kind={m.kind} src={m.src} name={m.name} />
        </span>
      </Swipeable>
    );

  return (
    <>
      <motion.li
        layout="position"
        className={`flex flex-col ${mine ? "items-end" : "items-start"} ${gap ? "mt-3" : ""}`}
        style={{ transformOrigin: mine ? "100% 100%" : "0% 100%" }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={SPRING.move}
      >
        {body}
      </motion.li>
    </>
  );
}

// bare: opened as a page (the residency), so a back button and Memory instead of the home pills.
export default function Companion({ bare = false }: { bare?: boolean }) {
  const chat = useF((s) => s.chat);
  const list = useRef<HTMLUListElement>(null);
  // The newest of Force's messages, if it came with replies you can tap.
  const lastForce = [...chat].reverse().find((m) => m.from === "force" && m.kind === "text");
  const quick = lastForce && lastForce.from === "force" && lastForce.kind === "text" && lastForce.options?.length ? { id: lastForce.id, options: lastForce.options } : null;
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [voice, setVoice] = useState<{ x: number; y: number; el: HTMLElement | null } | null>(null);

  useEffect(() => {
    f.openChat();
  }, []);

  // Keep the newest message in view, including when the keyboard opens and the list shrinks.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const down = () => el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    down();
    const ro = new ResizeObserver(down);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chat.length, reduce]);

  // One gesture on the conversation: swipe right to pull in Memory;
  // hold still to start voice mode, or to map the message under your finger.
  const g = useRef<{ id: number; x: number; y: number; moved: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, [data-swipe]")) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-msg]");
    const box = root.current?.getBoundingClientRect();
    const s = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    s.timer = setTimeout(() => {
      if (s.moved) return;
      g.current = null;
      haptic("soft");
      if (target) {
        const m = useF.getState().chat.find((x) => x.id === target.dataset.msg);
        if (!m || m.from !== "me") return;
        if (m.kind === "text") f.open({ label: "One message", entryIds: [], text: m.text });
        else if (m.kind === "audio") f.open({ label: m.clip.name, entryIds: [], text: m.clip.transcript, clips: [m.clip] });
        else f.open(f.chatScope());
      } else if (!bare) setVoice({ x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0), el: root.current });
    }, 420);
    g.current = s;
  };
  const onMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) > 10) {
      s.moved = true;
      clearTimeout(s.timer);
    }
    if (s.moved && dx > 64 && dx > Math.abs(dy) * 1.5) {
      g.current = null;
      haptic("soft");
      f.push({ name: "memory" });
    }
  };
  const onUp = () => {
    clearTimeout(g.current?.timer);
    g.current = null;
  };

  return (
    <div ref={root} className="absolute inset-0 flex flex-col overflow-hidden bg-canvas" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
      <div data-no-shot>
        <BlurTop height={76} />
      </div>
      {bare ? (
        <header data-no-shot className="absolute inset-x-0 z-[2] flex h-[60px] items-center justify-between px-4 pt-2" style={{ top: "var(--sat)" }}>
          <button type="button" aria-label="Back" onClick={() => f.pop()} className="press pill hit h-11 w-11 justify-center p-0">
            <I.Back size={22} />
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 t-nav text-ink">Force</h1>
          <button type="button" onClick={() => (haptic(), f.push({ name: "memory" }))} className="press pill h-11 gap-2 pl-3 pr-4 t-label font-medium">
            <Paint name="memory" h={18} /> Memory
          </button>
        </header>
      ) : (
      <header data-no-shot className="absolute inset-x-0 z-[2] flex h-[60px] items-center justify-between px-4 pt-2" style={{ top: "var(--sat)" }}>
        <TopPill to="memory" label="Memory" icon={<Face face={MIRA_FACE} size={30} />} />
        <span className="flex items-center gap-2">
          <TopPill to="energy" label="Energy" icon={<EnergyIcon />} flip />
          <button type="button" aria-label="You" onClick={() => f.push({ name: "profile" })} className="press pill h-11 w-11 justify-center p-0">
            <Face face={MIRA_FACE} size={34} />
          </button>
        </span>
      </header>
      )}

      <ul
        ref={list}
        aria-live="polite"
        aria-label="Conversation"
        data-scroll="chat"
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-3 pt-[84px]"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The mark leads the conversation and scrolls away with it */}
        <li className="flex justify-center pb-5 pt-3" aria-hidden>
          <Logo size={34} className="text-ink" />
        </li>
        <AnimatePresence initial={false}>
          {chat.map((m, i) => {
            const prev = chat[i - 1];
            const next = chat[i + 1];
            const first = !prev || prev.from !== m.from || prev.kind === "note";
            const lastOfGroup = !next || next.from !== m.from || next.kind === "note";
            return <Message key={m.id} m={m} first={first} lastOfGroup={lastOfGroup} gap={i > 0 && first} />;
          })}
        </AnimatePresence>
      </ul>

      {/* Replies you can tap sit just above the field, where your thumb already is */}
      <AnimatePresence initial={false}>
        {quick && (
          <motion.div key={quick.id} className="scroll-row no-scrollbar relative z-10 shrink-0 pb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.2 }}>
            {quick.options.map((o) => (
              <button key={o.label} type="button" onClick={() => f.pick(o)} className="press pill h-10 shrink-0 gap-1 whitespace-nowrap pl-4 pr-3 t-body">
                {o.label}
                <I.Chevron size={16} className={o.go ? "text-ink-4" : "hidden"} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <Composer />
      <div aria-hidden className="h-2 shrink-0" />

      <AnimatePresence>{voice && <VoiceMode key="voice" origin={voice} shotOf={voice.el} onClose={() => setVoice(null)} />}</AnimatePresence>
    </div>
  );
}
