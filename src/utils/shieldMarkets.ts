/**
 * shieldMarkets.ts  (v2 — Deep Analysis Edition)
 *
 * 🛡️ Protective Shield — Smart Market Recommender
 *
 * Classifies BBResult markets into three non-contradicting tiers:
 *   mustHave       — 3–5 high-confidence, goal-range-aligned picks
 *   recommended    — 4–5 solid secondary picks (never contradicting mustHave)
 *   outsideShield  — everything else (⚠️ badge in UI)
 *
 * Improvements over v1:
 *   • Full BBResult context — uses goalRange, finalScore, riskAnalysis
 *   • Goal-range alignment scoring — rewards markets consistent with xG
 *   • Contradiction detection — no contradicting pair survives the same tier
 *   • Logical impossibility pruning — removes statistically impossible combos
 */

import type { BBMarket, BBResult, FixtureRiskLevel, BBGoalRange } from '../types';

// ── Public interface ──────────────────────────────────────────────────────────

export interface ShieldTier {
  /** 3–5 markets. Skip fixture if none are available at the bookmaker. */
  mustHave: BBMarket[];
  /** 4–5 solid markets. Good supporting picks if available. */
  recommended: BBMarket[];
  /** All other markets. Show ⚠️ OUTSIDE SHIELD badge if user adds one. */
  outsideShield: BBMarket[];
  /** True when mustHave is empty — system recommends skipping this fixture. */
  shouldSkipFixture: boolean;
  /** Human-readable explanation of the shield result. */
  summary: string;
}

// ── Contradiction registry ────────────────────────────────────────────────────
//
// Each entry is a pair [A, B] meaning A and B must not both appear in the same
// recommended tier. If both are present, the lower-scoring one moves to outsideShield.
//
// Three categories:
//   1. DIRECT OPPOSITES   — mathematically exclusive outcomes on the same line
//   2. LOGICAL CONFLICTS  — one outcome makes the other impossible
//   3. MISLEADING COMBOS  — both could theoretically coexist but together signal
//                           contradictory match pictures to the punter

const CONTRADICTION_PAIRS: [string, string][] = [
  // ── 1. Direct opposites ──
  ['over15',    'under15'],
  ['over25',    'under25'],
  ['over35',    'under35'],
  ['over45',    'under45'],
  ['gg',        'ng'],
  ['total_odd', 'total_even'],
  ['home_win',  'away_win'],
  ['dc_1x',     'away_win'],   // 1X covers home+draw; away_win = opposite
  ['dc_x2',     'home_win'],   // X2 covers draw+away; home_win = opposite
  ['dc_12',     'draw'],       // No-draw market vs draw

  // ── 2. Logical impossibilities ──
  ['gg',        'home_cs'],    // BTTS + home clean sheet is impossible (away scored)
  ['gg',        'away_cs'],    // BTTS + away clean sheet is impossible (home scored)
  ['ng',        'gg_home'],    // NG means no BTTS; BTTS+result combos are impossible
  ['ng',        'gg_draw'],
  ['ng',        'gg_away'],
  ['under15',   'gg'],         // Under 1.5 goals + BTTS is impossible (BTTS ≥ 2 goals)
  ['under15',   'home_ov05'],  // 0 or 1 total goals yet home scores > 0.5 — razor thin
  ['home_cs',   'away_win'],   // Home CS means away scored 0 → home cannot lose
  ['away_cs',   'home_win'],   // Away CS means home scored 0 → away cannot lose
  ['no_goal',   'gg'],         // 0-0 and BTTS are mutually exclusive
  ['no_goal',   'over05'],     // 0-0 and over 0.5 goals are mutually exclusive
  ['no_goal',   'home_ov05'],
  ['no_goal',   'away_ov05'],
  ['home_win',  'dnb_away'],   // Home DNB wins on away win — opposite outcomes
  ['away_win',  'dnb_home'],   // Away DNB wins on home win — opposite outcomes

  // ── 3. Misleading combos (contradictory match picture) ──
  ['over35',    'ng'],         // 4+ goals yet neither team scored? Statistically tiny
  ['over35',    'home_cs'],    // 4+ goals with home clean sheet = very narrow
  ['over35',    'away_cs'],    // 4+ goals with away clean sheet = very narrow
  ['under25',   'gg'],         // Under 2.5 + BTTS = only 1-1 survives; misleading
  ['under15',   'over05'],     // Under 1.5 + over 0.5 = exactly 1 goal only; too narrow
  ['home_win',  'gg_away'],    // Home win + BTTS away win = impossible
  ['away_win',  'gg_home'],    // Away win + BTTS home win = impossible

  // ── 4. Soft contradictions (system indecision — force a choice) ──
  ['dc_1x',           'dc_x2'],
  ['home_first',      'away_first'],
  ['home_win_either', 'away_win_either'],
  ['home_1up',        'away_1up'],
  ['home_2up',        'away_2up'],
  ['home_ov15',       'away_ov15'],
];

// Pre-index contradiction pairs into a Set of "id1__id2" for O(1) lookup
const CONTRADICTION_SET = new Set<string>();
for (const [a, b] of CONTRADICTION_PAIRS) {
  CONTRADICTION_SET.add(`${a}__${b}`);
  CONTRADICTION_SET.add(`${b}__${a}`);
}

function areContradicting(a: string, b: string): boolean {
  return CONTRADICTION_SET.has(`${a}__${b}`);
}

// ── Thresholds per risk level ─────────────────────────────────────────────────

function getThresholds(riskLevel: FixtureRiskLevel): {
  mustHaveProbMin: number;
  recommendedProbMin: number;
  mustHaveMaxCount: number;
  recommendedMaxCount: number;
} {
  switch (riskLevel) {
    case 'safe':
      return { mustHaveProbMin: 0.62, recommendedProbMin: 0.50, mustHaveMaxCount: 5, recommendedMaxCount: 5 };
    case 'moderate':
      return { mustHaveProbMin: 0.65, recommendedProbMin: 0.52, mustHaveMaxCount: 5, recommendedMaxCount: 5 };
    case 'dangerous':
      return { mustHaveProbMin: 0.68, recommendedProbMin: 0.55, mustHaveMaxCount: 4, recommendedMaxCount: 4 };
    case 'extreme_danger':
      return { mustHaveProbMin: 0.72, recommendedProbMin: 0.60, mustHaveMaxCount: 3, recommendedMaxCount: 3 };
  }
}

// ── Category priority (lower = higher priority) ───────────────────────────────

const CATEGORY_PRIORITY: Record<string, number> = {
  total:         1,  // Over/Under totals — most liquid, most data
  btts:          2,  // BTTS — high volume, analytical
  result:        3,  // 1X2 / DNB / Clean sheet
  double_chance: 4,  // 1X / X2 / 12
  home:          5,  // team-specific goal markets
  away:          5,
  multigoals:    6,  // windows
  halftime:      7,
  handicap:      8,
  corners:       9,
};

// ── Goal-range alignment scoring ─────────────────────────────────────────────
//
// Returns 0.0–1.0 based on how well the market aligns with the model's
// expected goal distribution. Markets that agree with the xG picture get a
// bonus; markets that fight against it get penalised.

function goalAlignmentScore(m: BBMarket, g: BBGoalRange): number {
  const { exact, homeExact, awayExact, min, max } = g;

  switch (m.id) {
    // ── Total goals overs ──
    case 'over05':  return exact >= 0.8 ? 1.0 : 0.60;
    case 'over15':  return exact >= 2.0 ? 1.0 : exact >= 1.5 ? 0.75 : 0.25;
    case 'over25':  return exact >= 2.8 ? 1.0 : exact >= 2.5 ? 0.75 : exact >= 2.0 ? 0.40 : 0.10;
    case 'over35':  return exact >= 3.8 ? 1.0 : exact >= 3.5 ? 0.70 : exact >= 3.0 ? 0.30 : 0.02;
    case 'over45':  return exact >= 4.8 ? 1.0 : exact >= 4.5 ? 0.70 : 0.01;
    case 'over55':  return exact >= 5.5 ? 0.80 : 0.01;

    // ── Total goals unders ──
    case 'under15': return exact <= 1.0 ? 1.0 : exact <= 1.5 ? 0.60 : 0.10;
    case 'under25': return exact <= 1.8 ? 1.0 : exact <= 2.5 ? 0.65 : exact <= 3.0 ? 0.25 : 0.05;
    case 'under35': return exact <= 2.5 ? 1.0 : exact <= 3.5 ? 0.70 : exact <= 4.0 ? 0.35 : 0.10;
    case 'under45': return exact <= 3.5 ? 1.0 : exact <= 4.5 ? 0.75 : 0.30;
    case 'under55': return exact <= 4.5 ? 1.0 : exact <= 5.5 ? 0.80 : 0.40;

    // ── BTTS ──
    case 'gg':  return (homeExact >= 1.0 && awayExact >= 1.0) ? 1.0
                     : (homeExact >= 0.7 && awayExact >= 0.7) ? 0.65 : 0.20;
    case 'ng':  return (homeExact < 0.6 || awayExact < 0.6) ? 0.90
                     : (homeExact < 0.9 || awayExact < 0.9) ? 0.50 : 0.15;

    // ── Result / 1X2 ──
    case 'home_win': return homeExact > awayExact + 0.6 ? 1.0
                          : homeExact > awayExact + 0.2 ? 0.65 : 0.25;
    case 'away_win': return awayExact > homeExact + 0.6 ? 1.0
                          : awayExact > homeExact + 0.2 ? 0.65 : 0.25;
    case 'draw':     return Math.abs(homeExact - awayExact) < 0.3 ? 0.85
                          : Math.abs(homeExact - awayExact) < 0.6 ? 0.50 : 0.20;

    // ── Double chance ──
    case 'dc_1x': return homeExact > awayExact + 0.2 ? 0.90 : Math.abs(homeExact - awayExact) <= 0.2 ? 0.60 : 0.30;
    case 'dc_x2': return awayExact > homeExact + 0.2 ? 0.90 : Math.abs(homeExact - awayExact) <= 0.2 ? 0.60 : 0.30;
    case 'dc_12': return Math.abs(homeExact - awayExact) > 0.5 ? 0.80 : 0.40;

    // ── Home goal markets ──
    case 'home_ov05':  return homeExact >= 0.9 ? 1.0 : 0.55;
    case 'home_ov15':  return homeExact >= 1.8 ? 1.0 : homeExact >= 1.2 ? 0.55 : 0.10;
    case 'home_ov25':  return homeExact >= 2.8 ? 1.0 : homeExact >= 2.0 ? 0.50 : 0.05;
    case 'home_cs':    return awayExact <= 0.5 ? 0.90 : awayExact <= 0.9 ? 0.55 : 0.15;

    // ── Away goal markets ──
    case 'away_ov05':  return awayExact >= 0.9 ? 1.0 : 0.55;
    case 'away_ov15':  return awayExact >= 1.8 ? 1.0 : awayExact >= 1.2 ? 0.55 : 0.10;
    case 'away_ov25':  return awayExact >= 2.8 ? 1.0 : awayExact >= 2.0 ? 0.50 : 0.05;
    case 'away_cs':    return homeExact <= 0.5 ? 0.90 : homeExact <= 0.9 ? 0.55 : 0.15;

    // ── Multi-goals ──
    case 'mg_15':  return (min >= 1 && max <= 5) ? 1.0 : exact >= 1 && exact <= 5 ? 0.85 : 0.50;
    case 'mg_13':  return exact >= 1.0 && exact <= 3.0 ? 1.0 : 0.50;
    case 'mg_25':  return exact >= 2.0 && exact <= 4.5 ? 1.0 : exact >= 1.5 ? 0.65 : 0.25;

    // ── Handicaps ──
    case 'handicap_home_plus15': return homeExact >= awayExact - 1.0 ? 0.80 : 0.40;
    case 'handicap_away_plus15': return awayExact >= homeExact - 1.0 ? 0.80 : 0.40;
    case 'handicap_home_plus25': return homeExact >= awayExact - 2.0 ? 0.90 : 0.50;
    case 'handicap_away_plus25': return awayExact >= homeExact - 2.0 ? 0.90 : 0.50;

    // ── First to Score / Win Either Half / Lead Markets ──
    case 'home_first':
    case 'home_win_either':
    case 'home_1up':
    case 'home_2up':
         return homeExact > awayExact + 0.3 ? 0.90 : 0.40;
    case 'away_first':
    case 'away_win_either':
    case 'away_1up':
    case 'away_2up':
         return awayExact > homeExact + 0.3 ? 0.90 : 0.40;

    default: return 0.50; // neutral for unrecognised IDs
  }
}

// ── Composite sort score ──────────────────────────────────────────────────────
//
// Weights:
//   60% — raw probability (the model's fundamental output)
//   20% — goal-range alignment (does the market agree with xG analysis?)
//   20% — category priority (liquidity + data quality proxy)

function marketCompositeScore(m: BBMarket, goalRange: BBGoalRange): number {
  const catPriority = CATEGORY_PRIORITY[m.category] ?? 10;
  const catScore    = 1 - catPriority / 15; // normalised 0..1
  const alignment   = goalAlignmentScore(m, goalRange);
  return m.probability * 0.60 + alignment * 0.20 + catScore * 0.20;
}

// ── Contradiction resolution ──────────────────────────────────────────────────
//
// Given an already-selected list and a candidate, returns true if the candidate
// contradicts any market already in the list.

function contradictsAny(candidate: BBMarket, selected: BBMarket[]): boolean {
  return selected.some(s => areContradicting(candidate.id, s.id));
}

// ── Main classifier ───────────────────────────────────────────────────────────

export function classifyShieldMarkets(result: BBResult): ShieldTier {
  const { allMarkets, riskAnalysis, goalRange } = result;
  const riskLevel = riskAnalysis.level;

  const {
    mustHaveProbMin,
    recommendedProbMin,
    mustHaveMaxCount,
    recommendedMaxCount,
  } = getThresholds(riskLevel);

  // Step 1 — Sort all markets by composite score (probability + alignment + category)
  const sorted = [...allMarkets].sort(
    (a, b) => marketCompositeScore(b, goalRange) - marketCompositeScore(a, goalRange)
  );

  const mustHave:      BBMarket[] = [];
  const recommended:   BBMarket[] = [];
  const outsideShield: BBMarket[] = [];

  const BANNED_UNDERS = ['under15', 'under25', 'under35'];

  // Step 2 — Fill mustHave (high confidence, high probability, non-contradicting)
  for (const m of sorted) {
    if (mustHave.length >= mustHaveMaxCount) break;
    if (m.confidence !== 'high') continue;
    if (m.probability < mustHaveProbMin) continue;
    if (BANNED_UNDERS.includes(m.id)) continue; // 🚫 Anti-Under Bias
    if (contradictsAny(m, mustHave)) continue; // reject if it contradicts an already-chosen pick
    mustHave.push(m);
  }

  // Step 3 — Fill recommended (solid probability, non-contradicting with mustHave OR with each other)
  const allChosen = [...mustHave];
  for (const m of sorted) {
    if (recommended.length >= recommendedMaxCount) break;
    if (mustHave.some(mh => mh.id === m.id)) continue; // skip already in mustHave
    if (m.probability < recommendedProbMin) continue;
    if (BANNED_UNDERS.includes(m.id)) continue; // 🚫 Anti-Under Bias
    if (contradictsAny(m, allChosen)) continue; // reject contradictions against mustHave + prior recommended
    recommended.push(m);
    allChosen.push(m);
  }

  // Step 4 — Everything else goes to outsideShield
  const chosenIds = new Set(allChosen.map(m => m.id));
  for (const m of sorted) {
    if (!chosenIds.has(m.id)) {
      outsideShield.push(m);
    }
  }

  // Step 5 — Build summary
  const shouldSkipFixture = mustHave.length === 0;

  let summary: string;
  if (shouldSkipFixture) {
    summary = 'No must-have markets survive the contradiction and confidence filters for this fixture. The system recommends skipping it and finding a more predictable match.';
  } else if (riskLevel === 'extreme_danger') {
    summary = `Extreme-danger fixture. Only ${mustHave.length} must-have market${mustHave.length > 1 ? 's' : ''} cleared all filters. Do not deviate — these are the only analytically sound options.`;
  } else {
    const goalNote = `Expected goals: ${goalRange.exact} (H ${goalRange.homeExact} / A ${goalRange.awayExact}).`;
    summary = `${mustHave.length} must-have + ${recommended.length} recommended markets identified — all verified non-contradicting and goal-range aligned. ${goalNote} If none of the 🔴 markets are available, skip this fixture.`;
  }

  return { mustHave, recommended, outsideShield, shouldSkipFixture, summary };
}

// ── Helper exports ────────────────────────────────────────────────────────────

export function isOutsideShield(market: BBMarket, tier: ShieldTier): boolean {
  return tier.outsideShield.some(m => m.id === market.id);
}

export function isMustHave(market: BBMarket, tier: ShieldTier): boolean {
  return tier.mustHave.some(m => m.id === market.id);
}
