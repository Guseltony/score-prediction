/**
 * useTeamFixtures — Fetch the last 5 finished fixtures for a team.
 * Used to derive form (W/D/L) and average goals scored/conceded.
 * Cached for 24 hours — team form doesn't change intra-day.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/footballApi';
import type { ApiResponse, ApiFixtureResult, RecentFixture } from '../api/types';
import { TTL } from '../utils/storage';

export function useTeamFixtures(teamId: number | null) {
  return useQuery({
    queryKey: ['fixtures', 'team', teamId],
    queryFn: () =>
      apiFetch<ApiResponse<ApiFixtureResult>>('/fixtures', {
        team: teamId!,
        last: 5,
        status: 'FT',
      }),
    enabled: teamId !== null,
    staleTime: TTL.TWENTY_FOUR_H,
    select: (data): RecentFixture[] =>
      data.response.map((f) => {
        const homeGoals = f.goals.home ?? 0;
        const awayGoals = f.goals.away ?? 0;
        return {
          fixtureId: f.fixture.id,
          date: f.fixture.date,
          homeTeam: f.teams.home.name,
          awayTeam: f.teams.away.name,
          homeGoals,
          awayGoals,
          // result from the perspective of `teamId`
          result:
            f.teams.home.id === teamId
              ? homeGoals > awayGoals ? 'W' : homeGoals < awayGoals ? 'L' : 'D'
              : awayGoals > homeGoals ? 'W' : awayGoals < homeGoals ? 'L' : 'D',
        };
      }),
  });
}
