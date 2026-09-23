import { apiFetch } from '../api/footballApi';
import { applyMatchIntelligence, type MatchIntelligenceInput } from '../utils/matchIntelligence';
import { calculatePoissonProbabilities } from '../utils/poisson';
import { generateScores } from '../utils/generateScores';
import { countFrequency, getTopScores } from '../utils/countFrequency';
import { weightedRandomScore } from '../utils/poisson';
import { runBetBuilder } from '../utils/betBuilder';
import type { BBResult, ProbabilityMap, ScoreString } from '../types';
import type { ApiResponse, ApiFixtureResult, ApiOddsResult } from '../api/types';

// Supported Leagues (Can be expanded by the user later)
export const SUPPORTED_LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 61, name: 'Ligue 1', country: 'France' },
  { id: 286, name: 'Super Liga', country: 'Serbia' }, // Serbia
  { id: 119, name: 'Superliga', country: 'Denmark' }, // Denmark
  { id: 203, name: 'Süper Lig', country: 'Turkey' }, // Turkiye
  { id: 94, name: 'Primeira Liga', country: 'Portugal' }, // Portugal
  { id: 88, name: 'Eredivisie', country: 'Netherlands' }, // Netherlands
  { id: 103, name: 'Eliteserien', country: 'Norway' }, // Norway
  { id: 98, name: 'J1 League', country: 'Japan' }, // Japan
  { id: 292, name: 'K League 1', country: 'South-Korea' }, // Korea
  { id: 113, name: 'Allsvenskan', country: 'Sweden' } // Sweden
];

export interface AnalyzedMatch {
  fixtureId: number | string;
  homeTeam: string;
  awayTeam: string;
  country?: string;
  date: string;
  bbResult: BBResult;
  intelligenceInput: MatchIntelligenceInput;
  rawAiFixture?: import('../types').AiScrapedFixture;
  /** Validation result from the TypeScript fixture validator — present for AI-loaded fixtures */
  validation?: import('../utils/fixtureValidator').FixtureValidationResult;
}

/**
 * Main batch processing function.
 */
export async function analyzeLeagueForDate(
  leagueId: number,
  dateYYYYMMDD: string,
  seasonYYYY: number,
  onProgress?: (msg: string) => void
): Promise<AnalyzedMatch[]> {
  onProgress?.(`Fetching fixtures for League ${leagueId}...`);
  
  // 1. Fetch Fixtures
  const fixturesRes = await apiFetch<ApiResponse<ApiFixtureResult>>('/fixtures', {
    league: leagueId,
    season: seasonYYYY,
    date: dateYYYYMMDD
  });
  
  const fixtures = fixturesRes.response;
  if (!fixtures || fixtures.length === 0) {
    onProgress?.(`No fixtures found for this date in League ${leagueId}.`);
    return [];
  }

  // 2. Fetch Standings (to get Form and Rank efficiently)
  onProgress?.(`Fetching standings to derive Form and Rank...`);
  // API-Football returns any type here, we map manually
  const standingsRes = await apiFetch<any>('/standings', {
    league: leagueId,
    season: seasonYYYY
  });

  const teamDataMap = new Map<number, { rank: number; form: string }>();
  if (standingsRes.response && standingsRes.response.length > 0) {
    const standingsArray = standingsRes.response[0].league.standings[0];
    for (const teamItem of standingsArray) {
      teamDataMap.set(teamItem.team.id, {
        rank: teamItem.rank,
        form: teamItem.form || '',
      });
    }
  }

  const results: AnalyzedMatch[] = [];

  // 3. Process each fixture
  for (let i = 0; i < fixtures.length; i++) {
    const fix = fixtures[i];
    onProgress?.(`Processing ${fix.teams.home.name} vs ${fix.teams.away.name} (${i + 1}/${fixtures.length})...`);
    
    // 3a. Fetch Odds for this specific fixture (Bet365 = 6)
    const oddsRes = await apiFetch<ApiResponse<ApiOddsResult>>('/odds', {
      fixture: fix.fixture.id,
      bookmaker: 6,
    }).catch(() => null); // ignore single odd fetch errors

    let homeWin = 0, draw = 0, awayWin = 0;
    
    if (oddsRes && oddsRes.response && oddsRes.response.length > 0) {
      const bm = oddsRes.response[0].bookmakers[0];
      if (bm) {
        const matchWinnerBet = bm.bets.find((b: any) => b.name === 'Match Winner' || b.name.includes('1x2') || b.name === 'Home/Away');
        if (matchWinnerBet) {
          const hVal = matchWinnerBet.values.find((v: any) => v.value === 'Home');
          const dVal = matchWinnerBet.values.find((v: any) => v.value === 'Draw');
          const aVal = matchWinnerBet.values.find((v: any) => v.value === 'Away');
          if (hVal && dVal && aVal) {
            homeWin = parseFloat(hVal.odd);
            draw = parseFloat(dVal.odd);
            awayWin = parseFloat(aVal.odd);
          }
        }
      }
    }

    // Skip if odds are completely missing, as the engine heavily relies on them
    if (homeWin === 0 || draw === 0 || awayWin === 0) {
      onProgress?.(`Skipped ${fix.teams.home.name} (No Bet365 odds found).`);
      continue;
    }

    // 3b. Map to Intelligence Input
    const homeTeamId = fix.teams.home.id;
    const awayTeamId = fix.teams.away.id;
    
    const homeData = teamDataMap.get(homeTeamId) || { rank: 10, form: '' };
    const awayData = teamDataMap.get(awayTeamId) || { rank: 10, form: '' };

    const intelligenceInput: MatchIntelligenceInput = {
      baseHomeXG: 1.5, // Default baseline, engine adjusts via odds
      baseAwayXG: 1.2, 
      homeOdds: homeWin,
      drawOdds: draw,
      awayOdds: awayWin,
      homeAttackRating: 6, // Base neutral, odds will shift this
      homeDefenseRating: 6,
      awayAttackRating: 6,
      awayDefenseRating: 6,
      homeForm: homeData.form,
      awayForm: awayData.form,
      h2hHomeBias: 0,
      competition: 'league',
      homeAdvantageEnabled: true,
      volatilityFactor: 0,
      pitchTilt: 0,
      // Phase 1
      leagueSetting: 'same',
      homeLeagueRank: homeData.rank,
      awayLeagueRank: awayData.rank,
      leagueSize: teamDataMap.size || 20,
      homeTier: 1,
      awayTier: 1,
      homeSquadRotation: false,
      awaySquadRotation: false,
      // Phase 2
      homeKeyAttackerMissing: false,
      homeKeyDefenderMissing: false,
      awayKeyAttackerMissing: false,
      awayKeyDefenderMissing: false,
      homeDaysSinceLastMatch: 0,
      awayDaysSinceLastMatch: 0,
      homeFixtureCongestion: false,
      awayFixtureCongestion: false,
      // Phase 3
      mustWinHome: false,
      mustWinAway: false,
      revengeMatch: false,
      nothingToPlayFor: false,
      playingForDrawHome: false,
      playingForDrawAway: false,
      isDerby: false,
      bigOccasion: false,
      cupFocus: false,
      // Phase 4
      homeAttackStyle: 'possession',
      homeDefenceStyle: 'block',
      awayAttackStyle: 'possession',
      awayDefenceStyle: 'block',
      // Phase 4B
      homeOpeningOdds: 0,
      drawOpeningOdds: 0,
      awayOpeningOdds: 0,
      // Phase 5
      marketGoalLine: 0,
      marketGoalLineOdds: 0,
      // Phase 6
      homeTeamGoalLine: 0,
      homeTeamGoalLineOdds: 0,
      awayTeamGoalLine: 0,
      awayTeamGoalLineOdds: 0,
    };

    // 3c. Run Intelligence Engine
    const intelResult = applyMatchIntelligence(intelligenceInput);

    // 3d. Generate Base Probabilities Map
    const allScores = generateScores(5);
    const probabilities = calculatePoissonProbabilities(
      intelResult.adjustedHomeXG,
      intelResult.adjustedAwayXG,
      allScores,
      1.0 // advantage already applied inside intelligence engine
    );

    // 3e. Derive mcTop3 from a quick Monte Carlo spin
    const mcPicks: ScoreString[] = Array.from({ length: 20 }, () =>
      weightedRandomScore(allScores, probabilities)
    );
    const mcFrequency = countFrequency(mcPicks);
    const mcTop3 = getTopScores(mcFrequency);

    // 3f. Run the BetBuilder core
    const bbResult = runBetBuilder({
      scores: allScores,
      probabilities,
      mcTop3,
      intelligenceInput,
    });

    results.push({
      fixtureId: fix.fixture.id,
      homeTeam: fix.teams.home.name,
      awayTeam: fix.teams.away.name,
      date: fix.fixture.date,
      bbResult,
      intelligenceInput
    });
  }
  
  onProgress?.(`Completed League ${leagueId}. Analyzed ${results.length} matches.`);
  return results;
}
