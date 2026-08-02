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

/** Supported Monte Carlo simulation counts */
export type SimCount = 100 | 500 | 1000 | 5000;

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

// ─── V2: Advanced Modifiers ─────────────────────────────────────────────────

/** Advanced xG modifier settings for the Poisson model */
export interface AdvancedModifiers {
  homeAdvantageEnabled: boolean;
  /** 0 = equal weight all matches, 1 = heavily weight most recent matches */
  formWeightRecency: number;
}

// ─── V2: Market Probabilities ────────────────────────────────────────────────

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
}

// ─── V2: Monte Carlo ─────────────────────────────────────────────────────────

export interface MonteCarloEntry {
  score: ScoreString;
  count: number;
  pct: number;
  modelPct: number;
}

export interface MonteCarloResult {
  ranked: MonteCarloEntry[];
  frequency: FrequencyMap;
  simCount: number;
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
