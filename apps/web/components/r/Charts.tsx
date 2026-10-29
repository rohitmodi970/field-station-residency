"use client";

// The analysis as pictures, from measured counts only: nothing that ranks you, nothing guessed.
//   WordsBar   where your words went across your three answers (part-to-whole)
//   LensBars   how many residents work through each of your lenses (magnitude)
// Following
// Apple's chart guidance: a plain headline first, familiar forms, detail when you ask for it
// (tap a part), and a description for VoiceOver.

import { useState } from "react";
import { ART_SRC } from "@/data/mira";

// Emphasis, not a rainbow: the part the headline is about is filled with the painting; the
// others are two greys. Every part is named in ink beside it.
const PAINT = { backgroundImage: `url(${ART_SRC.water})`, backgroundSize: "400% 1200%", backgroundPosition: "60% 40%" };
const GREYS = ["#c9c6c1", "#e2e0dc"];
const fill = (on: boolean, i: number): React.CSSProperties => (on ? PAINT : { background: GREYS[i % 2] });

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function WordsBar({ answers }: { answers: string[] }) {
  const [pick, setPick] = useState<string | null>(null);
  const parts = [
    { key: "intent" as const, label: "Intent", n: words(answers[0] ?? "") },
    { key: "problem" as const, label: "Problem", n: words(answers[1] ?? "") },
    { key: "current_frontier" as const, label: "Open question", n: words(answers[2] ?? "") },
  ];
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total) return null;
  const pct = (n: number) => Math.round((n / total) * 100);
  const top = [...parts].sort((a, b) => b.n - a.n)[0];
  const even = parts.every((p) => Math.abs(p.n / total - 1 / 3) < 0.08);
  return (
    <figure className="rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
      <figcaption className="t-meta text-ink-3">Where your words went · {total} words</figcaption>
      <p className="mt-1 t-body font-semibold text-ink">{even ? "You gave all three about the same room." : `Most of what you said went to your ${top.label.toLowerCase()}: ${pct(top.n)}%.`}</p>
      <div className="mt-4 flex h-3 w-full gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.n)}%`).join(", ")}>
        {parts
          .filter((p) => p.n)
          .map((p, i, a) => (
            <button
              key={p.key}
              type="button"
              aria-label={`${p.label}: ${p.n} words, ${pct(p.n)}%`}
              onClick={() => setPick(pick === p.key ? null : p.key)}
              className="relative h-full transition-opacity duration-200 after:absolute after:-inset-y-4 after:inset-x-0"
              style={{ width: `${(p.n / total) * 100}%`, ...fill(p.key === top.key, parts.filter((x) => x.key !== top.key).indexOf(p)), opacity: pick && pick !== p.key ? 0.25 : 1, borderRadius: `${i === 0 ? 4 : 0}px ${i === a.length - 1 ? 4 : 0}px ${i === a.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px` }}
            />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <li key={p.key}>
            <button type="button" onClick={() => setPick(pick === p.key ? null : p.key)} className="flex items-center gap-[6px] t-label text-ink-2 transition-opacity duration-200" style={{ opacity: pick && pick !== p.key ? 0.4 : 1 }}>
              <span className="h-2 w-2 rounded-full" style={fill(p.key === top.key, parts.filter((x) => x.key !== top.key).indexOf(p))} aria-hidden />
              {p.label} <span className="t-num text-ink">{pct(p.n)}%</span>
            </button>
          </li>
        ))}
      </ul>
      {pick && (
        <p className="mt-3 rounded-[16px] bg-fill px-3 py-2 t-label text-ink-2">
          {(() => {
            const p = parts.find((x) => x.key === pick)!;
            return `${p.label}: ${p.n} of your ${total} words. ${answers[parts.indexOf(p)]?.trim().split(/\s+/).slice(0, 12).join(" ")}${(answers[parts.indexOf(p)] ?? "").trim().split(/\s+/).length > 12 ? "…" : ""}`;
          })()}
        </p>
      )}
      <table className="sr-only">
        <caption>Words per answer</caption>
        <tbody>
          {parts.map((p) => (
            <tr key={p.key}>
              <th>{p.label}</th>
              <td>{p.n} words</td>
              <td>{pct(p.n)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function LensBars({ rows, of }: { rows: { name: string; n: number; who: string[] }[]; of: number }) {
  if (!rows.length) return null;
  const shared = rows.filter((x) => x.n).length;
  return (
    <figure className="rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
      <figcaption className="t-meta text-ink-3">Your lenses in the residency · of {of} who&apos;ve shared</figcaption>
      <p className="mt-1 t-body font-semibold text-ink">{shared ? `${shared} of your ${rows.length} lens${rows.length === 1 ? "" : "es"} ${shared === 1 ? "is" : "are"} shared by people here.` : "Nobody here works through your lenses yet, which makes you the one others can learn from."}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((x) => (
          <li key={x.name} title={x.who.length ? x.who.join(", ") : "No one yet"}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate t-label text-ink">{x.name}</span>
              <span className="shrink-0 t-meta text-ink-3">
                <span className="t-num text-ink">{x.n}</span> {x.who.length ? `· ${x.who.slice(0, 3).join(", ")}${x.who.length > 3 ? "…" : ""}` : ""}
              </span>
            </div>
            <div className="mt-[6px] h-2 w-full rounded-[4px] bg-fill">
              <div className="h-full rounded-[4px]" style={{ width: `${of ? Math.max(x.n ? 4 : 0, (x.n / of) * 100) : 0}%`, ...PAINT }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
