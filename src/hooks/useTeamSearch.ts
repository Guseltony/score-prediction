/**
 * useTeamSearch — Search for teams by name.
 * Fires when the query string is ≥ 3 characters.
 * Results are cached indefinitely (team names/crests don't change).
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/footballApi';
import type { ApiResponse, ApiTeamResult } from '../api/types';

export function useTeamSearch(query: string) {
  return useQuery({
    queryKey: ['teams', 'search', query],
    queryFn: () => apiFetch<ApiResponse<ApiTeamResult>>('/teams', { search: query }),
    enabled: query.trim().length >= 3,
    staleTime: Infinity,   // team records never go stale
    select: (data) => data.response,
  });
}
