/**
 * groupPages.ts
 *
 * Pure client-side utility that groups OCR-extracted pages into
 * separate journal entries based on Claude's date-detection results.
 *
 * Grouping rules (applied in scan order):
 *   1. If page.isContinuation → append to the current (last) group
 *   2. If page has a date and a group with that date already exists → append to it
 *   3. If page has a date but no existing group → create a new group
 *   4. If page has no date and is not a continuation → append to the current group
 *      (or create an "undated" group if it's the first page)
 */

import type { PageData, DateDetectionResult, JournalGroup } from './BulkJournalImport';

// ── Helpers ──────────────────────────────────────────────────────────

let _groupCounter = 0;
function nextGroupId(): string {
  _groupCounter += 1;
  return `g_${Date.now()}_${_groupCounter}`;
}

function lowestConfidence(
  a: 'high' | 'medium' | 'low',
  b: 'high' | 'medium' | 'low',
): 'high' | 'medium' | 'low' {
  const rank = { high: 3, medium: 2, low: 1 };
  return rank[a] <= rank[b] ? a : b;
}

// ── Main ─────────────────────────────────────────────────────────────

export function groupPages(
  pages: PageData[],
  dateResults: DateDetectionResult[],
  defaultAttachImages = true,
): JournalGroup[] {
  if (pages.length === 0) return [];

  // Build a quick lookup: pageIndex → detection result
  const detectionMap = new Map<number, DateDetectionResult>();
  for (const dr of dateResults) {
    detectionMap.set(dr.pageIndex, dr);
  }

  const groups: JournalGroup[] = [];
  // dateKey → index in groups[] for fast lookup of existing date groups
  const dateGroupIndex = new Map<string, number>();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const detection = detectionMap.get(i);

    const isContinuation = detection?.isContinuation ?? false;
    const date = detection?.date ?? null;
    const confidence = detection?.confidence ?? 'low';

    // ── Rule 1: continuation → append to current (last) group ──────
    if (isContinuation && groups.length > 0) {
      const lastGroup = groups[groups.length - 1]!;
      lastGroup.pages.push(page);
      lastGroup.confidence = lowestConfidence(lastGroup.confidence, confidence);
      lastGroup.combinedText = buildCombinedText(lastGroup.pages);
      continue;
    }

    // ── Rule 2 & 3: page has a date ────────────────────────────────
    if (date) {
      const existingIdx = dateGroupIndex.get(date);

      if (existingIdx !== undefined && groups[existingIdx]) {
        // Rule 2 — existing group with same date
        const group = groups[existingIdx]!;
        group.pages.push(page);
        group.confidence = lowestConfidence(group.confidence, confidence);
        group.combinedText = buildCombinedText(group.pages);
      } else {
        // Rule 3 — new group
        const newGroup = createGroup(date, confidence, page, defaultAttachImages);
        dateGroupIndex.set(date, groups.length);
        groups.push(newGroup);
      }
      continue;
    }

    // ── Rule 4: no date, not continuation ──────────────────────────
    if (groups.length > 0) {
      // Append to the last group
      const lastGroup = groups[groups.length - 1]!;
      lastGroup.pages.push(page);
      lastGroup.confidence = lowestConfidence(lastGroup.confidence, confidence);
      lastGroup.combinedText = buildCombinedText(lastGroup.pages);
    } else {
      // Very first page with no date → create an "undated" group
      const newGroup = createGroup(null, confidence, page, defaultAttachImages);
      groups.push(newGroup);
    }
  }

  return groups;
}

// ── Internal helpers ─────────────────────────────────────────────────

function createGroup(
  date: string | null,
  confidence: 'high' | 'medium' | 'low',
  firstPage: PageData,
  attachImages: boolean,
): JournalGroup {
  return {
    groupId: nextGroupId(),
    date,
    confidence,
    pages: [firstPage],
    combinedText: firstPage.rawText,
    title: '',
    tags: ['handwritten', 'imported'],
    journalType: 'journal',
    includeInImport: true,
    attachImages,
  };
}

function buildCombinedText(pages: PageData[]): string {
  return pages.map((p) => p.rawText).join('\n\n---\n\n');
}
