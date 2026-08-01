/**
 * xG Calculation Engine
 *
 * Implements a simplified Dixon–Robinson goal-expectation model.
 * Given recent team form and optional head-to-head data, it calculates
 * statistically grounded Expected Goals (xG) for each team.
 *
 * Formula:
 *   homeXG = (homeAttackStr × awayDefenseWeakness × LEAGUE_AVG) × HOME_ADVANTAGE
 *   awayXG =  awayAttackStr × homeDefenseWeakness × LEAGUE_AVG
 *
 * If H2H data is present, the result is blended 70% form / 30% H2H.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Average goals per team per match in a typical top-flight league */
export const LEAGUE_AVG_GOALS = 1.2;

/** Home teams score ~12% more than away teams on average */
export const HOME_ADVANTAGE_FACTOR = 1.12;

/** How much weight to give H2H data vs recent form (0 = ignore H2H, 1 = only H2H) */
export const H2H_WEIGHT = 0.3;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchResult {
  /** Goals scored by this team in the match */
  scored: number;
  /** Goals conceded by this team in the match */
  conceded: number;
}

export interface H2HMatch {
  /** Goals scored by the home team in this historical meeting */
  homeGoals: number;
  /** Goals scored by the away team in this historical meeting */
  awayGoals: number;
}

export interface XGCalculationInput {
  homeMatches: MatchResult[];
  awayMatches: MatchResult[];
  h2hMatches: H2HMatch[];
}

export interface XGBreakdown {
  homeAvgScored: number;
  homeAvgConceded: number;
  awayAvgScored: number;
  awayAvgConceded: number;
  homeAttackStrength: number;   // > 1 means above-average attack
  homeDefenseStrength: number;  // < 1 means above-average defense (concedes less)
  awayAttackStrength: number;
  awayDefenseStrength: number;
  baseHomeXG: number;
  baseAwayXG: number;
  h2hHomeAvg: number | null;
  h2hAwayAvg: number | null;
  h2hAdjusted: boolean;
}

export interface XGCalculationResult {
  homeXG: number;
  awayXG: number;
  breakdown: XGBreakdown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return LEAGUE_AVG_GOALS;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ─── Core Calculator ──────────────────────────────────────────────────────────

/**
 * Calculate expected goals for both teams from recent form + H2H data.
 */
export function calculateXG(input: XGCalculationInput): XGCalculationResult {
  const { homeMatches, awayMatches, h2hMatches } = input;

  // Recent form averages
  const homeAvgScored    = average(homeMatches.map((m) => m.scored));
  const homeAvgConceded  = average(homeMatches.map((m) => m.conceded));
  const awayAvgScored    = average(awayMatches.map((m) => m.scored));
  const awayAvgConceded  = average(awayMatches.map((m) => m.conceded));

  // Strength indices relative to league average
  // homeAttackStrength > 1  → home team scores more than average
  // awayDefenseWeakness > 1 → away team concedes more than average (easier to score against)
  const homeAttackStr    = homeAvgScored   / LEAGUE_AVG_GOALS;
  const homeDefenseStr   = homeAvgConceded / LEAGUE_AVG_GOALS;
  const awayAttackStr    = awayAvgScored   / LEAGUE_AVG_GOALS;
  const awayDefenseStr   = awayAvgConceded / LEAGUE_AVG_GOALS;

  // Dixon–Robinson core prediction
  const baseHomeXG = homeAttackStr * awayDefenseStr   * LEAGUE_AVG_GOALS * HOME_ADVANTAGE_FACTOR;
  const baseAwayXG = awayAttackStr * homeDefenseStr   * LEAGUE_AVG_GOALS;

  // H2H blend
  let homeXG = baseHomeXG;
  let awayXG = baseAwayXG;
  let h2hHomeAvg: number | null = null;
  let h2hAwayAvg: number | null = null;

  if (h2hMatches.length > 0) {
    h2hHomeAvg = average(h2hMatches.map((m) => m.homeGoals));
    h2hAwayAvg = average(h2hMatches.map((m) => m.awayGoals));
    homeXG = baseHomeXG * (1 - H2H_WEIGHT) + h2hHomeAvg * H2H_WEIGHT;
    awayXG = baseAwayXG * (1 - H2H_WEIGHT) + h2hAwayAvg * H2H_WEIGHT;
  }

  // Clamp to sensible range
  homeXG = clamp(homeXG, 0.3, 4.0);
  awayXG = clamp(awayXG, 0.3, 4.0);

  return {
    homeXG: round2(homeXG),
    awayXG: round2(awayXG),
    breakdown: {
      homeAvgScored:       round2(homeAvgScored),
      homeAvgConceded:     round2(homeAvgConceded),
      awayAvgScored:       round2(awayAvgScored),
      awayAvgConceded:     round2(awayAvgConceded),
      homeAttackStrength:  round2(homeAttackStr),
      homeDefenseStrength: round2(homeDefenseStr),
      awayAttackStrength:  round2(awayAttackStr),
      awayDefenseStrength: round2(awayDefenseStr),
      baseHomeXG:          round2(baseHomeXG),
      baseAwayXG:          round2(baseAwayXG),
      h2hHomeAvg:          h2hHomeAvg !== null ? round2(h2hHomeAvg) : null,
      h2hAwayAvg:          h2hAwayAvg !== null ? round2(h2hAwayAvg) : null,
      h2hAdjusted:         h2hMatches.length > 0,
    },
  };
}

// ─── Input Parsers ────────────────────────────────────────────────────────────

/**
 * Parse a score string like "2-1" → { scored: 2, conceded: 1 }
 * Supports formats: "2-1", "2:1", "2 1", "2,1"
 */
export function parseMatchResult(raw: string): MatchResult | null {
  const m = raw.trim().match(/^(\d+)\s*[-:,\s]\s*(\d+)$/);
  if (!m) return null;
  return { scored: parseInt(m[1], 10), conceded: parseInt(m[2], 10) };
}

/**
 * Parse a H2H score string like "2-1" → { homeGoals: 2, awayGoals: 1 }
 */
export function parseH2HResult(raw: string): H2HMatch | null {
  const m = raw.trim().match(/^(\d+)\s*[-:,\s]\s*(\d+)$/);
  if (!m) return null;
  return { homeGoals: parseInt(m[1], 10), awayGoals: parseInt(m[2], 10) };
}
