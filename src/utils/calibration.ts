/**
 * calibration.ts — Phase 5
 *
 * Analyses all history entries with actual results to build a calibration
 * profile that tells you:
 *   - Exact score hit rate
 *   - Correct outcome (win/draw/loss) hit rate
 *   - Suggested xG bias correction (was the model over/under-estimating goals?)
 *   - Goal range accuracy
 *   - Most common miss pattern (over-predicted home goals, etc.)
 *   - Best-performing prediction mode
 *   - xG bias (average predicted total vs actual total)
 */

import type { HistoryEntry, PredictionMode, ScoreString } from '../types';

// ─── Output types ─────────────────────────────────────────────────────────────

export type Outcome = 'H' | 'D' | 'A';

export interface CalibrationStats {
  /** Total entries with an actual result */
  totalResults: number;
  /** Exact score correct */
  exactHits: number;
  exactHitRate: number;
  /** Correct 1X2 outcome */
  outcomeHits: number;
  outcomeHitRate: number;
  /** Predicted total within ±1 goal of actual total */
  within1GoalHits: number;
  within1GoalRate: number;
  /** Predicted total within ±2 goals */
  within2GoalHits: number;
  within2GoalRate: number;
  /** Average predicted total goals */
  avgPredictedTotal: number;
  /** Average actual total goals */
  avgActualTotal: number;
  /** xG bias: positive = model over-predicts goals, negative = under-predicts */
  totalGoalsBias: number;
  /** Home goals bias: positive = over-predicts home, negative = under-predicts */
  homeGoalsBias: number;
  /** Away goals bias */
  awayGoalsBias: number;
  /** Breakdown by prediction mode */
  modeBreakdown: Record<PredictionMode, { total: number; exact: number; outcome: number }>;
  /** Outcome confusion matrix (predicted → actual count) */
  confusionMatrix: Record<Outcome, Record<Outcome, number>>;
  /** Recent trend (last 10 with results) */
  recentStreak: { exact: number; outcome: number; total: number };
  /** Most common actual score (your nemesis score) */
  mostMissedScore: ScoreString | null;
  /** Calibration grade A/B/C/D/F */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Plain-English recommendation */
  recommendation: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parse(s: ScoreString): [number, number] {
  const [h, a] = s.split('-').map(Number);
  return [isNaN(h) ? 0 : h, isNaN(a) ? 0 : a];
}

function outcome(h: number, a: number): Outcome {
  return h > a ? 'H' : h < a ? 'A' : 'D';
}

const ALL_OUTCOMES: Outcome[] = ['H', 'D', 'A'];

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeCalibration(entries: HistoryEntry[]): CalibrationStats | null {
  const withResult = entries.filter(e => e.actualResult && /^\d+-\d+$/.test(e.actualResult));
  if (withResult.length < 2) return null;

  let exactHits = 0;
  let outcomeHits = 0;
  let within1 = 0;
  let within2 = 0;

  let totalPredicted = 0;
  let totalActual = 0;
  let homePredicted = 0;
  let homeActual = 0;
  let awayPredicted = 0;
  let awayActual = 0;

  const modeMap: Record<string, { total: number; exact: number; outcome: number }> = {};
  const confusion: Record<Outcome, Record<Outcome, number>> = {
    H: { H: 0, D: 0, A: 0 },
    D: { H: 0, D: 0, A: 0 },
    A: { H: 0, D: 0, A: 0 },
  };

  // Scores that were actual results but NOT in our prediction
  const missedScores: Record<string, number> = {};

  for (const e of withResult) {
    const [ph, pa] = parse(e.prediction);
    const [ah, aa] = parse(e.actualResult!);

    const predTotal = ph + pa;
    const actualTotal = ah + aa;
    const predOutcome = outcome(ph, pa);
    const actualOutcome = outcome(ah, aa);

    // Totals
    totalPredicted += predTotal;
    totalActual += actualTotal;
    homePredicted += ph;
    homeActual += ah;
    awayPredicted += pa;
    awayActual += aa;

    // Exact hit
    if (e.prediction === e.actualResult) exactHits++;

    // Outcome hit
    if (predOutcome === actualOutcome) outcomeHits++;
    else {
      // Track missed actual scores
      missedScores[e.actualResult!] = (missedScores[e.actualResult!] ?? 0) + 1;
    }

    // Goal range
    if (Math.abs(predTotal - actualTotal) <= 1) within1++;
    if (Math.abs(predTotal - actualTotal) <= 2) within2++;

    // Confusion matrix
    confusion[predOutcome][actualOutcome]++;

    // Mode breakdown
    const mode = e.predictionMode ?? 'uniform';
    if (!modeMap[mode]) modeMap[mode] = { total: 0, exact: 0, outcome: 0 };
    modeMap[mode].total++;
    if (e.prediction === e.actualResult) modeMap[mode].exact++;
    if (predOutcome === actualOutcome) modeMap[mode].outcome++;
  }

  const n = withResult.length;
  const avgPredictedTotal = totalPredicted / n;
  const avgActualTotal = totalActual / n;
  const totalGoalsBias = avgPredictedTotal - avgActualTotal;
  const homeGoalsBias = homePredicted / n - homeActual / n;
  const awayGoalsBias = awayPredicted / n - awayActual / n;

  // Most-missed actual score
  const sortedMissed = Object.entries(missedScores).sort((a, b) => b[1] - a[1]);
  const mostMissedScore = sortedMissed[0]?.[0] ?? null;

  // Recent trend (last 10 with results — these are already in order)
  const recentEntries = [...withResult].reverse().slice(0, 10);
  const recentExact = recentEntries.filter(e => e.prediction === e.actualResult).length;
  const recentOutcome = recentEntries.filter(e => {
    const [ph, pa] = parse(e.prediction);
    const [ah, aa] = parse(e.actualResult!);
    return outcome(ph, pa) === outcome(ah, aa);
  }).length;

  // Grade calculation
  const exactRate = exactHits / n;
  const outcomeRate = outcomeHits / n;
  const grade = exactRate >= 0.15
    ? 'A'
    : exactRate >= 0.10
    ? 'B'
    : outcomeRate >= 0.55
    ? 'C'
    : outcomeRate >= 0.40
    ? 'D'
    : 'F';

  // Recommendation
  let recommendation = '';
  if (totalGoalsBias > 0.5) {
    recommendation = `Model over-predicts goals by ~${totalGoalsBias.toFixed(1)} per match. Try reducing your base xG inputs.`;
  } else if (totalGoalsBias < -0.5) {
    recommendation = `Model under-predicts goals by ~${Math.abs(totalGoalsBias).toFixed(1)} per match. Consider increasing base xG.`;
  } else if (homeGoalsBias > 0.4) {
    recommendation = `Home xG is systematically too high by ~${homeGoalsBias.toFixed(1)}. Reduce home xG when using Poisson mode.`;
  } else if (awayGoalsBias > 0.4) {
    recommendation = `Away xG is systematically too high by ~${awayGoalsBias.toFixed(1)}. Reduce away xG for better accuracy.`;
  } else if (outcomeRate < 0.35) {
    recommendation = `Outcome prediction is below 35%. Try using the Odds-Blended mode or entering bookmaker odds.`;
  } else if (exactRate >= 0.15) {
    recommendation = `Excellent accuracy! Your model is well calibrated — keep using the same settings.`;
  } else {
    recommendation = `Add League Context, team form, and bookmaker odds to improve accuracy further.`;
  }

  return {
    totalResults: n,
    exactHits,
    exactHitRate: exactRate,
    outcomeHits,
    outcomeHitRate: outcomeRate,
    within1GoalHits: within1,
    within1GoalRate: within1 / n,
    within2GoalHits: within2,
    within2GoalRate: within2 / n,
    avgPredictedTotal,
    avgActualTotal,
    totalGoalsBias,
    homeGoalsBias,
    awayGoalsBias,
    modeBreakdown: modeMap as Record<PredictionMode, { total: number; exact: number; outcome: number }>,
    confusionMatrix: confusion,
    recentStreak: { exact: recentExact, outcome: recentOutcome, total: recentEntries.length },
    mostMissedScore,
    grade,
    recommendation,
  };
}
