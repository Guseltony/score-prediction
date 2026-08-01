/**
 * generateScores – Creates every score combination from 0-0 to N-N
 * where N is maxGoals.
 */
export function generateScores(maxGoals: number): string[] {
  if (maxGoals < 1) return [];
  const scores: string[] = [];
  for (let home = 0; home <= maxGoals; home++) {
    for (let away = 0; away <= maxGoals; away++) {
      scores.push(`${home}-${away}`);
    }
  }
  return scores;
}
