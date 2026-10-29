"use client";

// Lets a mouse drag a sideways row, the way a finger already can. Desktop browsers only
// scroll a row by wheel or trackpad, so on the phone frame "swipe" did nothing. Touch and
// pen keep the browser's own scrolling. A drag lands on a card (the nearest, or the next one
// over after a flick), and the click at the end of a drag doesn't press anything.

import { useEffect, useRef } from "react";

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id = -1;
    let x0 = 0;
    let left0 = 0;
    let moved = false;
    let settle = 0;

    // The scroll position that puts a card in the middle, as snap-center would.
    const centre = (c: Element) => {
      const a = el.getBoundingClientRect();
      const b = c.getBoundingClientRect();
      return el.scrollLeft + b.left + b.width / 2 - (a.left + a.width / 2);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) {
        moved = true;
        clearTimeout(settle);
        el.style.scrollSnapType = "none"; // snapping fights every frame of the drag
        el.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        window.getSelection()?.removeAllRanges();
      }
      el.scrollLeft = left0 - dx;
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!moved) return;
      setTimeout(() => (moved = false), 0); // after the click this pointerup makes, if any
      el.style.userSelect = "";
      document.body.style.cursor = "";
      const cards = Array.from(el.children).filter((c) => (c as HTMLElement).offsetWidth > 0);
      const max = el.scrollWidth - el.clientWidth;
      const at = cards.map(centre);
      const near = at.reduce((best, p, i) => (Math.abs(p - el.scrollLeft) < Math.abs(at[best] - el.scrollLeft) ? i : best), 0);
      // A short flick still moves one card on, as it does under a finger.
      const dx = e.clientX - x0;
      const from = at.reduce((best, p, i) => (Math.abs(p - left0) < Math.abs(at[best] - left0) ? i : best), 0);
      const i = near === from && Math.abs(dx) > 40 ? Math.min(Math.max(from + (dx < 0 ? 1 : -1), 0), cards.length - 1) : near;
      el.scrollTo({ left: Math.min(Math.max(at[i] ?? 0, 0), max), behavior: "smooth" });
      settle = window.setTimeout(() => (el.style.scrollSnapType = ""), 500);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      id = e.pointerId;
      x0 = e.clientX;
      left0 = el.scrollLeft;
      moved = false;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };

    // The click that ends a drag isn't a tap on whatever it ended over.
    const click = (e: MouseEvent) => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const noDrag = (e: DragEvent) => e.preventDefault();

    el.addEventListener("pointerdown", down);
    el.addEventListener("click", click, true);
    el.addEventListener("dragstart", noDrag);
    return () => {
      clearTimeout(settle);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("click", click, true);
      el.removeEventListener("dragstart", noDrag);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  return ref;
}
