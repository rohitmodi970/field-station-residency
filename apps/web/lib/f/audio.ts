"use client";

// Recording in the browser. The microphone is real when it's allowed: we keep the audio, draw
// the live level, and read energy and pauses from the recording itself. Words come from the
// browser's speech recognition where it exists. When either isn't available, the prototype
// falls back to a sample so the flow still works.

import { SAMPLE_CLIP, USUAL, type Clip, type Moment } from "@/data/mira";

let seq = 0;
const clipId = () => `c${Date.now().toString(36)}${(++seq).toString(36)}`;
const noteName = () => `Voice note ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.m4a`;
const newContext = () => new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

type SR = {
  start(): void;
  stop(): void;
  abort(): void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
};

export interface Recording {
  level: () => number; // 0..1, live
  stop: () => Promise<Clip>;
  cancel: () => void;
  real: boolean;
}

export async function record(): Promise<Recording> {
  const started = performance.now();
  let words = "";

  const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  let sr: SR | null = null;

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    stream = null;
  }

  if (!stream) {
    // Simulated: a believable level so the waveform still breathes.
    let t = 0;
    return {
      real: false,
      level: () => {
        t += 0.12;
        return 0.25 + 0.35 * Math.abs(Math.sin(t) * Math.sin(t * 0.37 + 1));
      },
      stop: async () => sampleClip((performance.now() - started) / 1000),
      cancel: () => {},
    };
  }

  // Anything below can throw on an older browser; if it does, let go of the mic.
  let ctx: AudioContext;
  let an: AnalyserNode;
  let mr: MediaRecorder;
  const chunks: Blob[] = [];
  try {
    ctx = newContext();
    const src = ctx.createMediaStreamSource(stream);
    an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t));
    mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.start(250);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    throw err;
  }
  const buf = new Uint8Array(an.fftSize);

  if (Rec) {
    try {
      sr = new Rec();
      sr.continuous = true;
      sr.interimResults = false;
      sr.lang = "en-IN";
      sr.onresult = (e) => {
        words = Array.from(e.results)
          .map((r) => r[0].transcript)
          .join(" ");
      };
      sr.onerror = () => {};
      sr.start();
    } catch {
      sr = null;
    }
  }

  const end = () => {
    stream?.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };

  let stopping: Promise<Clip> | null = null;
  return {
    real: true,
    level: () => {
      an.getByteTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        s += v * v;
      }
      return Math.min(1, Math.sqrt(s / buf.length) * 4.5);
    },
    cancel: () => {
      try {
        sr?.abort();
        mr.stop();
      } catch {}
      end();
    },
    // Stopping twice returns the same clip instead of hanging.
    stop: () =>
      (stopping ??= new Promise<Clip>((resolve) => {
        try {
          sr?.stop();
        } catch {}
        mr.onstop = async () => {
          end();
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/mp4" });
          const secs = (performance.now() - started) / 1000;
          const url = URL.createObjectURL(blob);
          // Give recognition a moment to deliver its last words.
          await new Promise((r) => setTimeout(r, 450));
          const read = await readSignals(blob).catch(() => null);
          // Only ever her own words: if nothing was transcribed, there's no transcript.
          const transcript = words.trim();
          const n = transcript ? transcript.split(/\s+/).length : 0;
          const pace = read && n ? Math.round(n / Math.max(0.1, read.speaking / 60)) : 0;
          if (!read) {
            resolve({ id: clipId(), name: noteName(), secs, transcript, energy: [0.4, 0.5, 0.45, 0.5, 0.4], pace, pauses: 0, longest: 0, moments: [], src: url, blob });
            return;
          }
          resolve({
            id: clipId(),
            name: noteName(),
            secs,
            transcript,
            energy: read.energy,
            pace,
            pauses: read.pauses,
            longest: read.longest,
            moments: momentsFrom(read, transcript, secs, pace),
            src: url,
            blob,
          });
        };
        try {
          mr.stop();
        } catch {
          end();
        }
      })),
  };
}

// Without a microphone (or permission) the prototype records a clearly-labelled sample.
function sampleClip(secs: number): Clip {
  const s = Math.max(secs, 28);
  return {
    ...SAMPLE_CLIP,
    id: clipId(),
    name: "Sample voice note.m4a",
    secs: s,
    moments: SAMPLE_CLIP.moments.map((m) => ({ ...m, t: Math.min(s - 2, (m.t / 30) * s) })),
  };
}

// Energy across the clip, and where the silences are, from the audio itself.
async function readSignals(blob: Blob) {
  const ac = newContext();
  let ab: AudioBuffer;
  try {
    ab = await ac.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ac.close().catch(() => {});
  }
  const ch = ab.getChannelData(0);
  const win = Math.floor(ab.sampleRate * 0.05); // 50ms
  const rms: number[] = [];
  for (let i = 0; i + win < ch.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += ch[j] * ch[j];
    rms.push(Math.sqrt(s / win));
  }
  const peak = Math.max(...rms, 1e-4);
  const norm = rms.map((v) => v / peak);
  const quiet = 0.12;
  let pauses = 0;
  let longest = 0;
  let run = 0;
  let speaking = 0;
  let longestAt = 0;
  norm.forEach((v, i) => {
    if (v < quiet) run++;
    else {
      speaking++;
      if (run * 0.05 >= 0.6) {
        pauses++;
        if (run * 0.05 > longest) {
          longest = run * 0.05;
          longestAt = i * 0.05;
        }
      }
      run = 0;
    }
  });
  const N = 26;
  const energy = Array.from({ length: N }, (_, k) => {
    const a = Math.floor((k / N) * norm.length);
    const b = Math.max(a + 1, Math.floor(((k + 1) / N) * norm.length));
    const sl = norm.slice(a, b);
    return Math.min(1, (sl.reduce((s, v) => s + v, 0) / sl.length) * 1.6);
  });
  return { energy, pauses, longest: Math.round(longest * 10) / 10, longestAt, speaking: speaking * 0.05 };
}

function momentsFrom(read: { energy: number[]; longest: number; longestAt: number }, transcript: string, secs: number, pace: number): Moment[] {
  const words = transcript.split(/\s+/);
  const at = (t: number) => {
    if (!transcript) return "";
    const i = Math.max(0, Math.min(words.length - 3, Math.round((t / secs) * words.length)));
    return words.slice(i, i + 4).join(" ").replace(/[.,!?]$/, "");
  };
  const out: Moment[] = [];
  const hi = read.energy.indexOf(Math.max(...read.energy));
  out.push({ t: (hi / read.energy.length) * secs, kind: "lift", phrase: at((hi / read.energy.length) * secs), note: "Where your voice carried the most energy." });
  if (read.longest >= 0.8) out.push({ t: read.longestAt, kind: "pause", phrase: at(read.longestAt), note: `The longest pause, ${read.longest} seconds, came right before this.` });
  if (pace < USUAL.pace - 15) out.push({ t: secs * 0.8, kind: "slow", phrase: at(secs * 0.8), note: `Slower than you usually speak, at ${pace} words a minute.` });
  return out.sort((a, b) => a.t - b.t);
}

// An audio file someone adds. We read its energy and pauses; the prototype can't transcribe a file.
export async function clipFromFile(file: File): Promise<Clip> {
  const src = URL.createObjectURL(file);
  const secs = await new Promise<number>((r) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => r(isFinite(a.duration) ? a.duration : 30);
    a.onerror = () => r(30);
    a.src = src;
  });
  const read = await readSignals(file).catch(() => null);
  return {
    id: clipId(),
    name: file.name,
    secs,
    transcript: "",
    energy: read?.energy ?? [0.4, 0.45, 0.4, 0.45, 0.4],
    pace: 0,
    pauses: read?.pauses ?? 0,
    longest: read?.longest ?? 0,
    moments: read
      ? [
          { t: (read.energy.indexOf(Math.max(...read.energy)) / read.energy.length) * secs, kind: "lift", phrase: "", note: "Where your voice carried the most energy." },
          ...(read.longest >= 0.8 ? [{ t: read.longestAt, kind: "pause" as const, phrase: "", note: `The longest pause, ${read.longest} seconds.` }] : []),
        ]
      : [],
    src,
  };
}
