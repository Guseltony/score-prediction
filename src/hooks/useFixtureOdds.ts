/**
 * useFixtureOdds — Fetch bookmaker odds for a specific fixture.
 * Uses Bet365 (bookmaker id = 6) as the primary bookmaker.
 * Cached for 1 hour — odds shift closer to kickoff.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/footballApi';
import type {
  ApiResponse, ApiOddsResult,
  ParsedMatchOdds, ParsedCorrectScoreOdds,
} from '../api/types';
import { TTL } from '../utils/storage';

const BET365_ID = 6;

export interface FixtureOddsData {
  matchOdds: ParsedMatchOdds | null;
  correctScoreOdds: ParsedCorrectScoreOdds;
  bookmakerName: string;
}

function parseOddsResponse(data: ApiResponse<ApiOddsResult>): FixtureOddsData {
  // Find Bet365 (id 6), fall back to first available bookmaker
  const fixture = data.response[0];
  if (!fixture) return { matchOdds: null, correctScoreOdds: {}, bookmakerName: '' };

  const bm =
    fixture.bookmakers.find((b) => b.id === BET365_ID) ??
    fixture.bookmakers[0];

  if (!bm) return { matchOdds: null, correctScoreOdds: {}, bookmakerName: '' };

  let matchOdds: ParsedMatchOdds | null = null;
  const correctScoreOdds: ParsedCorrectScoreOdds = {};

  for (const bet of bm.bets) {
    const nameLower = bet.name.toLowerCase();

    // 1X2 / Match Winner
    if (nameLower.includes('match winner') || nameLower.includes('1x2')) {
      const home = bet.values.find((v) => v.value === 'Home');
      const draw = bet.values.find((v) => v.value === 'Draw');
      const away = bet.values.find((v) => v.value === 'Away');
      if (home && draw && away) {
        matchOdds = {
          homeWin: parseFloat(home.odd),
          draw: parseFloat(draw.odd),
          awayWin: parseFloat(away.odd),
        };
      }
    }

    // Correct Score
    if (nameLower.includes('correct score')) {
      for (const v of bet.values) {
        // API returns scores as "1:0", normalise to "1-0"
        const normalised = v.value.replace(':', '-');
        const odds = parseFloat(v.odd);
        if (!isNaN(odds) && odds > 1) {
          correctScoreOdds[normalised] = odds;
        }
      }
    }
  }

  return { matchOdds, correctScoreOdds, bookmakerName: bm.name };
}

export function useFixtureOdds(fixtureId: number | null) {
  return useQuery({
    queryKey: ['odds', fixtureId],
    queryFn: () =>
      apiFetch<ApiResponse<ApiOddsResult>>('/odds', {
        fixture: fixtureId!,
        bookmaker: BET365_ID,
      }),
    enabled: fixtureId !== null,
    staleTime: TTL.ONE_HOUR,
    select: parseOddsResponse,
  });
}
