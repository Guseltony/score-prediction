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
}

export interface MatchIntelligenceResult {
  adjustedHomeXG: number;
  adjustedAwayXG: number;
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
    const favoriteGap = oddsImplied.homeWin - oddsImplied.awayWin;
    oddsHomeShift = favoriteGap * 0.5;
    oddsAwayShift = -favoriteGap * 0.5;
    homeXG = homeXG * 0.6 + (homeXG + oddsHomeShift) * 0.4;
    awayXG = awayXG * 0.6 + (awayXG + oddsAwayShift) * 0.4;
  }

  // 2. Attack vs Defense rating adjustment
  const normalizeRating = (r: number) => 0.75 + (r / 10) * 0.5;
  const homeAttackMult = normalizeRating(homeAttackRating);
  const homeDefMult    = normalizeRating(homeDefenseRating);
  const awayAttackMult = normalizeRating(awayAttackRating);
  const awayDefMult    = normalizeRating(awayDefenseRating);
  const homeAttackDefEffect = homeAttackMult * (1.5 - awayDefMult);
  const awayAttackDefEffect = awayAttackMult * (1.5 - homeDefMult);
  homeXG *= (0.7 + homeAttackDefEffect * 0.3);
  awayXG *= (0.7 + awayAttackDefEffect * 0.3);

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


  const clamp = (v: number) => Math.max(0.2, Math.min(4.5, v));
  const r2 = (v: number) => Math.round(v * 100) / 100;

  return {
    adjustedHomeXG: r2(clamp(homeXG)),
    adjustedAwayXG: r2(clamp(awayXG)),
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
    },
  };
}
