"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, ChevronUp, BookOpen, ExternalLink, Calendar, Sparkles } from 'lucide-react';
import Toast, { ToastType } from '@/components/ui/toast';
import JournalAnalysis from '@/components/JournalAnalysis';
import { getAllJournalEntries } from '@/utilities/journal-data';
import { createClient } from '@/utils/supabase/client';
import { autoInitializeEncryptionForOAuthUser } from '@/utils/encryption';
import { isEncryptionInitialized, restoreEncryptionFromCache } from '@/utils/encryption/keyManager';

interface JournalEntry {
  journalId: string;
  title: string;
  content: string;
  resolvedContent?: string;
  date: string;
  createdAt?: string;
}

export default function EntriesAnalysisPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [query, setQuery] = useState('');
  const [isMobilePickerOpen, setIsMobilePickerOpen] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  }>({
    visible: false,
    message: '',
    type: 'info',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) {
          const userId = data.user.id;
          setUser({ id: userId });

          // Ensure encryption keys are available before loading entries,
          // otherwise encrypted rows appear as locked placeholders.
          if (!isEncryptionInitialized()) {
            const restored = await restoreEncryptionFromCache(userId);

            if (!restored) {
              try {
                await autoInitializeEncryptionForOAuthUser(userId);
              } catch (encErr) {
                console.warn('[EntriesAnalysisPage] Encryption auto-init skipped/failed:', encErr);
              }
            }
          }
        }

        const fetched = await getAllJournalEntries();
        setEntries(fetched as JournalEntry[]);
        if (fetched?.length > 0) {
          setSelectedId((fetched[0] as JournalEntry).journalId);
        }
      } catch (err) {
        console.error('Failed to load entries for analysis:', err);
        setError('Failed to load journal entries.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const title = (entry.title || '').toLowerCase();
      const content = (entry.resolvedContent || entry.content || '').toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }, [entries, query]);

  useEffect(() => {
    if (!filteredEntries.length) {
      setSelectedId(null);
      return;
    }

    const selectedStillVisible = filteredEntries.some((e) => e.journalId === selectedId);
    if (!selectedStillVisible && filteredEntries[0]) {
      setSelectedId(filteredEntries[0].journalId);
    }
  }, [filteredEntries, selectedId]);

  const selectedEntry = filteredEntries.find((entry) => entry.journalId === selectedId) || null;
  const getEntryTimestamp = (entry: JournalEntry) => entry.createdAt || entry.date;

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({
      visible: true,
      message,
      type,
    });
  };

  const selectEntry = (journalId: string) => {
    setSelectedId(journalId);
    setIsMobilePickerOpen(false);
  };

  return (
    <section className="mx-auto max-w-7xl min-w-0 px-1 sm:px-0">
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      {/* Page Header */}
      <header className="mb-4 rounded-2xl border border-[#dccdbf] bg-[#fffdf9] px-4 py-3.5 shadow-xs sm:mb-5 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a7263] sm:text-[11px]">Single Entry Analysis</p>
            <h2 className="mt-0.5 text-xl font-semibold text-[#332620] sm:text-2xl" style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}>
              Thought Threads
            </h2>
            <p className="mt-0.5 text-xs text-[#685447] sm:text-sm">Choose one journal entry to run a focused, clean analysis and cognition flow.</p>
          </div>
          {entries.length > 0 && (
            <span className="self-start rounded-full border border-[#d8c6b8] bg-[#fbf6f0] px-3 py-1 text-xs font-semibold text-[#7c6859] sm:self-center">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} available
            </span>
          )}
        </div>
      </header>

      {/* Mobile Entry Selector Hub (< lg viewports) */}
      <div className="mb-4 block lg:hidden">
        <div className="rounded-2xl border border-[#dccdbf] bg-[#fffdf9] p-3 shadow-xs">
          {/* Active Entry Bar + Switch Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a7263]">Active Entry</p>
              <h3 className="truncate text-sm font-semibold text-[#332620]">
                {selectedEntry ? (selectedEntry.title || 'Untitled entry') : 'No entry selected'}
              </h3>
              {selectedEntry && (
                <p className="text-[11px] text-[#7c6859]">
                  {new Date(getEntryTimestamp(selectedEntry)).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsMobilePickerOpen((prev) => !prev)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#c4ab99] bg-[#f5ebe0] px-3 py-1.5 text-xs font-semibold text-[#5a4235] transition hover:bg-[#eddcca] active:scale-95"
            >
              <BookOpen size={13} />
              <span>{isMobilePickerOpen ? 'Hide Picker' : 'Switch Entry'}</span>
              {isMobilePickerOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {/* Quick-switch horizontal scroll chips */}
          {filteredEntries.length > 1 && !isMobilePickerOpen && (
            <div className="mt-3 border-t border-[#eee2d7] pt-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a7263]">Quick Switch</p>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
                {filteredEntries.map((entry) => {
                  const isActive = entry.journalId === selectedId;
                  return (
                    <button
                      key={entry.journalId}
                      type="button"
                      onClick={() => selectEntry(entry.journalId)}
                      className={[
                        'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition',
                        isActive
                          ? 'border-[#8f7363] bg-[#2f241f] text-white shadow-xs'
                          : 'border-[#dacbbf] bg-white text-[#685447] hover:bg-[#fbf4ec]',
                      ].join(' ')}
                    >
                      <span className="truncate max-w-[140px] inline-block align-middle">
                        {entry.title || 'Untitled'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collapsible Search & Entry List Drawer */}
          {isMobilePickerOpen && (
            <div className="mt-3 border-t border-[#eee2d7] pt-3">
              <label className="relative mb-2.5 block">
                <span className="sr-only">Search entries</span>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8576]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search entries..."
                  className="w-full rounded-xl border border-[#dacbbf] bg-white py-2 pl-9 pr-3 text-xs text-[#3e2e26] outline-none transition focus:border-[#9a7f6d]"
                />
              </label>

              {loading ? (
                <div className="rounded-xl border border-[#e3d6cb] bg-[#fffcf8] px-3 py-3 text-xs text-[#6e5a4b]">
                  Loading entries...
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">{error}</div>
              ) : filteredEntries.length === 0 ? (
                <div className="rounded-xl border border-[#e3d6cb] bg-[#fffcf8] px-3 py-3 text-xs text-[#6e5a4b]">
                  No entries found matching "{query}".
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {filteredEntries.map((entry) => {
                    const isActive = entry.journalId === selectedId;
                    const displayContent = entry.resolvedContent || entry.content;
                    return (
                      <button
                        key={entry.journalId}
                        onClick={() => selectEntry(entry.journalId)}
                        className={[
                          'w-full rounded-xl border px-3 py-2.5 text-left transition',
                          isActive
                            ? 'border-[#a18674] bg-[#f7efe6]'
                            : 'border-[#e3d6cb] bg-white hover:border-[#ccb8a9] hover:bg-[#fbf4ec]',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[#3e2e26]">
                            {entry.title || 'Untitled entry'}
                          </span>
                          <span className="shrink-0 text-[10px] text-[#7c6859]">
                            {new Date(getEntryTimestamp(entry)).toLocaleDateString()}
                          </span>
                        </div>
                        {displayContent && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[#6e5a4b]">
                            {displayContent}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main 2-Column Responsive Grid */}
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        {/* Desktop Sidebar (lg:col-span-4) */}
        <aside className="hidden rounded-2xl border border-[#dccdbf] bg-[#fffdf9] p-4 lg:col-span-4 lg:block lg:self-start lg:sticky lg:top-20">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#8a7263]">Select Entry</p>
            <span className="text-xs text-[#8a7263]">{filteredEntries.length} entries</span>
          </div>

          <label className="relative mb-3 block">
            <span className="sr-only">Search entries</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8576]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entries..."
              className="w-full rounded-xl border border-[#dacbbf] bg-white py-2 pl-9 pr-3 text-sm text-[#3e2e26] outline-none transition focus:border-[#9a7f6d]"
            />
          </label>

          {loading ? (
            <div className="rounded-xl border border-[#e3d6cb] bg-[#fffcf8] px-3 py-4 text-sm text-[#6e5a4b]">
              Loading entries...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-700">{error}</div>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-xl border border-[#e3d6cb] bg-[#fffcf8] px-3 py-4 text-sm text-[#6e5a4b]">No entries found.</div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredEntries.map((entry) => {
                const isActive = entry.journalId === selectedId;
                const displayContent = entry.resolvedContent || entry.content;
                return (
                  <button
                    key={entry.journalId}
                    onClick={() => selectEntry(entry.journalId)}
                    className={[
                      'w-full rounded-xl border px-3.5 py-3 text-left transition',
                      isActive
                        ? 'border-[#a18674] bg-[#f7efe6] shadow-xs'
                        : 'border-[#e3d6cb] bg-[#fffcf8] hover:border-[#ccb8a9] hover:bg-[#fbf4ec]',
                    ].join(' ')}
                  >
                    <div className="text-sm font-semibold text-[#3e2e26] break-words">{entry.title || 'Untitled entry'}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[#7c6859]">
                      <Calendar size={11} />
                      <span>{new Date(getEntryTimestamp(entry)).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-[#6e5a4b] whitespace-pre-wrap break-words">
                      {displayContent || 'No content'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Main Content Pane (Full width on mobile, lg:col-span-8 on desktop) */}
        <main className="min-w-0 rounded-2xl border border-[#dccdbf] bg-[#fffdf9] p-3.5 sm:p-5 lg:col-span-8">
          {!selectedEntry ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[#d7c1b1] bg-[#fffcf8] p-6 text-center sm:min-h-80 sm:p-8">
              <Sparkles size={24} className="mb-2 text-[#9a7f6d]" />
              <p className="text-base font-semibold text-[#3e2e26]">No journal entry selected</p>
              <p className="mt-1 text-xs text-[#6e5a4b] sm:text-sm">
                Choose an entry from the list to begin Thought Threads and Cognition Engine analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {/* Selected Entry Card */}
              <div className="rounded-xl border border-[#e3d6cb] bg-[#fffcf8] p-3.5 sm:p-4.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a7263] sm:text-[11px]">Selected Entry</p>
                    <h3 className="mt-1 text-base font-semibold text-[#3e2e26] break-words sm:text-lg" style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}>
                      {selectedEntry.title || 'Untitled entry'}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#7c6859]">{new Date(getEntryTimestamp(selectedEntry)).toLocaleString()}</p>
                  </div>
                  <Link
                    href={`/journal/${selectedEntry.journalId}`}
                    className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#d2c0b2] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#6f5647] transition hover:bg-[#f8efe7] sm:w-auto"
                  >
                    <span>Open Original</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>

                <div className="mt-3">
                  <p
                    className={[
                      'text-xs text-[#58453a] whitespace-pre-wrap break-words leading-relaxed sm:text-sm',
                      !isContentExpanded ? 'line-clamp-4' : '',
                    ].join(' ')}
                  >
                    {selectedEntry.resolvedContent || selectedEntry.content || 'No content'}
                  </p>
                  {(selectedEntry.resolvedContent || selectedEntry.content || '').length > 200 && (
                    <button
                      type="button"
                      onClick={() => setIsContentExpanded((prev) => !prev)}
                      className="mt-1.5 text-xs font-semibold text-[#8a7263] hover:underline"
                    >
                      {isContentExpanded ? 'Show less' : 'Read full text'}
                    </button>
                  )}
                </div>
              </div>

              {/* Journal Analysis & Cognition Engine Workspace */}
              {user ? (
                <JournalAnalysis
                  journalId={selectedEntry.journalId}
                  journal={{
                    title: selectedEntry.title || '',
                    content: selectedEntry.resolvedContent || selectedEntry.content || '',
                  }}
                  user={{ id: user.id }}
                  showToast={showToast}
                />
              ) : (
                <div className="rounded-xl border border-[#e3d6cb] bg-[#fffcf8] p-4 text-sm text-[#6e5a4b]">
                  Sign in to unlock Thought Threads for each entry.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
