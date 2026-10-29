"use client";

// A side quest: something she keeps coming back to because it makes her life hers. Force
// builds them from what she tells it. This is one quest's page; the list lives in Memory.

import { useMemo } from "react";
import { entryClips, type Art, type Entry } from "@/data/mira";
import { PEOPLE, questById, type Quest } from "@/data/social";
import { f, fmtShort, parse, useF } from "@/lib/f/store";
import Face from "./Face";
import Nav from "./Nav";
import { I, Paint, haptic } from "./ui";

export const questEntries = (q: Quest, entries: Entry[]) => entries.filter((e) => e.themes.includes(q.theme)).sort((a, b) => b.date.localeCompare(a.date));

const daysSince = (d: string) => (Date.now() - parse(d).getTime()) / 864e5;

// "this week", "3 weeks ago", "4 months ago"
export function ago(d: string) {
  const days = Math.round(daysSince(d));
  if (days < 7) return "this week";
  if (days < 30) return `${Math.round(days / 7)} week${days < 11 ? "" : "s"} ago`;
  if (days < 365) return `${Math.round(days / 30)} month${days < 45 ? "" : "s"} ago`;
  return `${Math.round(days / 365)} year${days < 548 ? "" : "s"} ago`;
}

export const quiet = (d: string) => daysSince(d) > 90;

// Your energy lately: your side quests' paintings, the liveliest first.
export function useMyForce(): Art[] {
  const quests = useF((s) => s.quests);
  const entries = useF((s) => s.entries);
  return useMemo(() => {
    const last = (q: Quest) => questEntries(q, entries)[0]?.date ?? "";
    const arts = [...quests].sort((a, b) => last(b).localeCompare(last(a))).map((q) => q.art);
    return arts.length ? Array.from(new Set(arts)) : ["dusk"];
  }, [quests, entries]);
}

// A white row, the one shape every list in the app is made of.
export function Row({ onClick, icon, title, sub, right, big }: { onClick: () => void; icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`press flex w-full items-center gap-3 rounded-full bg-paper pl-3 pr-4 text-left ${big ? "h-[72px]" : "h-16"}`} style={{ boxShadow: "var(--lift-1)" }}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate t-body text-ink">{title}</span>
        {sub && <span className="block truncate t-label text-ink-3">{sub}</span>}
      </span>
      {right ?? <I.Chevron size={18} className="shrink-0 text-ink-4" />}
    </button>
  );
}

export const questFace = (q: Quest) => ({ art: q.art, x: 40, y: 45 });

export function QuestPage({ id }: { id: string }) {
  const q = useF((s) => s.quests.find((x) => x.id === id)) ?? questById(id);
  const entries = useF((s) => s.entries);
  if (!q) return null;
  const es = questEntries(q, entries);
  const people = PEOPLE.filter((p) => p.shares === q.id);
  const scope = { label: q.name, entryIds: es.map((e) => e.id) };
  const last = es[0]?.date;

  return (
    <div className="relative flex h-full flex-col">
      <Nav />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-[76px]">
        <div className="flex flex-col items-center pt-1 text-center">
          <Face face={questFace(q)} size={88} />
          <h1 className="mt-4 t-title text-ink">{q.name}</h1>
          <p className="mt-1 t-label text-ink-3">{last ? `Moved ${ago(last)} · ${es.length} ${es.length === 1 ? "moment" : "moments"}` : "Just started"}</p>
        </div>

        <div className="mt-6 rounded-[28px] bg-fill p-5">
          <p className="t-label text-ink-3">Next move</p>
          <p className="mt-1 t-body font-semibold text-ink">{q.next}</p>
          <p className="mt-4 t-label text-ink-3">Force noticed</p>
          <p className="mt-1 t-body text-ink-2">{q.noticed}</p>
        </div>

        {people.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-1 px-1 t-body text-ink-3">Same energy</h2>
            <p className="mb-3 px-1 t-label text-ink-3">Moving this side quest too. Names only, until you both say yes.</p>
            <ul className="flex flex-col gap-2">
              {people.map((p) => (
                <li key={p.id}>
                  <Row onClick={() => f.push({ name: "energy", focus: p.id })} icon={<Face face={p.face} size={40} />} title={p.group ? `${p.name} · ${p.group} people` : p.name} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {es.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-1 px-1 t-body text-ink-3">Moments</h2>
            <ul className="px-1">
              {es.map((e) => (
                <li key={e.id} className="border-b border-[var(--line)] last:border-0">
                  <button type="button" onClick={() => f.push({ name: "entry", id: e.id })} className="press flex h-14 w-full items-center gap-3 text-left">
                    <span className="min-w-0 flex-1 truncate t-body text-ink">{e.title}</span>
                    {entryClips(e).length > 0 && <Paint name="voice-signals" h={16} className="text-ink-4" />}
                    <span className="t-num shrink-0 text-ink-3">{fmtShort(e.date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="flex shrink-0 gap-2 px-4 pb-2 pt-2">
        <button
          type="button"
          onClick={() => {
            haptic();
            if (es.length) f.open(scope);
            else f.toast("Nothing here to map yet.");
          }}
          className="press pill h-[52px] flex-1 justify-center gap-2 t-body font-medium"
        >
          <Paint name="pattern-maps" h={18} /> Pattern map
        </button>
        <button type="button" onClick={() => f.push({ name: "energy", focus: people[0]?.id })} className="press pill-ink h-[52px] flex-1 justify-center gap-2 t-body font-medium">
          Same energy
        </button>
      </div>
    </div>
  );
}
