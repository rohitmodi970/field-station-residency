"use client";

// Who you are online: your name, your links, Onairos. The same pieces on the way in and on
// your own page, so you can change them any time. Links only go on your card for the people
// you connect with; Onairos is the one source Force reads, and only once you say so.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Art } from "@/data/mira";
import { LINKS, pretty, type LinkKind } from "@/data/residency";
import { r, useR } from "@/lib/f/residency";
import Glass from "../f/Glass";
import { MARKS, OnairosMark } from "../f/brands";
import { I, haptic } from "../f/ui";
import OnairosButton from "@/components/onBoarding/v2/OnairosButton";

export function NameField({ className = "" }: { className?: string }) {
  const name = useR((s) => s.name);
  return (
    <label className={`flex h-[60px] items-center rounded-full bg-paper px-5 ${className}`} style={{ boxShadow: "var(--lift-1)" }}>
      <input
        value={name}
        onChange={(e) => {
          const val = e.target.value;
          console.log(`👤 [DATA INTAKE: Name Entered] "${val}"`);
          r.setName(val);
        }}
        autoComplete="name"
        placeholder="Your name"
        aria-label="Your name"
        enterKeyHint="next"
        className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3"
      />
    </label>
  );
}

function LinkRow({ id, kind, name, art, x, y, value, onChange }: { id: string; kind: LinkKind | "extra"; name: string; art: Art; x: number; y: number; value: string; onChange: (v: string) => void }) {
  const [focus, setFocus] = useState(false);
  const on = !!value.trim();
  const M = MARKS[kind];
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;
  return (
    <label className="flex h-[60px] items-center gap-3 rounded-full bg-paper pl-[10px] pr-4 transition-shadow duration-300" style={{ boxShadow: focus ? "var(--lift-2)" : "var(--lift-1)" }}>
      <motion.span animate={{ scale: on ? [1, 1.1, 1] : 1 }} transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}>
        <Glass size={40} art={art} x={x} y={y} zoom={300}>
          <M size={16} />
        </Glass>
      </motion.span>
      <input
        id={id}
        value={focus ? value : on ? pretty(kind, value) : ""}
        onChange={(e) => {
          const val = e.target.value;
          console.log(`🔗 [DATA INTAKE: Link Typed] Kind: "${kind}", Input: "${val}", Pretty Handle: "${pretty(kind, val)}"`);
          onChange(val);
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={name}
        aria-label={name}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="url"
        enterKeyHint="next"
        className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3"
      />
      <AnimatePresence initial={false} mode="popLayout">
        {on ? (
          <motion.span key="ok" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-ink text-paper" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", duration: 0.35, bounce: 0.3 }}>
            <I.Check size={13} />
          </motion.span>
        ) : focus && canPaste ? (
          <motion.button
            key="paste"
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (!t.trim()) return;
                haptic();
                console.log(`📋 [DATA INTAKE: Link Pasted from Clipboard] Kind: "${kind}", Pasted Content: "${t.trim()}"`);
                onChange(t.trim());
              } catch (err) {
                console.warn("⚠️ [Clipboard] Read failed:", err);
              }
            }}
            className="press h-8 shrink-0 rounded-full bg-fill px-3 t-label font-medium text-ink"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            Paste
          </motion.button>
        ) : null}
      </AnimatePresence>
    </label>
  );
}

// One pill per place, then any others you add.
export function LinkList({ className = "" }: { className?: string }) {
  const { links, extra } = useR();
  const focusLink = (k: string) => {
    const el = document.getElementById(`link-${k}`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        {LINKS.map((l) => (
          <LinkRow key={l.kind} id={`link-${l.kind}`} {...l} value={links[l.kind] ?? ""} onChange={(v) => r.setLink(l.kind, v)} />
        ))}
        {extra.map((x, i) => (
          <LinkRow key={`x${i}`} id={`link-x${i}`} kind="extra" name="Any other link" art="meadow" x={20 + i * 25} y={70} value={x} onChange={(v) => r.setExtra(i, v)} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          haptic();
          console.log(`➕ [DATA ACTION: Add Extra Link] Slot index: ${extra.length}`);
          r.addExtra();
          setTimeout(() => focusLink(`x${extra.length}`), 50);
        }}
        className="press mt-2 flex h-11 items-center gap-2 px-3 t-label font-medium text-ink-2"
      >
        <I.Plus size={16} /> Add another link
      </button>
    </div>
  );
}

// Your say-so for Force to look you up, the way a friend might before meeting you: your name
// and the links you add, public pages only. Off until you turn it on.
export function LookupCard({ className = "" }: { className?: string }) {
  const on = useR((s) => s.lookup);
  return (
    <div className={`rounded-[28px] bg-paper p-5 ${className}`} style={{ boxShadow: "var(--lift-1)" }}>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block t-body font-semibold text-ink">Let Force look you up</span>
          <span className="mt-1 block t-label text-ink-3">It reads what&apos;s public under your name and links, so it meets you already knowing a little.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Let Force look you up"
          onClick={() => {
            haptic();
            console.log(`🔍 [DATA CONSENT: Public Lookup Toggle] New value: ${!on}`);
            r.setLookup(!on);
          }}
          className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ink" : "bg-[var(--grey-300)]"}`}
        >
          <span className="absolute top-1 h-6 w-6 rounded-full bg-paper transition-[left] duration-200" style={{ left: on ? 24 : 4, boxShadow: "0 1px 3px rgb(28 27 26 / 0.2)" }} />
        </button>
      </div>
      <dl className="mt-4 flex flex-col gap-2 t-label">
        <div>
          <dt className="inline font-medium text-ink">What it reads: </dt>
          <dd className="inline text-ink-2">public pages only, from a search of your name and the links below. Never your inbox or accounts.</dd>
        </div>
        <div>
          <dt className="inline font-medium text-ink">What you see: </dt>
          <dd className="inline text-ink-2">every finding with its sources. Remove anything that isn&apos;t you.</dd>
        </div>
        <div>
          <dt className="inline font-medium text-ink">Who sees it: </dt>
          <dd className="inline text-ink-2">only you. It shapes your snapshot; it never goes to the residency on its own.</dd>
        </div>
      </dl>
    </div>
  );
}

// Before anything connects: what's read, what Force takes from it, what it keeps, and why.
export function OnairosCard({ className = "", id = "onairos" }: { className?: string; id?: string }) {
  const onairos = useR((s) => s.onairos);
  return (
    <div id={id} className={`rounded-[28px] bg-paper p-5 ${className}`} style={{ boxShadow: "var(--lift-1)" }}>
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: "linear-gradient(160deg, #fff4ee, #eef3fe)" }}>
          <OnairosMark size={40} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 t-body font-semibold text-ink">
            Onairos <span className="rounded-full bg-fill px-2 py-[1px] t-meta font-normal text-ink-2">Optional</span>
          </span>
          <span className="block t-label text-ink-3">Reads the apps you pick inside Onairos, like ChatGPT, Instagram or YouTube</span>
        </span>
      </div>
      <dl className="mt-4 flex flex-col gap-2 t-label">
        <div>
          <dt className="inline font-medium text-ink">What Force gets: </dt>
          <dd className="inline text-ink-2">a short general read (strengths, a summary, a few suggestions) and how much of your data it covered.</dd>
        </div>
        <div>
          <dt className="inline font-medium text-ink">What Force keeps: </dt>
          <dd className="inline text-ink-2">only that read, on this phone. Never your chats or posts.</dd>
        </div>
        <div>
          <dt className="inline font-medium text-ink">Why: </dt>
          <dd className="inline text-ink-2">to help spot the themes in your work. Never shared, never used to rank anyone.</dd>
        </div>
      </dl>
      {onairos === "failed" ? (
        <>
          <p className="mt-4 t-label text-ink-2">Onairos didn&apos;t answer. You can try again, or carry on without it.</p>
          <button type="button" onClick={() => (haptic(), r.connectOnairos())} className="press mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink t-body font-medium text-paper">
            <I.Redo size={16} /> Try again
          </button>
        </>
      ) : onairos === "on" ? (
        <div className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-fill t-body font-medium text-ink">
          <I.Check size={16} /> Connected
        </div>
      ) : (
        <div className="mt-4">
          <OnairosButton
            buttonText={onairos === "busy" ? "Connecting…" : "Connect with Onairos"}
            onComplete={(raw) => {
              console.log("🧩 [DATA INTAKE: Onairos Widget] Live payload received from user's apps:", raw);
              r.connectOnairos(raw?.apiResponse || raw);
            }}
            onError={(err) => {
              console.warn("⚠️ [DATA INTAKE: Onairos Widget] Skipped / not signed in, using sample fallback:", err);
              r.connectOnairos();
            }}
          />
        </div>
      )}
      {onairos === "on" && (
        <button type="button" onClick={() => (haptic(), r.disconnectOnairos())} className="press mx-auto mt-1 flex h-9 items-center px-3 t-label text-ink-3">
          Disconnect
        </button>
      )}
    </div>
  );
}
