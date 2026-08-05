/**
 * footballApi.ts — Base API client for api-football.com (v3.football.api-sports.io)
 *
 * All requests use the API key from the environment variable VITE_API_FOOTBALL_KEY.
 * Every endpoint call goes through `apiFetch` which handles headers and error normalisation.
 */

const BASE_URL = 'https://v3.football.api-sports.io';

function getApiKey(): string {
  const key = import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined;
  if (!key) throw new Error('VITE_API_FOOTBALL_KEY is not set in .env');
  return key;
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
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': getApiKey(),
      'x-apisports-host': 'v3.football.api-sports.io',
    },
  });

  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // API-Football wraps all responses in { response: [...], errors: {} }
  if (json.errors && Object.keys(json.errors).length > 0) {
    const errMsg = Object.values(json.errors).join(', ');
    throw new Error(`API-Football API error: ${errMsg}`);
  }

  return json as T;
}
