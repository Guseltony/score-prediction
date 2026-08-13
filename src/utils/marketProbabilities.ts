import type { ProbabilityMap, ScoreString } from '../types';

export interface MarketProbabilities {
  over15: number;
  over25: number;
  over35: number;
  under15: number;
  under25: number;
  under35: number;
  bttsYes: number;
  bttsNo: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  /** Top correct score prediction by model probability */
  topScore: string;
  topScorePct: number;
  /** Fair decimal odds for the top score (1 / probability) */
  topScoreOdds: string;
  /** 2nd and 3rd most likely correct scores */
  runner: Array<{ score: string; pct: number; odds: string }>;
}

/**
 * calculateMarketProbabilities – Sums individual scoreline probabilities
 * to derive aggregate betting market probabilities.
 *
 * Works with any probability map (Poisson, Historical, or Uniform).
 */
export function calculateMarketProbabilities(
  scores: ScoreString[],
  probabilities: ProbabilityMap,
): MarketProbabilities {
  const markets: MarketProbabilities = {
    over15: 0, over25: 0, over35: 0,
    under15: 0, under25: 0, under35: 0,
    bttsYes: 0, bttsNo: 0,
    homeWin: 0, draw: 0, awayWin: 0,
    topScore: '', topScorePct: 0, topScoreOdds: '—',
    runner: [],
  };

  for (const score of scores) {
    const prob = probabilities[score] ?? 0;
    if (prob === 0) continue;

    const [h, a] = score.split('-').map(Number);
    const total = h + a;

    // Over / Under
    if (total > 1.5) markets.over15 += prob; else markets.under15 += prob;
    if (total > 2.5) markets.over25 += prob; else markets.under25 += prob;
    if (total > 3.5) markets.over35 += prob; else markets.under35 += prob;

    // BTTS
    if (h > 0 && a > 0) markets.bttsYes += prob; else markets.bttsNo += prob;

    // 1X2
    if (h > a) markets.homeWin += prob;
    else if (h === a) markets.draw += prob;
    else markets.awayWin += prob;
  }

  // Top correct score prediction — sort by probability
  const sorted = scores
    .map((s) => ({ score: s, prob: probabilities[s] ?? 0 }))
    .filter((x) => x.prob > 0)
    .sort((a, b) => b.prob - a.prob);

  if (sorted.length > 0) {
    let topChoice = sorted[0];

    // --- 1-1 Bias Fix: Score Thresholding ---
    // If the top score is a draw, but a team is heavily favored overall, pick their best score instead.
    const [h, a] = topChoice.score.split('-').map(Number);
    const isDraw = h === a;

    if (isDraw) {
      const MARGIN = 0.15; // 15% clear margin needed to override
      
      if (markets.homeWin > markets.draw + MARGIN) {
        const bestHomeWin = sorted.find(s => {
          const [hx, ax] = s.score.split('-').map(Number);
          return hx > ax;
        });
        if (bestHomeWin) topChoice = bestHomeWin;
      } 
      else if (markets.awayWin > markets.draw + MARGIN) {
        const bestAwayWin = sorted.find(s => {
          const [hx, ax] = s.score.split('-').map(Number);
          return hx < ax;
        });
        if (bestAwayWin) topChoice = bestAwayWin;
      }
    }

    markets.topScore = topChoice.score;
    markets.topScorePct = topChoice.prob * 100;
    markets.topScoreOdds = (1 / topChoice.prob).toFixed(2);
    
    markets.runner = sorted
      .filter(x => x.score !== topChoice.score)
      .slice(0, 2)
      .map((x) => ({
        score: x.score,
        pct: x.prob * 100,
        odds: (1 / x.prob).toFixed(2),
      }));
  }

  return markets;
}

/**
 * Convert a probability (0–1) to a decimal bookmaker odds equivalent.
 * e.g. 0.25 → 4.00
 */
export function probToOdds(prob: number): string {
  if (prob <= 0) return '—';
  return (1 / prob).toFixed(2);
}
