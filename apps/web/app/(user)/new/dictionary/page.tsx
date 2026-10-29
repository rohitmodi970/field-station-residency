"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Book, ArrowLeft, Volume2, Plus, Pencil, Trash2, Search, X, ChevronUp, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button2";
import { ScrollArea } from "@/components/ui/quilted-gallery/ui/scroll-area";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/quilted-gallery/ui/dialog";
import {
  DictionaryMutationInput,
  DictionaryWord,
  useDictionary,
} from "@/hooks/useDictionary";
import { useDebounce } from "@/hooks/use-debounce";
import Toast, { ToastType } from "@/components/ui/toast";

interface WordFormState {
  term: string;
  pronunciation: string;
  definition: string;
  examples: string;
}

const emptyForm: WordFormState = {
  term: "",
  pronunciation: "",
  definition: "",
  examples: "",
};

function toFormState(word: DictionaryWord): WordFormState {
  return {
    term: word.term,
    pronunciation: word.pronunciation ?? "",
    definition: word.definition,
    examples: (word.examples || []).join("\n"),
  };
}

function toPayload(form: WordFormState): DictionaryMutationInput {
  return {
    term: form.term,
    pronunciation: form.pronunciation,
    definition: form.definition,
    examples: form.examples
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

const Dictionary = () => {
  const {
    words,
    selectedWord,
    loading,
    error,
    total,
    search,
    sortBy,
    sortOrder,
    setSearch,
    setSortBy,
    setSortOrder,
    setSelectedWordId,
    refresh,
    addWord,
    updateWord,
    deleteWord,
  } = useDictionary();

  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<WordFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("info");
  const [filterOpen, setFilterOpen] = useState(false);
  // Mobile: toggle between list and detail panels
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const router = useRouter();
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setSearch(debouncedSearch); }, [debouncedSearch, setSearch]);

  const sortedLabel = useMemo(() => {
    if (sortBy === "term") return "Term";
    if (sortBy === "updated_at") return "Updated";
    return "Created";
  }, [sortBy]);

  const openCreateForm = () => { setMode("create"); setForm(emptyForm); setFormError(null); };
  const openEditForm = () => {
    if (!selectedWord) return;
    setMode("edit"); setForm(toFormState(selectedWord)); setFormError(null);
  };
  const closeForm = () => { setMode(null); setForm(emptyForm); setFormError(null); };

  const showToast = (message: string, type: ToastType) => {
    setToastVisible(false);
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastVisible(true), 10);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await addWord(toPayload(form));
        await refresh();
        showToast("Word added", "success");
      }
      if (mode === "edit" && selectedWord) {
        await updateWord(selectedWord.id, toPayload(form));
        await refresh();
        showToast("Word updated", "success");
      }
      closeForm();
    } catch (submitError: any) {
      setFormError(submitError.message || "Failed to save word");
      showToast("Failed to save word", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWord) return;
    const confirmed = window.confirm(`Delete "${selectedWord.term}"?`);
    if (!confirmed) return;
    try {
      await deleteWord(selectedWord.id);
      await refresh();
      showToast("Word deleted", "success");
      setMobileView("list");
    } catch (deleteError: any) {
      showToast("Failed to delete word", "error");
    }
  };

  const handleSpeak = () => {
    if (!selectedWord) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showToast("Pronunciation is not supported in this browser", "warning");
      return;
    }

    const textToSpeak = selectedWord.pronunciation?.trim() || selectedWord.term;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const selectWord = (id: string) => {
    setSelectedWordId(id);
    setMobileView("detail");
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col">
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      {/* ── Header ── */}
      <div className="px-4 sm:px-6 py-4 flex items-center gap-3 border-b border-border/20 bg-background/30 backdrop-blur-lg shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/new")}
          className="hover:bg-accent/20"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-3">
          <Book className="h-6 w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-serif-display font-semibold text-foreground">
            My Vocabulary
          </h1>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:block text-sm text-muted-foreground">
            {total} words collected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={openCreateForm}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Word</span>
          </Button>
        </div>
      </div>

      {/* ── Search & Sort bar ── */}
      <div className="px-4 sm:px-6 py-3 border-b border-border/20 bg-background/20 shrink-0">
        <div className="flex flex-wrap items-center gap-2">

          {/* Search input */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search term or definition…"
              className="h-9 w-full rounded-lg border border-border/30 bg-background/70 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterOpen((v) => !v)}
            className={`gap-1.5 ${filterOpen ? "bg-accent/20" : ""}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sort</span>
          </Button>

          {/* Edit / Delete — desktop toolbar */}
          <div className="hidden sm:flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={openEditForm}
              disabled={!selectedWord}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={!selectedWord}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Expandable sort pills */}
        {filterOpen && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/15">
            <span className="text-xs text-muted-foreground mr-1">Sort by</span>
            {(["term", "created_at", "updated_at"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1 rounded-full text-xs border transition-all ${
                  sortBy === key
                    ? "bg-primary/20 border-primary/30 text-foreground font-medium"
                    : "bg-background/40 border-border/20 text-muted-foreground hover:border-border/40"
                }`}
              >
                {key === "term" ? "Term" : key === "created_at" ? "Created" : "Updated"}
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortOrder("asc")}
                className={`h-7 w-7 ${sortOrder === "asc" ? "bg-accent/20" : ""}`}
                title="Ascending"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortOrder("desc")}
                className={`h-7 w-7 ${sortOrder === "desc" ? "bg-accent/20" : ""}`}
                title="Descending"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            <span className="w-full text-xs text-muted-foreground mt-0.5">
              Sorted by {sortedLabel} ({sortOrder})
            </span>
          </div>
        )}

        {(error || formError) && (
          <p className="mt-2 text-sm text-destructive">{error || formError}</p>
        )}
      </div>

      {/* ── Dialog ── */}
      <Dialog open={Boolean(mode)} onOpenChange={(open) => (!open ? closeForm() : undefined)}>
        <DialogContent className="bg-card border border-border/40 text-foreground shadow-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-xl text-foreground">
              {mode === "create" ? "Add New Word" : "Edit Word"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-3 mt-1">
            <input
              type="text"
              required
              placeholder="Term *"
              value={form.term}
              onChange={(e) => setForm((p) => ({ ...p, term: e.target.value }))}
              className="h-10 rounded-lg border border-border/30 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              placeholder="Pronunciation (optional)"
              value={form.pronunciation}
              onChange={(e) => setForm((p) => ({ ...p, pronunciation: e.target.value }))}
              className="h-10 rounded-lg border border-border/30 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <textarea
              required
              placeholder="Definition *"
              value={form.definition}
              onChange={(e) => setForm((p) => ({ ...p, definition: e.target.value }))}
              className="min-h-24 rounded-lg border border-border/30 bg-background/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <textarea
              placeholder="Examples (one per line)"
              value={form.examples}
              onChange={(e) => setForm((p) => ({ ...p, examples: e.target.value }))}
              className="min-h-24 rounded-lg border border-border/30 bg-background/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Saving…" : mode === "create" ? "Create" : "Update"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Main two-panel layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT: word list ── */}
        <div
          className={`
            border-r border-border/20 bg-card/30 backdrop-blur-sm shrink-0
            w-full md:w-72 lg:w-80
            ${mobileView === "detail" ? "hidden md:block" : "block"}
          `}
        >
          <ScrollArea className="h-full">
            <div className="p-4 space-y-1.5">
              {/* Skeleton placeholders */}
              {loading && (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg animate-pulse bg-card/40" />
                  ))}
                </div>
              )}

              {!loading && words.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Book className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No words found.</p>
                  <button
                    onClick={openCreateForm}
                    className="text-xs text-primary/70 hover:text-primary underline underline-offset-2 transition"
                  >
                    Add your first word
                  </button>
                </div>
              )}

              {words.map((word) => (
                <button
                  key={word.id}
                  onClick={() => selectWord(word.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 ${
                    selectedWord?.id === word.id
                      ? "glass-effect bg-primary/10 border border-primary/20 shadow-soft"
                      : "glass-effect bg-card/20 hover:shadow-medium border border-transparent hover:border-border/20"
                  }`}
                >
                  <h3 className="font-serif-display text-base font-medium text-foreground truncate">
                    {word.term}
                  </h3>
                  {word.pronunciation && (
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {word.pronunciation}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* ── RIGHT: word detail ── */}
        <div
          className={`
            flex-1 overflow-hidden
            ${mobileView === "list" ? "hidden md:block" : "block"}
          `}
        >
          <ScrollArea className="h-full">
            {selectedWord ? (
              <div className="p-6 sm:p-10 lg:p-12 max-w-3xl mx-auto animate-fade-in">
                {/* Mobile back button */}
                <button
                  onClick={() => setMobileView("list")}
                  className="md:hidden flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All words
                </button>

                <div className="glass-effect p-6 sm:p-8 rounded-2xl">
                  {/* Word header */}
                  <div className="flex items-start justify-between gap-4 mb-8">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-3xl sm:text-4xl font-serif-display font-bold text-foreground break-words mb-2">
                        {selectedWord.term}
                      </h2>
                      <div className="flex items-center gap-3">
                        {selectedWord.pronunciation && (
                          <span className="text-lg text-muted-foreground">
                            {selectedWord.pronunciation}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-accent/20"
                          onClick={handleSpeak}
                          aria-label={`Play pronunciation for ${selectedWord.term}`}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Edit / Delete — mobile only (desktop uses toolbar) */}
                    <div className="flex items-center gap-1 shrink-0 sm:hidden">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-accent/20"
                        onClick={openEditForm}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                        onClick={handleDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Definition */}
                  <div className="mb-8">
                    <h3 className="text-sm uppercase tracking-wider text-primary font-semibold mb-3">
                      Definition
                    </h3>
                    <p className="text-lg leading-relaxed text-foreground/90">
                      {selectedWord.definition}
                    </p>
                  </div>

                  {/* Examples */}
                  {selectedWord.examples && selectedWord.examples.length > 0 && (
                    <div>
                      <h3 className="text-sm uppercase tracking-wider text-primary font-semibold mb-3">
                        Examples
                      </h3>
                      <div className="space-y-3">
                        {selectedWord.examples.map((example, index) => (
                          <div
                            key={index}
                            className="pl-4 border-l-2 border-accent/30 py-2"
                          >
                            <p className="text-foreground/80 italic leading-relaxed">
                              "{example}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8 text-muted-foreground">
                <Book className="h-10 w-10 opacity-20" />
                <p className="text-sm">Select a word to view its details</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default Dictionary;