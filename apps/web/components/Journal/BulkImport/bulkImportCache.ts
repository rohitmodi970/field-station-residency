/**
 * bulkImportCache.ts
 *
 * Persists bulk-import wizard state to sessionStorage so the user can
 * survive a page reload without losing progress.
 *
 * What IS cached (all JSON-serialisable):
 *   - currentStep, processingPhase
 *   - uploadResults (filePaths, not File blobs)
 *   - tempFolder
 *   - pages (OCR text)
 *   - dateResults
 *   - journalGroups
 *   - attachImages
 *
 * What is NOT cached:
 *   - uploadedFiles (contains File objects / blob URLs — not serialisable)
 *     If the user reloads during Step 1 they simply restart the file picker.
 *     If they reload after Step 2 the cached uploadResults carry the info.
 */

import type { PageData, DateDetectionResult, JournalGroup } from './BulkJournalImport';
import type { FileUploadProgress } from './ProcessingStep';

const CACHE_KEY = 'bulk_import_state';
const CACHE_VERSION = 1;

// ─── Shape ───────────────────────────────────────────────────────────

export interface BulkImportCacheData {
  version: number;
  savedAt: number; // Date.now()
  currentStep: string;
  processingPhase: string;
  uploadResults: FileUploadProgress[];
  tempFolder: string;
  pages: PageData[];
  dateResults: DateDetectionResult[];
  journalGroups: JournalGroup[];
  attachImages: boolean;
}

// ─── Save ────────────────────────────────────────────────────────────

export function saveBulkImportCache(data: Omit<BulkImportCacheData, 'version' | 'savedAt'>): void {
  try {
    const payload: BulkImportCacheData = {
      ...data,
      version: CACHE_VERSION,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[BulkImportCache] Failed to save:', err);
  }
}

// ─── Load ────────────────────────────────────────────────────────────

export function loadBulkImportCache(): BulkImportCacheData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as BulkImportCacheData;

    // Version check
    if (data.version !== CACHE_VERSION) {
      clearBulkImportCache();
      return null;
    }

    // Expire after 2 hours
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    if (Date.now() - data.savedAt > TWO_HOURS) {
      clearBulkImportCache();
      return null;
    }

    return data;
  } catch (err) {
    console.warn('[BulkImportCache] Failed to load:', err);
    clearBulkImportCache();
    return null;
  }
}

// ─── Clear ───────────────────────────────────────────────────────────

export function clearBulkImportCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
