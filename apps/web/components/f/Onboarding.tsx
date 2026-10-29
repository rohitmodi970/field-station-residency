"use client";

// The first ten minutes, in Force's own language. One thing per screen: a painted hero, a
// title, a line, a black pill. Your number and a code. Then the things Force needs and the
// apps it can read, one at a time. Then the three questions, which are simply your first
// conversation with Force: it asks, you hold anywhere and talk, thirty seconds each, and your
// memory grows from the answers in front of you. It ends where the app begins.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ART_SRC, type Art, type Clip } from "@/data/mira";
import PaintedMark from "./PaintedMark";
import { f, useF } from "@/lib/f/store";
import { AudioBubble, Bubble, Typing } from "./Bubbles";
import Graph3D from "./Graph3D";
import VoiceMode from "./VoiceMode";
import { I, Logo, SPRING, haptic } from "./ui";

type Step = "splash" | "phone" | "code" | "mic" | "bell" | "pin" | "calendar" | "photos" | "notes" | "talk";
const STEPS: Step[] = ["splash", "phone", "code", "mic", "bell", "pin", "calendar", "photos", "notes", "talk"];

// The permission and connection screens: one each, the way Wabi does it.
const ASKS: Record<"mic" | "bell" | "pin" | "calendar" | "photos" | "notes", { art: Art; icon: React.ReactNode; title: string; body: string; button: string; note: string; kind: "permission" | "connect" }> = {
  mic: { art: "dusk", icon: <I.Mic size={22} />, title: "Let Force hear you", body: "So you can hold anywhere and talk, instead of typing.", button: "Allow microphone", note: "Force only listens while you're holding.", kind: "permission" },
  bell: { art: "hills", icon: <I.Bell size={22} />, title: "Let Force nudge you", body: "A quiet note when a move you kept is due. Nothing else.", button: "Allow notifications", note: "You choose which moves to keep. Force never nudges about the rest.", kind: "permission" },
  pin: { art: "meadow", icon: <I.Pin size={22} />, title: "People near you", body: "So the energy map can show who's close, in kilometres, not addresses.", button: "Allow location", note: "Your location is never shown to anyone.", kind: "permission" },
  calendar: { art: "water", icon: <I.Calendar size={22} />, title: "Connect your calendar", body: "Force reads where your time goes, so it can tell the difference between a full week and a good one.", button: "Connect calendar", note: "It reads. It never adds, moves or shares anything.", kind: "connect" },
  photos: { art: "park", icon: <I.Photos size={22} />, title: "Connect your photos", body: "Where you've been and who with. The moments you didn't write down.", button: "Connect photos", note: "Photos stay on your phone. Force keeps only what they tell it.", kind: "connect" },
  notes: { art: "hills", icon: <I.Notes size={22} />, title: "Connect your notes", body: "What you've already written down becomes part of your memory from day one.", button: "Connect notes", note: "Read only, and only the notes you choose.", kind: "connect" },
};

const QUESTIONS = ["What's one thing you keep coming back to lately?", "When did you last feel completely like yourself? Where were you, who was there?", "What do you want more of, that nobody's asked you for?"];
const SECS = 30;

type Line = { id: string; from: "force" | "me"; text?: string; clip?: Clip; world?: boolean };

function Ring({ at, total }: { at: number; total: number }) {
  const R = 11;
  const C = 2 * Math.PI * R;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90" aria-label={`Step ${at + 1} of ${total}`} role="img">
      <circle cx="14" cy="14" r={R} fill="none" stroke="var(--grey-300)" strokeWidth="2.5" />
      <circle cx="14" cy="14" r={R} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (at + 1) / total)} style={{ transition: "stroke-dashoffset 400ms cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
    </svg>
  );
}

function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="press pill-ink h-[52px] w-full justify-center gap-2 t-body font-medium disabled:bg-fill disabled:text-ink-3">
      {children}
    </button>
  );
}

function Screen({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <motion.div key={k} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28, transition: { duration: 0.15 } }} transition={SPRING.move}>
      {children}
    </motion.div>
  );
}

// A painted hero: the painting in a circle, the step's icon riding on it.
function Hero({ art, icon }: { art: Art; icon: React.ReactNode }) {
  return (
    <div className="mx-4 flex aspect-[4/3] items-center justify-center rounded-[28px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
      <div className="relative">
        <span className="block h-[132px] w-[132px] rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${ART_SRC[art]})`, boxShadow: "var(--lift-2)" }} />
        <span className="absolute -bottom-1 -right-1 grid h-12 w-12 place-items-center rounded-full bg-paper text-ink" style={{ boxShadow: "var(--lift-1)" }}>
          {icon}
        </span>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState<Step>("splash");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [resend, setResend] = useState(30);
  const [status, setStatus] = useState<Record<string, "ask" | "busy" | "ok" | "later">>({});
  const [painted, setPainted] = useState(false);
  const at = STEPS.indexOf(step);
  const go = (s: Step) => {
    haptic();
    setStep(s);
  };
  const next = () => go(STEPS[Math.min(STEPS.length - 1, at + 1)]);
  const back = () => go(STEPS[Math.max(0, at - 1)]);
  const toCode = () => {
    setResend(30);
    go("code");
  };

  // Six digits and you're through; the resend timer counts down meanwhile.
  useEffect(() => {
    if (step !== "code") return;
    const id = setInterval(() => setResend((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [step]);
  useEffect(() => {
    if (step === "code" && code.length === 6) {
      const id = setTimeout(() => {
        haptic("done");
        setStep("mic");
      }, 350);
      return () => clearTimeout(id);
    }
  }, [code, step]);

  const ask = async (k: keyof typeof ASKS) => {
    haptic();
    setStatus((s) => ({ ...s, [k]: "busy" }));
    let ok = true;
    try {
      if (k === "mic") {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } else if (k === "bell") ok = typeof Notification !== "undefined" && (await Notification.requestPermission()) === "granted";
      else if (k === "pin") await new Promise<void>((res, rej) => navigator.geolocation.getCurrentPosition(() => res(), () => rej(), { timeout: 8000 }));
      else await new Promise((r) => setTimeout(r, 900)); // connecting an app: simulated for now
    } catch {
      ok = false;
    }
    setStatus((s) => ({ ...s, [k]: ok ? "ok" : "later" }));
    if (ok) haptic("done");
    setTimeout(next, ok ? 500 : 0);
  };

  const digits = phone.replace(/\D/g, "");
  const asking = step in ASKS ? ASKS[step as keyof typeof ASKS] : null;

  return (
    <motion.div className="absolute inset-0 z-[60] flex flex-col bg-canvas" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }} initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.35 } }}>
      {step !== "splash" && step !== "talk" && (
        <header className="flex h-14 shrink-0 items-center justify-between px-4">
          <button type="button" aria-label="Back" onClick={back} className="press pill hit h-11 w-11 justify-center p-0">
            <I.Back size={22} />
          </button>
          <Ring at={at} total={STEPS.length} />
          <button type="button" onClick={next} className="press h-11 px-2 t-label text-ink-3">
            Skip
          </button>
        </header>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {step === "splash" && (
          <Screen k="splash">
            {/* The mark is painted in front of you; then the line, and the way in right under it */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <PaintedMark size={236} onDone={() => setPainted(true)} />
              <motion.p className="mt-10 max-w-[330px] t-body text-ink-2" initial={{ opacity: 0, y: 8 }} animate={painted ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}>
                A companion that builds your longitudinal memory and helps you find your perfect side quest partnerships.
              </motion.p>
              <motion.div className="mt-6 w-full max-w-[280px]" initial={{ opacity: 0, y: 12 }} animate={painted ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }} transition={{ delay: 0.2, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>
                <Primary onClick={() => go("phone")}>Let&apos;s go</Primary>
              </motion.div>
            </div>
          </Screen>
        )}

        {step === "phone" && (
          <Screen k="phone">
            <div className="flex flex-1 flex-col items-center px-6 pt-10 text-center">
              <h1 className="t-title text-ink">What&apos;s your number?</h1>
              <p className="mt-2 t-body text-ink-3">Force texts you a code. Nothing else, ever.</p>
              <label className="mt-8 flex h-14 w-full items-center gap-2 rounded-full bg-paper pl-2 pr-5" style={{ boxShadow: "var(--lift-1)" }}>
                <span className="grid h-10 shrink-0 place-items-center rounded-full bg-fill px-3 t-body text-ink">+91</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel-national" autoFocus placeholder="98765 43210" aria-label="Phone number" enterKeyHint="next" onKeyDown={(e) => e.key === "Enter" && digits.length >= 8 && toCode()} className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
              </label>
            </div>
            <div className="px-4 pb-3">
              <Primary onClick={toCode} disabled={digits.length < 8}>
                Next
              </Primary>
            </div>
          </Screen>
        )}

        {step === "code" && (
          <Screen k="code">
            <div className="flex flex-1 flex-col items-center px-6 pt-10 text-center">
              <h1 className="t-title text-ink">Verify your number</h1>
              <p className="mt-2 t-body text-ink-3">+91 {phone.trim()}</p>
              <button type="button" disabled={resend > 0} onClick={() => (f.toast("Sent again."), setResend(30))} className="press mt-1 h-9 t-label text-ink-3 disabled:opacity-100">
                {resend > 0 ? `Didn't get one? Try again in ${resend}s` : "Send it again"}
              </button>
              <label className="relative mt-8 block w-full">
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus aria-label="Six-digit code" className="absolute inset-0 opacity-0" />
                <span className="flex justify-center gap-2" aria-hidden>
                  {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className={`grid h-[52px] w-[46px] place-items-center rounded-full bg-paper t-title text-ink ${i === code.length ? "ring-2 ring-ink" : ""}`} style={{ boxShadow: "var(--lift-1)" }}>
                      {code[i] ?? (i === code.length ? "–" : "")}
                    </span>
                  ))}
                </span>
              </label>
            </div>
            <div className="px-4 pb-3">
              <Primary onClick={() => go("mic")} disabled={code.length < 6}>
                Next
              </Primary>
            </div>
          </Screen>
        )}

        {asking && (
          <Screen k={step}>
            <div className="flex flex-1 flex-col pt-2">
              <Hero art={asking.art} icon={asking.icon} />
              <div className="px-6 pt-6 text-center">
                <h1 className="t-title text-ink">{asking.title}</h1>
                <p className="mt-2 t-body text-ink-3">{asking.body}</p>
              </div>
              <div className="mx-4 mt-6 rounded-[24px] bg-fill p-4">
                <p className="t-label font-medium text-ink">{asking.kind === "permission" ? "Privacy" : "Sharing"}</p>
                <p className="mt-1 t-label text-ink-3">{status[step] === "ok" ? "Done." : status[step] === "later" ? "Not now. You can allow it later in Settings." : asking.note}</p>
              </div>
            </div>
            <div className="px-4 pb-3">
              <Primary onClick={() => ask(step as keyof typeof ASKS)} disabled={status[step] === "busy"}>
                {status[step] === "ok" ? (
                  <>
                    <I.Check size={18} /> Done
                  </>
                ) : status[step] === "busy" ? (
                  "One moment"
                ) : (
                  asking.button
                )}
              </Primary>
            </div>
          </Screen>
        )}

        {step === "talk" && (
          <Screen k="talk">
            <Talk />
          </Screen>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// The three questions are your first conversation with Force: it asks, you hold anywhere and
// talk. Then it shows you where everything is, in the same conversation.
function Talk() {
  const entries = useF((s) => s.entries);
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [qi, setQi] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [phase, setPhase] = useState<"ask" | "building" | "tour" | "done">("ask");
  const [voice, setVoice] = useState<{ x: number; y: number; el: HTMLElement | null } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const kept = useRef(false);
  const [mine, setMine] = useState<string[]>([]);

  // Force speaks one line at a time, with a pause to think.
  const say = (text: string, delay = 900, extra?: Partial<Line>) =>
    new Promise<void>((res) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setLines((l) => [...l, { id: `${Date.now()}${l.length}`, from: "force", text, ...extra }]);
        res();
      }, delay);
    });

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      await say("Three questions, out loud. Thirty seconds each. Hold anywhere and talk.", 700);
      await say(QUESTIONS[0], 1100);
    })();
     
  }, []);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [lines, typing]);

  const answered = async (clip: Clip) => {
    setLines((l) => [...l, { id: `me${l.length}`, from: "me", clip }]);
    const all = [...clips, clip];
    setClips(all);
    if (qi + 1 < QUESTIONS.length) {
      setQi(qi + 1);
      await say(qi === 0 ? "Good. Next one." : "Last one.", 800);
      await say(QUESTIONS[qi + 1], 900);
      return;
    }
    setPhase("building");
    await say("That's three. Watch.", 800);
    if (!kept.current) {
      kept.current = true;
      setMine(f.keepClips(all));
    }
    setLines((l) => [...l, { id: "world", from: "force", world: true }]);
    await new Promise((r) => setTimeout(r, 3000));
    setPhase("tour");
    await say("This is your memory. Your three answers are already in it, as moments. It's always to your left.", 900);
    await say("Open any moment to add words, photos, video or audio. Pick a few and I'll map the pattern.", 1300);
    await say("To your right is your energy: the people moving the same side quests as you. Names only, until you both say yes.", 1400);
    await say("Hold anywhere and talk to me. That's everything.", 1200);
    setPhase("done");
  };

  // Hold anywhere on the conversation, or press the pill.
  const g = useRef<{ id: number; x: number; y: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const start = (x: number, y: number) => {
    if (phase !== "ask" || typing || voice) return;
    const box = root.current?.getBoundingClientRect();
    setVoice({ x: x - (box?.left ?? 0), y: y - (box?.top ?? 0), el: root.current });
  };
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const s = { id: e.pointerId, x: e.clientX, y: e.clientY, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    s.timer = setTimeout(() => {
      g.current = null;
      haptic("soft");
      start(s.x, s.y);
    }, 420);
    g.current = s;
  };
  const onEnd = () => {
    clearTimeout(g.current?.timer);
    g.current = null;
  };
  const onMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) onEnd();
  };

  return (
    <div ref={root} className="relative flex min-h-0 flex-1 flex-col">
      <ul ref={list} data-scroll="onboarding" aria-live="polite" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-3 pt-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onContextMenu={(e) => e.preventDefault()} style={{ touchAction: "pan-y" }}>
        <li className="flex justify-center pb-5 pt-3" aria-hidden>
          <Logo size={34} className="text-ink" />
        </li>
        <AnimatePresence initial={false}>
          {lines.map((m, i) => {
            const prev = lines[i - 1];
            const first = !prev || prev.from !== m.from || !!prev.world;
            const nextL = lines[i + 1];
            const last = !nextL || nextL.from !== m.from || !!nextL.world;
            return (
              <motion.li key={m.id} layout="position" className={`flex ${m.from === "me" ? "justify-end" : "justify-start"} ${first ? "mt-3" : ""}`} initial={{ opacity: 0, y: 14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING.move} style={{ transformOrigin: m.from === "me" ? "100% 100%" : "0% 100%" }}>
                {m.world ? (
                  <div className="relative h-[320px] w-full overflow-hidden rounded-[24px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
                    <Graph3D entries={entries} marked={mine} focus={null} match={null} fresh={null} onTap={() => {}} onHold={() => {}} inPage />
                  </div>
                ) : m.clip ? (
                  <AudioBubble clip={m.clip} />
                ) : (
                  <Bubble from="force" joinTop={!first} joinBottom={!last}>
                    {m.text}
                  </Bubble>
                )}
              </motion.li>
            );
          })}
          {typing && (
            <motion.li key="typing" className="mt-3 flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
              <Typing />
            </motion.li>
          )}
        </AnimatePresence>
      </ul>

      {/* Where the field would be: how to answer, or the way in */}
      <div className="shrink-0 px-4 pb-2">
        {phase === "done" ? (
          <Primary
            onClick={() => {
              haptic("done");
              f.finishOnboarding();
            }}
          >
            Open Force <I.Arrow size={18} />
          </Primary>
        ) : phase === "ask" ? (
          <button type="button" onClick={(e) => start(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight - 80)} disabled={typing} className="flex h-[52px] w-full items-center gap-3 rounded-[26px] bg-paper pl-5 pr-5 text-left" style={{ boxShadow: "var(--lift-1)", opacity: typing ? 0.5 : 1 }}>
            <I.Mic size={20} className="shrink-0 text-ink" />
            <span className="min-w-0 flex-1 truncate t-body text-ink-3">Hold anywhere and talk</span>
            <span className="t-num text-ink-3">
              {qi + 1} of {QUESTIONS.length} · {SECS}s
            </span>
          </button>
        ) : (
          <div className="h-[52px]" />
        )}
      </div>

      <AnimatePresence>{voice && <VoiceMode key="voice" origin={voice} shotOf={voice.el} limit={SECS} onClip={answered} onClose={() => setVoice(null)} />}</AnimatePresence>
    </div>
  );
}
