/**
 * useTeamFixtures — Fetch the last 5 finished fixtures for a team.
 *
 * Free plan restrictions:
 *  - The `last` parameter is NOT available (paid only)
 *  - Only seasons 2022–2024 are accessible
 *
 * Strategy: query season by season from most recent backward until we get data.
 * Cached for 24 hours.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/footballApi';
import type { ApiResponse, ApiFixtureResult, RecentFixture } from '../api/types';
import { TTL } from '../utils/storage';

// Free plan: max accessible season is 2024
// We try 2024 first, fall back to 2023 if no results
const FREE_PLAN_SEASONS = [2024, 2023, 2022];

async function fetchTeamFixtures(teamId: number): Promise<RecentFixture[]> {
  for (const season of FREE_PLAN_SEASONS) {
    const data = await apiFetch<ApiResponse<ApiFixtureResult>>('/fixtures', {
      team: teamId,
      season,
      status: 'FT',
    });

    if (data.response.length > 0) {
      // Sort newest first, return last 5
      const sorted = [...data.response].sort(
        (a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
      );
      return sorted.slice(0, 5).map((f) => {
        const homeGoals = f.goals.home ?? 0;
        const awayGoals = f.goals.away ?? 0;
        const isHomeTeam = f.teams.home.id === teamId;
        return {
          fixtureId: f.fixture.id,
          date: f.fixture.date,
          homeTeam: f.teams.home.name,
          awayTeam: f.teams.away.name,
          homeGoals,
          awayGoals,
          result: isHomeTeam
            ? homeGoals > awayGoals ? 'W' : homeGoals < awayGoals ? 'L' : 'D'
            : awayGoals > homeGoals ? 'W' : awayGoals < homeGoals ? 'L' : 'D',
        };
      });
    }
  }
  return [];
}

export function useTeamFixtures(teamId: number | null) {
  return useQuery({
    queryKey: ['fixtures', 'team', teamId],
    queryFn: () => fetchTeamFixtures(teamId!),
    enabled: teamId !== null,
    staleTime: TTL.TWENTY_FOUR_H,
  });
}
