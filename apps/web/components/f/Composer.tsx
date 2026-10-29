"use client";

// The one field. Type, or tap the mic and talk, or + to add photos, video or an audio file.
// While you type, the mic becomes send. While you record, the field becomes your voice.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { f } from "@/lib/f/store";
import { clipFromFile, record, type Recording } from "@/lib/f/audio";
import { I, SPRING, haptic } from "./ui";

const BARS = 28;

export function Live({ rec, since, hint = "Let go to send" }: { rec: Recording; since: number; hint?: string }) {
  const [lv, setLv] = useState<number[]>(() => Array(BARS).fill(0.08));
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 70) {
        last = t;
        const v = rec.level();
        setLv((a) => [...a.slice(1), Math.max(0.08, v)]);
        setSecs((performance.now() - since) / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rec, since]);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="relative flex h-2 w-2 shrink-0">
        <motion.span className="absolute inset-0 rounded-full bg-[#d64545]" animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
      </span>
      <div className="flex h-6 flex-1 items-center justify-between gap-[2px]" aria-hidden>
        {lv.map((v, i) => (
          <span key={i} className="w-[2px] rounded-full bg-ink transition-[height] duration-75" style={{ height: `${Math.round(4 + v * 20)}px`, opacity: 0.25 + (i / BARS) * 0.75 }} />
        ))}
      </div>
      <span className="t-num shrink-0 text-ink-2">
        {Math.floor(secs / 60)}:{String(Math.floor(secs % 60)).padStart(2, "0")}
      </span>
      <span className="hidden shrink-0 t-meta text-ink-3 min-[380px]:block">{hint}</span>
    </div>
  );
}

export default function Composer() {
  const [text, setText] = useState("");
  const [rec, setRec] = useState<{ r: Recording; since: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const media = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const aud = useRef<HTMLInputElement>(null);
  const plusBox = useRef<HTMLDivElement>(null);

  // Tap anywhere else and the menu closes.
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!plusBox.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  // Grow with the words, up to five lines.
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(100, el.scrollHeight)}px`;
  }, [text]);

  const send = () => {
    if (!text.trim()) return;
    haptic();
    f.send(text);
    setText("");
  };

  const startRec = async () => {
    if (starting || rec) return;
    setMenu(false);
    setStarting(true);
    haptic("soft");
    try {
      const r = await record();
      if (!r.real) f.toast("No microphone access, so this records a sample.");
      setRec({ r, since: performance.now() });
    } catch {
      f.toast("Recording isn't available in this browser.");
    } finally {
      setStarting(false);
    }
  };
  const stopping = useRef(false);
  const stopRec = async () => {
    if (!rec || stopping.current) return;
    stopping.current = true;
    haptic("soft");
    const r = rec.r;
    setRec(null);
    setSaving(true);
    try {
      f.addClip(await r.stop());
    } finally {
      stopping.current = false;
      setSaving(false);
    }
  };

  // Tap the mic to record and tap stop to send, or hold it and let go. Tapping works the same
  // on every phone; holding is the shortcut.
  const hold = useRef<{ timer?: ReturnType<typeof setTimeout>; holding: boolean; released: boolean; at: number }>({ holding: false, released: false, at: 0 });
  const [tapped, setTapped] = useState(false);
  const live = useRef<{ r: Recording } | null>(null);
  useEffect(() => {
    live.current = rec ? { r: rec.r } : null;
    // Let go before the mic was ready: stop as soon as it is.
    if (rec && hold.current.released) {
      hold.current.released = false;
      stopRec();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stopRec reads the latest rec
  }, [rec]);
  const holdStart = (e: React.PointerEvent) => {
    if (starting || rec || saving) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    hold.current = { holding: false, released: false, at: performance.now(), timer: setTimeout(() => {
      hold.current.holding = true;
      startRec();
    }, 160) };
  };
  const holdEnd = () => {
    const h = hold.current;
    clearTimeout(h.timer);
    if (!h.holding) {
      setTapped(true);
      return startRec();
    }
    h.holding = false;
    // Let go within half a second: that was a tap, so keep recording until stop is tapped.
    if (performance.now() - h.at < 500) return setTapped(true);
    if (live.current) stopRec();
    else h.released = true;
  };

  const onFiles = async (files: File[], kind: "media" | "audio") => {
    setMenu(false);
    if (!files.length) return;
    for (const file of files) {
      if (kind === "audio" || file.type.startsWith("audio")) {
        try {
          f.addClip(await clipFromFile(file));
        } catch {
          f.toast(`Couldn't read ${file.name}.`);
        }
      }
      else f.addMedia(file.type.startsWith("video") ? "video" : "image", URL.createObjectURL(file), file.name);
    }
  };

  // Copy the files before clearing the input, so picking the same file again still works.
  const pick = (e: React.ChangeEvent<HTMLInputElement>, kind: "media" | "audio") => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    onFiles(files, kind);
  };

  const hasText = text.trim().length > 0;

  const plus = (
    <div ref={plusBox} className="relative grid h-[52px] w-11 shrink-0 place-items-center">
      <motion.button
        type="button"
        aria-label="Add photos, video or audio"
        aria-expanded={menu}
        onClick={() => {
          haptic();
          setMenu((m) => !m);
        }}
        animate={{ rotate: menu ? 45 : 0 }}
        transition={SPRING.ui}
        className="press grid h-9 w-9 place-items-center rounded-full bg-fill text-ink"
      >
        <I.Plus size={20} />
      </motion.button>
      <AnimatePresence>
        {menu && (
          <motion.div
            className="absolute bottom-[60px] left-0 w-60 overflow-hidden rounded-[22px] bg-paper p-[6px]"
            style={{ boxShadow: "var(--lift-2)", transformOrigin: "bottom left" }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={SPRING.ui}
          >
            {/* eslint-disable-next-line react-hooks/refs -- handlers only run on tap */}
            {[
              { label: "Photos & videos", icon: <I.Image size={20} />, go: () => media.current?.click() },
              { label: "Camera", icon: <I.Camera size={20} />, go: () => cam.current?.click() },
              { label: "Audio file", icon: <I.Music size={20} />, go: () => aud.current?.click() },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  setMenu(false);
                  o.go();
                }}
                className="press flex h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left t-body active:bg-fill"
              >
                <span className="text-ink-2">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <input ref={media} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => pick(e, "media")} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e, "media")} />
      <input ref={aud} type="file" accept="audio/*" hidden onChange={(e) => pick(e, "audio")} />
    </div>
  );

  // One white pill, like Wabi: + on the left, the words, then mic or send.
  return (
    <div className="relative z-10 shrink-0 px-4">
      <motion.div className="flex min-h-[52px] items-end rounded-[26px] bg-paper px-1" style={{ boxShadow: "var(--lift-1)" }}>
        {!rec && plus}
        <AnimatePresence mode="popLayout" initial={false}>
          {rec ? (
            <motion.div key="rec" className="flex h-[52px] flex-1 items-center gap-2 pl-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              <button
                type="button"
                aria-label="Cancel recording"
                className="press hit -ml-1 grid h-10 w-10 shrink-0 place-items-center text-ink-3"
                onClick={() => {
                  rec.r.cancel();
                  setRec(null);
                }}
              >
                <I.Close size={16} />
              </button>
              <Live rec={rec.r} since={rec.since} hint={tapped ? "Tap ■ to send" : "Let go to send"} />
            </motion.div>
          ) : (
            <motion.textarea
              key="ta"
              ref={ta}
              rows={1}
              value={text}
              enterKeyHint="send"
              placeholder="Share your thoughts…"
              aria-label="Share your thoughts"
                            onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              className="no-scrollbar block min-h-[52px] flex-1 resize-none bg-transparent py-4 pl-2 t-body text-ink outline-none placeholder:text-ink-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          )}
        </AnimatePresence>

        <div className="relative grid h-[52px] w-11 shrink-0 place-items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {rec ? (
              <motion.button key="stop" type="button" aria-label="Stop and add" onClick={stopRec} className="press grid h-9 w-9 place-items-center rounded-full bg-ink text-paper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                <I.Stop size={12} />
              </motion.button>
            ) : hasText ? (
              <motion.button key="send" type="button" aria-label="Send" onPointerDown={(e) => e.preventDefault()} onClick={send} className="press grid h-9 w-9 place-items-center rounded-full bg-ink text-paper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                <I.Up size={16} />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                type="button"
                aria-label="Record a voice note"
                disabled={saving}
                onPointerDown={(e) => {
                  setTapped(false);
                  holdStart(e);
                }}
                onPointerUp={holdEnd}
                onPointerCancel={() => {
                  // The browser took the touch (a scroll, a system gesture): keep what's
                  // recording going, as a tap, so it's stopped with the stop button.
                  clearTimeout(hold.current.timer);
                  if (hold.current.holding) {
                    hold.current.holding = false;
                    setTapped(true);
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
                className="press hit grid h-9 w-9 touch-none select-none place-items-center text-ink"
                initial={{ opacity: 0 }}
                animate={{ opacity: starting || saving ? 0.35 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <I.Mic size={20} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
