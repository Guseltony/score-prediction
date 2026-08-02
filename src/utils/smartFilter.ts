import type { ScoreString, XGSettings } from '../types';

export interface SmartFilterResult {
  kept: Set<ScoreString>;
  eliminated: Set<ScoreString>;
  reasons: Record<ScoreString, string>;
}

/**
 * applySmartFilter – Automatically eliminates illogical scorelines based on xG reality.
 *
 * Rules applied (in order):
 *  1. If combined xG < 1.5 → eliminate all Over 2.5 goals results (too many goals expected)
 *  2. If combined xG > 2.5 → eliminate 0-0 (boring no-goal result when xG is high)
 *  3. If awayXG > homeXG * 1.5 → eliminate home-team-wins (home xG too weak to beat away)
 *  4. If homeXG > awayXG * 1.5 → eliminate away-team-wins (away xG too weak)
 *  5. If combined xG > 2.5 → eliminate exact scores where total < 2 (1-0, 0-1, 0-0 covered above)
 */
export function applySmartFilter(
  scores: ScoreString[],
  xg: XGSettings,
): SmartFilterResult {
  const kept = new Set<ScoreString>();
  const eliminated = new Set<ScoreString>();
  const reasons: Record<ScoreString, string> = {};

  const { homeXG, awayXG } = xg;
  const combinedXG = homeXG + awayXG;
  const xgRatio = awayXG > 0 ? homeXG / awayXG : 1;

  for (const score of scores) {
    const [h, a] = score.split('-').map(Number);
    const total = h + a;
    let reason = '';

    // Rule: Low combined xG → high scorelines are illogical
    if (combinedXG < 1.5 && total > 2) {
      reason = `Combined xG ${combinedXG.toFixed(1)} too low for ${total} goals`;
    }
    // Rule: High combined xG → 0-0 is very unlikely
    else if (combinedXG > 2.5 && h === 0 && a === 0) {
      reason = `xG ${combinedXG.toFixed(1)} makes 0-0 very unlikely`;
    }
    // Rule: High combined xG → very low total scores unlikely
    else if (combinedXG > 2.5 && total < 2) {
      reason = `xG ${combinedXG.toFixed(1)} suggests more than ${total} goal${total !== 1 ? 's' : ''}`;
    }
    // Rule: Away team dominant — home wins unlikely
    else if (awayXG > homeXG * 1.6 && h > a) {
      reason = `Away xG (${awayXG.toFixed(1)}) far exceeds Home xG (${homeXG.toFixed(1)})`;
    }
    // Rule: Home team dominant — away wins unlikely
    else if (homeXG > awayXG * 1.6 && a > h) {
      reason = `Home xG (${homeXG.toFixed(1)}) far exceeds Away xG (${awayXG.toFixed(1)})`;
    }

    if (reason) {
      eliminated.add(score);
      reasons[score] = reason;
    } else {
      kept.add(score);
    }
  }

  return { kept, eliminated, reasons };
}
