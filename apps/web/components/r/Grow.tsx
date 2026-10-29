"use client";

// A text field that grows with what you write, the way chat apps' fields do: one line to
// start, up to about six, then it scrolls inside. Enter sends; Shift+Enter is a new line.

import { useLayoutEffect, useRef } from "react";

export default function Grow({ value, onChange, onSend, max = 6, className = "", ...rest }: { value: string; onChange: (v: string) => void; onSend?: () => void; max?: number } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const el = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = el.current;
    if (!t) return;
    t.style.height = "0px";
    const line = parseFloat(getComputedStyle(t).lineHeight) || 22;
    t.style.height = `${Math.min(t.scrollHeight, line * max)}px`;
    t.style.overflowY = t.scrollHeight > line * max ? "auto" : "hidden";
  }, [value, max]);
  return (
    <textarea
      ref={el}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && onSend) {
          e.preventDefault();
          onSend();
        }
      }}
      className={`block min-w-0 flex-1 resize-none bg-transparent py-[9px] t-body text-ink outline-none placeholder:text-ink-3 ${className}`}
      {...rest}
    />
  );
}
