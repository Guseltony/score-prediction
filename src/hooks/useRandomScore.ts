import { useState, useCallback } from 'react';
import type { ScoreString, SpinSession, SpinResult, ProbabilityMap, PredictionMode } from '../types';
import { countFrequency, getTopScores } from '../utils/countFrequency';
import { generateId } from '../utils/formatTime';
import { weightedRandomScore } from '../utils/poisson';

/** Options controlling how a spin is performed */
export interface SpinOptions {
  mode: PredictionMode;
  /** Probability map used when mode is 'poisson' or 'historical' */
  probabilities: ProbabilityMap;
}

/**
 * Pure uniform random selection — equal probability for every score.
 */
export function randomScore(scores: ScoreString[]): ScoreString {
  return scores[Math.floor(Math.random() * scores.length)];
}

/**
 * Select one score using the given mode.
 */
function selectScore(scores: ScoreString[], options: SpinOptions): ScoreString {
  if (options.mode === 'uniform') return randomScore(scores);
  return weightedRandomScore(scores, options.probabilities);
}

interface UseRandomScoreReturn {
  isSpinning: boolean;
  singleResult: ScoreString | null;
  spinSession: SpinSession | null;
  spinOnce: (scores: ScoreString[], options: SpinOptions) => Promise<void>;
  spinN: (scores: ScoreString[], n: number, options: SpinOptions) => Promise<void>;
}

/**
 * useRandomScore – Custom hook encapsulating all spin logic.
 * Supports uniform, Poisson-weighted, and historically-weighted selection.
 */
export function useRandomScore(): UseRandomScoreReturn {
  const [isSpinning, setIsSpinning] = useState(false);
  const [singleResult, setSingleResult] = useState<ScoreString | null>(null);
  const [spinSession, setSpinSession] = useState<SpinSession | null>(null);

  const spinOnce = useCallback(async (scores: ScoreString[], options: SpinOptions) => {
    if (!scores.length) return;
    setIsSpinning(true);
    setSingleResult(null);
    setSpinSession(null);

    await new Promise((res) => setTimeout(res, 1000));

    setSingleResult(selectScore(scores, options));
    setIsSpinning(false);
  }, []);

  const spinN = useCallback(async (scores: ScoreString[], n: number, options: SpinOptions) => {
    if (!scores.length) return;
    setIsSpinning(true);
    setSpinSession(null);
    setSingleResult(null);

    // Delay scales slightly with count for UX feel, capped at 1.5s
    const delay = Math.min(800 + n * 6, 1500);
    await new Promise((res) => setTimeout(res, delay));

    const results: SpinResult[] = Array.from({ length: n }, (_, i) => ({
      spinNumber: i + 1,
      score: selectScore(scores, options),
    }));

    const frequency = countFrequency(results.map((r) => r.score));
    const suggestedScores = getTopScores(frequency);

    setSpinSession({
      id: generateId(),
      results,
      frequency,
      suggestedScores,
      timestamp: new Date(),
      spinCount: n,
    });
    setIsSpinning(false);
  }, []);

  return { isSpinning, singleResult, spinSession, spinOnce, spinN };
}
