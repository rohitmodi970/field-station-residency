"use client";
/* eslint-disable react-hooks/refs -- toolbar handlers read refs only when tapped, never during render */

// One entry, on paper. Edit it in place: the toolbar rides on top of the keyboard. Select any
// words and they can go straight into a pattern map; tap a voice note to
// read its voice signals. The painted icons at the top run on the whole entry, and the
// memory icon saves it (it also saves itself when you go back).

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Block, Clip } from "@/data/mira";
import { esc, f, fmtLong, fmtTime, uid, useF } from "@/lib/f/store";
import { clipFromFile } from "@/lib/f/audio";
import { AudioBubble } from "./Bubbles";
import { BlurTop } from "./Nav";
import VoiceMode from "./VoiceMode";
import { I, Paint, SPRING, haptic } from "./ui";

const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault(); // don't steal focus from the page

function readActive(): Record<string, boolean | string> {
  const q = (c: string) => {
    try {
      return document.queryCommandState(c);
    } catch {
      return false;
    }
  };
  let block = "";
  try {
    block = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
  } catch {}
  return { bold: q("bold"), italic: q("italic"), underline: q("underline"), strikeThrough: q("strikeThrough"), insertUnorderedList: q("insertUnorderedList"), insertOrderedList: q("insertOrderedList"), block };
}

// Two taps, so it can't happen by accident.
function DeleteEntry({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <div className="mt-16 flex justify-center">
      <button
        type="button"
        onClick={() => {
          if (!armed) return setArmed(true);
          haptic("soft");
          onDelete();
          f.toast("Entry deleted");
        }}
        className={`press h-9 rounded-full px-4 t-meta transition-colors duration-200 ${armed ? "bg-[#c4321f] text-paper" : "text-ink-3"}`}
      >
        {armed ? "Tap again to delete" : "Delete entry"}
      </button>
    </div>
  );
}

function Transcript({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex h-9 items-center gap-1 px-3 t-meta text-ink-3">
        {open ? "Hide what you said" : "Show what you said"}
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={SPRING.ui}>
          <I.Chevron size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING.ui} className="selectable overflow-hidden px-3 pb-3 t-label text-ink-2">
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EntryView({ id }: { id: string }) {
  const entry = useF((s) => s.entries.find((e) => e.id === id));
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const b = entry?.blocks ?? [];
    return b[b.length - 1]?.kind === "text" ? b : [...b, { id: uid("b"), kind: "text", html: "" }];
  });
  const [title, setTitle] = useState(entry?.title ?? "");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selText, setSelText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const [styles, setStyles] = useState(false);
  const [act, setAct] = useState<Record<string, boolean | string>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const body = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const cam = useRef<HTMLInputElement>(null);
  const pics = useRef<HTMLInputElement>(null);
  const aud = useRef<HTMLInputElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const plusBox = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [voice, setVoice] = useState<{ x: number; y: number; el: HTMLElement | null } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!plusBox.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  // Read the page back into blocks.
  const latest = useRef<Record<string, string>>({}); // last known html, even after the page has gone
  const collect = (): Block[] => blocks.map((b) => (b.kind === "text" ? { ...b, html: refs.current[b.id]?.innerHTML ?? latest.current[b.id] ?? b.html } : b)).filter((b, i, a) => !(b.kind === "text" && !b.html.replace(/<[^>]+>|&nbsp;|\s/g, "") && i === a.length - 1));

  const commit = (quiet = false) => {
    if (!entry) return;
    f.updateEntry(id, { title: title.trim() || entry.title, blocks: collect() });
    setDirty(false);
    if (!quiet) setSaved(true);
  };

  // Autosave, like Notes: a moment after you stop, it's kept, and says so quietly.
  const autosave = useRef<() => void>(() => {});
  useEffect(() => {
    autosave.current = () => commit();
  });
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => autosave.current(), 900);
    return () => clearTimeout(t);
  }, [dirty, title, blocks]);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1600);
    return () => clearTimeout(t);
  }, [saved]);

  // Edits are never lost: however you leave the page, unsaved changes are kept.
  const leave = useRef<() => void>(() => {});
  useEffect(() => {
    leave.current = () => dirty && commit(true);
  });
  useEffect(() => () => leave.current(), []);

  // Keep track of where you are in the text (so tapping the bar never loses it), which
  // formats are on there, and any words you've selected.
  useEffect(() => {
    const on = () => {
      const s = document.getSelection();
      if (!s || !s.rangeCount || !body.current?.contains(s.anchorNode)) return;
      range.current = s.getRangeAt(0).cloneRange();
      if ((s.anchorNode?.nodeType === 1 ? (s.anchorNode as Element) : s.anchorNode?.parentElement)?.closest("[contenteditable]")) setEditing(true);
      setAct(readActive());
      setSelText(s.isCollapsed ? "" : s.toString().trim());
    };
    document.addEventListener("selectionchange", on);
    return () => document.removeEventListener("selectionchange", on);
  }, []);

  if (!entry) return null;


  const runWhole = () => {
    haptic();
    commit(true);
    f.open({ label: title || entry.title, entryIds: [id] });
  };
  const runSel = () => {
    haptic();
    f.open({ label: `A part of ${title || entry.title}`, entryIds: [], text: selText });
  };

  const exec = (cmd: string, arg?: string) => {
    restore();
    document.execCommand(cmd, false, arg);
    Object.entries(refs.current).forEach(([k, el]) => el && (latest.current[k] = el.innerHTML));
    setDirty(true);
    requestAnimationFrame(() => setAct(readActive()));
    haptic();
  };
  const restore = () => {
    const r = range.current;
    const s = document.getSelection();
    if (!r || !s) return;
    const n = r.startContainer;
    const host = (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest("[contenteditable]") as HTMLElement | null;
    host?.focus({ preventScroll: true });
    s.removeAllRanges();
    s.addRange(r);
  };
  const block = (tag: string) => {
    const cur = String(act.block || "");
    exec("formatBlock", cur === tag && tag !== "p" ? "<p>" : `<${tag}>`);
  };

  // Anything you add goes after the paragraph you're in, or at the end, and the entry keeps
  // ending in a place to write.
  const insertBlock = (b: Block) => {
    const s = document.getSelection();
    const at = blocks.findIndex((x) => x.kind === "text" && refs.current[x.id]?.contains(s?.anchorNode ?? null));
    const i = at < 0 ? blocks.length - 1 : at + 1;
    const next = [...blocks.slice(0, i), b, ...blocks.slice(i)];
    setBlocks(next[next.length - 1].kind === "text" ? next : [...next, { id: uid("b"), kind: "text", html: "" }]);
    setDirty(true);
    haptic("soft");
  };
  const insertMedia = async (file: File) => {
    if (file.type.startsWith("audio")) {
      try {
        insertBlock({ id: uid("b"), kind: "audio", clip: await clipFromFile(file) });
      } catch {
        f.toast(`Couldn't read ${file.name}.`);
      }
      return;
    }
    insertBlock({ id: uid("b"), kind: file.type.startsWith("video") ? "video" : "image", src: URL.createObjectURL(file), name: file.name });
  };
  const insertClip = (clip: Clip) => insertBlock({ id: uid("b"), kind: "audio", clip });

  const pickedBlock = blocks.find((b) => b.id === picked);

  return (
    <div ref={page} className="relative flex h-full flex-col">
      <BlurTop />
      <header className="absolute inset-x-0 top-0 z-[2] flex h-14 items-center justify-between px-4">
        <button
          type="button"
          onClick={() => {
            if (dirty) commit(true);
            f.pop();
          }}
          aria-label="Back"
          className="press pill hit h-11 w-11 justify-center p-0"
        >
          <I.Back size={22} />
        </button>
        <div className="pill h-11 gap-0 p-0 px-[2px]">
          <button type="button" aria-label="Pattern map of this entry" onClick={runWhole} className="press grid h-11 w-11 place-items-center rounded-full text-ink active:bg-fill">
            <Paint name="pattern-maps" h={20} />
          </button>
          <button
            type="button"
            aria-label="Show in your world"
            onClick={() => {
              if (dirty) commit(true);
              f.mem({ focus: id, selecting: false, sel: [] });
              const st = useF.getState().stack;
              if (st.length > 1 && st[st.length - 2].name === "memory") f.pop();
              else {
                f.pop();
                f.push({ name: "memory" });
              }
            }}
            className="press grid h-11 w-11 place-items-center rounded-full text-ink active:bg-fill"
          >
            <Paint name="memory" h={20} />
          </button>
        </div>
      </header>

      <div
        ref={body}
        data-scroll="entry"
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6"
        style={{ paddingBottom: editing ? 200 : 96, paddingTop: 72 }}
        onFocus={() => setEditing(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setTimeout(() => !body.current?.contains(document.activeElement) && setEditing(false), 120);
        }}
      >
        <div className="flex gap-3 pt-6">
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              aria-label="Title"
              placeholder="Untitled"
              className="block w-full bg-transparent t-large text-ink outline-none placeholder:text-ink-3"
            />
            <p className="mt-1 flex items-center gap-2 t-num text-ink-3">
              <span>{fmtLong(entry.date)}</span>
              <span className="h-3 w-px bg-ink-4" />
              <span>{fmtTime(entry.time)}</span>
              <AnimatePresence>
                {(saved || dirty) && (
                  <motion.span key={saved ? "s" : "d"} className="t-meta text-ink-3" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    · {saved ? "Saved" : "Editing"}
                  </motion.span>
                )}
              </AnimatePresence>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {blocks.map((b, i) =>
            b.kind === "text" ? (
              <div
                key={b.id}
                ref={(el) => {
                  refs.current[b.id] = el;
                }}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline
                aria-label={i === 0 ? "Entry" : "More of the entry"}
                data-placeholder={i === blocks.length - 1 ? (blocks.length > 1 ? "Keep writing…" : "Write something…") : ""}
                className="prose t-read text-ink [&_p+p]:mt-4"
                dangerouslySetInnerHTML={{ __html: b.html }}
                onInput={(e) => {
                  latest.current[b.id] = e.currentTarget.innerHTML;
                  setDirty(true);
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
                    e.preventDefault();
                    exec("bold");
                  }
                }}
              />
            ) : (
              <motion.div
                key={b.id}
                onClick={() => setPicked(picked === b.id ? null : b.id)}
                className="relative rounded-[18px]"
                style={{ boxShadow: picked === b.id ? "0 0 0 1.5px var(--ink)" : undefined, outlineOffset: 2 }}
              >
                {b.kind === "audio" ? (
                  <div className="rounded-[18px] bg-fill p-1">
                    <div onClick={(e) => e.stopPropagation()}>
                      <AudioBubble clip={b.clip} compact />
                    </div>
                    {b.clip.transcript && <Transcript text={b.clip.transcript} />}
                  </div>
                ) : b.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.src} alt={b.name ?? ""} className="w-full rounded-[18px] object-cover" />
                ) : (
                  <video src={b.src} controls playsInline className="w-full rounded-[18px]" />
                )}
              </motion.div>
            ),
          )}
        </div>
        {!editing && <DeleteEntry onDelete={() => f.deleteEntry(id)} />}
      </div>

      {/* The bar at the bottom, like the composer: + for photos, camera and audio files, the mic
          to talk. It steps aside while you're typing; the formatting bar takes its place. */}
      <AnimatePresence initial={false}>
        {!editing && (
          <motion.div key="add" className="absolute inset-x-4 z-10" style={{ bottom: "calc(var(--sab) + 8px)" }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12, transition: { duration: 0.12 } }} transition={SPRING.ui}>
            <div className="relative flex h-[52px] items-center rounded-[26px] bg-paper px-1" style={{ boxShadow: "var(--lift-1)" }}>
              <div ref={plusBox} className="relative grid h-[52px] w-11 shrink-0 place-items-center">
                <motion.button type="button" aria-label="Add photos, video or audio" aria-expanded={menu} onClick={() => (haptic(), setMenu((m) => !m))} animate={{ rotate: menu ? 45 : 0 }} transition={SPRING.ui} className="press grid h-9 w-9 place-items-center rounded-full bg-fill text-ink">
                  <I.Plus size={20} />
                </motion.button>
                <AnimatePresence>
                  {menu && (
                    <motion.div className="absolute bottom-[60px] left-0 w-60 overflow-hidden rounded-[22px] bg-paper p-[6px]" style={{ boxShadow: "var(--lift-2)", transformOrigin: "bottom left" }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={SPRING.ui}>
                      {[
                        { label: "Photos & videos", icon: <I.Image size={20} />, go: () => pics.current?.click() },
                        { label: "Camera", icon: <I.Camera size={20} />, go: () => cam.current?.click() },
                        { label: "Audio file", icon: <I.Music size={20} />, go: () => aud.current?.click() },
                      ].map((o) => (
                        <button key={o.label} type="button" onClick={() => (setMenu(false), o.go())} className="press flex h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left t-body active:bg-fill">
                          <span className="text-ink-2">{o.icon}</span>
                          {o.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button type="button" onClick={() => refs.current[blocks[blocks.length - 1]?.id]?.focus()} className="h-[52px] min-w-0 flex-1 pl-2 text-left t-body text-ink-3">
                Keep writing…
              </button>
              <div className="grid h-[52px] w-11 shrink-0 place-items-center">
                <button type="button" aria-label="Add a voice note" onClick={() => (haptic("soft"), setVoice({ x: (page.current?.clientWidth ?? 393) - 40, y: (page.current?.clientHeight ?? 852) - 40, el: page.current }))} className="press hit grid h-9 w-9 place-items-center text-ink">
                  <I.Mic size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <input ref={pics} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => (Array.from(e.target.files ?? []).forEach(insertMedia), (e.target.value = ""))} />
      <input ref={aud} type="file" accept="audio/*" hidden onChange={(e) => (Array.from(e.target.files ?? []).forEach(insertMedia), (e.target.value = ""))} />
      <AnimatePresence>
        {voice && (
          <VoiceMode
            key="voice"
            origin={voice}
            shotOf={voice.el}
            onClip={(clip) => {
              insertClip(clip);
              commit(true);
            }}
            onClose={() => setVoice(null)}
          />
        )}
      </AnimatePresence>

      {/* A voice note or picture you've picked out */}
      <AnimatePresence>
        {pickedBlock && !editing && (
          <motion.div
            key="picked"
            className="absolute inset-x-4 z-10 flex items-center gap-2 rounded-full bg-paper p-1"
            style={{ bottom: 16, boxShadow: "var(--lift-2)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={SPRING.ui}
          >
            {pickedBlock.kind === "audio" && (
              <button type="button" onClick={() => f.open({ label: pickedBlock.clip.name, entryIds: [], text: pickedBlock.clip.transcript, clips: [pickedBlock.clip] })} className="press pill-ink h-10 flex-1 justify-center gap-2 px-3 t-label">
                <Paint name="pattern-maps" h={18} /> Pattern map
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setBlocks((bs) => bs.filter((x) => x.id !== pickedBlock.id));
                setPicked(null);
                setDirty(true);
              }}
              className={`press pill-in h-10 px-4 t-label text-[#c4321f] ${pickedBlock.kind === "audio" ? "" : "flex-1 justify-center"}`}
            >
              Remove
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating above the keyboard: formatting, with the tools for selected words on top */}
      <AnimatePresence>
        {editing && (
          <motion.div
            key="kb"
            className="absolute inset-x-3 z-10 flex flex-col gap-2"
            style={{ bottom: 10 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.15 } }}
            transition={SPRING.ui}
          >
            <AnimatePresence mode="popLayout">
              {styles && !linking ? (
                <motion.div
                  key="styles"
                  className="grid grid-cols-4 gap-1 rounded-[22px] bg-paper p-1"
                  style={{ boxShadow: "var(--lift-2)", transformOrigin: "bottom left" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={SPRING.ui}
                >
                  {[
                    { tag: "h2", label: "Title", cls: "text-[17px] font-medium" },
                    { tag: "h3", label: "Heading", cls: "text-[14px] font-medium" },
                    { tag: "p", label: "Body", cls: "text-[13px]" },
                    { tag: "blockquote", label: "Quote", cls: "text-[13px] italic" },
                  ].map((o) => {
                    const on = String(act.block || "p") === o.tag || (o.tag === "p" && act.block === "div");
                    return (
                      <button key={o.tag} type="button" onMouseDown={keep} onPointerDown={keep} onClick={() => block(o.tag)} className={`press h-11 rounded-[18px] ${o.cls} transition-colors duration-150 ${on ? "bg-ink text-paper" : "text-ink active:bg-fill"}`}>
                        {o.label}
                      </button>
                    );
                  })}
                </motion.div>
              ) : selText && !linking ? (
                <motion.div
                  key="sel"
                  className="flex items-center gap-1 rounded-[22px] bg-paper p-1"
                  style={{ boxShadow: "var(--lift-2)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={SPRING.ui}
                >
                  <span className="min-w-0 flex-1 truncate pl-3 t-meta text-ink-3">“{selText}”</span>
                  <button type="button" onMouseDown={keep} onPointerDown={keep} onClick={runSel} className="press flex h-10 shrink-0 items-center gap-2 rounded-[18px] bg-fill pl-2 pr-3 t-meta text-ink">
                    <Paint name="pattern-maps" h={18} />
                    Pattern map
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="overflow-hidden rounded-[24px] bg-paper" style={{ boxShadow: "var(--lift-2)" }}>
              {linking ? (
                <form
                  className="flex h-12 items-center gap-2 px-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (url.trim()) exec("createLink", /^https?:/.test(url) ? url.trim() : `https://${url.trim()}`);
                    setLinking(false);
                    setUrl("");
                  }}
                >
                  <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste or type a link" inputMode="url" className="h-10 min-w-0 flex-1 rounded-[18px] bg-fill px-4 t-body outline-none" />
                  <button type="submit" className="press pill-ink h-10 px-4 t-label">
                    Add
                  </button>
                </form>
              ) : (
                <div className="no-scrollbar flex h-12 items-center gap-[2px] overflow-x-auto px-1">
                  {(
                    [
                      { k: "styles", label: "Text styles", node: <span className="text-[15px] font-medium tracking-[-0.02em]">Aa</span>, on: styles, go: () => setStyles((v) => !v) },
                      "|",
                      { k: "bold", label: "Bold", node: <I.Bold size={18} />, on: !!act.bold, go: () => exec("bold") },
                      { k: "italic", label: "Italic", node: <I.Italic size={18} />, on: !!act.italic, go: () => exec("italic") },
                      { k: "underline", label: "Underline", node: <I.Underline size={18} />, on: !!act.underline, go: () => exec("underline") },
                      { k: "strike", label: "Strikethrough", node: <I.Strike size={18} />, on: !!act.strikeThrough, go: () => exec("strikeThrough") },
                      "|",
                      { k: "ul", label: "Bulleted list", node: <I.Bullets size={18} />, on: !!act.insertUnorderedList, go: () => exec("insertUnorderedList") },
                      { k: "ol", label: "Numbered list", node: <I.Numbers size={18} />, on: !!act.insertOrderedList, go: () => exec("insertOrderedList") },
                      { k: "hl", label: "Highlight", node: <I.Highlight size={18} />, on: false, go: () => exec("hiliteColor", "#e3efc4") },
                      "|",
                      {
                        k: "link",
                        label: "Link",
                        node: <I.Link size={18} />,
                        on: false,
                        go: () => {
                          if (!range.current || range.current.collapsed) return f.toast("Select some words to link first.");
                          setLinking(true);
                        },
                      },
                      { k: "photo", label: "Add a photo", node: <I.Camera size={18} />, on: false, go: () => cam.current?.click() },
                      {
                        k: "paste",
                        label: "Paste",
                        node: <I.Clipboard size={18} />,
                        on: false,
                        go: async () => {
                          try {
                            const t = await navigator.clipboard.readText();
                            if (t) exec("insertHTML", esc(t).replace(/\n/g, "<br>"));
                          } catch {
                            f.toast("Paste needs clipboard access. Long-press to paste instead.");
                          }
                        },
                      },
                      "|",
                      { k: "undo", label: "Undo", node: <I.Undo size={18} />, on: false, go: () => exec("undo") },
                      { k: "redo", label: "Redo", node: <I.Redo size={18} />, on: false, go: () => exec("redo") },
                      { k: "done", label: "Hide keyboard", node: <I.KeyboardDown size={18} />, on: false, go: () => (document.activeElement as HTMLElement | null)?.blur() },
                    ] as const
                  ).map((t, i) =>
                    t === "|" ? (
                      <span key={`d${i}`} className="mx-1 h-5 w-px shrink-0 bg-[var(--line)]" aria-hidden />
                    ) : (
                      <button
                        key={t.k}
                        type="button"
                        aria-label={t.label}
                        aria-pressed={t.on}
                        onMouseDown={keep}
                        onPointerDown={keep}
                        onClick={t.go}
                        className={`press grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150 ${t.on ? "bg-ink text-paper" : "text-ink active:bg-fill"}`}
                      >
                        {t.node}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <input
        ref={cam}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertMedia(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
