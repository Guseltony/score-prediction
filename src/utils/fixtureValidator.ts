import type { AiScrapedFixture } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'critical' | 'warning' | 'info';

export interface FieldAlert {
  field: string;
  message: string;
  severity: ValidationSeverity;
}

export interface FixtureValidationResult {
  fixtureLabel: string;
  isValid: boolean;          // false = at least one critical alert
  hasWarnings: boolean;      // true = at least one warning/info alert
  alerts: FieldAlert[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function missing(val: unknown): boolean {
  return val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val));
}

function isBlankArray(val: unknown): boolean {
  return !Array.isArray(val) || val.length === 0;
}

function isValidScore(score: string): boolean {
  return /^\d+-\d+$/.test(score);
}

function isValidResult(r: string): boolean {
  return r === 'W' || r === 'D' || r === 'L';
}

// ─── Main Validator ───────────────────────────────────────────────────────────

export function validateFixture(fix: AiScrapedFixture): FixtureValidationResult {
  const alerts: FieldAlert[] = [];
  const label = `${fix?.fixture?.homeTeam ?? '?'} vs ${fix?.fixture?.awayTeam ?? '?'}`;

  // ── 1. Top-level identity ───────────────────────────────────────────────────
  if (missing(fix.fixtureId))
    alerts.push({ field: 'fixtureId', message: 'Missing fixture ID', severity: 'info' });

  if (missing(fix.country))
    alerts.push({ field: 'country', message: 'Missing country', severity: 'warning' });

  // ── 2. Competition ──────────────────────────────────────────────────────────
  if (missing(fix.competition?.name))
    alerts.push({ field: 'competition.name', message: 'Missing competition name', severity: 'warning' });

  if (missing(fix.competition?.tier))
    alerts.push({ field: 'competition.tier', message: 'Missing competition tier', severity: 'info' });

  if (missing(fix.competition?.season))
    alerts.push({ field: 'competition.season', message: 'Missing season', severity: 'info' });

  // ── 3. Fixture details ──────────────────────────────────────────────────────
  if (missing(fix.fixture?.homeTeam))
    alerts.push({ field: 'fixture.homeTeam', message: 'Missing home team name', severity: 'critical' });

  if (missing(fix.fixture?.awayTeam))
    alerts.push({ field: 'fixture.awayTeam', message: 'Missing away team name', severity: 'critical' });

  if (missing(fix.fixture?.date))
    alerts.push({ field: 'fixture.date', message: 'Missing fixture date', severity: 'critical' });

  if (missing(fix.fixture?.kickoffTime))
    alerts.push({ field: 'fixture.kickoffTime', message: 'Missing kickoff time', severity: 'warning' });

  // ── 4. Standings ────────────────────────────────────────────────────────────
  const homeStandings = fix.rawStandings?.home;
  const awayStandings = fix.rawStandings?.away;

  if (!homeStandings)
    alerts.push({ field: 'rawStandings.home', message: 'Home team standings data is missing entirely', severity: 'critical' });
  else {
    if (missing(homeStandings.leagueRank) || homeStandings.leagueRank === 0)
      alerts.push({ field: 'rawStandings.home.leagueRank', message: 'Home team league rank is missing or zero', severity: 'critical' });
    if (missing(homeStandings.matchesPlayed))
      alerts.push({ field: 'rawStandings.home.matchesPlayed', message: 'Home team matches played count missing', severity: 'warning' });
    if (missing(homeStandings.points))
      alerts.push({ field: 'rawStandings.home.points', message: 'Home team points missing', severity: 'warning' });
  }

  if (!awayStandings)
    alerts.push({ field: 'rawStandings.away', message: 'Away team standings data is missing entirely', severity: 'critical' });
  else {
    if (missing(awayStandings.leagueRank) || awayStandings.leagueRank === 0)
      alerts.push({ field: 'rawStandings.away.leagueRank', message: 'Away team league rank is missing or zero', severity: 'critical' });
    if (missing(awayStandings.matchesPlayed))
      alerts.push({ field: 'rawStandings.away.matchesPlayed', message: 'Away team matches played count missing', severity: 'warning' });
    if (missing(awayStandings.points))
      alerts.push({ field: 'rawStandings.away.points', message: 'Away team points missing', severity: 'warning' });
  }

  // ── 5. Recent Matches — Home team ───────────────────────────────────────────
  const homeMatches = fix.rawRecentMatches?.homeTeam;
  if (isBlankArray(homeMatches)) {
    alerts.push({ field: 'rawRecentMatches.homeTeam', message: 'Home team recent matches are missing entirely', severity: 'critical' });
  } else {
    if (homeMatches.length < 5)
      alerts.push({ field: 'rawRecentMatches.homeTeam', message: `Only ${homeMatches.length}/5 recent home matches provided`, severity: 'warning' });

    homeMatches.forEach((m, idx) => {
      const prefix = `rawRecentMatches.homeTeam[${idx}]`;
      if (missing(m.date))
        alerts.push({ field: `${prefix}.date`, message: `Home match #${idx + 1} is missing its date`, severity: 'warning' });
      if (!isValidScore(m.score))
        alerts.push({ field: `${prefix}.score`, message: `Home match #${idx + 1} has an invalid score: "${m.score}"`, severity: 'critical' });
      if (!isValidResult(m.result))
        alerts.push({ field: `${prefix}.result`, message: `Home match #${idx + 1} has an invalid result: "${m.result}"`, severity: 'critical' });
      if (missing(m.competition))
        alerts.push({ field: `${prefix}.competition`, message: `Home match #${idx + 1} is missing competition name`, severity: 'info' });
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number')
        alerts.push({ field: `${prefix}.homeScore/awayScore`, message: `Home match #${idx + 1} is missing numeric goal values`, severity: 'warning' });
    });
  }

  // ── 6. Recent Matches — Away team ───────────────────────────────────────────
  const awayMatches = fix.rawRecentMatches?.awayTeam;
  if (isBlankArray(awayMatches)) {
    alerts.push({ field: 'rawRecentMatches.awayTeam', message: 'Away team recent matches are missing entirely', severity: 'critical' });
  } else {
    if (awayMatches.length < 5)
      alerts.push({ field: 'rawRecentMatches.awayTeam', message: `Only ${awayMatches.length}/5 recent away matches provided`, severity: 'warning' });

    awayMatches.forEach((m, idx) => {
      const prefix = `rawRecentMatches.awayTeam[${idx}]`;
      if (missing(m.date))
        alerts.push({ field: `${prefix}.date`, message: `Away match #${idx + 1} is missing its date`, severity: 'warning' });
      if (!isValidScore(m.score))
        alerts.push({ field: `${prefix}.score`, message: `Away match #${idx + 1} has an invalid score: "${m.score}"`, severity: 'critical' });
      if (!isValidResult(m.result))
        alerts.push({ field: `${prefix}.result`, message: `Away match #${idx + 1} has an invalid result: "${m.result}"`, severity: 'critical' });
      if (missing(m.competition))
        alerts.push({ field: `${prefix}.competition`, message: `Away match #${idx + 1} is missing competition name`, severity: 'info' });
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number')
        alerts.push({ field: `${prefix}.homeScore/awayScore`, message: `Away match #${idx + 1} is missing numeric goal values`, severity: 'warning' });
    });
  }

  // ── 7. Odds ─────────────────────────────────────────────────────────────────
  const odds = fix.rawOdds;
  if (!odds) {
    alerts.push({ field: 'rawOdds', message: 'Odds block is missing entirely — model will use neutral estimates', severity: 'critical' });
  } else {
    if (!odds.homeWin || odds.homeWin <= 0)
      alerts.push({ field: 'rawOdds.homeWin', message: 'Home Win odds missing or zero', severity: 'critical' });
    if (!odds.draw || odds.draw <= 0)
      alerts.push({ field: 'rawOdds.draw', message: 'Draw odds missing or zero', severity: 'critical' });
    if (!odds.awayWin || odds.awayWin <= 0)
      alerts.push({ field: 'rawOdds.awayWin', message: 'Away Win odds missing or zero', severity: 'critical' });
    if (!odds.over25 || odds.over25 <= 0)
      alerts.push({ field: 'rawOdds.over25', message: 'Over 2.5 odds missing or zero — O/U market accuracy reduced', severity: 'warning' });
    if (!odds.under25 || odds.under25 <= 0)
      alerts.push({ field: 'rawOdds.under25', message: 'Under 2.5 odds missing or zero — O/U market accuracy reduced', severity: 'warning' });
    if (!odds.bttsYes || odds.bttsYes <= 0)
      alerts.push({ field: 'rawOdds.bttsYes', message: 'BTTS Yes odds missing or zero', severity: 'warning' });
    if (!odds.bttsNo || odds.bttsNo <= 0)
      alerts.push({ field: 'rawOdds.bttsNo', message: 'BTTS No odds missing or zero', severity: 'warning' });
    if (missing(odds.snapshotTime))
      alerts.push({ field: 'rawOdds.snapshotTime', message: 'Odds snapshot timestamp missing — cannot confirm odds are current', severity: 'info' });
  }

  // ── 8. Head-to-Head ─────────────────────────────────────────────────────────
  if (isBlankArray(fix.rawHeadToHead))
    alerts.push({ field: 'rawHeadToHead', message: 'Head-to-head history is empty', severity: 'info' });

  // ── 9. Source ────────────────────────────────────────────────────────────────
  if (!fix.source || isBlankArray(fix.source.fixture))
    alerts.push({ field: 'source.fixture', message: 'No fixture source URLs provided — data cannot be cross-verified', severity: 'warning' });
  if (!fix.source || isBlankArray(fix.source.odds))
    alerts.push({ field: 'source.odds', message: 'No odds source URLs provided', severity: 'info' });

  const hasCritical = alerts.some(a => a.severity === 'critical');
  const hasWarnings = alerts.some(a => a.severity === 'warning' || a.severity === 'info');

  return {
    fixtureLabel: label,
    isValid: !hasCritical,
    hasWarnings,
    alerts,
  };
}

/**
 * Validates a batch of fixtures and logs a summary.
 * Returns each fixture paired with its validation result.
 */
export function validateFixtures(
  fixtures: AiScrapedFixture[]
): Array<{ fixture: AiScrapedFixture; validation: FixtureValidationResult }> {
  return fixtures.map(fix => ({
    fixture: fix,
    validation: validateFixture(fix),
  }));
}
