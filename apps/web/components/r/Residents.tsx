"use client";

// Home, for the residency, one page in the order you meet it: you (your snapshot), Force to
// talk to, then everyone here who has shared what they're working on, the ones Force
// connected you with first, each with its reason. The residency's full graph isn't here:
// it's shown at the end of the pitch (/residency/graph). Side quests sit at the bottom as a
// preview of what comes after.

import { useMemo } from "react";
import { CONNECTION_LABEL, visible } from "@/contract/residency";
import { ART_SRC } from "@/data/mira";
import { ME_FACE, RESIDENTS, residentById } from "@/data/residency";
import { f } from "@/lib/f/store";
import { useR } from "@/lib/f/residency";
import { COHORT } from "@/lib/r/api";
import { otherIn, useCohort } from "@/lib/r/cohort";
import Face from "../f/Face";
import Glass from "../f/Glass";
import { BlurTop } from "../f/Nav";
import { I, Logo, haptic } from "../f/ui";
import { Kind } from "./Connection";

export default function Residents() {
  const name = useR((s) => s.name);
  const snapshot = useR((s) => s.snapshot);
  // Under your name: what you're here for, in a few words, or where your snapshot stands.
  const line = snapshot?.titles?.intent ? `Here for: ${snapshot.titles.intent.toLowerCase()}` : snapshot?.status === "approved" ? (snapshot.shared ? "Shared with the residency" : "Approved, private") : "Your snapshot";
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
      {/* What scrolls up under the status bar blurs away */}
      <BlurTop height={20} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-3">
        <button type="button" aria-label={`${name || "You"}: what Force understands about you`} onClick={() => (haptic(), f.push({ name: "persona" }))} className="press flex w-full items-center gap-3 rounded-full text-left">
          <Glass size={44} {...ME_FACE} zoom={260} />
          <span className="min-w-0 flex-1">
            <span className="block truncate t-body font-semibold text-ink">{name.trim() || "You"}</span>
            <span className="block truncate t-label text-ink-3">{line}</span>
          </span>
          <I.Chevron size={16} className="shrink-0 text-ink-4" />
        </button>

        <div className="mt-6">
          <Row
            onClick={() => (haptic(), f.push({ name: "force" }))}
            icon={
              <Glass size={44} art="dusk" x={40} y={40} zoom={300}>
                <Logo size={20} />
              </Glass>
            }
            title="Force"
            line="Talk, type or add a photo. It all becomes memory."
          />
        </div>

        <People />
        <SideQuests />
      </div>
    </div>
  );
}

function Row({ onClick, icon, title, line, tag }: { onClick: () => void; icon: React.ReactNode; title: string; line: string; tag?: string }) {
  return (
    <button type="button" onClick={onClick} className="press flex h-[68px] w-full items-center gap-3 rounded-full bg-paper pl-3 pr-4 text-left" style={{ boxShadow: "var(--lift-1)" }}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate t-body font-medium text-ink">{title}</span>
          {tag && <span className="shrink-0 rounded-full bg-fill px-2 py-[1px] t-meta text-ink-2">{tag}</span>}
        </span>
        <span className="block truncate t-label text-ink-3">{line}</span>
      </span>
      <I.Chevron size={16} className="shrink-0 text-ink-4" />
    </button>
  );
}

// ── People here ──
// Everyone who approved and shared, the ones Force connected you with first.
function People() {
  const { mine, people: cohortPeople } = useCohort();
  const me = useR((s) => s.me);
  const residentName = useR((s) => s.name);
  const linking = useR((s) => s.linking);
  const snapshot = useR((s) => s.snapshot);
  const connOf = (id: string) => mine.find((c) => otherIn(c, me) === id);

  const people = useMemo(() => {
    const list = cohortPeople && cohortPeople.length > 0 ? cohortPeople : [];
    const myCleanName = (residentName || "").trim().toLowerCase();
    return list.filter((p) => {
      if (p.id === me || p.id === `user_${me}` || (me && me.includes(p.id))) return false;
      if (myCleanName && p.name.trim().toLowerCase() === myCleanName) return false;
      return true;
    });
  }, [cohortPeople, me, residentName]);

  const sorted = [...people].sort((a, b) => Number(!!connOf(b.id)) - Number(!!connOf(a.id)));
  const shared = snapshot?.status === "approved" && snapshot.shared;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="t-body text-ink-3">People here</h2>
        <span className="t-meta text-ink-3">
          {linking
            ? "Force is reading everyone next to you…"
            : shared
            ? (mine.length ? `${mine.length} worth meeting first` : "No clear match yet")
            : `${people.length} signed up`}
        </span>
      </div>
      {!shared && (
        <button type="button" onClick={() => (haptic(), f.push({ name: "persona" }))} className="press mb-3 flex w-full items-center gap-3 rounded-[24px] bg-fill px-4 py-3 text-left">
          <span className="min-w-0 flex-1 t-label text-ink-2">Share your snapshot and Force will tell you who to meet first, and why.</span>
          <I.Chevron size={16} className="shrink-0 text-ink-4" />
        </button>
      )}
      <ul className="flex flex-col gap-2">
        {sorted.map((p) => {
          const c = connOf(p.id);
          return (
            <li key={p.id} className="rounded-[28px] bg-paper p-4" style={{ boxShadow: "var(--lift-1)" }}>
              <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: p.id }))} className="press flex w-full items-center gap-3 text-left" aria-label={`${p.name}${c ? `, ${CONNECTION_LABEL[c.type]}` : ""}`}>
                <Face face={p.face} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block t-body font-semibold text-ink">{p.name}</span>
                  {c ? <Kind c={c} /> : <span className="block truncate t-label text-ink-3">{p.work}</span>}
                </span>
                <I.Chevron size={16} className="shrink-0 text-ink-4" />
              </button>
              {c && <p className="mt-3 t-body text-ink-2">{c.why_connected}</p>}
              {c && (
                <button
                  type="button"
                  onClick={() => (haptic(), f.push({ name: "connection", id: p.id, say: true }))}
                  className="press mt-3 h-10 rounded-full bg-fill px-4 t-label font-medium text-ink-2"
                >
                  Coming after residency
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Side quests: after the residency ──
// A preview of where Force is going: what you and someone here could go and do together.
// Hardcoded UI preview cards as designed, coming after the residency.
const PREVIEW_SIDE_QUESTS = [
  {
    id: "meera",
    name: "Meera",
    quest: "A morning of field interviews, together",
    face: { art: "meadow" as const, x: 30, y: 25 },
  },
  {
    id: "kabir",
    name: "Kabir",
    quest: "Saturday at Kabir's test tank",
    face: { art: "water" as const, x: 70, y: 40 },
  },
  {
    id: "ananya",
    name: "Ananya",
    quest: "Mandai market at 6 a.m.",
    face: { art: "dusk" as const, x: 20, y: 70 },
  },
];

function SideQuests() {
  const quests = PREVIEW_SIDE_QUESTS;
  const odd = quests.length % 2 === 1;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="t-body text-ink-3">Side quests</h2>
        <span className="rounded-full bg-fill px-2 py-[2px] t-meta text-ink-2">Coming soon</span>
      </div>
      <p className="mb-3 px-1 t-label text-ink-3">Where Force is heading: something real to do together, picked from the patterns you share.</p>
      <ul className="grid grid-cols-2 gap-3" aria-label="Side quests, coming soon">
        {quests.map((p, i) => {
          const wide = odd && i === quests.length - 1;
          return (
            <li key={p.id} className={wide ? "col-span-2" : ""}>
              <div className={`relative w-full overflow-hidden rounded-[24px] bg-cover ${wide ? "aspect-[2/1]" : "aspect-[4/5]"}`} style={{ backgroundImage: `url(${ART_SRC[p.face.art]})`, backgroundPosition: `${p.face.x}% ${p.face.y}%`, boxShadow: "var(--lift-1)" }}>
                <span className="absolute inset-0 grid place-items-center p-3">
                  <span className="max-w-full rounded-[16px] px-3 py-[6px] text-center t-label font-medium text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
                    {p.quest}
                  </span>
                </span>
                <span className="absolute bottom-3 left-3 flex items-center gap-[6px] rounded-full py-[3px] pl-[3px] pr-2 t-meta text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
                  <Face face={p.face} size={18} />
                  With {p.name}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
