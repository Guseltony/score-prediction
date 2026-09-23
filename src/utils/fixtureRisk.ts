/**
 * fixtureRisk.ts
 *
 * Mathematical Fixture Risk & Volatility Analysis Engine.
 *
 * Evaluates:
 *   1. 1X2 Shannon Entropy (outcome chaos vs dominance)
 *   2. Probability Floor of top betting markets (are there any safe edges?)
 *   3. Goal-line variance & distribution split (Over 2.5 vs Under 2.5)
 *   4. Tactical & psychological red flags (Derby, Squad Rotation, Dead Rubbers, Flat Bookmaker Odds)
 *
 * Categorizes matches into:
 *   - 🟢 Safe / High Predictability
 *   - 🟡 Moderate Risk
 *   - 🟠 Dangerous / High Volatility
 *   - 🔴 Extremely Dangerous / NO-BET ZONE
 */

import type {
  ScoreString, ProbabilityMap, BBMarket,
  FixtureRiskAnalysis, FixtureRiskLevel,
} from '../types';
import type { MatchIntelligenceInput } from './matchIntelligence';

export interface FixtureRiskInput {
  scores: ScoreString[];
  probabilities: ProbabilityMap;
  allMarkets: BBMarket[];
  intelligenceInput?: Partial<MatchIntelligenceInput>;
}

export function calculateFixtureRisk({
  scores,
  probabilities,
  allMarkets,
  intelligenceInput = {},
}: FixtureRiskInput): FixtureRiskAnalysis {
  const reasons: string[] = [];
  let riskPoints = 15; // baseline neutral

  // ── 1. Calculate 1X2 Probabilities & Shannon Entropy ───────────────────────
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver25 = 0;
  let pUnder25 = 0;

  for (const s of scores) {
    const prob = probabilities[s] ?? 0;
    if (prob <= 0) continue;
    const [h, a] = s.split('-').map(Number);
    if (h > a) pHome += prob;
    else if (h === a) pDraw += prob;
    else pAway += prob;

    if (h + a > 2.5) pOver25 += prob;
    else pUnder25 += prob;
  }

  const totalProb = pHome + pDraw + pAway || 1;
  const nHome = pHome / totalProb;
  const nDraw = pDraw / totalProb;
  const nAway = pAway / totalProb;

  // Normalized Shannon Entropy: H / log2(3)
  const calcEntropy = (p: number) => (p > 0.0001 ? -p * Math.log2(p) : 0);
  const rawEntropy = calcEntropy(nHome) + calcEntropy(nDraw) + calcEntropy(nAway);
  const normalizedEntropy = +(rawEntropy / 1.58496).toFixed(3);

  if (normalizedEntropy > 0.95) {
    riskPoints += 35;
    reasons.push(
      `Extreme outcome entropy (${Math.round(normalizedEntropy * 100)}%) — 1X2 distribution is evenly balanced (${Math.round(nHome * 100)}% / ${Math.round(nDraw * 100)}% / ${Math.round(nAway * 100)}%)`
    );
  } else if (normalizedEntropy > 0.88) {
    riskPoints += 25;
    reasons.push(
      `High outcome uncertainty — no clear match winner (${Math.round(nHome * 100)}% / ${Math.round(nDraw * 100)}% / ${Math.round(nAway * 100)}%)`
    );
  } else if (normalizedEntropy < 0.65) {
    riskPoints -= 20; // Clear dominant team lowers risk
  } else if (normalizedEntropy < 0.75) {
    riskPoints -= 10;
  }

  // ── 2. Highest Market Probability Floor ───────────────────────────────────
  const sortedMarkets = [...allMarkets].sort((a, b) => b.probability - a.probability);
  const maxMarketProbability = sortedMarkets.length > 0 ? sortedMarkets[0].probability : 0;

  if (maxMarketProbability < 0.52) {
    riskPoints += 45;
    reasons.push(
      `Top market probability capped at ${Math.round(maxMarketProbability * 100)}% — zero high-edge betting angles found in the entire market suite`
    );
  } else if (maxMarketProbability < 0.60) {
    riskPoints += 30;
    reasons.push(
      `Sub-optimal confidence ceiling — highest market probability is only ${Math.round(maxMarketProbability * 100)}%`
    );
  } else if (maxMarketProbability >= 0.80) {
    riskPoints -= 22;
  } else if (maxMarketProbability >= 0.72) {
    riskPoints -= 12;
  }

  // ── 3. Goal Line Volatility ───────────────────────────────────────────────
  const goalDiff = Math.abs(pOver25 - pUnder25);
  if (goalDiff < 0.08 && normalizedEntropy > 0.85) {
    riskPoints += 15;
    reasons.push(
      `50/50 goal-line coin toss (Over 2.5: ${Math.round(pOver25 * 100)}% vs Under 2.5: ${Math.round(pUnder25 * 100)}%)`
    );
  }

  // ── 4. Tactical / Psychological Context & Bookmaker Odds ──────────────────
  const intel = intelligenceInput;
  if (intel.isDerby) {
    riskPoints += 18;
    reasons.push('Local derby match — high psychological tension, card count volatility and unpredictable tempo');
  }
  if (intel.nothingToPlayFor) {
    riskPoints += 14;
    reasons.push('Dead rubber / nothing to play for — uncommitted team motivation');
  }
  if (intel.homeSquadRotation || intel.awaySquadRotation) {
    riskPoints += 14;
    reasons.push('Squad rotation / non-standard starting XI announced or expected');
  }
  if (intel.cupFocus) {
    riskPoints += 8;
    reasons.push('Upcoming cup clash distraction');
  }
  if (intel.volatilityFactor && intel.volatilityFactor > 15) {
    riskPoints += 10;
    reasons.push(`High tactical volatility rating (+${intel.volatilityFactor}%)`);
  }
  if (intel.homeOdds && intel.awayOdds && intel.homeOdds > 1 && intel.awayOdds > 1) {
    const oddsDiff = Math.abs(intel.homeOdds - intel.awayOdds);
    if (oddsDiff < 0.35 && intel.homeOdds > 2.30) {
      riskPoints += 12;
      reasons.push(`Bookmaker coin-toss pricing (Home @${intel.homeOdds.toFixed(2)} vs Away @${intel.awayOdds.toFixed(2)})`);
    }
  }

  // Clamp final score
  const finalScore = Math.max(5, Math.min(99, riskPoints));

  // ── 5. Classify Risk Level & Prescribe Action ─────────────────────────────
  let level: FixtureRiskLevel = 'moderate';
  let title = 'Moderate Volatility';
  let badgeLabel = '🟡 MODERATE RISK';
  let summary = 'Competitive match with viable angles. Restrict picks to resilient double-chance or conservative goal lines.';
  let recommendation: FixtureRiskAnalysis['recommendation'] = 'caution';

  if (finalScore >= 80 || (maxMarketProbability < 0.55 && normalizedEntropy > 0.90)) {
    level = 'extreme_danger';
    title = 'CRITICAL DANGER / NO-BET ZONE';
    badgeLabel = '🔴 EXTREMELY DANGEROUS';
    summary = 'Outcome entropy is too high and no market meets minimum safety threshold (≥55%). The system strongly advises SKIPPING this fixture for accumulator/rollover tickets.';
    recommendation = 'avoid_match';
    if (reasons.length === 0) {
      reasons.push('High statistical entropy and flat probability distribution across all outcomes');
    }
  } else if (finalScore >= 62) {
    level = 'dangerous';
    title = 'Dangerous / High Volatility';
    badgeLabel = '🟠 DANGEROUS FIXTURE';
    summary = 'Elevated match volatility. Single-direction 1X2 bets are prone to upsets; stick strictly to resilient double-chance or wide goal windows.';
    recommendation = 'restrict_markets';
  } else if (finalScore <= 32) {
    level = 'safe';
    title = 'Stable / High Predictability';
    badgeLabel = '🟢 STABLE FIXTURE';
    summary = 'Strong statistical trends with high-probability betting angles. Ideal anchor candidate for rollover tickets.';
    recommendation = 'bet_freely';
  }

  return {
    level,
    score: finalScore,
    title,
    badgeLabel,
    summary,
    reasons,
    recommendation,
    hasReliableMarkets: maxMarketProbability >= 0.60,
    maxMarketProbability: +maxMarketProbability.toFixed(3),
    entropy1X2: normalizedEntropy,
  };
}
