/**
 * useAutoXG — Derives suggested xG values from real team fixture data.
 *
 * Algorithm (Dixon-Coles inspired):
 *   homeXG = homeAvgScored × awayDefenseFactor
 *   awayXG = awayAvgScored × homeDefenseFactor
 *
 * defenseFactor = leagueAvgGoals / teamAvgConceded
 * (teams that concede less than average have a factor < 1, making attacks less effective)
 */
import { useMemo } from 'react';
import type { RecentFixture } from '../api/types';

interface AutoXGResult {
  suggestedHomeXG: number;
  suggestedAwayXG: number;
  /** 'high' | 'medium' | 'low' based on how many fixtures were available */
  confidence: 'high' | 'medium' | 'low';
  homeAvgScored: number;
  homeAvgConceded: number;
  awayAvgScored: number;
  awayAvgConceded: number;
  homeLeagueAvg: number;
  awayLeagueAvg: number;
}

function avgGoals(
  fixtures: RecentFixture[],
  teamName: string,
  type: 'scored' | 'conceded'
): number {
  if (fixtures.length === 0) return 0;
  const total = fixtures.reduce((sum, f) => {
    const isHome = f.homeTeam === teamName;
    if (type === 'scored') {
      return sum + (isHome ? f.homeGoals : f.awayGoals);
    } else {
      return sum + (isHome ? f.awayGoals : f.homeGoals);
    }
  }, 0);
  return total / fixtures.length;
}

const COUNTRY_AVG_GOALS: Record<string, number> = {
  'Germany': 1.60,
  'Netherlands': 1.60,
  'Finland': 1.50,
  'Norway': 1.50,
  'England': 1.45,
  'Spain': 1.30,
  'Italy': 1.35,
  'France': 1.35,
  'Portugal': 1.35,
  'Brazil': 1.20,
  'Argentina': 1.10,
};

const DEFAULT_LEAGUE_AVG = 1.4; // typical per-team goals average

export function useAutoXG(
  homeFixtures: RecentFixture[] | undefined,
  awayFixtures: RecentFixture[] | undefined,
  homeTeamName: string,
  awayTeamName: string,
  homeCountry: string = '',
  awayCountry: string = '',
): AutoXGResult | null {
  return useMemo(() => {
    if (!homeFixtures?.length && !awayFixtures?.length) return null;

    const homeLeagueAvg = COUNTRY_AVG_GOALS[homeCountry] ?? DEFAULT_LEAGUE_AVG;
    const awayLeagueAvg = COUNTRY_AVG_GOALS[awayCountry] ?? DEFAULT_LEAGUE_AVG;

    const homeAvgScored    = homeFixtures?.length ? avgGoals(homeFixtures, homeTeamName, 'scored') : homeLeagueAvg;
    const homeAvgConceded  = homeFixtures?.length ? avgGoals(homeFixtures, homeTeamName, 'conceded') : homeLeagueAvg;
    const awayAvgScored    = awayFixtures?.length ? avgGoals(awayFixtures, awayTeamName, 'scored') : awayLeagueAvg;
    const awayAvgConceded  = awayFixtures?.length ? avgGoals(awayFixtures, awayTeamName, 'conceded') : awayLeagueAvg;

    // Defence factors: > 1 means leaky defence (concede more than avg)
    const homeDefenseFactor = homeAvgConceded > 0 ? homeAvgConceded / homeLeagueAvg : 1;
    const awayDefenseFactor = awayAvgConceded > 0 ? awayAvgConceded / awayLeagueAvg : 1;

    const suggestedHomeXG = Math.max(
      0.3,
      Math.min(4.0, parseFloat((homeAvgScored * awayDefenseFactor).toFixed(2)))
    );
    const suggestedAwayXG = Math.max(
      0.3,
      Math.min(4.0, parseFloat((awayAvgScored * homeDefenseFactor).toFixed(2)))
    );

    const totalSamples = (homeFixtures?.length ?? 0) + (awayFixtures?.length ?? 0);
    const confidence: 'high' | 'medium' | 'low' =
      totalSamples >= 8 ? 'high' : totalSamples >= 4 ? 'medium' : 'low';

    return {
      suggestedHomeXG,
      suggestedAwayXG,
      confidence,
      homeAvgScored,
      homeAvgConceded,
      awayAvgScored,
      awayAvgConceded,
      homeLeagueAvg,
      awayLeagueAvg,
    };
  }, [homeFixtures, awayFixtures, homeTeamName, awayTeamName, homeCountry, awayCountry]);
}
