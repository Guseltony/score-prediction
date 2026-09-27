/**
 * oddsBlend.ts — Odds-Blended prediction mode.
 *
 * Merges our Poisson model probabilities with bookmaker implied probabilities.
 * When the market is very confident (extreme odds), it increases bookmaker weight.
 *
 * Formula:
 *   blended(score) = α × modelProb(score) + (1-α) × bookieImpliedProb(score)
 *
 * The bookmaker implied probabilities are vig-stripped before blending.
 */
import type { ProbabilityMap, ScoreString } from '../types';
import type { ParsedMatchOdds, ParsedCorrectScoreOdds } from '../api/types';

// ─── Vig stripping ────────────────────────────────────────────────────────────

/**
 * Strip the bookmaker's margin (overround/vig) from a set of odds.
 * Returns true implied probabilities that sum to 1.
 */
function vigStrip(oddsMap: Record<string, number>): Record<string, number> {
  const implied: Record<string, number> = {};
  let totalImplied = 0;

  for (const [k, odds] of Object.entries(oddsMap)) {
    if (odds > 1) {
      implied[k] = 1 / odds;
      totalImplied += implied[k];
    }
  }

  // Normalise to remove the overround
  const stripped: Record<string, number> = {};
  for (const [k, prob] of Object.entries(implied)) {
    stripped[k] = totalImplied > 0 ? prob / totalImplied : 0;
  }
  return stripped;
}

// ─── Auto-alpha from odds extremity ───────────────────────────────────────────

/**
 * Dynamically reduce model weight when the market is very one-sided.
 * Celtic at 1.12 (89% implied) → alpha drops from 0.6 to ~0.30.
 */
function effectiveAlpha(baseAlpha: number, matchOdds: ParsedMatchOdds | null): number {
  if (!matchOdds) return baseAlpha;

  const minOdds = Math.min(matchOdds.homeWin, matchOdds.awayWin);

  if (minOdds <= 1.15) return Math.min(baseAlpha, 0.25); // extreme favourite
  if (minOdds <= 1.25) return Math.min(baseAlpha, 0.35);
  if (minOdds <= 1.40) return Math.min(baseAlpha, 0.45);

  return baseAlpha; // normal range — use base alpha
}

// ─── Main blend function ─────────────────────────────────────────────────────

export interface BlendedProbsInput {
  scores: ScoreString[];
  modelProbabilities: ProbabilityMap;
  correctScoreOdds: ParsedCorrectScoreOdds;
  matchOdds: ParsedMatchOdds | null;
  /** 0.0 = full bookie trust, 1.0 = full model trust. Default 0.6 */
  alpha: number;
}

export function calculateBlendedProbabilities(input: BlendedProbsInput): ProbabilityMap {
  const { scores, modelProbabilities, correctScoreOdds, matchOdds, alpha } = input;

  if (Object.keys(correctScoreOdds).length === 0) {
    if (!matchOdds || matchOdds.homeWin <= 1 || matchOdds.awayWin <= 1) {
      // No bookie odds available at all — fall back to purely model
      return modelProbabilities;
    }

    // We only have 1X2 odds. Blend by scaling the 1X2 buckets.
    const a = effectiveAlpha(alpha, matchOdds);
    const stripped1X2 = stripMatchOddsVig(matchOdds);
    
    let modelHome = 0, modelDraw = 0, modelAway = 0;
    for (const score of scores) {
      const p = modelProbabilities[score] ?? 0;
      const [h, away] = score.split('-').map(Number);
      if (h > away) modelHome += p;
      else if (h === away) modelDraw += p;
      else modelAway += p;
    }
    
    const raw: ProbabilityMap = {};
    let total = 0;
    
    for (const score of scores) {
      const p = modelProbabilities[score] ?? 0;
      const [h, away] = score.split('-').map(Number);
      
      let bucketRatio = 1;
      if (h > away && modelHome > 0) bucketRatio = stripped1X2.homeWin / modelHome;
      else if (h === away && modelDraw > 0) bucketRatio = stripped1X2.draw / modelDraw;
      else if (h < away && modelAway > 0) bucketRatio = stripped1X2.awayWin / modelAway;
      
      const bookieP = p * bucketRatio;
      const blended = a * p + (1 - a) * bookieP;
      
      raw[score] = blended;
      total += blended;
    }
    
    const result: ProbabilityMap = {};
    for (const score of scores) {
      result[score] = total > 0 ? raw[score] / total : 1 / scores.length;
    }
    return result;
  }

  const a = effectiveAlpha(alpha, matchOdds);
  const strippedBookieProbs = vigStrip(correctScoreOdds);

  const raw: ProbabilityMap = {};
  let total = 0;

  for (const score of scores) {
    const modelP = modelProbabilities[score] ?? 0;
    const bookieP = strippedBookieProbs[score] ?? 0;

    let blended: number;
    if (bookieP > 0) {
      blended = a * modelP + (1 - a) * bookieP;
    } else {
      // Score not in bookie's offered correct scores — use a small fallback
      // based purely on model (very low bookie offering implies low probability)
      blended = a * modelP * 0.5;
    }

    raw[score] = blended;
    total += blended;
  }

  // Normalise
  const result: ProbabilityMap = {};
  for (const score of scores) {
    result[score] = total > 0 ? raw[score] / total : 1 / scores.length;
  }

  return result;
}

// ─── Vig-stripped 1X2 implied probabilities ───────────────────────────────────

export interface StrippedMatchOdds {
  homeWin: number;
  draw: number;
  awayWin: number;
  overround: number; // bookmaker margin %
}

export function stripMatchOddsVig(matchOdds: ParsedMatchOdds): StrippedMatchOdds {
  const raw = {
    homeWin: 1 / matchOdds.homeWin,
    draw: 1 / matchOdds.draw,
    awayWin: 1 / matchOdds.awayWin,
  };
  const totalImplied = raw.homeWin + raw.draw + raw.awayWin;
  const overround = (totalImplied - 1) * 100;

  return {
    homeWin: raw.homeWin / totalImplied,
    draw: raw.draw / totalImplied,
    awayWin: raw.awayWin / totalImplied,
    overround,
  };
}
