"use client";

// You. Your face, your number, what Force can use, the apps it reads, and the small levers:
// replay the welcome, start over. It lives at the top right of home, next to Energy.

import { MIRA_FACE } from "@/data/social";
import { f, useF, type Settings } from "@/lib/f/store";
import Face from "./Face";
import Nav from "./Nav";
import { I, haptic } from "./ui";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => (haptic(), onChange(!on))} className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ink" : "bg-[var(--grey-300)]"}`}>
      <span className="absolute top-1 h-6 w-6 rounded-full bg-paper transition-[left] duration-200" style={{ left: on ? 24 : 4, boxShadow: "0 1px 3px rgb(28 27 26 / 0.2)" }} />
    </button>
  );
}

function Row({ icon, title, sub, right, onClick }: { icon: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fill text-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate t-body text-ink">{title}</span>
        {sub && <span className="block truncate t-label text-ink-3">{sub}</span>}
      </span>
      {right ?? <I.Chevron size={16} className="shrink-0 text-ink-4" />}
    </>
  );
  const cls = "flex h-16 w-full items-center gap-3 rounded-full bg-paper pl-3 pr-4 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`press ${cls}`} style={{ boxShadow: "var(--lift-1)" }}>
      {inner}
    </button>
  ) : (
    <div className={cls} style={{ boxShadow: "var(--lift-1)" }}>
      {inner}
    </div>
  );
}

export default function Profile() {
  const settings = useF((s) => s.settings);
  const entries = useF((s) => s.entries);
  const quests = useF((s) => s.quests);
  const demo = useF((s) => s.demo);
  const set = (k: keyof Settings) => (v: boolean) => f.setSetting(k, v);
  const withForce = entries.filter((e) => e.via === "chat").length;

  return (
    <div className="relative flex h-full flex-col">
      <Nav title="You" />
      <div data-scroll="profile" className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-[76px]">
        <div className="flex flex-col items-center text-center">
          <Face face={MIRA_FACE} size={96} className="ring-4 ring-paper" />
          <h1 className="mt-4 t-title text-ink">{demo === "new" ? "You" : "Mira Rao"}</h1>
          <p className="mt-1 t-label text-ink-3">+91 98765 43210 · Bengaluru</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => f.push({ name: "memory" })} className="press rounded-[24px] bg-paper p-4 text-left" style={{ boxShadow: "var(--lift-1)" }}>
            <span className="block t-title text-ink">{entries.length}</span>
            <span className="block t-label text-ink-3">moments{withForce ? ` · ${withForce} with Force` : ""}</span>
          </button>
          <button type="button" onClick={() => f.push({ name: "energy" })} className="press rounded-[24px] bg-paper p-4 text-left" style={{ boxShadow: "var(--lift-1)" }}>
            <span className="block t-title text-ink">{quests.length}</span>
            <span className="block t-label text-ink-3">side quests</span>
          </button>
        </div>

        <h2 className="mb-2 mt-8 px-1 t-body text-ink-3">What Force can use</h2>
        <ul className="flex flex-col gap-2">
          <li>
            <Row icon={<I.Mic size={20} />} title="Microphone" sub="Hold anywhere and talk" right={<Toggle on={settings.mic} onChange={set("mic")} label="Microphone" />} />
          </li>
          <li>
            <Row icon={<I.Bell size={20} />} title="Nudges" sub="For the moves you keep" right={<Toggle on={settings.bell} onChange={set("bell")} label="Nudges" />} />
          </li>
          <li>
            <Row icon={<I.Pin size={20} />} title="Location" sub="People near you, in kilometres" right={<Toggle on={settings.pin} onChange={set("pin")} label="Location" />} />
          </li>
        </ul>

        <h2 className="mb-2 mt-8 px-1 t-body text-ink-3">What Force reads</h2>
        <ul className="flex flex-col gap-2">
          <li>
            <Row icon={<I.Calendar size={20} />} title="Calendar" sub="Where your time goes" right={<Toggle on={settings.calendar} onChange={set("calendar")} label="Calendar" />} />
          </li>
          <li>
            <Row icon={<I.Photos size={20} />} title="Photos" sub="Where you've been, who with" right={<Toggle on={settings.photos} onChange={set("photos")} label="Photos" />} />
          </li>
          <li>
            <Row icon={<I.Notes size={20} />} title="Notes" sub="What you've already written" right={<Toggle on={settings.notes} onChange={set("notes")} label="Notes" />} />
          </li>
        </ul>

        <h2 className="mb-2 mt-8 px-1 t-body text-ink-3">Force</h2>
        <ul className="flex flex-col gap-2">
          <li>
            <Row icon={<I.Arrow size={20} />} title="See the welcome again" sub="The three questions, from the top" onClick={() => (f.home(), f.restartOnboarding())} />
          </li>
          <li>
            <Row icon={<I.Close size={20} />} title="Start over" sub="Clears this phone's copy of your memory" onClick={() => (f.setDemo("new"), f.home(), f.restartOnboarding())} />
          </li>
        </ul>
        <p className="mt-6 px-1 text-center t-meta text-ink-3">Force never posts, and never shares your moments.</p>
      </div>
    </div>
  );
}
