/**
 * Core TypeScript types for the Correct Score Predictor application.
 * Designed for future extensibility with AI, API, and statistics features.
 */

// ─── Score Types ─────────────────────────────────────────────────────────────

/** A score string in "home-away" format, e.g. "2-1" */
export type ScoreString = string;

/** Frequency map: score → count */
export type FrequencyMap = Record<ScoreString, number>;

/** Probability map: score → 0–1 value */
export type ProbabilityMap = Record<ScoreString, number>;

// ─── Prediction Modes ─────────────────────────────────────────────────────────

/** How scores are selected during a spin */
export type PredictionMode = 'uniform' | 'poisson' | 'historical';

/** Expected goals settings for the Poisson model */
export interface XGSettings {
  homeXG: number; // Expected goals for home team (e.g. 1.5)
  awayXG: number; // Expected goals for away team (e.g. 1.2)
}

/** Supported multi-spin counts */
export type SpinCount = 5 | 10 | 20 | 50 | 100;

// ─── Spin Results ─────────────────────────────────────────────────────────────

export interface SpinResult {
  spinNumber: number;
  score: ScoreString;
}

export interface SpinSession {
  id: string;
  results: SpinResult[];
  frequency: FrequencyMap;
  suggestedScores: ScoreString[];
  timestamp: Date;
  spinCount: number;
}

// ─── Match Info ───────────────────────────────────────────────────────────────

export interface MatchInfo {
  homeTeam: string;
  awayTeam: string;
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  matchInfo: MatchInfo;
  prediction: ScoreString;
  timestamp: Date;
  spinCount: number;
  selectedScoresCount: number;
  suggestedScores: ScoreString[];
  predictionMode: PredictionMode;
}

// ─── Future Extensibility Stubs ───────────────────────────────────────────────

/** Placeholder for future team statistics */
export interface TeamStats {
  teamId: string;
  teamName: string;
  goalsScored?: number;
  goalsConceded?: number;
  xG?: number;
  formString?: string; // e.g. "WWDLL"
}

/** Placeholder for future head-to-head data */
export interface HeadToHead {
  homeTeam: TeamStats;
  awayTeam: TeamStats;
  recentResults?: ScoreString[];
}

/** Score probability with metadata */
export interface ScoreProbability {
  score: ScoreString;
  probability: number; // 0–1
  source: PredictionMode | 'ai' | 'ml';
}

/** Placeholder for future user accounts */
export interface UserProfile {
  userId: string;
  displayName: string;
  savedPredictions?: HistoryEntry[];
}
