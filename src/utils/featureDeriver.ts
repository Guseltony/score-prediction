import type { AiScrapedFixture, AiScrapedRecentMatch, DerivedMatchFeatures } from '../types';

/**
 * Calculates Points Per Game (PPG) and form string from recent matches.
 */
function calculateForm(matches: AiScrapedRecentMatch[]): { ppg: number, formString: string } {
  if (!matches || matches.length === 0) {
    return { ppg: 1.0, formString: 'DDDDD' };
  }
  
  let points = 0;
  let formString = '';
  
  // Assuming matches are ordered from most recent to oldest.
  for (const m of matches) {
    if (m.result === 'W') {
      points += 3;
      formString += 'W';
    } else if (m.result === 'D') {
      points += 1;
      formString += 'D';
    } else {
      formString += 'L';
    }
  }
  
  return {
    ppg: points / matches.length,
    formString
  };
}

/**
 * Calculates attack and defense ratings out of 10 based on goals scored/conceded.
 * Base rating is 5.
 * Attack: +2 per average goal scored.
 * Defense: Neutral at 1.5 goals conceded, +2 per goal fewer than 1.5.
 */
function calculateRatings(matches: AiScrapedRecentMatch[], teamName: string): { attack: number, defense: number } {
  if (!matches || matches.length === 0) {
    return { attack: 6, defense: 6 };
  }
  
  let goalsScored = 0;
  let goalsConceded = 0;
  
  for (const m of matches) {
    if (m.venue === 'HOME') {
      goalsScored += m.homeScore;
      goalsConceded += m.awayScore;
    } else if (m.venue === 'AWAY') {
      goalsScored += m.awayScore;
      goalsConceded += m.homeScore;
    } else {
      goalsScored += 1;
      goalsConceded += 1;
    }
  }
  
  const avgScored = goalsScored / matches.length;
  const avgConceded = goalsConceded / matches.length;
  
  const attack = 5 + (avgScored * 2);
  const defense = 5 + ((1.5 - avgConceded) * 2);
  
  return {
    attack: Math.min(10, Math.max(1, Math.round(attack))),
    defense: Math.min(10, Math.max(1, Math.round(defense)))
  };
}

/**
 * Calculates percentage of matches hitting BTTS or Over 2.5.
 */
function calculateTrends(homeMatches: AiScrapedRecentMatch[], awayMatches: AiScrapedRecentMatch[]) {
  const allMatches = [...(homeMatches || []), ...(awayMatches || [])];
  if (allMatches.length === 0) {
    return { bttsPercentage: 0.5, over25Percentage: 0.5 };
  }
  
  let bttsCount = 0;
  let over25Count = 0;
  
  for (const m of allMatches) {
    if (m.homeScore > 0 && m.awayScore > 0) {
      bttsCount++;
    }
    if (m.homeScore + m.awayScore > 2.5) {
      over25Count++;
    }
  }
  
  return {
    bttsPercentage: bttsCount / allMatches.length,
    over25Percentage: over25Count / allMatches.length
  };
}

/**
 * Calculates days between a past date and the fixture date.
 */
function calculateRestDays(fixtureDateStr: string, matches: AiScrapedRecentMatch[]): number {
  if (!matches || matches.length === 0 || !fixtureDateStr) return 7; // Default 1 week
  
  // Find the most recent match
  // Matches might not be perfectly sorted, so let's find the max date
  let maxDate = new Date(0);
  for (const m of matches) {
    const d = new Date(m.date);
    if (d > maxDate) {
      maxDate = d;
    }
  }
  
  const fixtureDate = new Date(fixtureDateStr);
  const diffTime = fixtureDate.getTime() - maxDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays); // Minimum 1 day of rest
}

/**
 * Converts standard bookmaker decimal odds into true implied probabilities 
 * by removing the bookmaker margin (vig).
 * Safe fallback: returns 1/3 each for 1X2 and 0.5 for binary markets if odds are missing.
 */
function calculateTrueProbabilities(odds: AiScrapedFixture['rawOdds']) {
  // Guard: if entire odds block is missing, return neutral probs
  if (!odds) {
    return { homeWin: 1/3, draw: 1/3, awayWin: 1/3, over25: 0.5, under25: 0.5, bttsYes: 0.5, bttsNo: 0.5 };
  }

  // 1X2 Margin
  const impliedHome = 1 / (odds.homeWin || 3);
  const impliedDraw = 1 / (odds.draw || 3);
  const impliedAway = 1 / (odds.awayWin || 3);
  const totalImplied1X2 = impliedHome + impliedDraw + impliedAway;
  
  // Over/Under Margin
  const impliedO25 = 1 / (odds.over25 || 2);
  const impliedU25 = 1 / (odds.under25 || 2);
  const totalImpliedOU = impliedO25 + impliedU25;
  
  // BTTS Margin
  const impliedBttsYes = 1 / (odds.bttsYes || 2);
  const impliedBttsNo = 1 / (odds.bttsNo || 2);
  const totalImpliedBtts = impliedBttsYes + impliedBttsNo;
  
  return {
    homeWin: impliedHome / totalImplied1X2,
    draw: impliedDraw / totalImplied1X2,
    awayWin: impliedAway / totalImplied1X2,
    over25: impliedO25 / totalImpliedOU,
    under25: impliedU25 / totalImpliedOU,
    bttsYes: impliedBttsYes / totalImpliedBtts,
    bttsNo: impliedBttsNo / totalImpliedBtts,
  };
}

/**
 * Calculates a bias modifier based on recent H2H results.
 * Positive = home dominance, Negative = away dominance
 */
function calculateH2HBias(h2h: AiScrapedFixture['rawHeadToHead'], homeTeam: string): number {
  if (!h2h || h2h.length === 0) return 0;
  
  let bias = 0;
  for (const m of h2h) {
    const isHomeContext = m.homeTeam.trim().toLowerCase() === homeTeam.trim().toLowerCase();
    const isAwayContext = m.awayTeam.trim().toLowerCase() === homeTeam.trim().toLowerCase();
    
    const scoreStr = m.score || '';
    const [hGoals, aGoals] = scoreStr.split('-').map(Number);
    if (isNaN(hGoals) || isNaN(aGoals)) continue;
    
    // Evaluate from the perspective of the current homeTeam
    let contextGoalsFor = 0;
    let contextGoalsAgainst = 0;
    
    if (isHomeContext) {
      contextGoalsFor = hGoals;
      contextGoalsAgainst = aGoals;
    } else if (isAwayContext) {
      contextGoalsFor = aGoals;
      contextGoalsAgainst = hGoals;
    } else {
      continue;
    }
    
    if (contextGoalsFor > contextGoalsAgainst) {
      bias += 0.2; // Win
    } else if (contextGoalsFor < contextGoalsAgainst) {
      bias -= 0.2; // Loss
    }
    // Draw does nothing to bias
  }
  
  // Average the bias over the matches (max impact per match is +/- 0.2)
  return bias / h2h.length;
}

/**
 * Calculates Poisson strengths for attack and defense relative to league averages.
 * Uses home/away splits if available, otherwise falls back to overall stats.
 */
function calculatePoissonStrengths(standings: AiScrapedFixture['rawStandings']): {
  homeAttackStrength: number;
  homeDefenseStrength: number;
  awayAttackStrength: number;
  awayDefenseStrength: number;
} {
  // Standard league averages (can be dynamic later)
  const LEAGUE_AVG_HOME_GF = 1.45;
  const LEAGUE_AVG_HOME_GA = 1.15; // Same as Away GF
  const LEAGUE_AVG_AWAY_GF = 1.15;
  const LEAGUE_AVG_AWAY_GA = 1.45; // Same as Home GF

  const home = standings.home;
  const away = standings.away;

  // Calculate Home Team Averages (at Home)
  let homeTeamAvgGfAtHome = 1.45;
  let homeTeamAvgGaAtHome = 1.15;
  
  if (home.homeMatchesPlayed && home.homeMatchesPlayed > 0) {
    homeTeamAvgGfAtHome = (home.homeGoalsFor || 0) / home.homeMatchesPlayed;
    homeTeamAvgGaAtHome = (home.homeGoalsAgainst || 0) / home.homeMatchesPlayed;
  } else if (home.matchesPlayed && home.matchesPlayed > 0) {
    // Fallback to overall stats, slightly boosted for home advantage
    homeTeamAvgGfAtHome = (home.goalsFor / home.matchesPlayed) * 1.1;
    homeTeamAvgGaAtHome = (home.goalsAgainst / home.matchesPlayed) * 0.9;
  }

  // Calculate Away Team Averages (Away)
  let awayTeamAvgGfAway = 1.15;
  let awayTeamAvgGaAway = 1.45;

  if (away.awayMatchesPlayed && away.awayMatchesPlayed > 0) {
    awayTeamAvgGfAway = (away.awayGoalsFor || 0) / away.awayMatchesPlayed;
    awayTeamAvgGaAway = (away.awayGoalsAgainst || 0) / away.awayMatchesPlayed;
  } else if (away.matchesPlayed && away.matchesPlayed > 0) {
    // Fallback to overall stats, slightly reduced for away disadvantage
    awayTeamAvgGfAway = (away.goalsFor / away.matchesPlayed) * 0.9;
    awayTeamAvgGaAway = (away.goalsAgainst / away.matchesPlayed) * 1.1;
  }

  return {
    homeAttackStrength: homeTeamAvgGfAtHome / LEAGUE_AVG_HOME_GF,
    homeDefenseStrength: homeTeamAvgGaAtHome / LEAGUE_AVG_HOME_GA,
    awayAttackStrength: awayTeamAvgGfAway / LEAGUE_AVG_AWAY_GF,
    awayDefenseStrength: awayTeamAvgGaAway / LEAGUE_AVG_AWAY_GA
  };
}

/**
 * Main feature extraction engine.
 */
export function deriveFeatures(fixture: AiScrapedFixture): DerivedMatchFeatures {
  const homeForm = calculateForm(fixture.rawRecentMatches.homeTeam);
  const awayForm = calculateForm(fixture.rawRecentMatches.awayTeam);
  
  const homeRatings = calculateRatings(fixture.rawRecentMatches.homeTeam, fixture.fixture.homeTeam);
  const awayRatings = calculateRatings(fixture.rawRecentMatches.awayTeam, fixture.fixture.awayTeam);
  
  const trends = calculateTrends(fixture.rawRecentMatches.homeTeam, fixture.rawRecentMatches.awayTeam);
  
  const homeRestDays = calculateRestDays(fixture.fixture.date, fixture.rawRecentMatches.homeTeam);
  const awayRestDays = calculateRestDays(fixture.fixture.date, fixture.rawRecentMatches.awayTeam);
  
  const trueImpliedProbabilities = calculateTrueProbabilities(fixture.rawOdds);
  
  const h2hHomeBias = calculateH2HBias(fixture.rawHeadToHead, fixture.fixture.homeTeam);
  
  const poissonStrengths = calculatePoissonStrengths(fixture.rawStandings);
  
  return {
    homeFormPPG: homeForm.ppg,
    awayFormPPG: awayForm.ppg,
    homeFormString: homeForm.formString,
    awayFormString: awayForm.formString,
    homeAttackRating: homeRatings.attack,
    homeDefenseRating: homeRatings.defense,
    awayAttackRating: awayRatings.attack,
    awayDefenseRating: awayRatings.defense,
    homeAttackStrength: poissonStrengths.homeAttackStrength,
    homeDefenseStrength: poissonStrengths.homeDefenseStrength,
    awayAttackStrength: poissonStrengths.awayAttackStrength,
    awayDefenseStrength: poissonStrengths.awayDefenseStrength,
    bttsPercentage: trends.bttsPercentage,
    over25Percentage: trends.over25Percentage,
    homeRestDays,
    awayRestDays,
    trueImpliedProbabilities,
    h2hHomeBias
  };
}
