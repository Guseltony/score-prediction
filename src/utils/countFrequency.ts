import type { FrequencyMap, ScoreString } from '../types';

/**
 * countFrequency – Counts occurrences of each score in a results array.
 * Returns a sorted map (highest count first).
 */
export function countFrequency(results: ScoreString[]): FrequencyMap {
  const map: FrequencyMap = {};
  for (const score of results) {
    map[score] = (map[score] ?? 0) + 1;
  }
  return map;
}

/**
 * getTopScores – Returns the score(s) with the highest frequency.
 */
export function getTopScores(frequency: FrequencyMap): ScoreString[] {
  const entries = Object.entries(frequency);
  if (entries.length === 0) return [];
  const maxCount = Math.max(...entries.map(([, c]) => c));
  return entries.filter(([, c]) => c === maxCount).map(([s]) => s);
}

/**
 * getSortedFrequency – Returns frequency entries sorted by count descending.
 */
export function getSortedFrequency(frequency: FrequencyMap): [ScoreString, number][] {
  return Object.entries(frequency).sort(([, a], [, b]) => b - a);
}
