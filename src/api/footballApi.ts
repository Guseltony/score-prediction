/**
 * footballApi.ts — Base API client for api-football.com (v3.football.api-sports.io)
 *
 * In development: requests go through the Vite proxy at /api-football/*
 *   → proxy injects the auth headers and forwards to api-sports.io (no CORS issue)
 *
 * In production: requests go directly to api-sports.io with the auth header.
 *   (api-sports.io does support CORS for production browser requests)
 */

// In dev the Vite proxy handles auth headers; in prod we call directly.
const BASE_URL = import.meta.env.DEV
  ? '/api-football'
  : 'https://v3.football.api-sports.io';

function getApiKey(): string {
  return import.meta.env.VITE_API_FOOTBALL_KEY as string ?? '';
}

/**
 * Core fetch wrapper.
 * @param endpoint  e.g. '/teams'
 * @param params    query string params object
 */
export async function apiFetch<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  // Build URL — relative BASE_URL (proxy) needs the window origin as base
  const fullBase = BASE_URL.startsWith('/')
    ? `${window.location.origin}${BASE_URL}`
    : BASE_URL;
  const url = new URL(`${fullBase}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  // In dev the proxy injects headers, so we only need the key in prod
  const headers: Record<string, string> = {};
  if (!import.meta.env.DEV) {
    const key = getApiKey();
    if (key) {
      headers['x-apisports-key'] = key;
      headers['x-apisports-host'] = 'v3.football.api-sports.io';
    }
  }

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // API-Football wraps all responses in { response: [...], errors: {} }
  const errs = json.errors;
  if (errs && !Array.isArray(errs) && Object.keys(errs).length > 0) {
    const errMsg = Object.values(errs).join(', ');
    throw new Error(`API-Football API error: ${errMsg}`);
  }

  return json as T;
}
