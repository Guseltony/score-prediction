/**
 * api/types.ts — TypeScript interfaces for API-Football (v3) response shapes.
 *
 * Only the fields we actually consume are typed here. The API returns many more
 * fields which are safely ignored.
 */

// ─── Shared wrapper ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  response: T[];
  results: number;
  errors: Record<string, string>;
  paging: { current: number; total: number };
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export interface ApiTeamInfo {
  id: number;
  name: string;
  code: string | null;
  country: string;
  logo: string;       // URL to team crest
}

export interface ApiVenue {
  id: number | null;
  name: string | null;
  city: string | null;
}

export interface ApiTeamResult {
  team: ApiTeamInfo;
  venue: ApiVenue;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export interface ApiFixtureInfo {
  id: number;
  date: string;       // ISO 8601
  status: {
    short: string;    // 'FT' | 'NS' | 'LIVE' | etc.
    long: string;
  };
  venue: {
    name: string | null;
    city: string | null;
  };
}

export interface ApiGoals {
  home: number | null;
  away: number | null;
}

export interface ApiFixtureTeams {
  home: ApiTeamInfo;
  away: ApiTeamInfo;
}

export interface ApiFixtureResult {
  fixture: ApiFixtureInfo;
  teams: ApiFixtureTeams;
  goals: ApiGoals;
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface ApiStatValue {
  type: string;
  value: string | number | null;
}

export interface ApiTeamStatistics {
  team: ApiTeamInfo;
  statistics: ApiStatValue[];
}

// ─── Odds ─────────────────────────────────────────────────────────────────────

export interface ApiOddValue {
  value: string;      // e.g. "Home", "Draw", "Away" or a score "1:0"
  odd: string;        // decimal odds as string, e.g. "1.45"
}

export interface ApiOddBet {
  id: number;
  name: string;       // e.g. "Match Winner", "Correct Score"
  values: ApiOddValue[];
}

export interface ApiBookmaker {
  id: number;
  name: string;
  bets: ApiOddBet[];
}

export interface ApiOddsResult {
  fixture: { id: number; date: string };
  bookmakers: ApiBookmaker[];
}

// ─── Derived types used internally ───────────────────────────────────────────

/** Simplified fixture used in form/H2H display */
export interface RecentFixture {
  fixtureId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: 'W' | 'D' | 'L';   // from the perspective of the queried team
}

/** Parsed 1X2 odds for one bookmaker */
export interface ParsedMatchOdds {
  homeWin: number;
  draw: number;
  awayWin: number;
}

/** Parsed correct score odds: score → decimal odds */
export type ParsedCorrectScoreOdds = Record<string, number>;
