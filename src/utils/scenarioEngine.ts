/**
 * scenarioEngine.ts
 *
 * Phase 3B — Scenario Engine
 *
 * Takes the probability map + match context and buckets all scores into
 * three meaningful scenarios: Most Likely, Upset, and High-Scoring/Volatile.
 * Also computes an Upset Risk rating and Model Confidence score.
 */

import type { ScoreString, ProbabilityMap } from '../types';
import type { MatchIntelligenceInput } from './matchIntelligence';

// ─── Output types ─────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ScenarioBucket {
  label: string;
  description: string;
  scores: ScoreString[];           // top representative scores
  combinedProbability: number;     // sum of probabilities (normalised)
  topScore: ScoreString | null;    // single highest-prob score in bucket
  emoji: string;
}

export interface ScenarioResult {
  favourite: 'home' | 'away' | 'even';
  mostLikely: ScenarioBucket;
  upset: ScenarioBucket;
  volatile: ScenarioBucket;
  /** Overall upset risk derived from context factors */
  upsetRisk: RiskLevel;
  /** How much confidence we have in the model given the inputs provided */
  modelConfidence: RiskLevel;
  /** Active context factors that influenced the scenario analysis */
  activeFactors: string[];
  /** Plain-English summary of the match outlook */
  outlook: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseScore(s: ScoreString): [number, number] {
  const [h, a] = s.split('-').map(Number);
  return [h, a];
}

/** Returns top N scores from a bucket by probability, capped at maxScores */
function topN(
  scores: ScoreString[],
  probabilities: ProbabilityMap,
  n: number,
): ScoreString[] {
  return [...scores]
    .sort((a, b) => (probabilities[b] ?? 0) - (probabilities[a] ?? 0))
    .slice(0, n);
}

/** Sum of probabilities for a set of scores */
function sumProb(scores: ScoreString[], probabilities: ProbabilityMap): number {
  return scores.reduce((acc, s) => acc + (probabilities[s] ?? 0), 0);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeScenarios(
  scores: ScoreString[],
  probabilities: ProbabilityMap,
  adjustedHomeXG: number,
  adjustedAwayXG: number,
  intelligence?: Partial<MatchIntelligenceInput>,
): ScenarioResult {
  const intel = intelligence ?? {};
  const activeFactors: string[] = [];

  // ── Determine favourite ──────────────────────────────────────────────────
  const xgDiff = adjustedHomeXG - adjustedAwayXG;
  const favourite: 'home' | 'away' | 'even' =
    xgDiff > 0.15 ? 'home' : xgDiff < -0.15 ? 'away' : 'even';

  // ── Bucket all scores ───────────────────────────────────────────────────
  const mostLikelyScores: ScoreString[] = [];
  const upsetScores: ScoreString[] = [];
  const volatileScores: ScoreString[] = [];

  for (const score of scores) {
    const [h, a] = parseScore(score);
    const total = h + a;
    const isHighScoring = total >= 4;

    // High-scoring goes to volatile bucket (can also appear in others)
    if (isHighScoring) {
      volatileScores.push(score);
    }

    if (favourite === 'even') {
      // No clear favourite — all scores go to "most likely"
      if (!isHighScoring) mostLikelyScores.push(score);
    } else if (favourite === 'home') {
      if (h > a && !isHighScoring) mostLikelyScores.push(score);
      else if (a >= h && !isHighScoring) upsetScores.push(score);
    } else {
      if (a > h && !isHighScoring) mostLikelyScores.push(score);
      else if (h >= a && !isHighScoring) upsetScores.push(score);
    }
  }

  // Ensure every bucket has at least something
  if (mostLikelyScores.length === 0) mostLikelyScores.push(...topN(scores, probabilities, 3));
  if (upsetScores.length === 0) {
    // fallback: draw scores
    const draws = scores.filter(s => { const [h, a] = parseScore(s); return h === a; });
    upsetScores.push(...(draws.length > 0 ? draws : topN(scores, probabilities, 2)));
  }
  if (volatileScores.length === 0) {
    const high = scores.filter(s => { const [h, a] = parseScore(s); return h + a >= 3; });
    volatileScores.push(...(high.length > 0 ? high : topN(scores, probabilities, 2)));
  }

  const totalProb = sumProb(scores, probabilities) || 1;

  // ── Upset Risk calculation ───────────────────────────────────────────────
  let upsetScore = 0;

  // xG gap — small gap = more upset risk
  const xgGapAbs = Math.abs(xgDiff);
  if (xgGapAbs < 0.3) upsetScore += 30;
  else if (xgGapAbs < 0.7) upsetScore += 15;
  else if (xgGapAbs > 1.5) upsetScore -= 10;

  // Volatility factor from match intelligence
  const vol = intel.volatilityFactor ?? 0;
  upsetScore += vol * 30;
  if (vol > 0) activeFactors.push(`Volatility ${Math.round(vol * 100)}%`);

  // Psychological factors
  if (intel.isDerby) { upsetScore += 20; activeFactors.push('Derby match'); }
  if (intel.revengeMatch) { upsetScore += 15; activeFactors.push('Revenge factor'); }
  if (intel.bigOccasion) { upsetScore += 12; activeFactors.push('Big occasion'); }
  if (intel.nothingToPlayFor) { upsetScore -= 10; activeFactors.push('Low motivation'); }

  // League context
  const rankGapAbs = Math.abs((intel.awayLeagueRank ?? 0) - (intel.homeLeagueRank ?? 0));
  if (intel.leagueSetting === 'same' && rankGapAbs > 10) upsetScore -= 10;
  else if (intel.leagueSetting === 'same' && rankGapAbs < 4) upsetScore += 10;

  const tierGapAbs = Math.abs((intel.homeTier ?? 1) - (intel.awayTier ?? 1));
  if (intel.leagueSetting === 'different' && tierGapAbs >= 2) upsetScore -= 15;
  else if (intel.leagueSetting === 'different' && tierGapAbs === 1) upsetScore += 5;

  // Squad rotation amplifies upset risk significantly
  if (intel.homeSquadRotation || intel.awaySquadRotation) {
    upsetScore += 18;
    activeFactors.push('Squad rotation');
  }
  if (intel.cupFocus) { upsetScore += 12; activeFactors.push('Cup focus'); }

  // Fatigue
  if ((intel.homeFixtureCongestion || intel.awayFixtureCongestion)) {
    upsetScore += 8;
    activeFactors.push('Fixture congestion');
  }

  // Player absences
  if (intel.homeKeyAttackerMissing || intel.awayKeyAttackerMissing ||
      intel.homeKeyDefenderMissing || intel.awayKeyDefenderMissing) {
    upsetScore += 12;
    activeFactors.push('Key player absent');
  }

  const upsetRisk: RiskLevel =
    upsetScore >= 45 ? 'HIGH' : upsetScore >= 20 ? 'MEDIUM' : 'LOW';

  // ── Model Confidence calculation ─────────────────────────────────────────
  let confidenceScore = 0;

  // Odds loaded = strong signal
  const oddsLoaded = (intel.homeOdds ?? 0) > 1 && (intel.drawOdds ?? 0) > 1;
  if (oddsLoaded) { confidenceScore += 30; activeFactors.push('Odds loaded'); }

  // Form entered
  if (intel.homeForm && intel.homeForm.length >= 3) confidenceScore += 10;
  if (intel.awayForm && intel.awayForm.length >= 3) confidenceScore += 10;

  // Attack/defense ratings non-default
  if ((intel.homeAttackRating ?? 5) !== 5 || (intel.awayAttackRating ?? 5) !== 5) confidenceScore += 10;
  if ((intel.homeDefenseRating ?? 5) !== 5 || (intel.awayDefenseRating ?? 5) !== 5) confidenceScore += 10;

  // League context entered
  if (intel.leagueSetting === 'same' && (intel.homeLeagueRank ?? 0) > 0) confidenceScore += 15;
  else if (intel.leagueSetting === 'different' && (intel.homeTier ?? 1) !== (intel.awayTier ?? 1)) confidenceScore += 15;

  // H2H set
  if ((intel.h2hHomeBias ?? 0) !== 0) confidenceScore += 5;

  const modelConfidence: RiskLevel =
    confidenceScore >= 55 ? 'HIGH' : confidenceScore >= 25 ? 'MEDIUM' : 'LOW';

  // ── Plain-English outlook ────────────────────────────────────────────────
  const favLabel = favourite === 'home'
    ? 'Home team'
    : favourite === 'away'
    ? 'Away team'
    : 'Neither team';

  const upsetPhrase =
    upsetRisk === 'HIGH' ? 'with a significant upset risk'
    : upsetRisk === 'MEDIUM' ? 'with moderate upset potential'
    : 'as clear favourites';

  const goalPhrase =
    adjustedHomeXG + adjustedAwayXG > 3.0 ? 'a high-scoring game is likely' :
    adjustedHomeXG + adjustedAwayXG > 2.0 ? 'goals expected from both sides' :
    'a tight, low-scoring affair expected';

  const outlook = `${favLabel} ${favourite !== 'even' ? 'leads' : 'with both sides even'} ${upsetPhrase}. ${goalPhrase.charAt(0).toUpperCase() + goalPhrase.slice(1)}.`;

  // ── Build buckets ────────────────────────────────────────────────────────
  const favName = favourite === 'home' ? 'home' : favourite === 'away' ? 'away' : 'either side';

  const mostLikelyBucket: ScenarioBucket = {
    label: favourite === 'even' ? 'Most Likely Outcomes' : `${favourite === 'home' ? 'Home' : 'Away'} Win Scenario`,
    description: favourite === 'even'
      ? 'Both teams closely matched — any result is plausible'
      : `${favourite === 'home' ? 'Home' : 'Away'} team wins as expected by form & xG`,
    scores: topN(mostLikelyScores, probabilities, 4),
    combinedProbability: Math.min(0.99, sumProb(mostLikelyScores, probabilities) / totalProb),
    topScore: topN(mostLikelyScores, probabilities, 1)[0] ?? null,
    emoji: '🎯',
  };

  const upsetBucket: ScenarioBucket = {
    label: favourite === 'even' ? 'Draw / Low-Scoring' : `Upset Scenario`,
    description: favourite === 'even'
      ? 'Closely contested — draw or narrow result most likely'
      : `The underdog overturns the form book`,
    scores: topN(upsetScores, probabilities, 4),
    combinedProbability: Math.min(0.99, sumProb(upsetScores, probabilities) / totalProb),
    topScore: topN(upsetScores, probabilities, 1)[0] ?? null,
    emoji: '⚡',
  };

  const volatileBucket: ScenarioBucket = {
    label: 'High-Scoring / Volatile',
    description: `Both teams score freely — 4+ goals expected in these scenarios`,
    scores: topN(volatileScores, probabilities, 4),
    combinedProbability: Math.min(0.99, sumProb(volatileScores, probabilities) / totalProb),
    topScore: topN(volatileScores, probabilities, 1)[0] ?? null,
    emoji: '🔥',
  };

  return {
    favourite,
    mostLikely: mostLikelyBucket,
    upset: upsetBucket,
    volatile: volatileBucket,
    upsetRisk,
    modelConfidence,
    activeFactors: [...new Set(activeFactors)],
    outlook,
  };
}
