/**
 * betBuilder.ts
 *
 * Bet Builder (BB) Engine.
 *
 * Flow:
 *   1. Run spinner 20× exactly 3 times → capture top scores per round
 *   2. Merge with Monte Carlo top-3 scores
 *   3. Build a deduplicated weighted score pool
 *   4. Derive expected goal range (exact + min/max)
 *   5. Infer 1H / 2H goal split from odds + attack/defence ratings
 *   6. Compute ALL betting markets from the pool
 *   7. Rank markets, eliminate contradictions, return top 5
 */

import type {
  ScoreString, ProbabilityMap,
  BBSpinRound, BBGoalRange, BBMarket, BBResult, BBConfidence,
} from '../types';
import { weightedRandomScore } from './poisson';
import { countFrequency, getTopScores } from './countFrequency';
import type { MatchIntelligenceInput } from './matchIntelligence';
import { calculateFixtureRisk } from './fixtureRisk';

// ─── Internal: run one 20× spin round ────────────────────────────────────────

function runOneSpinRound(
  scores: ScoreString[],
  probabilities: ProbabilityMap,
  roundNumber: number,
): BBSpinRound {
  const picks: ScoreString[] = Array.from({ length: 20 }, () =>
    weightedRandomScore(scores, probabilities)
  );
  const frequency = countFrequency(picks);
  const topScores = getTopScores(frequency);
  return { roundNumber, topScores, frequency };
}

// ─── Pool builder ─────────────────────────────────────────────────────────────

/**
 * Merge Monte Carlo top-3 and spin round top scores into a deduplicated pool.
 * Order: MC scores first, then spin round scores. Duplicates are preserved
 * in terms of the probability map lookup — the pool is just unique scorelines.
 */
function buildScorePool(
  mcTop3: ScoreString[],
  spinRounds: BBSpinRound[],
): ScoreString[] {
  const seen = new Set<ScoreString>();
  const pool: ScoreString[] = [];

  const addScore = (s: ScoreString) => {
    if (!seen.has(s)) { seen.add(s); pool.push(s); }
  };

  mcTop3.forEach(addScore);
  spinRounds.forEach(r => r.topScores.forEach(addScore));

  return pool;
}

// ─── Goal range ───────────────────────────────────────────────────────────────

function computeGoalRange(
  pool: ScoreString[],
  probabilities: ProbabilityMap,
  intelligenceInput: Partial<MatchIntelligenceInput>,
): BBGoalRange {
  if (pool.length === 0) {
    return { exact: 0, min: 0, max: 0, homeExact: 0, awayExact: 0, expectedH1: 0, expectedH2: 0 };
  }

  let totalWeight = 0;
  let weightedTotal = 0;
  let weightedHome = 0;
  let weightedAway = 0;

  // Use the FULL probability map for accurate xG sums, not just the subset pool
  for (const [score, prob] of Object.entries(probabilities)) {
    if (prob === 0) continue;
    const [h, a] = score.split('-').map(Number);
    const total = h + a;
    weightedTotal += total * prob;
    weightedHome += h * prob;
    weightedAway += a * prob;
    totalWeight += prob;
  }

  // Calculate min/max from the pool (the most likely scenarios)
  let minGoals = Infinity;
  let maxGoals = -Infinity;
  for (const score of pool) {
    const [h, a] = score.split('-').map(Number);
    const total = h + a;
    if (total < minGoals) minGoals = total;
    if (total > maxGoals) maxGoals = total;
  }

  const norm = totalWeight > 0 ? totalWeight : 1;
  const exact = weightedTotal / norm;
  const homeExact = weightedHome / norm;
  const awayExact = weightedAway / norm;

  // ── 1H / 2H inference ──────────────────────────────────────────────────────
  // Base split: 44% of goals in 1H, 56% in 2H (statistical norm for elite football)
  let h1Split = 0.44;

  // Adjust based on attack ratings — high combined attack → more open early
  const homeAtk = intelligenceInput.homeAttackRating ?? 5;
  const awayAtk = intelligenceInput.awayAttackRating ?? 5;
  const combinedAtk = (homeAtk + awayAtk) / 2; // 1–10
  // Scale: if avg attack > 7, push 1H split up to 0.48; if < 4, pull down to 0.40
  h1Split += ((combinedAtk - 5) / 5) * 0.04;

  // Strong favourite (homeOdds < 1.6 or awayOdds < 1.6) → more pressure early → more 1H goals
  const homeOdds = intelligenceInput.homeOdds ?? 0;
  const awayOdds = intelligenceInput.awayOdds ?? 0;
  if ((homeOdds > 1 && homeOdds < 1.6) || (awayOdds > 1 && awayOdds < 1.6)) {
    h1Split += 0.03;
  }

  // Clamp to sensible range
  h1Split = Math.min(0.52, Math.max(0.38, h1Split));

  const expectedH1 = Math.round(exact * h1Split * 10) / 10;
  const expectedH2 = Math.round(exact * (1 - h1Split) * 10) / 10;

  return {
    exact: Math.round(exact * 10) / 10,
    min: minGoals === Infinity ? 0 : minGoals,
    max: maxGoals === -Infinity ? 0 : maxGoals,
    homeExact: Math.round(homeExact * 10) / 10,
    awayExact: Math.round(awayExact * 10) / 10,
    expectedH1,
    expectedH2,
  };
}

// ─── Contradiction sets ────────────────────────────────────────────────────────
// Markets that can't coexist in a BB slip

const CONTRADICTION_GROUPS: string[][] = [
  ['gg', 'ng'],
  ['home_win', 'draw', 'away_win'],
  ['home_cs', 'gg'],
  ['away_cs', 'gg'],
  ['home_cs', 'ng'],
  ['dc_1x', 'away_win'],
  ['dc_x2', 'home_win'],
  // Multi-goal windows: narrower ranges contradict the broader 1–5
  ['mg_15', 'mg_25'],   // 1–5 and 2–5 overlap but are logically competing claims
  ['mg_15', 'mg_13'],  // 1–5 and 1–3 are redundant — only keep the tighter or broader
];

// ─── Market factory ───────────────────────────────────────────────────────────

function mkMarket(
  id: string,
  label: string,
  probability: number,
  category: string,
  emoji: string,
  tacticalNote?: string,
): BBMarket {
  const p = Math.min(0.99, Math.max(0.01, probability));
  const confidence: BBConfidence =
    p >= 0.70 ? 'high' : p >= 0.50 ? 'medium' : 'low';
  const odds = +(1 / p).toFixed(2);
  return { id, label, probability: p, confidence, category, emoji, odds, tacticalNote };
}

// ─── Full market computation ──────────────────────────────────────────────────

function computeAllMarkets(
  pool: ScoreString[], // kept for backward compatibility if needed elsewhere, but ignored for math
  probabilities: ProbabilityMap,
  goalRange: BBGoalRange,
  intelligenceInput: Partial<MatchIntelligenceInput> = {},
): BBMarket[] {
  // Use the FULL probability map for markets, not just the narrowed pool.
  // This ensures mathematical perfection for markets like Over 2.5 and Team Goals.
  const allScores = Object.keys(probabilities);
  
  const poolProbs: Record<ScoreString, number> = {};
  let poolTotal = 0;
  for (const s of allScores) {
    poolProbs[s] = probabilities[s] ?? 0;
    poolTotal += poolProbs[s];
  }
  const norm = poolTotal > 0 ? poolTotal : 1;
  for (const s of allScores) poolProbs[s] /= norm;
  
  // The loop below will now use `allScores` instead of `pool`.

  // Accumulators
  let gg = 0, ng = 0;
  let gg1 = 0, gg2 = 0, ggx = 0;
  let homeOv25Win = 0, awayOv25Win = 0, drawOv25Win = 0;
  let totalOdd = 0, totalEven = 0;
  let homeWin = 0, draw = 0, awayWin = 0;
  let homeOv05 = 0, homeOv15 = 0, homeOv25 = 0, homeOv35 = 0, homeOv45 = 0;
  let awayOv05 = 0, awayOv15 = 0, awayOv25 = 0, awayOv35 = 0, awayOv45 = 0;
  let over05 = 0, over15 = 0, over25 = 0, over35 = 0, over45 = 0, over55 = 0;
  let under15 = 0, under25 = 0, under35 = 0, under45 = 0;
  let home1up = 0, home2up = 0, away1up = 0, away2up = 0;
  let homeMinus15 = 0, awayMinus15 = 0;
  let homeCS = 0, awayCS = 0;
  let homeFirst = 0, awayFirst = 0, noGoal = 0;
  let homeBothHalves = 0, awayBothHalves = 0;
  let homeWinEitherHalf = 0, awayWinEitherHalf = 0;
  let homePlus15 = 0, awayPlus15 = 0, homePlus25 = 0, awayPlus25 = 0;
  let mg25 = 0, mg13 = 0, mg15 = 0, mg24 = 0;
  let homeMg13 = 0, awayMg13 = 0;

  const { expectedH1, expectedH2, exact } = goalRange;

  for (const score of allScores) {
    const p = poolProbs[score];
    const [h, a] = score.split('-').map(Number);
    const total = h + a;

    // BTTS
    if (h > 0 && a > 0) gg += p; else ng += p;

    // BTTS & Win
    if (h > 0 && a > 0) {
      if (h > a) gg1 += p;
      else if (h === a) ggx += p;
      else gg2 += p;
    }

    // Win & Over 2.5
    if (total > 2.5) {
      if (h > a) homeOv25Win += p;
      else if (h === a) drawOv25Win += p;
      else awayOv25Win += p;
    }

    // Odd/Even
    if (total % 2 !== 0) totalOdd += p;
    else totalEven += p;

    // 1X2
    if (h > a) homeWin += p;
    else if (h === a) draw += p;
    else awayWin += p;

    // Home goals
    if (h >= 1) homeOv05 += p;
    if (h >= 2) homeOv15 += p;
    if (h >= 3) homeOv25 += p;
    if (h >= 4) homeOv35 += p;
    if (h >= 5) homeOv45 += p;

    // Away goals
    if (a >= 1) awayOv05 += p;
    if (a >= 2) awayOv15 += p;
    if (a >= 3) awayOv25 += p;
    if (a >= 4) awayOv35 += p;
    if (a >= 5) awayOv45 += p;

    // Total Over/Under
    if (total > 0.5) over05 += p;
    if (total > 1.5) over15 += p;
    if (total > 2.5) over25 += p;
    if (total > 3.5) over35 += p;
    if (total > 4.5) over45 += p;
    if (total > 5.5) over55 += p;
    if (total < 1.5) under15 += p;
    if (total < 2.5) under25 += p;
    if (total < 3.5) under35 += p;
    if (total < 4.5) under45 += p;

    // Multi-Goals
    if (total >= 2 && total <= 5) mg25 += p;
    if (total >= 1 && total <= 3) mg13 += p;
    if (total >= 1 && total <= 5) mg15 += p;

    // Team Multi-Goals
    if (h >= 1 && h <= 3) homeMg13 += p;
    if (a >= 1 && a <= 3) awayMg13 += p;

    // Handicaps (+1.5 and +2.5 cushions)
    if (h + 1.5 > a) homePlus15 += p;
    if (a + 1.5 > h) awayPlus15 += p;
    if (h + 2.5 > a) homePlus25 += p;
    if (a + 2.5 > h) awayPlus25 += p;

    // Lead markets
    if (h - a === 1) home1up += p;
    if (h - a >= 2) { home2up += p; homeMinus15 += p; }
    if (a - h === 1) away1up += p;
    if (a - h >= 2) { away2up += p; awayMinus15 += p; }

    // Clean sheets
    if (a === 0) homeCS += p;
    if (h === 0) awayCS += p;

    // First team to score proxy
    if (total === 0) {
      noGoal += p;
    } else {
      homeFirst += p * (h / total);
      awayFirst += p * (a / total);
    }

    // Both halves scoring: approximate from H1/H2 expected goals
    if (h >= 2) {
      homeBothHalves += p * Math.min(0.85, 0.4 + (h - 1) * 0.15);
    }
    if (a >= 2) {
      awayBothHalves += p * Math.min(0.85, 0.4 + (a - 1) * 0.15);
    }

    // Win either half
    if (h > a) homeWinEitherHalf += p * 0.92;
    else if (h === a) homeWinEitherHalf += p * 0.45;
    if (a > h) awayWinEitherHalf += p * 0.92;
    else if (h === a) awayWinEitherHalf += p * 0.45;
  }

  // Double Chance
  const dc1X = homeWin + draw;
  const dcX2 = draw + awayWin;
  const dc12 = homeWin + awayWin;

  // Draw No Bet (DNB)
  const dnbHome = homeWin / (homeWin + awayWin || 1);
  const dnbAway = awayWin / (homeWin + awayWin || 1);

  // 1H / 2H Over markets — derived from goal range inference
  const h1Ov05 = expectedH1 >= 0.5 ? Math.min(0.95, 0.55 + (expectedH1 - 0.5) * 0.5) : Math.max(0.15, expectedH1);
  const h1Ov15 = expectedH1 >= 1.5 ? Math.min(0.80, 0.35 + (expectedH1 - 1.5) * 0.4) : Math.max(0.05, (expectedH1 - 0.5) * 0.3);
  const h2Ov05 = expectedH2 >= 0.5 ? Math.min(0.97, 0.60 + (expectedH2 - 0.5) * 0.45) : Math.max(0.20, expectedH2);
  const h2Ov15 = expectedH2 >= 1.5 ? Math.min(0.85, 0.40 + (expectedH2 - 1.5) * 0.35) : Math.max(0.05, (expectedH2 - 0.5) * 0.3);

  // Tactical Corner Calculations
  const homeAtk = intelligenceInput.homeAttackRating ?? 5;
  const awayDef = intelligenceInput.awayDefenseRating ?? 5;
  const awayAtk = intelligenceInput.awayAttackRating ?? 5;
  const homeDef = intelligenceInput.homeDefenseRating ?? 5;

  const markets: BBMarket[] = [
    // ── Safe Team Goals (Anti-Fragile Early Settlement) ──
    mkMarket('home_ov05', 'Home Over 0.5 Goals', homeOv05, 'home', '🏠', 'Anti-Fragile: Wins as soon as Home scores 1 goal'),
    mkMarket('away_ov05', 'Away Over 0.5 Goals', awayOv05, 'away', '✈️', 'Anti-Fragile: Wins as soon as Away scores 1 goal'),
    mkMarket('home_mg13', 'Home 1–3 Team Goals', homeMg13, 'home', '🏠', 'Controlled Home team scoring window'),
    mkMarket('away_mg13', 'Away 1–3 Team Goals', awayMg13, 'away', '✈️', 'Controlled Away team scoring window'),

    // ── Multi-Goals Windows (High Statistical Stability) ──
    mkMarket('mg_15', '1–5 Multi-Goals', mg15, 'multigoals', '📊', 'Ultra Safe: Covers almost all non-zero scorelines'),
    mkMarket('mg_13', '1–3 Multi-Goals', mg13, 'multigoals', '📊', 'Controlled match goal window'),
    mkMarket('mg_25', '2–5 Multi-Goals', mg25, 'multigoals', '📊', 'High tempo goal distribution window'),

    // ── Resilient Cushion Handicaps (+1.5 and +2.5) ──
    mkMarket('handicap_home_plus15', 'Home +1.5 Handicap', homePlus15, 'handicap', '🛡️', 'Wins if Home loses by exactly 1 goal or better'),
    mkMarket('handicap_away_plus15', 'Away +1.5 Handicap', awayPlus15, 'handicap', '🛡️', 'Wins if Away loses by exactly 1 goal or better'),
    mkMarket('handicap_home_plus25', 'Home +2.5 Handicap', homePlus25, 'handicap', '🛡️', 'Wins even if Home loses by up to 2 goals'),
    mkMarket('handicap_away_plus25', 'Away +2.5 Handicap', awayPlus25, 'handicap', '🛡️', 'Wins even if Away loses by up to 2 goals'),

    // ── Total Goals Floors & Ceilings ──
    mkMarket('over05',  'Over 0.5 Goals',  over05,  'total', '⚽', 'Universal match floor'),
    mkMarket('over15',  'Over 1.5 Goals',  over15,  'total', '⚽', 'High-resilience match goal floor'),
    mkMarket('over25',  'Over 2.5 Goals',  over25,  'total', '⚽'),
    mkMarket('over35',  'Over 3.5 Goals',  over35,  'total', '⚽'),
    mkMarket('over45',  'Over 4.5 Goals',  over45,  'total', '⚽'),
    mkMarket('over55',  'Over 5.5 Goals',  over55,  'total', '⚽'),
    mkMarket('under55', 'Under 5.5 Goals', Math.max(0.01, 1 - over55), 'total', '🔒', 'Ultra-safe statistical upper ceiling'),
    mkMarket('under45', 'Under 4.5 Goals', under45, 'total', '🔒', 'Very high statistical ceiling buffer'),
    mkMarket('under35', 'Under 3.5 Goals', under35, 'total', '🔒', 'Safe upper ceiling for disciplined games'),
    mkMarket('under25', 'Under 2.5 Goals', under25, 'total', '🔒'),
    mkMarket('under15', 'Under 1.5 Goals', under15, 'total', '🔒'),

    // ── Resilient Double Chance ──
    mkMarket('dc_1x', '1X (Home or Draw)', dc1X, 'double_chance', '🛡️', 'Covers 2 match outcomes'),
    mkMarket('dc_x2', 'X2 (Draw or Away)', dcX2, 'double_chance', '🛡️', 'Covers 2 match outcomes'),
    mkMarket('dc_12', '12 (Any Winner)',   dc12, 'double_chance', '⚔️', 'Decisive outcome'),

    // ── Draw No Bet (Refund on Draw) ──
    mkMarket('dnb_home', 'Home Draw No Bet (DNB)', dnbHome, 'result', '🏠', 'Stake refunded on Draw'),
    mkMarket('dnb_away', 'Away Draw No Bet (DNB)', dnbAway, 'result', '✈️', 'Stake refunded on Draw'),

    // ── Half Time & Intervals ──
    mkMarket('h2_ov05', '2nd Half Over 0.5', h2Ov05, 'halftime', '⏱️', 'Goals expected in 2nd half'),
    mkMarket('h1_ov05', '1st Half Over 0.5', h1Ov05, 'halftime', '⏱️', 'Early goal expected in 1st half'),
    mkMarket('h2_ov15', '2nd Half Over 1.5', h2Ov15, 'halftime', '⏱️'),
    mkMarket('h1_ov15', '1st Half Over 1.5', h1Ov15, 'halftime', '⏱️'),
    mkMarket('home_win_either',  'Home Win Either Half',   homeWinEitherHalf, 'home', '🏠'),
    mkMarket('away_win_either',  'Away Win Either Half',   awayWinEitherHalf, 'away', '✈️'),
    mkMarket('home_both_halves', 'Home Score Both Halves', homeBothHalves, 'home', '🏠'),
    mkMarket('away_both_halves', 'Away Score Both Halves', awayBothHalves, 'away', '✈️'),

    // ── Straight Match Result & Early Payout (1UP/2UP) ──
    mkMarket('home_win', 'Home Win', homeWin, 'result', '🏠'),
    mkMarket('home_early_1up', 'Home 1UP (Early Payout)', Math.min(0.99, homeWin * 1.15), 'result', '💸', 'Pays out instantly if Home takes a 1-goal lead'),
    mkMarket('home_early_2up', 'Home 2UP (Early Payout)', Math.min(0.99, homeWin * 1.05), 'result', '💸', 'Pays out instantly if Home takes a 2-goal lead'),
    mkMarket('draw',     'Draw',     draw,    'result', '🤝'),
    mkMarket('away_win', 'Away Win', awayWin, 'result', '✈️'),
    mkMarket('away_early_1up', 'Away 1UP (Early Payout)', Math.min(0.99, awayWin * 1.15), 'result', '💸', 'Pays out instantly if Away takes a 1-goal lead'),
    mkMarket('away_early_2up', 'Away 2UP (Early Payout)', Math.min(0.99, awayWin * 1.05), 'result', '💸', 'Pays out instantly if Away takes a 2-goal lead'),

    // ── BTTS ──
    mkMarket('gg', 'GG (Both Score)', gg, 'btts', '🎯'),
    mkMarket('ng', 'NG (No Both)',    ng, 'btts', '🚫'),
    mkMarket('gg_home', 'Home Win & BTTS', gg1, 'btts', '🏠'),
    mkMarket('gg_draw', 'Draw & BTTS', ggx, 'btts', '🤝'),
    mkMarket('gg_away', 'Away Win & BTTS', gg2, 'btts', '✈️'),

    // ── Win & Over 2.5 ──
    mkMarket('home_ov25_win', 'Home Win & Over 2.5', homeOv25Win, 'result', '🏠'),
    mkMarket('draw_ov25_win', 'Draw & Over 2.5', drawOv25Win, 'result', '🤝'),
    mkMarket('away_ov25_win', 'Away Win & Over 2.5', awayOv25Win, 'result', '✈️'),

    // ── Odd/Even ──
    mkMarket('total_odd', 'Total Goals Odd', totalOdd, 'total', '🔢'),
    mkMarket('total_even', 'Total Goals Even', totalEven, 'total', '🔢'),

    // ── Additional Home/Away Lines ──
    mkMarket('home_ov15', 'Home Over 1.5 Goals', homeOv15, 'home', '🏠'),
    mkMarket('home_ov25', 'Home Over 2.5 Goals', homeOv25, 'home', '🏠'),
    mkMarket('home_ov35', 'Home Over 3.5 Goals', homeOv35, 'home', '🏠'),
    mkMarket('home_ov45', 'Home Over 4.5 Goals', homeOv45, 'home', '🏠'),
    mkMarket('home_1up',  'Home Win by 1',  home1up,  'home', '🏠'),
    mkMarket('home_2up',  'Home Win by 2+', home2up,  'home', '🏠'),
    mkMarket('home_minus15', 'Home -1.5 Asian Handicap', homeMinus15, 'handicap', '⚔️'),
    mkMarket('home_cs',   'Home Clean Sheet', homeCS,  'home', '🧤'),
    mkMarket('home_first', 'Home Score First', Math.min(0.95, homeFirst), 'home', '🏠'),

    mkMarket('away_ov15', 'Away Over 1.5 Goals', awayOv15, 'away', '✈️'),
    mkMarket('away_ov25', 'Away Over 2.5 Goals', awayOv25, 'away', '✈️'),
    mkMarket('away_ov35', 'Away Over 3.5 Goals', awayOv35, 'away', '✈️'),
    mkMarket('away_ov45', 'Away Over 4.5 Goals', awayOv45, 'away', '✈️'),
    mkMarket('away_1up',  'Away Win by 1',  away1up,  'away', '✈️'),
    mkMarket('away_2up',  'Away Win by 2+', away2up,  'away', '✈️'),
    mkMarket('away_minus15', 'Away -1.5 Asian Handicap', awayMinus15, 'handicap', '⚔️'),
    mkMarket('away_cs',   'Away Clean Sheet', awayCS,  'away', '🧤'),
    mkMarket('away_first', 'Away Score First', Math.min(0.95, awayFirst), 'away', '✈️'),
    mkMarket('no_goal',   'No Goal (0-0)', noGoal, 'result', '🚫'),
  ];

  // ── Tactical Corner Intelligence Engine ──────────────────────────────────────
  //
  // Estimates expected corners from xG, attack/defence styles, press vs block,
  // and league rank gap. Uses Poisson distribution to convert expected corners
  // into Over/Under market probabilities.
  //
  // Benchmark: average English Premier League match ≈ 10.5 corners,
  // with ~2.3 corners generated per unit of xG (shot attempts + pressure).

  const poissonOv = (lambda: number, k: number): number => {
    if (lambda <= 0) return 0.01;
    let cdf = 0;
    let term = Math.exp(-lambda);
    cdf += term;
    for (let i = 1; i <= k; i++) {
      term *= lambda / i;
      cdf += term;
    }
    return Math.min(0.99, Math.max(0.01, 1 - cdf));
  };

  // Base corners from xG (goalRange already has home/away split)
  const homeXGEst = goalRange.homeExact;
  const awayXGEst = goalRange.awayExact;
  // Home teams generate slightly more corners due to home advantage crowd/set-piece pressure
  let expectedHomeCorners = homeXGEst * 2.5;
  let expectedAwayCorners = awayXGEst * 2.1;
  let expectedTotalCorners = expectedHomeCorners + expectedAwayCorners;

  const homeDefStyle = intelligenceInput.homeDefenceStyle ?? 'block';
  const awayDefStyle = intelligenceInput.awayDefenceStyle ?? 'block';
  const homeAtkStyle = intelligenceInput.homeAttackStyle ?? 'possession';
  const awayAtkStyle = intelligenceInput.awayAttackStyle ?? 'possession';

  // Press boost: high-press = more end-to-end play = more corners from both sides
  if (homeDefStyle === 'press' && awayDefStyle === 'press') {
    expectedTotalCorners += 1.8; expectedHomeCorners += 0.9; expectedAwayCorners += 0.9;
  } else if (awayDefStyle === 'press') {
    // Away pressing into home half = Home wins corners from defensive clearances
    expectedTotalCorners += 0.8; expectedHomeCorners += 0.8;
  } else if (homeDefStyle === 'press') {
    // Home pressing into away = Away wins corners from clearances
    expectedTotalCorners += 0.8; expectedAwayCorners += 0.8;
  }

  // Direct attack style = more crossing situations = more corners
  if (homeAtkStyle === 'direct') { expectedHomeCorners += 0.6; expectedTotalCorners += 0.6; }
  if (awayAtkStyle === 'direct') { expectedAwayCorners += 0.6; expectedTotalCorners += 0.6; }

  // Strong attack vs deep block = sustained crossing dominance
  if (homeAtk >= 7 && awayDef >= 6 && awayDefStyle === 'block') {
    expectedHomeCorners += 1.3; expectedTotalCorners += 1.3;
  }
  if (awayAtk >= 7 && homeDef >= 6 && homeDefStyle === 'block') {
    expectedAwayCorners += 1.1; expectedTotalCorners += 1.1;
  }

  // League rank gap: dominant side pushes for more set pieces
  const homeRank = intelligenceInput.homeLeagueRank ?? 0;
  const awayRank = intelligenceInput.awayLeagueRank ?? 0;
  if (homeRank > 0 && awayRank > 0) {
    const rankDelta = awayRank - homeRank; // positive = home is ranked higher (better)
    if (rankDelta > 4) {
      const boost = Math.min(1.5, rankDelta * 0.08);
      expectedHomeCorners += boost; expectedTotalCorners += boost * 0.7;
    } else if (rankDelta < -4) {
      const boost = Math.min(1.5, Math.abs(rankDelta) * 0.08);
      expectedAwayCorners += boost; expectedTotalCorners += boost * 0.7;
    }
  }

  // Compute Poisson probabilities for each corner line
  const cornerNote = '📐 Tactical Estimate — based on xG, press/block style & rank gap';
  const homeWinsCorners = Math.min(0.99, Math.max(0.01,
    expectedHomeCorners / (expectedHomeCorners + expectedAwayCorners + 0.001)
  ));

  markets.push(mkMarket('corners_ov75',      'Over 7.5 Total Corners',  poissonOv(expectedTotalCorners, 7),  'corners', '🚩', cornerNote));
  markets.push(mkMarket('corners_ov85',      'Over 8.5 Total Corners',  poissonOv(expectedTotalCorners, 8),  'corners', '🚩', cornerNote));
  markets.push(mkMarket('corners_ov95',      'Over 9.5 Total Corners',  poissonOv(expectedTotalCorners, 9),  'corners', '🚩', cornerNote));
  markets.push(mkMarket('corners_ov105',     'Over 10.5 Total Corners', poissonOv(expectedTotalCorners, 10), 'corners', '🚩', cornerNote));
  markets.push(mkMarket('corners_uv95',      'Under 9.5 Total Corners', Math.min(0.99, 1 - poissonOv(expectedTotalCorners, 9)), 'corners', '🔒', cornerNote));
  markets.push(mkMarket('corners_home_ov35', 'Home Over 3.5 Corners',   poissonOv(expectedHomeCorners, 3),  'corners', '🚩', cornerNote));
  markets.push(mkMarket('corners_home_ov45', 'Home Over 4.5 Corners',   poissonOv(expectedHomeCorners, 4),  'corners', '🚩', cornerNote));
  markets.push(mkMarket('corners_away_ov25', 'Away Over 2.5 Corners',   poissonOv(expectedAwayCorners, 2),  'corners', '🚩', cornerNote));
  markets.push(mkMarket('corners_away_ov35', 'Away Over 3.5 Corners',   poissonOv(expectedAwayCorners, 3),  'corners', '🚩', cornerNote));
  markets.push(mkMarket('corners_home_win',  'Home Team Wins Corners',  homeWinsCorners, 'corners', '🚩', cornerNote));

  return markets;
}

// ─── Rollover Safety Priority Function ─────────────────────────────────────────

export function getRolloverSafetyScore(market: BBMarket): number {
  const p = market.probability;

  // Tier 1 (ULTRA PRIORITY): The 14 User-Requested Rollover Markets
  if ([
    'home_ov05', 'away_ov05',                 // Team Ov 0.5
    'over15',                                 // Total goal Ov 1.5
    'over05',                                 // Total goal Ov 0.5
    'dnb_home', 'dnb_away',                   // Draw no bet
    'handicap_home_plus15', 'handicap_away_plus15', // Asian Handicap +1.5
    'handicap_home_plus25', 'handicap_away_plus25', // Asian Handicap +2.5
    'under35', 'under45', 'under55',          // Under Goal 3.5, 4.5, 5.5
    'home_mg13', 'away_mg13',                 // Team Goal bound 1-3
    'dc_1x', 'dc_x2', 'dc_12',                // Double chance
    'mg_15', 'mg_25'                          // Total goal bound 1-5, 2-5
  ].includes(market.id)) {
    return p * 3.0; // Heavily prioritize to ensure they fill the top 20
  }

  // Tier 2: Resilient Early-Settlement Over Goal Floors
  if ([
    'over25', 'h1_ov05', 'h2_ov05',
    'mg_13', 
  ].includes(market.id)) {
    return p * 1.32;
  }

  // Tier 3: 2UP Early Payout
  if ([
    'home_early_2up', 'away_early_2up'
  ].includes(market.id)) {
    return p * 1.15;
  }

  // Tier 2.5: 1UP Early Payout
  if ([
    'home_early_1up', 'away_early_1up'
  ].includes(market.id)) {
    return p * 1.08;
  }

  // Tier 3: High Upper Ceilings (Under 4.5 / 5.5) — High probability, but 90+ min exposure
  if ([
    'under55', 'under45',
  ].includes(market.id)) {
    return p * 1.02;
  }

  // Tier 4: Tight Ceilings (Under 3.5 / Under 2.5) — High match-tempo blowout risk
  if ([
    'under35', 'under25', 'under15',
  ].includes(market.id)) {
    return p * 0.85;
  }

  // Tier 5: 90-minute Match Result, BTTS, and Volatile lines
  return p * 0.78;
}

// ─── Contradiction filter + top-picks selector ────────────────────────────────

function selectTopPicks(markets: BBMarket[], intelligenceInput?: Partial<MatchIntelligenceInput>, goalRange?: BBGoalRange, maxPicks = 20): BBMarket[] {
  // Sort with Rollover Safety Priority weighting so anti-fragile goal markets rank highest
  const sorted = [...markets]
    .filter(m => m.probability >= 0.60) // Only 60%+ probability markets
    .sort((a, b) => getRolloverSafetyScore(b) - getRolloverSafetyScore(a));

  const selected: BBMarket[] = [];
  const usedIds = new Set<string>();

  for (const market of sorted) {
    if (selected.length >= maxPicks) break;
    if (usedIds.has(market.id)) continue;

    // Check contradiction with already-selected markets
    let contradicts = false;
    for (const group of CONTRADICTION_GROUPS) {
      if (group.includes(market.id)) {
        const conflict = selected.some(s => group.includes(s.id) && s.id !== market.id);
        if (conflict) { contradicts = true; break; }
      }
    }
    if (contradicts) continue;

    selected.push(market);
    usedIds.add(market.id);
  }

  // Enhance tactical notes for top picks with dynamic data
  if (intelligenceInput && goalRange) {
    selected.forEach((m) => {
      // Create dynamic reasons based on market
      if (m.id === 'away_ov05' && intelligenceInput.awayAttackRating && intelligenceInput.homeDefenseRating) {
        m.tacticalNote = `Away Attack rating (${intelligenceInput.awayAttackRating}/10) vs weak Home Defense (${intelligenceInput.homeDefenseRating}/10).`;
      } else if (m.id === 'home_ov05' && intelligenceInput.homeAttackRating && intelligenceInput.awayDefenseRating) {
        m.tacticalNote = `Home Attack rating (${intelligenceInput.homeAttackRating}/10) vs weak Away Defense (${intelligenceInput.awayDefenseRating}/10).`;
      } else if (m.id === 'over15') {
        m.tacticalNote = `Match goal expectation is robust at ${goalRange.exact.toFixed(2)} expected goals.`;
      } else if (m.id.startsWith('under')) {
        m.tacticalNote = `Match goal expectation is capped at ${goalRange.exact.toFixed(2)} goals, well below this market line.`;
      } else if (m.id.startsWith('handicap')) {
        m.tacticalNote = `Highly resilient cushion against an unlikely blowout scenario.`;
      } else if (m.id === 'dnb_home' || m.id === 'dnb_away') {
        m.tacticalNote = `Strong form and H2H advantage with a safety net for a draw.`;
      } else if (m.id.includes('mg13')) {
        m.tacticalNote = `High probability of team scoring 1-3 goals, effectively dodging the 0 and 4+ extremes.`;
      }
    });
  }

  return selected;
}

// ─── Final score selector ─────────────────────────────────────────────────────

function selectFinalScore(
  pool: ScoreString[],
  probabilities: ProbabilityMap,
): ScoreString {
  if (pool.length === 0) return '—';

  // Pick highest probability score from pool
  let best = pool[0];
  let bestProb = probabilities[pool[0]] ?? 0;

  for (const s of pool) {
    const p = probabilities[s] ?? 0;
    if (p > bestProb) { bestProb = p; best = s; }
  }

  return best;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface RunBBOptions {
  /** Score pool to spin from */
  scores: ScoreString[];
  /** Probability map for weighted selection */
  probabilities: ProbabilityMap;
  /** Top 3 scores from Monte Carlo simulation */
  mcTop3: ScoreString[];
  /** Match Intelligence inputs for HT inference */
  intelligenceInput?: Partial<MatchIntelligenceInput>;
}

/**
 * runBetBuilder – Full BB pipeline.
 * Runs 3 rounds of 20× spins, merges with MC top-3,
 * computes goal range and all markets, returns a BBResult.
 */
export function runBetBuilder(options: RunBBOptions): BBResult {
  const { scores, probabilities, mcTop3, intelligenceInput = {} } = options;

  // 1. Run 3 spinner rounds at 20×
  const spinRounds: BBSpinRound[] = [1, 2, 3].map(n =>
    runOneSpinRound(scores, probabilities, n)
  );

  // 2. Build deduplicated score pool
  const scorePool = buildScorePool(mcTop3, spinRounds);

  // 3. Compute goal range
  const goalRange = computeGoalRange(scorePool, probabilities, intelligenceInput);

  // 4. Compute all markets
  const allMarkets = computeAllMarkets(scorePool, probabilities, goalRange, intelligenceInput);

  // 5. Select top picks (max 20, ≥60% probability, safety-weighted, no contradictions)
  const topPicks = selectTopPicks(allMarkets, intelligenceInput, goalRange, 20);

  // 6. Select final score
  const finalScore = selectFinalScore(scorePool, probabilities);

  // 7. Calculate Fixture Volatility & Risk Analysis
  const riskAnalysis = calculateFixtureRisk({
    scores,
    probabilities,
    allMarkets,
    intelligenceInput,
  });

  return {
    mcTop3,
    spinRounds,
    scorePool,
    goalRange,
    allMarkets,
    topPicks,
    finalScore,
    riskAnalysis,
    computedAt: new Date(),
  };
}

