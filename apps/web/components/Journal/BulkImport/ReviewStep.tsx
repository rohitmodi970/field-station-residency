"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  Zap,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { JournalGroup } from './BulkJournalImport';

// ─── Props ───────────────────────────────────────────────────────────

interface ReviewStepProps {
  journalGroups: JournalGroup[];
  onGroupsChange: (groups: JournalGroup[]) => void;
  onConfirm: () => void;
  onBack: () => void;
}

// ─── Component ───────────────────────────────────────────────────────

const ReviewStep: React.FC<ReviewStepProps> = ({
  journalGroups,
  onGroupsChange,
  onConfirm,
  onBack,
}) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  // Track which cards are expanded
  const [expandedCards, setExpandedCards] = useState<Set<string>>(
    () => new Set(journalGroups.slice(0, 3).map((g) => g.groupId)),
  );
  // Track which cards are in content-edit mode
  const [editingContent, setEditingContent] = useState<Set<string>>(new Set());
  // Tag input state per group
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  // Title generation loading
  const [generatingTitles, setGeneratingTitles] = useState<Set<string>>(new Set());

  // ── Group mutation helpers ────────────────────────────────────────

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<JournalGroup>) => {
      onGroupsChange(
        journalGroups.map((g) =>
          g.groupId === groupId ? { ...g, ...patch } : g,
        ),
      );
    },
    [journalGroups, onGroupsChange],
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      onGroupsChange(journalGroups.filter((g) => g.groupId !== groupId));
    },
    [journalGroups, onGroupsChange],
  );

  // ── Toggle helpers ────────────────────────────────────────────────

  const toggleExpanded = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEditContent = (id: string) => {
    setEditingContent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Tag helpers ───────────────────────────────────────────────────

  const addTag = (groupId: string) => {
    const value = (tagInput[groupId] ?? '').trim();
    if (!value) return;
    const group = journalGroups.find((g) => g.groupId === groupId);
    if (!group) return;
    if (group.tags.includes(value)) return;
    updateGroup(groupId, { tags: [...group.tags, value] });
    setTagInput((prev) => ({ ...prev, [groupId]: '' }));
  };

  const removeTag = (groupId: string, tag: string) => {
    const group = journalGroups.find((g) => g.groupId === groupId);
    if (!group) return;
    updateGroup(groupId, { tags: group.tags.filter((t) => t !== tag) });
  };

  // ── Title generation ──────────────────────────────────────────────

  /** Clamp text to 200–3000 chars so we don't send huge payloads for title gen */
  const clampTextForTitle = (text: string): string => {
    if (text.length <= 3000) {
      return text.length >= 200 ? text : text.padEnd(200, ' ');
    }
    return text.slice(0, 3000);
  };

  const generateTitle = useCallback(
    async (groupId: string) => {
      const group = journalGroups.find((g) => g.groupId === groupId);
      if (!group) return;

      setGeneratingTitles((prev) => new Set(prev).add(groupId));
      try {
        const resp = await fetch('/api/journal/generate-titles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journals: [{ groupId, combinedText: clampTextForTitle(group.combinedText) }],
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const result = data.titles?.find(
            (t: { groupId: string; title: string }) => t.groupId === groupId,
          );
          if (result?.title) {
            updateGroup(groupId, { title: result.title });
          }
        }
      } catch (err) {
        console.error('[ReviewStep] Title generation failed:', err);
      } finally {
        setGeneratingTitles((prev) => {
          const next = new Set(prev);
          next.delete(groupId);
          return next;
        });
      }
    },
    [journalGroups, updateGroup],
  );

  const generateAllTitles = useCallback(async () => {
    const untitled = journalGroups.filter(
      (g) => g.includeInImport && !g.title.trim(),
    );
    if (untitled.length === 0) return;

    const ids = new Set(untitled.map((g) => g.groupId));
    setGeneratingTitles(ids);

    try {
      const resp = await fetch('/api/journal/generate-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journals: untitled.map((g) => ({
            groupId: g.groupId,
            combinedText: clampTextForTitle(g.combinedText),
          })),
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const titleMap = new Map<string, string>();
        for (const t of data.titles ?? []) {
          titleMap.set(t.groupId, t.title);
        }
        onGroupsChange(
          journalGroups.map((g) => {
            const newTitle = titleMap.get(g.groupId);
            return newTitle ? { ...g, title: newTitle } : g;
          }),
        );
      }
    } catch (err) {
      console.error('[ReviewStep] Bulk title generation failed:', err);
    } finally {
      setGeneratingTitles(new Set());
    }
  }, [journalGroups, onGroupsChange]);

  const hasAutoGenerated = useRef(false);

  useEffect(() => {
    if (!hasAutoGenerated.current) {
      hasAutoGenerated.current = true;
      generateAllTitles();
    }
  }, [generateAllTitles]);

  // ── Global actions ─────────────────────────────────────────────────

  const setAllAttachImages = (value: boolean) => {
    onGroupsChange(journalGroups.map((g) => ({ ...g, attachImages: value })));
  };

  // ── Computed ───────────────────────────────────────────────────────

  const includedCount = journalGroups.filter((g) => g.includeInImport).length;
  const totalPages = journalGroups.reduce((sum, g) => sum + g.pages.length, 0);

  // ── Format helpers ─────────────────────────────────────────────────

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const confidenceColor = (c: 'high' | 'medium' | 'low') => {
    const styles: Record<string, string> = {
      high: isDarkMode ? 'text-green-400' : 'text-green-600',
      medium: isDarkMode ? 'text-yellow-400' : 'text-yellow-600',
      low: isDarkMode ? 'text-red-400' : 'text-red-600',
    };
    return styles[c] ?? styles.low;
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Review &amp; Edit
          </h2>
          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {journalGroups.length} journal{journalGroups.length !== 1 ? 's' : ''} from {totalPages} page{totalPages !== 1 ? 's' : ''} — {includedCount} will be imported
          </p>
        </div>
      </div>

      {/* ── Global action bar ── */}
      <div
        className={`flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg border ${
          isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <button
          onClick={generateAllTitles}
          disabled={generatingTitles.size > 0}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            isDarkMode
              ? 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          } ${generatingTitles.size > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {generatingTitles.size > 0 ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Zap size={13} />
          )}
          Generate All Titles
        </button>

        <button
          onClick={() => setAllAttachImages(true)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            isDarkMode
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          <ImageIcon size={13} /> Attach All Images
        </button>

        <button
          onClick={() => setAllAttachImages(false)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            isDarkMode
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          <EyeOff size={13} /> Detach All Images
        </button>
      </div>

      {/* ── Journal cards ── */}
      <div className="space-y-4">
        <AnimatePresence>
          {journalGroups.map((group, gIdx) => {
            const isExpanded = expandedCards.has(group.groupId);
            const isEditing = editingContent.has(group.groupId);
            const isGenerating = generatingTitles.has(group.groupId);
            const dateStr = formatDate(group.date);

            return (
              <motion.div
                key={group.groupId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: group.includeInImport ? 1 : 0.5,
                  y: 0,
                }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-lg border overflow-hidden ${
                  isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                } ${!group.includeInImport ? 'opacity-50' : ''}`}
              >
                {/* ── Card header ── */}
                <button
                  onClick={() => toggleExpanded(group.groupId)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    isDarkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Calendar
                      size={16}
                      className={confidenceColor(group.confidence)}
                    />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Journal {gIdx + 1}
                        {dateStr ? ` — ${dateStr}` : ''}
                        {!group.date && (
                          <span className={`ml-2 text-xs font-normal ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                            No date detected
                          </span>
                        )}
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {group.pages.length} page{group.pages.length !== 1 ? 's' : ''}
                        {group.title && ` · ${group.title}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        group.includeInImport
                          ? isDarkMode
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-green-100 text-green-700'
                          : isDarkMode
                            ? 'bg-gray-700 text-gray-500'
                            : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {group.includeInImport ? 'Included' : 'Skipped'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                    ) : (
                      <ChevronDown size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                    )}
                  </div>
                </button>

                {/* ── Expanded body ── */}
                {isExpanded && (
                  <div className={`px-4 pb-4 space-y-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    {/* Title */}
                    <div className="pt-3">
                      <label className={`text-xs font-medium mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Title
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={group.title}
                          onChange={(e) => updateGroup(group.groupId, { title: e.target.value })}
                          placeholder="Enter a title or generate one…"
                          className={`flex-1 px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                          }`}
                        />
                        <button
                          onClick={() => generateTitle(group.groupId)}
                          disabled={isGenerating}
                          className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                            isDarkMode
                              ? 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50'
                              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Generate title with AI"
                        >
                          {isGenerating ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Zap size={12} />
                          )}
                          Generate
                        </button>
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className={`text-xs font-medium mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Date
                      </label>
                      <input
                        type="date"
                        value={group.date ?? ''}
                        onChange={(e) =>
                          updateGroup(group.groupId, {
                            date: e.target.value || null,
                          })
                        }
                        className={`px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        } ${!group.date ? (isDarkMode ? 'border-yellow-700' : 'border-yellow-400') : ''}`}
                      />
                      {!group.date && (
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          A date is required before import
                        </p>
                      )}
                    </div>

                    {/* Tags */}
                    <div>
                      <label className={`text-xs font-medium mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Tags
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {group.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                              isDarkMode
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <Tag size={10} />
                            {tag}
                            <button
                              onClick={() => removeTag(group.groupId, tag)}
                              className={`ml-0.5 hover:text-red-400 transition-colors`}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={tagInput[group.groupId] ?? ''}
                            onChange={(e) =>
                              setTagInput((prev) => ({
                                ...prev,
                                [group.groupId]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addTag(group.groupId);
                              }
                            }}
                            placeholder="Add tag…"
                            className={`w-20 px-2 py-0.5 rounded text-xs border outline-none ${
                              isDarkMode
                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                                : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                            }`}
                          />
                          <button
                            onClick={() => addTag(group.groupId)}
                            className={`p-0.5 rounded transition-colors ${
                              isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content preview / editor */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Content
                        </label>
                        <button
                          onClick={() => toggleEditContent(group.groupId)}
                          className={`text-xs flex items-center gap-1 transition-colors ${
                            isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          {isEditing ? (
                            <>
                              <Eye size={12} /> Preview
                            </>
                          ) : (
                            <>
                              <Edit3 size={12} /> Edit
                            </>
                          )}
                        </button>
                      </div>
                      {isEditing ? (
                        <textarea
                          value={group.combinedText}
                          onChange={(e) =>
                            updateGroup(group.groupId, {
                              combinedText: e.target.value,
                            })
                          }
                          rows={8}
                          className={`w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono leading-relaxed resize-y ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                          }`}
                        />
                      ) : (
                        <div
                          className={`px-3 py-2 rounded-lg text-sm leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap ${
                            isDarkMode
                              ? 'bg-gray-700/50 text-gray-300'
                              : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {group.combinedText.slice(0, 500)}
                          {group.combinedText.length > 500 && (
                            <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              … ({group.combinedText.length - 500} more characters)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Source pages */}
                    <div>
                      <label className={`text-xs font-medium mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Source Pages ({group.pages.length})
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {group.pages.map((p, pi) => (
                          <span
                            key={pi}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              isDarkMode
                                ? 'bg-gray-700 text-gray-400'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {p.fileName}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Attach images toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={group.attachImages}
                        onChange={(e) =>
                          updateGroup(group.groupId, {
                            attachImages: e.target.checked,
                          })
                        }
                        className="rounded"
                        style={{ accentColor: currentTheme.primary }}
                      />
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Attach original images to this journal
                      </span>
                    </label>

                    {/* Include / skip / delete buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() =>
                          updateGroup(group.groupId, {
                            includeInImport: !group.includeInImport,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          group.includeInImport
                            ? isDarkMode
                              ? 'bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40'
                              : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            : 'text-white hover:opacity-90'
                        }`}
                        style={
                          !group.includeInImport
                            ? { backgroundColor: elementColors.button }
                            : undefined
                        }
                      >
                        {group.includeInImport ? 'Skip this journal' : 'Include this journal'}
                      </button>

                      <button
                        onClick={() => removeGroup(group.groupId)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                          isDarkMode
                            ? 'text-red-400 hover:bg-red-900/20'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Footer buttons ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
            isDarkMode
              ? 'text-gray-300 hover:bg-gray-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <button
          onClick={onConfirm}
          disabled={includedCount === 0}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors hover:opacity-90 ${
            includedCount === 0 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: elementColors.button }}
        >
          Create {includedCount} Journal{includedCount !== 1 ? 's' : ''}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
