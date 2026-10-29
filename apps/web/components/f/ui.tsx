"use client";

// Shared pieces: motion values, line icons, the tool icons, the logo.

import type { Kind } from "@/data/mira";
import {
  ArrowUp, AudioLines, Bold, Camera, Check, ChevronLeft, ChevronRight, Clipboard, Globe, Image as ImageIcon, Link, List, ListFilter,
  Maximize2, Mic, Music, Pause, Play, Plus, Redo2, Square, Undo2, Video, X, Italic, Underline, Strikethrough, LocateFixed, CalendarDays, Minimize2, List as Bullets, ListOrdered, Highlighter, KeyboardOff, Spline, Waypoints, Orbit, PenLine, Search, NotebookPen, Images, Bell, Phone, ArrowRight, MapPin, Pencil, type LucideIcon,
} from "lucide-react";

// ── Motion ──
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const SPRING = {
  ui: { type: "spring" as const, duration: 0.32, bounce: 0 }, // small things: pills, toggles
  move: { type: "spring" as const, duration: 0.5, bounce: 0 }, // things travelling across the screen
  surface: { type: "spring" as const, duration: 0.55, bounce: 0.04 }, // a panel growing from a pill
  flick: { type: "spring" as const, duration: 0.4, bounce: 0.18 }, // after a gesture carried momentum
};

// ── Tool icons ──
// The light version draws these as line icons. Her painted icons (public/icons) come back
// when we get to materials.
export type PaintName = "thought-threads" | "pattern-maps" | "voice-signals" | "memory" | "journal-entry";
export const KIND_ICON: Record<Kind, PaintName> = { thread: "thought-threads", pattern: "pattern-maps", voice: "voice-signals" };
export const KIND_NAME: Record<Kind, string> = { thread: "Thought threads", pattern: "Pattern maps", voice: "Voice signals" };
export const KIND_ONE: Record<Kind, string> = { thread: "Thought thread", pattern: "Pattern map", voice: "Your voice" };

const PAINT: Record<PaintName, LucideIcon> = { "thought-threads": Spline, "pattern-maps": Waypoints, "voice-signals": AudioLines, memory: Orbit, "journal-entry": PenLine };

export function Paint({ name, h = 20, className = "" }: { name: PaintName; h?: number; className?: string }) {
  const C = PAINT[name];
  return <C size={h} strokeWidth={1.75} absoluteStrokeWidth className={`block shrink-0 ${className}`} aria-hidden />;
}

// ── Line icons: Lucide, at one stroke weight everywhere ──
type P = { size?: number; className?: string };
const L = (C: LucideIcon, fill = false) =>
  function Icon({ size = 20, className = "" }: P) {
    return <C size={size} strokeWidth={1.75} absoluteStrokeWidth className={className} fill={fill ? "currentColor" : "none"} aria-hidden />;
  };

export const I = {
  Back: L(ChevronLeft),
  Close: L(X),
  Mic: L(Mic),
  Plus: L(Plus),
  Up: L(ArrowUp),
  Stop: L(Square, true),
  Play: L(Play, true),
  Pause: L(Pause, true),
  Wave: L(AudioLines),
  Undo: L(Undo2),
  Redo: L(Redo2),
  Clipboard: L(Clipboard),
  Bold: L(Bold),
  Link: L(Link),
  Camera: L(Camera),
  Image: L(ImageIcon),
  Video: L(Video),
  Music: L(Music),
  Globe: L(Globe),
  List: L(List),
  Check: L(Check),
  Chevron: L(ChevronRight),
  Expand: L(Maximize2),
  Filter: L(ListFilter),
  Recenter: L(LocateFixed),
  Calendar: L(CalendarDays),
  Minimize: L(Minimize2),
  Italic: L(Italic),
  Underline: L(Underline),
  Strike: L(Strikethrough),
  Bullets: L(Bullets),
  Numbers: L(ListOrdered),
  Highlight: L(Highlighter),
  KeyboardDown: L(KeyboardOff),
  Search: L(Search),
  Notes: L(NotebookPen),
  Photos: L(Images),
  Bell: L(Bell),
  Phone: L(Phone),
  Arrow: L(ArrowRight),
  Pin: L(MapPin),
  Edit: L(Pencil),
};

// Force's mark, from the invite.
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="4 2 198 150" width={size} height={(size * 150) / 198} fill="currentColor" className={className} aria-label="Force">
      <path d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8529 33.1043 85.3772 32.024Z" />
      <path d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1043 120.579 32.024Z" />
      <path d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z" />
      <path d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z" />
    </svg>
  );
}

// Web stand-in for UIImpactFeedbackGenerator. Only Android vibrates; iOS Safari is silent.
export function haptic(kind: "tick" | "soft" | "done" = "tick") {
  try {
    navigator.vibrate?.(kind === "tick" ? 6 : kind === "soft" ? 12 : [10, 40, 16]);
  } catch {}
}
