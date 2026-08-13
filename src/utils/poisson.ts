import type { ProbabilityMap, ScoreString } from '../types';

/**
 * Poisson probability mass function: P(X = k) where X ~ Poisson(λ).
 * Uses log-space computation to avoid floating-point underflow for large k.
 *
 * This is the industry-standard statistical model for football goal scoring.
 * Goals per game are approximately Poisson-distributed with parameter λ = xG.
 */

function logFactorial(n: number): number {
  if (n <= 1) return 0;
  let result = 0;
  for (let i = 2; i <= n; i++) result += Math.log(i);
  return result;
}

export function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0 || k < 0) return 0;
  const logProb = -lambda + k * Math.log(lambda) - logFactorial(k);
  return Math.exp(logProb);
}

/**
 * Dixon-Coles adjustment multiplier.
 * Adjusts the independent Poisson assumption for low-scoring matches.
 * Standard rho value for football is typically around -0.13.
 */
function dixonColesAdjustment(h: number, a: number, lambda: number, mu: number, rho = -0.13): number {
  if (h === 0 && a === 0) return 1 - lambda * mu * rho;
  if (h === 0 && a === 1) return 1 + lambda * rho;
  if (h === 1 && a === 0) return 1 + mu * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1.0;
}

/**
 * Calculate the probability of every score given home/away expected goals (xG).
 *
 * Assumes goal scoring is independent between teams (standard Dixon-Coles
 * simplification). The result is normalised over the provided scores array so
 * that the probabilities of all selected scores sum to 1.
 *
 * @param homeXG  - Expected goals for home team (typically 0.5 – 3.5)
 * @param awayXG  - Expected goals for away team (typically 0.3 – 2.5)
 * @param scores  - Array of score strings to evaluate, e.g. ["0-0", "1-0", ...]
 */
export function calculatePoissonProbabilities(
  homeXG: number,
  awayXG: number,
  scores: ScoreString[],
  homeAdvantageMultiplier = 1.0,
): ProbabilityMap {
  let effectiveHomeXG = homeXG * homeAdvantageMultiplier;
  let effectiveAwayXG = awayXG;

  // --- xG Stretcher (Advanced Model Expansion) ---
  // If one team is clearly better, exaggerate the gap slightly to prevent the Poisson PMF 
  // from defaulting to 1-1 due to overlapping low-end probabilities.
  const gap = effectiveHomeXG - effectiveAwayXG;
  if (Math.abs(gap) > 0.4) {
    if (gap > 0) {
      effectiveHomeXG *= 1.1;
      effectiveAwayXG *= 0.9;
    } else {
      effectiveHomeXG *= 0.9;
      effectiveAwayXG *= 1.1;
    }
  }

  const raw: ProbabilityMap = {};
  let total = 0;

  for (const score of scores) {
    const [h, a] = score.split('-').map(Number);
    let p = poissonPMF(effectiveHomeXG, h) * poissonPMF(effectiveAwayXG, a);
    
    // Apply Dixon-Coles adjustment for low scores
    const dcMultiplier = dixonColesAdjustment(h, a, effectiveHomeXG, effectiveAwayXG);
    p = Math.max(0, p * dcMultiplier); // safeguard against negative probabilities
    
    raw[score] = p;
    total += p;
  }

  // Normalise so probabilities of selected scores sum to 1
  const normalised: ProbabilityMap = {};
  for (const score of scores) {
    normalised[score] = total > 0 ? raw[score] / total : 1 / scores.length;
  }

  return normalised;
}

/**
 * Weighted random selection using cumulative-distribution sampling.
 * Falls back to uniform selection if all weights are zero.
 */
export function weightedRandomScore(
  scores: ScoreString[],
  probabilities: ProbabilityMap
): ScoreString {
  const weights = scores.map((s) => probabilities[s] ?? 0);
  const total = weights.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return scores[Math.floor(Math.random() * scores.length)];
  }

  let r = Math.random() * total;
  for (let i = 0; i < scores.length; i++) {
    r -= weights[i];
    if (r <= 0) return scores[i];
  }
  return scores[scores.length - 1];
}
