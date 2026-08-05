/**
 * useHeadToHead — Fetch last 5 H2H fixtures between two teams.
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
        last: 5,
        status: 'FT',
      }),
    enabled,
    staleTime: TTL.TWENTY_FOUR_H,
    select: (data): RecentFixture[] =>
      data.response.map((f) => {
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
      }),
  });
}
