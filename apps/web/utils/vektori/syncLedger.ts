export const SYNC_LEDGER_KEY = 'vektori:syncLedger';
export const BACKFILL_SUMMARY_KEY = 'vektori:lastBackfill';

export type SyncLedger = Record<string, string>;

export function loadSyncLedger(): SyncLedger {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(SYNC_LEDGER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSyncLedger(ledger: SyncLedger) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_LEDGER_KEY, JSON.stringify(ledger));
}

export function clearSyncLedger() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SYNC_LEDGER_KEY);
}

export function getIndexedJournalCount(ledger: SyncLedger = loadSyncLedger()) {
  return Object.keys(ledger).length;
}
