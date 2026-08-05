/**
 * storage.ts — Typed localStorage service with TTL support.
 *
 * Replaces the thin localStorage.ts for all app state persistence.
 * All operations are silent-fail (never throw to the caller).
 */

// ─── Key Registry ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  HISTORY:         'csp_history_v2',
  XG_SETTINGS:     'csp_xg_settings',
  PREDICTION_MODE: 'csp_prediction_mode',
  MODIFIERS:       'csp_modifiers',
  SMART_FILTER:    'csp_smart_filter',
  MAX_GOALS:       'csp_max_goals',
  LAST_FIXTURE:    'csp_last_fixture',
  ODDS_ALPHA:      'csp_odds_alpha',
} as const;

// ─── TTL Wrapper ──────────────────────────────────────────────────────────────
interface TTLEntry<T> {
  data: T;
  expiresAt: number; // unix ms
}

// ─── Core API ────────────────────────────────────────────────────────────────

/** Read a JSON value from localStorage, returning `fallback` on any failure. */
export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write a JSON value to localStorage. Silently ignores quota errors. */
export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or unavailable (e.g. private mode)
  }
}

/** Remove a key from localStorage. */
export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Write a value with a time-to-live.
 * @param ttlMs — milliseconds until the entry expires (e.g. 24 * 60 * 60 * 1000 for 24 h)
 */
export function storageSetWithTTL<T>(key: string, value: T, ttlMs: number): void {
  const entry: TTLEntry<T> = {
    data: value,
    expiresAt: Date.now() + ttlMs,
  };
  storageSet(key, entry);
}

/**
 * Read a TTL-wrapped value. Returns `null` if missing or expired.
 */
export function storageGetWithTTL<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as TTLEntry<T>;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

// ─── TTL Constants ────────────────────────────────────────────────────────────
export const TTL = {
  ONE_HOUR:      60 * 60 * 1000,
  SIX_HOURS:     6  * 60 * 60 * 1000,
  TWENTY_FOUR_H: 24 * 60 * 60 * 1000,
} as const;
