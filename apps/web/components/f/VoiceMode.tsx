"use client";

// Voice mode. Hold anywhere on the conversation and the screen becomes water: ripples travel
// out from under your finger across the whole phone, and whatever they pass through (the
// bubbles, the words) curves with them, subtly. Then Force is listening, and every rise in
// your voice sends another ripple from the same point. Tap anywhere to finish.
//
// How: the screen is photographed once (html2canvas), handed to WebGL, and bent by a ripple
// shader. Nothing underneath changes while you talk, so the photograph stays true.

import { useEffect, useRef, useState } from "react";
import type { Clip } from "@/data/mira";
import { f } from "@/lib/f/store";
import { record, type Recording } from "@/lib/f/audio";
import { water, type Water } from "@/lib/f/ripple";
import { I, haptic } from "./ui";
import Glass from "./Glass";
import type { Art } from "@/data/mira";

// orb: the glass bubble the water starts from. It stays exactly where it was, still, above
// the water, and the listening pill gives way to a quiet line over it.
// onStop: you've finished; the clip follows a moment later, once the audio is read.
export default function VoiceMode({ origin, shotOf, onClose, onStop, limit, onClip, orb }: { origin: { x: number; y: number }; shotOf: HTMLElement | null; onClose: () => void; onStop?: () => void; limit?: number; onClip?: (clip: Clip) => void; orb?: { art: Art; x: number; y: number; size: number; zoom?: number; icon?: React.ReactNode } }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [rec, setRec] = useState<Recording | null>(null);
  const [ready, setReady] = useState(false);
  const [settled, setSettled] = useState(false); // the first wave has crossed; now the pill
  const [secs, setSecs] = useState(0);
  const recRef = useRef<Recording | null>(null);
  const done = useRef(false);
  const [sample, setSample] = useState(false); // no microphone: say so quietly, in place
  const [plain, setPlain] = useState(false); // this browser can't bend the screen: rings instead
  const closeRef = useRef(onClose);
  const doneBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Start listening the moment it opens: one recording for the life of voice mode. If it goes
  // away without finishing or cancelling, the microphone is let go.
  useEffect(() => {
    let live = true;
    haptic("done");
    record()
      .then((r) => {
        if (!live) return r.cancel();
        if (!r.real) setSample(true);
        recRef.current = r;
        setRec(r);
      })
      .catch(() => {
        f.toast("Recording isn't available in this browser.");
        closeRef.current();
      });
    doneBtn.current?.focus({ preventScroll: true });
    return () => {
      live = false;
      if (!done.current) recRef.current?.cancel();
    };
  }, []);

  // Photograph the screen, then let the water run.
  useEffect(() => {
    const c = cv.current;
    if (!c || !shotOf) return;
    let w: Water | null = null;
    let raf = 0;
    let live = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // The browser's own renderer photographs the screen (SVG foreignObject). If that fails,
    // html2canvas draws it by hand.
    // Cloned scroll containers forget where they were scrolled to, so the clone's contents are
    // shifted up by the same amount: the photograph shows the conversation where you left it.
    const scrolled = Array.from(shotOf.querySelectorAll<HTMLElement>("[data-scroll]")).map((el) => ({ key: el.dataset.scroll!, top: el.scrollTop }));
    import("modern-screenshot")
      .then(({ domToCanvas }) =>
        domToCanvas(shotOf, {
          scale: dpr,
          backgroundColor: "#f6f5f3",
          filter: (n) => !(n instanceof Element && (n.hasAttribute("data-no-shot") || n.tagName === "NEXTJS-PORTAL")),
          onCloneNode: (cloned) => {
            if (!(cloned instanceof Element)) return;
            scrolled.forEach(({ key, top }) => {
              const el = cloned.querySelector<HTMLElement>(`[data-scroll="${key}"]`);
              if (!el || !top) return;
              el.style.overflow = "hidden";
              Array.from(el.children).forEach((c) => ((c as HTMLElement).style.translate = `0 ${-top}px`));
            });
          },
        }),
      )
      .catch(() =>
        import("html2canvas").then(({ default: html2canvas }) =>
          html2canvas(shotOf, {
            scale: dpr,
            backgroundColor: "#f6f5f3",
            logging: false,
            useCORS: true,
            ignoreElements: (el) => el.hasAttribute("data-no-shot") || el.tagName === "NEXTJS-PORTAL",
          }),
        ),
      )
      .then((shot) => {
        if (!live) return;
        const start = performance.now();
        w = water(c, shot, origin, start);
        if (!w) {
          setPlain(true);
          setSettled(true);
          return;
        }
        setReady(true);
        // The touch, and a softer second ring behind it
        w.ring(1);
        setTimeout(() => w?.ring(0.5), 180);
        setTimeout(() => setSettled(true), 1100);
        let lastVoice = start;
        let lastIdle = start + 400;
        const frame = (now: number) => {
          // The surface keeps moving while Force listens; your voice sends stronger ripples
          const level = recRef.current?.level() ?? 0;
          if (level > 0.3 && now - lastVoice > 220) {
            lastVoice = now;
            lastIdle = now;
            w?.ring(Math.min(0.6, 0.2 + level * 0.5));
          } else if (now - lastIdle > 1300) {
            lastIdle = now;
            w?.ring(0.28);
          }
          w?.frame(now);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      })
      .catch(() => {
        // No photograph (or no WebGL): nothing to bend, so plain rings from the same point.
        setPlain(true);
        setSettled(true);
      });
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      w?.destroy();
    };
  }, [origin, shotOf]);

  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);

  const finish = async () => {
    if (done.current) return;
    done.current = true;
    const r = recRef.current;
    haptic("soft");
    if (r) onStop?.();
    onClose();
    // Finished before the microphone was allowed: say so, instead of losing it silently.
    if (!r) return f.toast("Nothing recorded. Allow the microphone when your browser asks, or type instead.");
    const clip = await r.stop();
    if (onClip) onClip(clip);
    else f.addClip(clip);
  };
  // With a limit, it finishes on its own.
  useEffect(() => {
    if (!limit || !rec || secs < limit) return;
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish is stable for the mount
  }, [secs, limit, rec]);
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    recRef.current?.cancel();
    onClose();
  };

  return (
    <div data-no-shot className="absolute inset-0 z-[70]" onClick={finish} role="dialog" aria-label="Voice mode. Tap anywhere to finish.">
      <canvas ref={cv} className="absolute inset-0 h-full w-full transition-opacity duration-200" style={{ opacity: ready ? 1 : 0 }} aria-hidden />
      {/* Tapping anywhere finishes; this is the same for a keyboard or a screen reader */}
      <button ref={doneBtn} type="button" onClick={(e) => (e.stopPropagation(), finish())} className="sr-only">
        Finish recording
      </button>
      <button
        type="button"
        aria-label="Cancel"
        onClick={(e) => {
          e.stopPropagation();
          cancel();
        }}
        className="press pill absolute right-4 h-11 w-11 justify-center p-0 text-ink"
        style={{ top: "calc(var(--sat) + 10px)" }}
      >
        <I.Close size={18} />
      </button>
      {plain && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="vm-ring absolute rounded-full" style={{ left: origin.x, top: origin.y, animationDelay: `${i * 1.1}s` }} />
          ))}
        </span>
      )}
      {orb && (
        <>
          <span className="pointer-events-none absolute" style={{ left: origin.x, top: origin.y, translate: "-50% -50%" }}>
            <Glass size={orb.size} art={orb.art} x={orb.x} y={orb.y} zoom={orb.zoom ?? 240}>
              {orb.icon}
            </Glass>
          </span>
          {/* Its own pill, so it reads cleanly over whatever the conversation has behind it */}
          <p className="pointer-events-none absolute left-1/2 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center whitespace-nowrap rounded-full bg-paper px-4 py-2 t-label text-ink-2 transition-opacity duration-300" style={{ top: origin.y - orb.size / 2 - 52, opacity: settled ? 1 : 0, boxShadow: "var(--lift-1)" }}>
            {rec ? (
              <>
                <span className="t-num text-ink-3">{limit ? `${Math.max(0, limit - secs)}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}</span>
                <span className="mx-2 text-ink-4">·</span>
                {sample ? "No microphone. Tap to finish." : "Listening · tap anywhere when done"}
              </>
            ) : (
              "One moment"
            )}
          </p>
        </>
      )}
      {/* Once the first wave has crossed, the field becomes the listening pill */}
      <div className="pointer-events-none absolute inset-x-4 flex h-[52px] items-center justify-between rounded-[26px] bg-paper px-5 transition-opacity duration-300" style={{ bottom: "calc(var(--sab) + 8px)", boxShadow: "var(--lift-1)", opacity: settled && !orb ? 1 : 0 }}>
        <span className="flex items-center gap-2 t-body font-medium text-ink">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inset-0 rounded-full ${rec ? "bg-blue" : "bg-ink-4"}`} />
            {rec && <span className="absolute inset-0 animate-ping rounded-full bg-blue opacity-60" />}
          </span>
          {rec ? "Listening" : "One moment"}
          {rec && (
            <span className="t-num text-ink-3">
              {limit ? `${Math.max(0, limit - secs)}s left` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}
            </span>
          )}
        </span>
        <span className="t-label text-ink-3">Tap anywhere to finish</span>
      </div>
    </div>
  );
}
