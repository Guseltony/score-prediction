/**
 * Calculates Expected Value (EV).
 * EV = (True Probability * Decimal Odds) - 1
 * An EV > 0 means the bet is mathematically profitable long term.
 * @param modelProbability Our model's calculated true probability (0 to 1)
 * @param decimalOdds The bookmaker's decimal odds (e.g., 2.50)
 */
export function calculateExpectedValue(modelProbability: number, decimalOdds: number): number {
  if (!modelProbability || !decimalOdds || decimalOdds <= 0) return 0;
  return (modelProbability * decimalOdds) - 1;
}

/**
 * Calculates Edge.
 * Edge = Model Probability - Market Implied Probability
 * An Edge > 0 means we think the event is more likely to happen than the bookmaker does.
 * @param modelProbability Our model's calculated true probability (0 to 1)
 * @param marketImpliedProbability The bookmaker's implied probability (0 to 1), typically with vig removed
 */
export function calculateEdge(modelProbability: number, marketImpliedProbability: number): number {
  if (!modelProbability || !marketImpliedProbability) return 0;
  return modelProbability - marketImpliedProbability;
}

/**
 * Helper to match a BBMarket ID to the corresponding raw bookmaker odds.
 */
export function getBookmakerOddsForMarket(marketId: string, rawOdds: any): number {
  if (!rawOdds) return 0;
  
  switch (marketId) {
    case 'home_win': return rawOdds.homeWin || 0;
    case 'draw': return rawOdds.draw || 0;
    case 'away_win': return rawOdds.awayWin || 0;
    case 'over25': return rawOdds.over25 || 0;
    case 'under25': return rawOdds.under25 || 0;
    case 'btts_yes': return rawOdds.bttsYes || 0;
    case 'btts_no': return rawOdds.bttsNo || 0;
    default: return 0;
  }
}

/**
 * Helper to match a BBMarket ID to the corresponding true implied probability (vig-free)
 */
export function getTrueImpliedProbabilityForMarket(marketId: string, trueImplied: any): number {
  if (!trueImplied) return 0;
  
  switch (marketId) {
    case 'home_win': return trueImplied.homeWin || 0;
    case 'draw': return trueImplied.draw || 0;
    case 'away_win': return trueImplied.awayWin || 0;
    case 'over25': return trueImplied.over25 || 0;
    case 'under25': return trueImplied.under25 || 0;
    case 'btts_yes': return trueImplied.bttsYes || 0;
    case 'btts_no': return trueImplied.bttsNo || 0;
    default: return 0;
  }
}
