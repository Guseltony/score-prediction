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
export type PredictionMode = 'uniform' | 'poisson' | 'historical' | 'odds-blended';

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
  /** Actual result entered by user after the match */
  actualResult?: ScoreString;
  /** Snapshot of bookmaker odds at prediction time */
  oddsUsed?: Record<string, number>;
  /** API fixture ID for reference */
  fixtureId?: number;
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
  /** Top correct score prediction by model probability */
  topScore: string;
  topScorePct: number;
  /** Fair decimal odds for the top score (1 / probability) */
  topScoreOdds: string;
  /** 2nd and 3rd most likely correct scores */
  runner: Array<{ score: string; pct: number; odds: string }>;
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

// ─── Fixture Risk Types ──────────────────────────────────────────────────────

export type FixtureRiskLevel = 'safe' | 'moderate' | 'dangerous' | 'extreme_danger';

export interface FixtureRiskAnalysis {
  level: FixtureRiskLevel;
  score: number;
  title: string;
  badgeLabel: string;
  summary: string;
  reasons: string[];
  recommendation: 'bet_freely' | 'caution' | 'restrict_markets' | 'avoid_match';
  hasReliableMarkets: boolean;
  maxMarketProbability: number;
  entropy1X2: number;
}

// ─── Bet Builder (BB) Types ───────────────────────────────────────────────────

export type BBConfidence = 'high' | 'medium' | 'low';

export interface BBMarket {
  id: string;
  label: string;
  probability: number;
  confidence: BBConfidence;
  category: string;
  emoji: string;
  odds: number;
  tacticalNote?: string;
}

export interface BBSpinRound {
  roundNumber: number;
  topScores: ScoreString[];
  frequency: FrequencyMap;
}

export interface BBGoalRange {
  exact: number;
  min: number;
  max: number;
  homeExact: number;
  awayExact: number;
  expectedH1: number;
  expectedH2: number;
}

export interface BBResult {
  mcTop3: ScoreString[];
  spinRounds: BBSpinRound[];
  scorePool: ScoreString[];
  goalRange: BBGoalRange;
  allMarkets: BBMarket[];
  topPicks: BBMarket[];
  finalScore: ScoreString;
  riskAnalysis: FixtureRiskAnalysis;
  computedAt: Date;
}

// ─── AI Data Types ────────────────────────────────────────────────────────────

export interface RawStandingsStats {
  leagueRank: number;
  competitionRank: number;
  domesticTier: number;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  homeMatchesPlayed: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayMatchesPlayed: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
}

export interface RawMatchResult {
  date: string;
  opponent: string;
  venue: 'HOME' | 'AWAY';
  result: 'W' | 'D' | 'L';
  score: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface RawHeadToHead {
  date: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
}

export interface AiScrapedFixture {
  fixtureId: string;
  country: string;
  competition: {
    name: string;
    tier: number;
    season: string;
    isUefaCompetition: boolean;
    isCupMatch: boolean;
    homeDomesticTier: number;
    awayDomesticTier: number;
  };
  fixture: {
    homeTeam: string;
    awayTeam: string;
    date: string;
    kickoffTime: string;
    isDerby: boolean;
  };
  rawStandings: {
    home: RawStandingsStats;
    away: RawStandingsStats;
  };
  rawRecentMatches: {
    homeTeam: RawMatchResult[];
    awayTeam: RawMatchResult[];
  };
  rawHeadToHead: RawHeadToHead[];
  rawOdds: {
    bookmaker: string;
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number | null;
    under25: number | null;
    bttsYes: number | null;
    bttsNo: number | null;
    snapshotTime: string;
  };
  source: {
    fixture: string[];
    standings: string[];
    recentMatches: string[];
    odds: string[];
    scrapedAt: string;
  };
  hasIncompleteData?: boolean;
  missingDataAlerts?: string[];
}
