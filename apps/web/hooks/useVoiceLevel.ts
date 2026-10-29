import { useEffect, useRef, useState } from 'react';

// Returns a smoothed, scaled voice level [0..1]. Uses separate attack/release
// smoothing to make the meter respond quickly to increases and decay more
// slowly for a pleasing visual effect.
export default function useVoiceLevel(
  stream: MediaStream | null,
  { attack = 0.35, release = 0.85 } = {}
) {
  const [level, setLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufRef = useRef<Float32Array | null>(null);
  const envRef = useRef<number>(0);

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;

    const setup = async () => {
      try {
        const win = window as unknown as {
          AudioContext?: typeof AudioContext
          webkitAudioContext?: typeof AudioContext
        }
        const AudioContextClass = win.AudioContext || win.webkitAudioContext
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const src = ctx.createMediaStreamSource(stream);
        srcRef.current = src;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        src.connect(analyser);

        const buf = new Float32Array(analyser.fftSize);
        bufRef.current = buf;

        const loop = () => {
          if (cancelled) return;
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = buf[i] ?? 0;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);

          // attack/release envelope
          if (rms > envRef.current) {
            envRef.current = attack * envRef.current + (1 - attack) * rms;
          } else {
            envRef.current = release * envRef.current + (1 - release) * rms;
          }

          // non-linear scaling to make visual movement feel larger
          const amplified = Math.sqrt(envRef.current) * 8; // tuned multiplier
          const scaled = Math.min(1, amplified);
          setLevel(scaled);

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error('useVoiceLevel setup failed', err);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (srcRef.current) {
        try { srcRef.current.disconnect(); } catch { /* ignore disconnect errors */ }
        srcRef.current = null;
      }
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch { /* ignore disconnect errors */ }
        analyserRef.current = null;
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch { /* ignore close errors */ }
        audioCtxRef.current = null;
      }
      bufRef.current = null;
      envRef.current = 0;
      setLevel(0);
    };
  }, [stream, attack, release]);

  return level;
}
