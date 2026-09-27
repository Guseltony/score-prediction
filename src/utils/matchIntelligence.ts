/**
 * matchIntelligence.ts
 *
 * Multi-factor xG adjuster that goes beyond pure xG.
 * Incorporates:
 *   1. Bookmaker 1X2 odds (converts to implied probability, strong signal)
 *   2. Attack / Defense ratings (1-10)
 *   3. Recent form (last 5: e.g. "WWDLL")
 *   4. H2H dominance bias
 *   5. Competition type (friendly, cup, league, Champions League)
 *   6. Home advantage
 *   7. "Football surprise" / volatility factor
 */

const COMPETITION_GOAL_MULTIPLIER: Record<string, number> = {
  friendly:         0.85,
  cup:              0.95,
  league:           1.00,
  championship:     1.00,
  europa:           1.05,
  champions_league: 0.92,
  world_cup:        0.90,
  other:            1.00,
};

function formRating(formStr: string): number {
  const chars = formStr.toUpperCase().split('').filter(c => 'WDL'.includes(c)).slice(0, 5);
  if (chars.length === 0) return 0.5;
  const weights = [1.5, 1.3, 1.1, 0.9, 0.7];
  let weighted = 0;
  let totalWeight = 0;
  chars.forEach((c, i) => {
    const w = weights[i] ?? 0.5;
    const score = c === 'W' ? 1.0 : c === 'D' ? 0.5 : 0.0;
    weighted += score * w;
    totalWeight += w;
  });
  return totalWeight > 0 ? weighted / totalWeight : 0.5;
}

function stripVig(homeOdds: number, drawOdds: number, awayOdds: number) {
  const raw = { h: 1 / homeOdds, d: 1 / drawOdds, a: 1 / awayOdds };
  const total = raw.h + raw.d + raw.a;
  return { homeWin: raw.h / total, draw: raw.d / total, awayWin: raw.a / total };
}

export interface MatchIntelligenceInput {
  baseHomeXG: number;
  baseAwayXG: number;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homeAttackRating: number;
  homeDefenseRating: number;
  awayAttackRating: number;
  awayDefenseRating: number;
  homeForm: string;
  awayForm: string;
  h2hHomeBias: number;
  competition: string;
  homeAdvantageEnabled: boolean;
  volatilityFactor: number;
  pitchTilt: number;
  homeDefenceStyle?: 'block' | 'press' | string;
  awayDefenceStyle?: 'block' | 'press' | string;
  homeAttackStyle?: 'possession' | 'counter' | string;
  awayAttackStyle?: 'possession' | 'counter' | string;
  homeLeagueRank?: number;
  awayLeagueRank?: number;
  
  // Advanced Phase properties
  leagueSetting?: 'same' | 'different' | string;
  leagueSize?: number;
  homeTier?: number;
  awayTier?: number;
  homeSquadRotation?: boolean;
  awaySquadRotation?: boolean;
  homeKeyAttackerMissing?: boolean;
  homeKeyDefenderMissing?: boolean;
  awayKeyAttackerMissing?: boolean;
  awayKeyDefenderMissing?: boolean;
  homeDaysSinceLastMatch?: number;
  awayDaysSinceLastMatch?: number;
  homeFixtureCongestion?: boolean;
  awayFixtureCongestion?: boolean;
  mustWinHome?: boolean;
  mustWinAway?: boolean;
  revengeMatch?: boolean;
  nothingToPlayFor?: boolean;
  playingForDrawHome?: boolean;
  playingForDrawAway?: boolean;
  isDerby?: boolean;
  bigOccasion?: boolean;
  cupFocus?: boolean;
  homeOpeningOdds?: number;
  drawOpeningOdds?: number;
  awayOpeningOdds?: number;
  marketGoalLine?: number;
  marketGoalLineOdds?: number;
  homeTeamGoalLine?: number;
  homeTeamGoalLineOdds?: number;
  awayTeamGoalLine?: number;
  awayTeamGoalLineOdds?: number;
}

export interface MatchIntelligenceResult {
  adjustedHomeXG: number;
  adjustedAwayXG: number;
  tacticalContext?: {
    scenario: 'close_rank_attack_vs_defense' | 'close_rank_balanced' | 'rank_gap_dominant' | 'normal';
    homeStyle: 'attacking' | 'defensive' | 'balanced';
    awayStyle: 'attacking' | 'defensive' | 'balanced';
    rankGap: number;
    note: string;
  };
  breakdown: {
    oddsImplied: { homeWin: number; draw: number; awayWin: number } | null;
    formEffect: { home: number; away: number };
    attackDefenseEffect: { home: number; away: number };
    h2hBias: number;
    competitionMultiplier: number;
    homeAdvantageMultiplier: number;
    oddsShift: { home: number; away: number };
    volatilityApplied: number;
    pitchTiltEffect: { home: number; away: number };
    rankGapEffect: { home: number; away: number };
  };
}

/**
 * Rank-Gap Tactical Analysis Engine
 *
 * Evaluates: league rank proximity + goals for/against ratio to infer each
 * team's in-match tactical mode (attack, defensive, counter). Adjusts xG
 * accordingly so the model correctly handles "goal machine vs defensive bloc"
 * and "counter-attack" scenarios.
 *
 * Rules:
 *  - CLOSE RANK (≤2 gap): evenly contested, volatility boosts, use goal ratios.
 *    • If home GF >> away GF and away GA << home GA → home attacks, away defends + counters
 *    • If both attack-heavy → open game, both xGs up
 *    • Otherwise → tight, compressed xGs
 *  - MEDIUM GAP (3–6): higher-ranked team applies pressure, lower-ranked goes defensive
 *  - LARGE GAP (>6): significant quality difference, dominant team gets major xG boost
 */
function applyRankGapTactics(
  homeXG: number,
  awayXG: number,
  input: MatchIntelligenceInput
): { homeXG: number; awayXG: number; homeEffect: number; awayEffect: number; tacticalContext: MatchIntelligenceResult['tacticalContext'] } {

  const homeRank = input.homeLeagueRank;
  const awayRank = input.awayLeagueRank;

  // If ranks are missing, skip tactical modelling
  if (!homeRank || !awayRank || homeRank === 0 || awayRank === 0) {
    return {
      homeXG,
      awayXG,
      homeEffect: 1,
      awayEffect: 1,
      tacticalContext: { scenario: 'normal', homeStyle: 'balanced', awayStyle: 'balanced', rankGap: 0, note: 'No rank data available.' }
    };
  }

  const rankGap = Math.abs(homeRank - awayRank);
  const homeIsHigherRank = homeRank < awayRank; // Lower number = better rank

  // Retrieve recent goals-for/against from input (populated by aiAnalyzer via rawStandings)
  // We use attack/defense ratings as proxies if raw numbers aren't available.
  // Attack rating 7+ = goal machine; Defense rating 7+ = solid defence
  const homeAttackStrong = (input.homeAttackRating ?? 5) >= 7;
  const homeDefenseStrong = (input.homeDefenseRating ?? 5) >= 7;
  const awayAttackStrong = (input.awayAttackRating ?? 5) >= 7;
  const awayDefenseStrong = (input.awayDefenseRating ?? 5) >= 7;

  let homeEffect = 1.0;
  let awayEffect = 1.0;
  let scenario: NonNullable<MatchIntelligenceResult['tacticalContext']>['scenario'] = 'normal';
  let homeStyle: NonNullable<MatchIntelligenceResult['tacticalContext']>['homeStyle'] = 'balanced';
  let awayStyle: NonNullable<MatchIntelligenceResult['tacticalContext']>['awayStyle'] = 'balanced';
  let note = '';

  if (rankGap <= 2) {
    // ── CLOSE RANK MATCH ──────────────────────────────────────────────────────
    // Both teams are at a similar level. Use scoring patterns to determine tactical mode.
    if (homeAttackStrong && awayDefenseStrong && !awayAttackStrong) {
      // Home = goal machine, Away = defensive bloc + counter-attack
      scenario = 'close_rank_attack_vs_defense';
      homeStyle = 'attacking';
      awayStyle = 'defensive';
      // Home bombards → slightly more home xG, away scoring chance via counters is low but non-zero
      homeEffect = 1.12;
      awayEffect = 0.82;
      note = `Tight rank match (${homeRank} vs ${awayRank}): Home attacks relentlessly, Away parks the bus + counters.`;
    } else if (awayAttackStrong && homeDefenseStrong && !homeAttackStrong) {
      // Away = goal machine, Home = defensive + counter
      scenario = 'close_rank_attack_vs_defense';
      homeStyle = 'defensive';
      awayStyle = 'attacking';
      homeEffect = 0.82;
      awayEffect = 1.12;
      note = `Tight rank match (${homeRank} vs ${awayRank}): Away is the goal machine, Home sits deep + counters.`;
    } else if (homeAttackStrong && awayAttackStrong) {
      // Both attack-heavy → open, end-to-end game
      scenario = 'close_rank_balanced';
      homeStyle = 'attacking';
      awayStyle = 'attacking';
      homeEffect = 1.07;
      awayEffect = 1.07;
      note = `Tight rank match (${homeRank} vs ${awayRank}): Both teams are attack-minded — open, high-scoring game likely.`;
    } else if (homeDefenseStrong && awayDefenseStrong) {
      // Both defensive → compressed, low-scoring
      scenario = 'close_rank_balanced';
      homeStyle = 'defensive';
      awayStyle = 'defensive';
      homeEffect = 0.88;
      awayEffect = 0.88;
      note = `Tight rank match (${homeRank} vs ${awayRank}): Both teams are defensively solid — low-scoring, compact affair.`;
    } else {
      // Genuinely balanced — slight compression to reflect contested nature
      scenario = 'close_rank_balanced';
      homeStyle = 'balanced';
      awayStyle = 'balanced';
      homeEffect = 0.96;
      awayEffect = 0.96;
      note = `Closely ranked rivals (${homeRank} vs ${awayRank}): Expect a tight, contested match.`;
    }

  } else if (rankGap <= 6) {
    // ── MEDIUM RANK GAP ───────────────────────────────────────────────────────
    const higherTeamBoost = 1.06;
    const lowerTeamDrop = 0.92;
    if (homeIsHigherRank) {
      scenario = 'rank_gap_dominant';
      homeStyle = 'attacking';
      awayStyle = 'defensive';
      homeEffect = higherTeamBoost;
      awayEffect = lowerTeamDrop;
      note = `Rank gap (${rankGap}): Home (#${homeRank}) applies pressure; Away (#${awayRank}) looks to defend and counter.`;
    } else {
      scenario = 'rank_gap_dominant';
      homeStyle = 'defensive';
      awayStyle = 'attacking';
      homeEffect = lowerTeamDrop;
      awayEffect = higherTeamBoost;
      note = `Rank gap (${rankGap}): Away (#${awayRank}) is higher-ranked; Home (#${homeRank}) expected to sit deep.`;
    }
  } else {
    // ── LARGE RANK GAP ────────────────────────────────────────────────────────
    const dominant = 1.12;
    const subdued = 0.82;
    if (homeIsHigherRank) {
      scenario = 'rank_gap_dominant';
      homeStyle = 'attacking';
      awayStyle = 'defensive';
      homeEffect = dominant;
      awayEffect = subdued;
      note = `Large rank gap (${rankGap}): Home (#${homeRank}) significantly stronger — expect dominant performance.`;
    } else {
      scenario = 'rank_gap_dominant';
      homeStyle = 'defensive';
      awayStyle = 'attacking';
      homeEffect = subdued;
      awayEffect = dominant;
      note = `Large rank gap (${rankGap}): Away (#${awayRank}) significantly stronger — expect away dominance.`;
    }
  }

  return {
    homeXG: homeXG * homeEffect,
    awayXG: awayXG * awayEffect,
    homeEffect,
    awayEffect,
    tacticalContext: { scenario, homeStyle, awayStyle, rankGap, note }
  };
}

export function applyMatchIntelligence(input: MatchIntelligenceInput): MatchIntelligenceResult {
  const {
    baseHomeXG, baseAwayXG,
    homeOdds, drawOdds, awayOdds,
    homeAttackRating, homeDefenseRating,
    awayAttackRating, awayDefenseRating,
    homeForm, awayForm,
    h2hHomeBias, competition,
    homeAdvantageEnabled, volatilityFactor,
    pitchTilt,
  } = input;

  let homeXG = baseHomeXG;
  let awayXG = baseAwayXG;

  // 1. Odds-derived xG shift
  let oddsImplied = null;
  let oddsHomeShift = 0;
  let oddsAwayShift = 0;

  if (homeOdds > 1 && drawOdds > 1 && awayOdds > 1) {
    oddsImplied = stripVig(homeOdds, drawOdds, awayOdds);
    
    // Scale base xG dynamically to match the market's implied 1X2 expectations
    const expectedTotal = baseHomeXG + baseAwayXG; // roughly 2.7
    const impliedHomeXG = expectedTotal * (oddsImplied.homeWin + oddsImplied.draw * 0.5);
    const impliedAwayXG = expectedTotal * (oddsImplied.awayWin + oddsImplied.draw * 0.5);
    
    // Blend 75% market odds, 25% baseline (to retain some home advantage base if desired)
    const newHomeXG = impliedHomeXG * 0.75 + homeXG * 0.25;
    const newAwayXG = impliedAwayXG * 0.75 + awayXG * 0.25;
    
    oddsHomeShift = newHomeXG - homeXG;
    oddsAwayShift = newAwayXG - awayXG;
    
    homeXG = newHomeXG;
    awayXG = newAwayXG;
  }

  // 2. Attack vs Defense rating adjustment
  const normalizeRating = (r: number) => 0.5 + (r / 10) * 1.0; // Rank 10 = 1.5, Rank 1 = 0.6
  const homeAttackMult = normalizeRating(homeAttackRating);
  const homeDefMult    = normalizeRating(homeDefenseRating);
  const awayAttackMult = normalizeRating(awayAttackRating);
  const awayDefMult    = normalizeRating(awayDefenseRating);
  
  // Ratio-based effect: High attack against low defense -> > 1.0 multiplier
  const homeAttackDefEffect = homeAttackMult / awayDefMult;
  const awayAttackDefEffect = awayAttackMult / homeDefMult;
  
  homeXG *= homeAttackDefEffect;
  awayXG *= awayAttackDefEffect;

  // 3. Form modifier
  const homeFormRating = formRating(homeForm);
  const awayFormRating = formRating(awayForm);
  const homeFormMult = 0.85 + homeFormRating * 0.30;
  const awayFormMult = 0.85 + awayFormRating * 0.30;
  homeXG *= homeFormMult;
  awayXG *= awayFormMult;

  // 4. H2H bias
  const h2hShift = Math.max(-0.2, Math.min(0.2, h2hHomeBias * 0.05));
  homeXG += h2hShift;
  awayXG -= h2hShift;

  // 5. Competition type
  const compMultiplier = COMPETITION_GOAL_MULTIPLIER[competition] ?? 1.0;
  homeXG *= compMultiplier;
  awayXG *= compMultiplier;

  // 6. Home advantage
  const homeAdvMult = homeAdvantageEnabled ? 1.12 : 1.0;
  homeXG *= homeAdvMult;

  // 7. Volatility / Upset factor
  if (volatilityFactor > 0) {
    const avg = (homeXG + awayXG) / 2;
    homeXG = homeXG + (avg - homeXG) * volatilityFactor * 0.4;
    awayXG = awayXG + (avg - awayXG) * volatilityFactor * 0.4;
  }

  // 8. Pitch Tilt (Expected Threat)
  const pitchTiltHomeMult = 1 + (pitchTilt * 0.03);
  const pitchTiltAwayMult = 1 - (pitchTilt * 0.03);
  homeXG *= pitchTiltHomeMult;
  awayXG *= Math.max(0.1, pitchTiltAwayMult); // avoid negative awayXG if pitchTilt is very high

  // 9. Rank-Gap Tactical Analysis (new engine)
  const rankTactics = applyRankGapTactics(homeXG, awayXG, input);
  homeXG = rankTactics.homeXG;
  awayXG = rankTactics.awayXG;

  const clamp = (v: number) => Math.max(0.2, Math.min(4.5, v));
  const r2 = (v: number) => Math.round(v * 100) / 100;

  return {
    adjustedHomeXG: r2(clamp(homeXG)),
    adjustedAwayXG: r2(clamp(awayXG)),
    tacticalContext: rankTactics.tacticalContext,
    breakdown: {
      oddsImplied,
      formEffect: { home: r2(homeFormMult), away: r2(awayFormMult) },
      attackDefenseEffect: { home: r2(homeAttackDefEffect), away: r2(awayAttackDefEffect) },
      h2hBias: r2(h2hShift),
      competitionMultiplier: compMultiplier,
      homeAdvantageMultiplier: homeAdvMult,
      oddsShift: { home: r2(oddsHomeShift), away: r2(oddsAwayShift) },
      volatilityApplied: volatilityFactor,
      pitchTiltEffect: { home: r2(pitchTiltHomeMult), away: r2(pitchTiltAwayMult) },
      rankGapEffect: { home: r2(rankTactics.homeEffect), away: r2(rankTactics.awayEffect) },
    },
  };
}
