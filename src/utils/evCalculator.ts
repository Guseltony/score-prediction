import { type ProbabilityMap, type ScoreString } from '../types';
import { calculatePoissonProbabilities } from './poisson';

/**
 * Strips the bookmaker vig to get true implied probabilities
 */
export function getImpliedProbabilities(homeOdds: number, drawOdds: number, awayOdds: number) {
  if (homeOdds <= 1 || drawOdds <= 1 || awayOdds <= 1) return null;
  const rawH = 1 / homeOdds;
  const rawD = 1 / drawOdds;
  const rawA = 1 / awayOdds;
  const total = rawH + rawD + rawA;
  return {
    homeWin: rawH / total,
    draw: rawD / total,
    awayWin: rawA / total,
    totalVig: total - 1
  };
}

/**
 * Heuristically estimates the Bookmaker's internal xG based strictly on their 1X2 odds.
 */
function estimateBookmakerXG(implied: { homeWin: number, draw: number, awayWin: number }, leagueAvgGoals = 2.7): { h: number, a: number } {
  const homeShare = implied.homeWin + (implied.draw / 2);
  const awayShare = implied.awayWin + (implied.draw / 2);
  return {
    h: leagueAvgGoals * homeShare,
    a: leagueAvgGoals * awayShare,
  };
}

export interface EVResult {
  score: string;
  modelProb: number;
  bookmakerProb: number;
  impliedOdds: number; // what the bookmaker would price this at
  ev: number;          // Expected value percentage (e.g. 0.15 = 15% edge)
}

/**
 * Calculates Expected Value (+EV) for all scores.
 */
export function calculateExpectedValue(
  modelProbMap: ProbabilityMap,
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  scores: ScoreString[]
): EVResult[] {
  const implied = getImpliedProbabilities(homeOdds, drawOdds, awayOdds);
  if (!implied) return [];

  const { h, a } = estimateBookmakerXG(implied);
  // Generate the bookmaker's estimated probability map
  const bookieMap = calculatePoissonProbabilities(h, a, scores, 1.0);

  const results: EVResult[] = [];

  for (const score of scores) {
    const modelProb = modelProbMap[score] || 0;
    const bookieProb = bookieMap[score] || 0;

    // Ignore highly unlikely scores to prevent massive variance
    if (bookieProb < 0.005 || modelProb < 0.005) continue;

    const impliedOdds = 1 / bookieProb;
    const ev = (modelProb * impliedOdds) - 1;

    results.push({
      score,
      modelProb,
      bookmakerProb: bookieProb,
      impliedOdds,
      ev
    });
  }

  return results.sort((a, b) => b.ev - a.ev);
}
