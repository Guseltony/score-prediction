/**
 * localStorage.ts — History persistence helpers.
 * Now delegates all storage operations to the central storage.ts service.
 */
import type { HistoryEntry } from '../types';
import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from './storage';

/** Serialise and persist history to localStorage. */
export function saveHistory(entries: HistoryEntry[]): void {
  storageSet(
    STORAGE_KEYS.HISTORY,
    entries.map((e) => ({ ...e, timestamp: e.timestamp.toISOString() }))
  );
}

/** Load and deserialise history from localStorage. Returns empty array on failure. */
export function loadHistory(): HistoryEntry[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: any[] = storageGet(STORAGE_KEYS.HISTORY, []);
  try {
    return parsed.map((e) => ({
      ...e,
      timestamp: new Date(e.timestamp as string),
      predictionMode: e.predictionMode ?? 'uniform',
    }));
  } catch {
    return [];
  }
}

/** Remove all persisted history. */
export function clearPersistedHistory(): void {
  storageRemove(STORAGE_KEYS.HISTORY);
}
