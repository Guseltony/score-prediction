/**
 * useHeadToHead — Fetch H2H fixtures between two teams.
 *
 * Free plan notes:
 *  - The `last` parameter is NOT available (paid only)
 *  - No `status` filter needed — we filter client-side
 *  - Full H2H history (all seasons) is accessible
 *
 * We fetch all H2H, filter to finished games, sort newest-first, take 5.
 * Cached for 24 hours.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/footballApi';
import type { ApiResponse, ApiFixtureResult, RecentFixture } from '../api/types';
import { TTL } from '../utils/storage';

export function useHeadToHead(homeId: number | null, awayId: number | null) {
  const enabled = homeId !== null && awayId !== null;

  return useQuery({
    queryKey: ['h2h', homeId, awayId],
    queryFn: () =>
      apiFetch<ApiResponse<ApiFixtureResult>>('/fixtures/headtohead', {
        h2h: `${homeId}-${awayId}`,
        // NOTE: no `last` (paid only), no `status` — filter client-side
      }),
    enabled,
    staleTime: TTL.TWENTY_FOUR_H,
    select: (data): RecentFixture[] => {
      // Filter to finished fixtures only, sort newest first, take 5
      const finished = data.response.filter(
        (f) => f.fixture.status.short === 'FT' || f.fixture.status.short === 'AET' || f.fixture.status.short === 'PEN'
      );
      const sorted = [...finished].sort(
        (a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
      );
      return sorted.slice(0, 5).map((f) => {
        const homeGoals = f.goals.home ?? 0;
        const awayGoals = f.goals.away ?? 0;
        const isHome = f.teams.home.id === homeId;
        return {
          fixtureId: f.fixture.id,
          date: f.fixture.date,
          homeTeam: f.teams.home.name,
          awayTeam: f.teams.away.name,
          homeGoals,
          awayGoals,
          result: isHome
            ? homeGoals > awayGoals ? 'W' : homeGoals < awayGoals ? 'L' : 'D'
            : awayGoals > homeGoals ? 'W' : awayGoals < homeGoals ? 'L' : 'D',
        };
      });
    },
  });
}
