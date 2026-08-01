import type { HistoryEntry } from '../types';

const HISTORY_KEY = 'csp_history_v2';

/** Serialise and persist history to localStorage. Silently fails if unavailable. */
export function saveHistory(entries: HistoryEntry[]): void {
  try {
    const serialized = JSON.stringify(
      entries.map((e) => ({ ...e, timestamp: e.timestamp.toISOString() }))
    );
    localStorage.setItem(HISTORY_KEY, serialized);
  } catch {
    // Storage quota exceeded or localStorage not available (e.g. private mode)
  }
}

/** Load and deserialise history from localStorage. Returns empty array on failure. */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any[] = JSON.parse(raw);
    return parsed.map((e) => ({
      ...e,
      timestamp: new Date(e.timestamp as string),
      predictionMode: e.predictionMode ?? 'uniform', // backfill legacy entries
    }));
  } catch {
    return [];
  }
}

/** Remove all persisted history. */
export function clearPersistedHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
