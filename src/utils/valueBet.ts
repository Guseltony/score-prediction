/**
 * Value Bet Engine
 *
 * Compares a bookmaker's implied probability (derived from their decimal odds)
 * against our model's calculated probability.
 *
 * If model probability > bookie's implied probability → Positive Expected Value (+EV).
 * This means the bookie is offering better odds than the true probability warrants.
 */

export interface ValueBetResult {
  bookieOdds: number;
  impliedPct: number;       // bookie's implied probability as %
  modelPct: number;         // our model's probability as %
  edgePct: number;          // difference: modelPct - impliedPct
  isValue: boolean;         // true if +EV (edge > 0)
  isStrongValue: boolean;   // true if edge > 3% (strong edge)
  expectedValue: number;    // EV per unit stake: (modelProb * bookieOdds) - 1
}

/**
 * calculateValueBet – Given bookie odds and our model probability, compute EV.
 *
 * @param bookieOdds  - Decimal odds (e.g. 6.0 for a 1-3 result)
 * @param modelProb   - Our model's probability for this score (0–1)
 */
export function calculateValueBet(
  bookieOdds: number,
  modelProb: number,
): ValueBetResult | null {
  if (bookieOdds <= 1 || modelProb <= 0) return null;

  const impliedProb = 1 / bookieOdds;
  const impliedPct = impliedProb * 100;
  const modelPct = modelProb * 100;
  const edgePct = modelPct - impliedPct;
  const expectedValue = modelProb * bookieOdds - 1;
  const isValue = edgePct > 0;
  const isStrongValue = edgePct > 3;

  return {
    bookieOdds,
    impliedPct,
    modelPct,
    edgePct,
    isValue,
    isStrongValue,
    expectedValue,
  };
}

/**
 * Parse a string into a valid decimal odds number.
 * Returns null if invalid.
 */
export function parseOdds(input: string): number | null {
  const n = parseFloat(input);
  if (isNaN(n) || n <= 1) return null;
  return n;
}
