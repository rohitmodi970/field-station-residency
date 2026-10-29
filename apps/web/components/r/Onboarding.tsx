"use client";

// The residency's way in. No number, no permission screens: the browser asks for the mic
// when it needs it. The mark paints itself and the app moves on by itself to one page of
// connectors. Then the three questions, as your first conversation with Force, answered by
// recording (tap, talk, tap done) or by typing, and two optional ones about what you can
// offer and what you'd value. Force drafts your Intent Snapshot; you check it, approve it,
// and choose separately whether the residency sees it.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard } from "lucide-react";
import type { Art, Clip } from "@/data/mira";
import { LINKS, QUESTIONS } from "@/data/residency";
import { FIELDS, OFFER_TAGS, SEEK_TAGS, isEmpty } from "@/contract/residency";
import { PARTS } from "./Painted";
import { f } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import PaintedMark from "../f/PaintedMark";
import { BlurBottom } from "../f/Nav";
import VoiceMode from "../f/VoiceMode";
import { AudioBubble, Bubble, Typing } from "../f/Bubbles";
import Glass from "../f/Glass";
import { I, Logo, Paint, haptic } from "../f/ui";
import Persona, { useYouWorld } from "./Persona";
import { LinkList, LookupCard, NameField, OnairosCard } from "./Links";
import Grow from "./Grow";
import PatternWorld from "./PatternWorld";

type Step = "splash" | "connect" | "talk";

function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="press pill-ink h-[52px] w-full justify-center gap-2 t-body font-medium disabled:bg-fill disabled:text-ink-3">
      {children}
    </button>
  );
}

// Steps cross-fade in place: nothing slides, nothing bounces.
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

export default function ResidencyOnboarding() {
  const [step, setStep] = useState<Step>("splash");
  const [painted, setPainted] = useState(false);
  const go = (s: Step) => {
    haptic();
    setStep(s);
  };

  // The splash stays five seconds in all, then moves on by itself (a tap moves on sooner).
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  useEffect(() => {
    if (!painted || step !== "splash") return;
    const id = setTimeout(() => setStep("connect"), Math.max(0, 5000 - (performance.now() - shownAt.current)));
    return () => clearTimeout(id);
  }, [painted, step]);

  return (
    <motion.div className="absolute inset-0 z-[60] flex flex-col bg-canvas" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
      <AnimatePresence mode="wait" initial={false}>
        {step === "splash" && (
          <Screen key="splash">
            <button type="button" onClick={() => painted && go("connect")} className="flex flex-1 flex-col items-center justify-center px-6 text-center" aria-label="Continue">
              <PaintedMark size={236} onDone={() => setPainted(true)} />
              <motion.p className="mt-10 max-w-[330px] t-body text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: painted ? 1 : 0 }} transition={{ duration: 0.3 }}>
                A social intelligence platform
              </motion.p>
            </button>
          </Screen>
        )}
        {step === "connect" && (
          <Screen key="connect">
            <Connect
              onNext={() => {
                r.readPublic();
                go("talk");
              }}
            />
          </Screen>
        )}
        {step === "talk" && (
          <Screen key="talk">
            <Talk
              onNext={() => {
                haptic("done");
                r.finish("people");
              }}
            />
          </Screen>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Connectors: one page ──
// One clean pill per link, its glass bubble holding a crop of a painting and the place's
// mark. Paste the URL and it reads back as the handle. Then Onairos.

function Connect({ onNext }: { onNext: () => void }) {
  const { links, extra, onairos } = useR();
  const filled = LINKS.filter((l) => links[l.kind]?.trim()).length + extra.filter((x) => x.trim()).length;
  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <header className="px-1 pb-6 pt-10">
          <h1 className="t-large text-ink">Connect what&apos;s yours</h1>
          <p className="mt-2 t-body text-ink-3">Your name, then as much as you&apos;d like Force to know before you talk. All of it is optional.</p>
        </header>

        <NameField />
        <OnairosCard className="mt-6" />
        <LookupCard className="mt-2" />
        <LinkList className="mt-2" />
      </div>
      <div className="relative shrink-0 px-4 pb-3 pt-2">
        <BlurBottom />
        <Primary onClick={onNext}>{filled || onairos === "on" ? "Continue" : "Continue without these"}</Primary>
      </div>
    </>
  );
}

// ── The three questions ──

type Line = { id: string; from: "force" | "me"; text?: string; clip?: Clip; map?: boolean };
type Phase = "ask" | "offer" | "seek" | "reading" | "failed" | "done";
const LIMIT = 90;
// The recorder: a glass bubble with the dusk painting in it.
const ORB = { art: "hills" as Art, x: 58, y: 34, size: 76, zoom: 150 };

function Talk({ onNext }: { onNext: () => void }) {
  const name = useR((s) => s.name);
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<Phase>("ask");
  const [voice, setVoice] = useState<{ x: number; y: number; el: HTMLElement | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false); // finished talking; the clip is on its way
  const [needText, setNeedText] = useState(false); // the recording had no words Force could read
  const answers = useRef<string[]>([]);
  const clips = useRef<Clip[]>([]);
  const offer = useRef<string[]>([]);
  const written = useRef<string[]>([]); // answers you typed
  const list = useRef<HTMLUListElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const say = (text: string, delay = 900, extra?: Partial<Line>) =>
    new Promise<void>((res) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setLines((l) => [...l, { id: `f${l.length}${Date.now()}`, from: "force", text, ...extra }]);
        res();
      }, delay);
    });

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const first = name.trim().split(/\s+/)[0];
      const looking = useR.getState().footprint.status === "busy";
      await say(`${first ? `Hi ${first}. ` : ""}Three questions about what you want from the residency. Tap the bubble and talk, or type if you'd rather. About five minutes in all.${looking ? " While we talk, I'm reading what's public about you." : ""}`, 350);
      await say(QUESTIONS[0], 500);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once
  }, []);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [lines, typing]);

  const answered = async (a: { clip?: Clip; text?: string }) => {
    setSaving(false);
    // One answer per question, however it arrives
    if (answers.current.length !== qi) return;
    const answerText = a.clip ? a.clip.transcript : (a.text ?? "");
    console.log(`🎙️ [DATA INTAKE: Question ${qi + 1} Answered]`, {
      question: QUESTIONS[qi],
      source: a.clip ? "VOICE_MICROPHONE_RECORDING" : "KEYBOARD_TYPED_TEXT",
      text: answerText,
      duration: a.clip?.secs ? `${Math.round(a.clip.secs)}s` : undefined,
    });
    setLines((l) => [...l, { id: `me${l.length}${Date.now()}`, from: "me", ...a }]);
    if (a.clip) clips.current = [...clips.current, a.clip];
    // A recording whose words this browser couldn't catch: keep it, and ask for a line typed.
    // Force never fills the gap with words you didn't say.
    if (a.clip && !a.clip.transcript.trim()) {
      setNeedText(true);
      await say("I kept your recording, but couldn't catch the words on this browser. Could you type a line or two?", 400);
      return;
    }
    setNeedText(false);
    if (a.text) written.current = [...written.current, a.text];
    answers.current = [...answers.current, a.clip ? a.clip.transcript : (a.text ?? "")];
    if (qi + 1 < QUESTIONS.length) {
      setQi(qi + 1);
      await say(qi === 0 ? "Thank you. Next one." : "Last one.", 350);
      await say(QUESTIONS[qi + 1], 450);
      return;
    }
    // The two optional contribution questions are off (the team's call), and with the
    // residency over, the snapshot page doesn't ask for them either.
    await say("That's all three. Thank you.", 350);
    await draft();
  };

  // What you offer, then what you'd value. Either can be skipped.
  const contributed = async (picked: string[]) => {
    const offering = phase === "offer";
    if (picked.length) setLines((l) => [...l, { id: `me${l.length}${Date.now()}`, from: "me", text: `${offering ? "I can help with" : "I'd value"} ${listOf(picked)}` }]);
    if (offering) {
      offer.current = picked;
      setPhase("seek");
      await say("And what would you value help with right now?", 400);
      return;
    }
    r.setContribution({ can_offer: offer.current, seeking: picked });
    await draft();
  };

  // The snapshot card goes into the conversation at once and narrates while Force reads.
  const draft = async () => {
    setPhase("reading");
    setLines((l) => (l.some((x) => x.map) ? l : [...l, { id: "map", from: "force", map: true }]));
    r.setAnswers(answers.current, clips.current.filter((c) => c.src));
    await r.synthesize();
    if (useR.getState().synth === "failed") {
      setPhase("failed");
      await say("I couldn't put that together just now. Try again, or I'll make a plain draft straight from your answers.", 300);
      return;
    }
    keep();
  };

  // Your answers are your first moments in memory: recordings as voice notes, typed ones as written.
  const kept = useRef(false);
  const keep = () => {
    if (kept.current) return;
    kept.current = true;
    const audio = clips.current.filter((c) => c.src);
    if (audio.length) f.keepClips(audio);
    f.keepTexts(written.current);
  };

  // The map has finished growing: Force says what to do with it.
  const told = useRef(false);
  const read = async () => {
    if (told.current) return;
    told.current = true;
    await say("Here's what I understand so far. Tap it to check each part: keep what's right, fix what isn't. Nothing is shared until you say so.", 550);
    setPhase("done");
  };

  // The water starts from the middle of the bubble.
  const listen = (el: HTMLElement) => {
    const b = el.getBoundingClientRect();
    const box = root.current?.getBoundingClientRect();
    haptic("soft");
    setVoice({ x: b.left + b.width / 2 - (box?.left ?? 0), y: b.top + b.height / 2 - (box?.top ?? 0), el: root.current });
  };

  return (
    <div ref={root} className="relative flex min-h-0 flex-1 flex-col">
      <ul ref={list} data-scroll="talk" aria-live="polite" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-3 pt-2">
        <li className="flex justify-center pb-5 pt-3" aria-hidden>
          <Logo size={34} className="text-ink" />
        </li>
        {lines.map((m, i) => {
          const prev = lines[i - 1];
          const first = !prev || prev.from !== m.from || !!prev.map;
          const nextL = lines[i + 1];
          const last = !nextL || nextL.from !== m.from || !!nextL.map;
          return (
            <motion.li key={m.id} layout="position" className={`flex ${m.from === "me" ? "justify-end" : "justify-start"} ${first || m.map ? "mt-3" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.28, bounce: 0 }}>
              {m.map ? (
                <MapCard onRead={read} onOpen={() => (haptic("soft"), setOpen(true))} />
              ) : m.clip ? (
                <AudioBubble clip={m.clip} />
              ) : (
                <Bubble from={m.from} joinTop={!first} joinBottom={!last}>
                  {m.text}
                </Bubble>
              )}
            </motion.li>
          );
        })}
        {typing && (
          <li className="mt-3 flex justify-start">
            <Typing />
          </li>
        )}
      </ul>

      {/* Kept out of the photograph the water bends, so the orb never wobbles under itself */}
      <div data-no-shot className="relative shrink-0 px-4 pb-3 pt-1">
        <BlurBottom />
        {phase === "done" ? (
          <Primary onClick={() => (haptic("soft"), setOpen(true))}>Check what Force understood</Primary>
        ) : phase === "ask" ? (
          <Answer key={`${qi}${needText}`} disabled={typing || !!voice || saving} typed={needText} onListen={listen} onAnswer={answered} />
        ) : phase === "offer" || phase === "seek" ? (
          <Contribute key={phase} tags={phase === "offer" ? OFFER_TAGS : SEEK_TAGS} disabled={typing} placeholder={phase === "offer" ? "Or say it in a few words…" : "Or say what would help…"} onDone={contributed} />
        ) : phase === "failed" ? (
          <div className="flex flex-col gap-2">
            <Primary onClick={() => (haptic(), draft())} disabled={typing}>
              Try again
            </Primary>
            <button type="button" disabled={typing} onClick={() => (haptic(), r.useDraft(), keep())} className="press h-11 w-full rounded-full bg-fill t-body font-medium text-ink">
              Use a plain draft from my answers
            </button>
          </div>
        ) : (
          <div className="h-[116px]" />
        )}
      </div>

      <AnimatePresence>
        {voice && (
          <VoiceMode
            key="voice"
            origin={voice}
            shotOf={voice.el}
            limit={LIMIT}
            orb={{ ...ORB, icon: <I.Mic size={26} /> }}
            onStop={() => setSaving(true)}
            onClip={(clip) => answered({ clip: { ...clip, name: `Answer ${qi + 1}` } })}
            onClose={() => setVoice(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{open && <YouPage key="you" onClose={() => setOpen(false)} onContinue={onNext} />}</AnimatePresence>
    </div>
  );
}

// "Skills, An introduction, a mentor" → "skills, an introduction and a mentor"
const listOf = (xs: string[]) => {
  const w = xs.map((x) => (/^[A-Z][a-z]/.test(x) && !/^[A-Z][a-z]+[A-Z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x));
  return w.length > 1 ? `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}` : w[0];
};

// The two optional fields: quick tags you tap on and off, plus a few words of your own.
function Contribute({ tags, placeholder, disabled, onDone }: { tags: readonly string[]; placeholder: string; disabled: boolean; onDone: (picked: string[]) => void }) {
  const [on, setOn] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const picked = [...on, ...(own.trim() ? [own.trim()] : [])];
  const flip = (t: string) => (haptic(), setOn((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t])));
  const done = () => {
    if (disabled) return;
    haptic();
    onDone(picked);
  };
  return (
    <div className="flex flex-col gap-2" style={{ opacity: disabled ? 0.55 : 1, transition: "opacity 300ms" }}>
      <div className="scroll-row no-scrollbar -mx-4 px-4 pb-1" role="group" aria-label="Quick tags">
        {tags.map((t) => (
          <button key={t} type="button" aria-pressed={on.includes(t)} disabled={disabled} onClick={() => flip(t)} className={`press h-10 shrink-0 whitespace-nowrap rounded-full px-4 t-body transition-colors duration-200 ${on.includes(t) ? "chip-on" : "chip"}`}>
            {t}
          </button>
        ))}
      </div>
      <form
        className="flex min-h-[52px] items-end gap-1 rounded-[26px] bg-paper py-[6px] pl-5 pr-[6px]"
        style={{ boxShadow: "var(--lift-1)" }}
        onSubmit={(e) => {
          e.preventDefault();
          done();
        }}
      >
        <Grow value={own} onChange={setOwn} onSend={done} placeholder={placeholder} aria-label={placeholder} enterKeyHint="done" />
        <button type="submit" disabled={disabled} onPointerDown={(e) => e.preventDefault()} className={`press h-10 shrink-0 rounded-full px-4 t-label font-medium ${picked.length ? "bg-ink text-paper" : "bg-fill text-ink-2"}`}>
          {picked.length ? "Done" : "Skip"}
        </button>
      </form>
    </div>
  );
}

// The snapshot, in the conversation, the way the world used to arrive. It goes in as soon as
// Force starts reading and says what it's doing; the map grows out from you once the read is
// back, and only then can you open it.
function MapCard({ onOpen, onRead }: { onOpen: () => void; onRead: () => void }) {
  const world = useYouWorld();
  const snapshot = useR((s) => s.snapshot);
  const synth = useR((s) => s.synth);
  const onairos = useR((s) => s.onairos);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const answers = useR((s) => s.answers);
  const footprint = useR((s) => s.footprint);
  // What Force is doing, with your own words as the receipt.
  const bit = (i: number) => {
    const w = (answers[i]?.split(/\s+/) ?? []).filter(Boolean);
    return w.length ? `"${w.slice(0, 6).join(" ")}${w.length > 6 ? "…" : ""}"` : "";
  };
  const steps = [
    answers[0] ? `Reading ${bit(0)}` : "Reading your three answers.",
    answers[1] ? `Finding the problem under ${bit(1)}` : "Finding the problem underneath.",
    answers[2] ? `Looking at what’s in the way of ${bit(2)}` : "Looking at what’s in the way.",
    onairos === "on" ? "Reading how you work from Onairos." : "Looking for where your approach might lead.",
    footprint.read.length ? "Bringing in what’s public about you." : "Putting the five parts together.",
  ];
  useEffect(() => {
    if (snapshot) return;
    const id = setInterval(() => setStep((x) => Math.min(x + 1, 4)), 2600);
    return () => clearInterval(id);
  }, [snapshot]);
  const filled = snapshot ? PARTS.filter((k) => !isEmpty(snapshot, k)).length : 0;
  return (
    <button type="button" disabled={!ready} onClick={onOpen} className="press block w-full overflow-hidden rounded-[24px] bg-paper text-left disabled:active:scale-100" style={{ boxShadow: "var(--lift-1)" }}>
      <span className="flex h-11 items-center justify-between px-4 pt-1">
        <span className="flex items-center gap-2 t-label font-medium text-ink-2">
          <Paint name="pattern-maps" h={16} /> Intent snapshot
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-fill text-ink transition-opacity duration-300" style={{ opacity: ready ? 1 : 0 }} aria-hidden>
          <I.Expand size={14} />
        </span>
      </span>
      <span className="block h-[240px]">
        <PatternWorld
          nodes={world.nodes}
          edges={world.edges}
          focus={null}
          interactive={false}
          onGrown={
            snapshot
              ? () => {
                  setReady(true);
                  onRead();
                }
              : undefined
          }
        />
      </span>
      <span className="block min-h-[68px] px-4 pb-4">
        {ready && snapshot ? (
          <>
            <span className="block t-body font-semibold text-ink">Here&apos;s what Force understands so far</span>
            <span className="mt-1 block t-label text-ink-3">
              {snapshot.noticed?.length ? `${snapshot.noticed.length} things Force noticed · ` : ""}
              {filled < PARTS.length ? `${PARTS.length - filled} for you to add · ` : ""}tap to check
            </span>
          </>
        ) : (
          <span className="block pt-2 t-label text-ink-3" aria-live="polite">
            {synth === "failed" ? "Waiting for you…" : steps[step]}
          </span>
        )}
      </span>
    </button>
  );
}

// Opened up: your page, pushed over the conversation the iOS way. Back returns to the
// conversation; at the bottom, on to the people.
function YouPage({ onClose, onContinue }: { onClose: () => void; onContinue: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-[75] bg-canvas" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%", transition: { type: "spring", duration: 0.28, bounce: 0 } }} transition={{ type: "spring", duration: 0.36, bounce: 0 }} style={{ boxShadow: "var(--lift-2)" }}>
      <Persona onBack={onClose} onContinue={onContinue} />
    </motion.div>
  );
}

// Answering: the glass bubble. Tap it and the screen turns to water from it while you talk;
// tap anywhere when you're done. No holding, so it's the same on every phone. Or type.
function Answer({ disabled, typed = false, onListen, onAnswer }: { disabled: boolean; typed?: boolean; onListen: (el: HTMLElement) => void; onAnswer: (a: { text: string }) => void }) {
  const [typing, setTypingMode] = useState(typed);
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim() || disabled) return;
    haptic();
    onAnswer({ text: text.trim() });
  };

  if (typing)
    return (
      <form
        className="flex min-h-[52px] items-end gap-1 rounded-[26px] bg-paper py-[6px] pl-5 pr-[6px]"
        style={{ boxShadow: "var(--lift-1)" }}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Grow value={text} onChange={setText} onSend={send} autoFocus placeholder="Type your answer…" aria-label="Your answer" enterKeyHint="send" />
        <button type="button" aria-label="Talk instead" onClick={() => setTypingMode(false)} className="press grid h-10 w-10 shrink-0 place-items-center">
          <Glass {...ORB} size={34}>
            <I.Mic size={15} />
          </Glass>
        </button>
        <button type="submit" aria-label="Send" disabled={!text.trim() || disabled} onPointerDown={(e) => e.preventDefault()} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper disabled:opacity-20">
          <I.Up size={18} />
        </button>
      </form>
    );

  return (
    <div className="flex flex-col items-center" style={{ opacity: disabled ? 0.55 : 1, transition: "opacity 300ms" }}>
      <motion.button
        type="button"
        aria-label="Tap to answer out loud"
        disabled={disabled}
        onClick={(e) => onListen(e.currentTarget)}
        className="rounded-full"
        whileTap={{ scale: 0.94 }}
      >
        <Glass {...ORB}>
          <I.Mic size={26} />
        </Glass>
      </motion.button>
      <p className="mt-3 flex items-center gap-1 t-label text-ink-3">
        Tap and talk
        <span className="text-ink-4">·</span>
        <button type="button" onClick={() => setTypingMode(true)} className="press hit -my-2 flex h-9 items-center gap-1 px-1 font-medium text-ink-2">
          <Keyboard size={14} strokeWidth={1.75} absoluteStrokeWidth aria-hidden /> Type instead
        </button>
      </p>
    </div>
  );
}
