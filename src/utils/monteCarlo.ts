import type { ScoreString, ProbabilityMap, FrequencyMap } from '../types';
import { weightedRandomScore } from './poisson';
import { countFrequency, getSortedFrequency } from './countFrequency';

export interface MonteCarloResult {
  /** Ranked list of scorelines with their counts and percentages */
  ranked: MonteCarloEntry[];
  /** Raw frequency map */
  frequency: FrequencyMap;
  /** Number of simulations run */
  simCount: number;
}

export interface MonteCarloEntry {
  score: ScoreString;
  count: number;
  pct: number;       // actual simulated %
  modelPct: number;  // theoretical model %
}

/**
 * runMonteCarlo – Instantly runs N weighted random picks and returns ranked results.
 * No animation delay — pure math, suitable for large N (1000+).
 */
export function runMonteCarlo(
  scores: ScoreString[],
  probabilities: ProbabilityMap,
  simCount: number,
): MonteCarloResult {
  if (scores.length === 0) {
    return { ranked: [], frequency: {}, simCount };
  }

  const results: ScoreString[] = Array.from({ length: simCount }, () =>
    weightedRandomScore(scores, probabilities)
  );

  const frequency = countFrequency(results);
  const sorted = getSortedFrequency(frequency);

  const ranked: MonteCarloEntry[] = sorted.map(([score, count]) => ({
    score,
    count,
    pct: (count / simCount) * 100,
    modelPct: (probabilities[score] ?? 0) * 100,
  }));

  return { ranked, frequency, simCount };
}
