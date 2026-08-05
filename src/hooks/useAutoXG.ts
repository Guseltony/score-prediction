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

const LEAGUE_AVG_GOALS = 1.4; // typical per-team goals average in top leagues

export function useAutoXG(
  homeFixtures: RecentFixture[] | undefined,
  awayFixtures: RecentFixture[] | undefined,
  homeTeamName: string,
  awayTeamName: string,
): AutoXGResult | null {
  return useMemo(() => {
    if (!homeFixtures?.length || !awayFixtures?.length) return null;

    const homeAvgScored    = avgGoals(homeFixtures, homeTeamName, 'scored');
    const homeAvgConceded  = avgGoals(homeFixtures, homeTeamName, 'conceded');
    const awayAvgScored    = avgGoals(awayFixtures, awayTeamName, 'scored');
    const awayAvgConceded  = avgGoals(awayFixtures, awayTeamName, 'conceded');

    // Defence factors: > 1 means leaky defence (concede more than avg)
    const homeDefenseFactor = homeAvgConceded > 0 ? LEAGUE_AVG_GOALS / homeAvgConceded : 1;
    const awayDefenseFactor = awayAvgConceded > 0 ? LEAGUE_AVG_GOALS / awayAvgConceded : 1;

    const suggestedHomeXG = Math.max(
      0.3,
      Math.min(4.0, parseFloat((homeAvgScored * awayDefenseFactor).toFixed(2)))
    );
    const suggestedAwayXG = Math.max(
      0.3,
      Math.min(4.0, parseFloat((awayAvgScored * homeDefenseFactor).toFixed(2)))
    );

    const totalSamples = homeFixtures.length + awayFixtures.length;
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
    };
  }, [homeFixtures, awayFixtures, homeTeamName, awayTeamName]);
}
