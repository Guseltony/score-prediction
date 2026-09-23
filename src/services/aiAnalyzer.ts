import { applyMatchIntelligence, type MatchIntelligenceInput } from '../utils/matchIntelligence';
import { calculatePoissonProbabilities } from '../utils/poisson';
import { generateScores } from '../utils/generateScores';
import { runBetBuilder } from '../utils/betBuilder';
import { runMonteCarlo } from '../utils/monteCarlo';
import type { AiScrapedFixture } from '../types';
import type { AnalyzedMatch } from './batchAnalyzer';
import { deriveFeatures } from '../utils/featureDeriver';
import { calculateExpectedValue, calculateEdge, getBookmakerOddsForMarket, getTrueImpliedProbabilityForMarket } from '../utils/valueScanner';
import { validateFixture } from '../utils/fixtureValidator';

export function analyzeAIFixtures(
  fixtures: AiScrapedFixture[],
  onProgress?: (msg: string) => void
): AnalyzedMatch[] {
  const results: AnalyzedMatch[] = [];

  for (let i = 0; i < fixtures.length; i++) {
    const fix = fixtures[i];
    const label = `${fix?.fixture?.homeTeam ?? '?'} vs ${fix?.fixture?.awayTeam ?? '?'}`;
    onProgress?.(`Validating & analyzing ${label} (AI Data)...`);

    // ── Validate fixture data before processing ──────────────────────────────
    const validation = validateFixture(fix);

    if (validation.alerts.length > 0) {
      const criticals = validation.alerts.filter(a => a.severity === 'critical').length;
      const warnings  = validation.alerts.filter(a => a.severity === 'warning').length;
      onProgress?.(`⚠️ ${label}: ${criticals} critical + ${warnings} warnings — continuing with safe fallbacks`);
    }

    // 1. Calculate all advanced metrics using our deterministic deriver
    const derived = deriveFeatures(fix);

    // ── UEFA / Cup / Cross-Tier Detection ────────────────────────────────────
    const competitionName = (fix.competition?.name ?? '').toLowerCase();
    const isUefa = fix.competition?.isUefaCompetition ??
      /champions|europa|conference league|cl |ucl|uel/.test(competitionName);
    const isCup = fix.competition?.isCupMatch ??
      /cup|copa|coupe|pokal|fa cup|league cup|carabao|coppa/.test(competitionName);

    // Per-team domestic tiers: use explicit fields, fall back to competition.tier
    const homeDomesticTier = fix.competition?.homeDomesticTier
      ?? fix.rawStandings.home.domesticTier
      ?? fix.competition.tier
      ?? 1;
    const awayDomesticTier = fix.competition?.awayDomesticTier
      ?? fix.rawStandings.away.domesticTier
      ?? fix.competition.tier
      ?? 1;

    const isCrossTier = isCup && (homeDomesticTier !== awayDomesticTier);
    const leagueSetting: 'same' | 'different' = isCrossTier ? 'different' : 'same';

    // Calculate projected xG using Poisson mathematical strengths.
    // NOTE: The league average multipliers (1.45 home, 1.15 away) are the
    // EXPECTED goals by context (home avg GF = 1.45, away avg GF = 1.15).
    // Poisson strength ratios already encode the asymmetry from standings data,
    // so we apply each team's CORRECT contextual baseline — no extra thumb on the scale.
    const projectedHomeXG = derived.homeAttackStrength * derived.awayDefenseStrength * 1.45;
    const projectedAwayXG = derived.awayAttackStrength * derived.homeDefenseStrength * 1.15;

    // 2. Map AI Data + Derived Stats to Intelligence Input
    const intelligenceInput: MatchIntelligenceInput = {
      baseHomeXG: projectedHomeXG,
      baseAwayXG: projectedAwayXG,
      homeOdds: fix.rawOdds?.homeWin || 0,
      drawOdds: fix.rawOdds?.draw || 0,
      awayOdds: fix.rawOdds?.awayWin || 0,
      homeAttackRating: derived.homeAttackRating,
      homeDefenseRating: derived.homeDefenseRating,
      awayAttackRating: derived.awayAttackRating,
      awayDefenseRating: derived.awayDefenseRating,
      homeForm: derived.homeFormString,
      awayForm: derived.awayFormString,
      h2hHomeBias: derived.h2hHomeBias,
      competition: isUefa ? 'cup' : (isCup ? 'cup' : 'league'),
      homeAdvantageEnabled: true,
      volatilityFactor: fix.fixture.isDerby ? 0.2 : (isCrossTier ? 0.15 : 0),
      pitchTilt: 0,
      leagueSetting,
      homeLeagueRank: fix.rawStandings?.home?.leagueRank || 10,
      awayLeagueRank: fix.rawStandings?.away?.leagueRank || 10,
      leagueSize: 20,
      homeTier: homeDomesticTier,
      awayTier: awayDomesticTier,
      homeSquadRotation: false,
      awaySquadRotation: false,
      homeKeyAttackerMissing: false,
      homeKeyDefenderMissing: false,
      awayKeyAttackerMissing: false,
      awayKeyDefenderMissing: false,
      homeDaysSinceLastMatch: derived.homeRestDays,
      awayDaysSinceLastMatch: derived.awayRestDays,
      homeFixtureCongestion: false,
      awayFixtureCongestion: false,
      mustWinHome: false,
      mustWinAway: false,
      revengeMatch: false,
      nothingToPlayFor: false,
      playingForDrawHome: false,
      playingForDrawAway: false,
      isDerby: !!fix.fixture.isDerby,
      bigOccasion: isUefa,   // UEFA = high-pressure occasion
      cupFocus: isCup,
      homeAttackStyle: 'possession',
      homeDefenceStyle: 'block',
      awayAttackStyle: 'possession',
      awayDefenceStyle: 'block',
      homeOpeningOdds: 0,
      drawOpeningOdds: 0,
      awayOpeningOdds: 0,
      
      // Map O/U 2.5 directly to the anomaly engine
      marketGoalLine: fix.rawOdds?.over25 ? 2.5 : 0,
      marketGoalLineOdds: fix.rawOdds?.over25 || 0,
      
      homeTeamGoalLine: 0,
      homeTeamGoalLineOdds: 0,
      awayTeamGoalLine: 0,
      awayTeamGoalLineOdds: 0,
    };

    // 3. Run Intelligence Engine
    const intelResult = applyMatchIntelligence(intelligenceInput);

    // 4. Generate Base Probabilities Map
    const allScores = generateScores(5);
    const probabilities = calculatePoissonProbabilities(
      intelResult.adjustedHomeXG,
      intelResult.adjustedAwayXG,
      allScores,
      1.0
    );

    // 5. Derive mcTop3 from a quick Monte Carlo spin
    const mc = runMonteCarlo(allScores, probabilities, 500);
    const mcTop3 = mc.ranked.slice(0, 3).map((x: any) => x.score);

    // 6. Run the BetBuilder core
    const bbResult = runBetBuilder({
      scores: allScores,
      probabilities,
      mcTop3,
      intelligenceInput
    });

    // 7. Inject Odds, EV, and Edge into the generated markets
    const enrichMarket = (m: any) => {
      const odds = getBookmakerOddsForMarket(m.id, fix.rawOdds);
      const trueImplied = getTrueImpliedProbabilityForMarket(m.id, derived.trueImpliedProbabilities);
      if (odds > 0) {
        m.odds = odds;
        m.expectedValue = calculateExpectedValue(m.probability, odds);
      }
      if (trueImplied > 0) {
        m.edge = calculateEdge(m.probability, trueImplied);
      }
      return m;
    };

    bbResult.topPicks = bbResult.topPicks.map(enrichMarket);
    bbResult.allMarkets = bbResult.allMarkets.map(enrichMarket);

    // Optionally filter out negative EV bets from top picks to heavily improve predictions:
    // bbResult.topPicks = bbResult.topPicks.filter(m => !m.expectedValue || m.expectedValue > -0.05);

    results.push({
      fixtureId: (fix.fixtureId as any) || Math.floor(Math.random() * 1000000), 
      homeTeam: fix.fixture?.homeTeam ?? 'Unknown',
      awayTeam: fix.fixture?.awayTeam ?? 'Unknown',
      country: fix.country,
      date: fix.fixture?.date ?? '',
      bbResult,
      intelligenceInput,
      rawAiFixture: fix,
      validation,
    });
  }

  onProgress?.(`Completed analysis of ${results.length} matches from AI Data.`);
  return results;
}
