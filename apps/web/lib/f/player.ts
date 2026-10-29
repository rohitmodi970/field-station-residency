"use client";

// One player for the whole app, so starting a clip stops the last one. Real recordings play
// their audio; the seeded clips play silently with the same progress, so every screen behaves.

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Clip } from "@/data/mira";

type St = { id: string | null; playing: boolean };
let st: St = { id: null, playing: false };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let audio: HTMLAudioElement | null = null;
let raf = 0;
let startAt = 0;
let offset = 0;
let current: Clip | null = null;

function tick() {
  if (!current || !st.playing) return;
  if (!current.src && now() >= current.secs) {
    stop();
    return;
  }
  emit();
  raf = requestAnimationFrame(tick);
}
const now = () => (audio && current?.src ? audio.currentTime : offset + (performance.now() - startAt) / 1000);

export function play(clip: Clip, from?: number) {
  if (current?.id !== clip.id) {
    stop();
    current = clip;
    offset = 0;
    if (clip.src) {
      audio = new Audio(clip.src);
      audio.onended = () => stop();
      audio.onerror = () => stop();
    }
  }
  if (from !== undefined) offset = from;
  if (audio && clip.src) {
    if (from !== undefined) audio.currentTime = from;
    audio.play().catch(() => stop());
  }
  startAt = performance.now();
  st = { id: clip.id, playing: true };
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
  emit();
}

export function pause() {
  if (!current) return;
  offset = now();
  audio?.pause();
  st = { ...st, playing: false };
  cancelAnimationFrame(raf);
  emit();
}

export function stop() {
  audio?.pause();
  audio = null;
  cancelAnimationFrame(raf);
  offset = 0;
  current = null;
  st = { id: null, playing: false };
  emit();
}

export function usePlayer(clip: Clip) {
  const s = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => st,
    () => st,
  );
  const mine = s.id === clip.id;
  const [, force] = useState(0);
  useEffect(() => {
    if (!mine || !s.playing) return;
    const fn = () => force((x) => x + 1);
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  }, [mine, s.playing]);
  // Leaving the screen stops what it was playing.
  useEffect(() => () => {
    if (current?.id === clip.id) stop();
  }, [clip.id]);
  const t = mine ? now() : 0;
  return {
    playing: mine && s.playing,
    t,
    progress: mine ? Math.min(1, t / clip.secs) : 0,
    toggle: () => (mine && s.playing ? pause() : play(clip)),
    seek: (sec: number) => play(clip, sec),
  };
}
