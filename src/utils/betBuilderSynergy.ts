/**
 * betBuilderSynergy.ts
 *
 * Same-Game Correlation & Synergy Analysis Engine for Bet Builder selections.
 * Identifies reinforcing statistical synergies, redundant coverage, and mathematical conflicts.
 */

import type { BBMarket, ProbabilityMap } from '../types';

export type SynergyStatus = 'optimal_synergy' | 'balanced' | 'redundant' | 'conflict';

export interface SynergyAlert {
  type: 'synergy' | 'conflict' | 'redundancy';
  marketIds: string[];
  marketLabels: string[];
  message: string;
  adjustmentFactor: number; // multiplier to naive joint probability (e.g. 1.25 for positive correlation, 0 for collision)
}

export interface SynergyAnalysis {
  synergyScore: number; // 0 to 100
  status: SynergyStatus;
  statusLabel: string;
  badgeColor: string;
  alerts: SynergyAlert[];
  naiveJointProb: number;
  correlatedJointProb: number;
  correlationMultiplier: number;
  recommendations: string[];
}

/**
 * Evaluates same-game correlation between 2 or more Bet Builder markets.
 */
export function calculateBetBuilderSynergy(
  markets: BBMarket[],
  probabilities?: ProbabilityMap
): SynergyAnalysis {
  if (markets.length <= 1) {
    const p = markets[0]?.probability ?? 1;
    return {
      synergyScore: 85,
      status: 'balanced',
      statusLabel: 'Single Market (No Correlation Risk)',
      badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
      alerts: [],
      naiveJointProb: p,
      correlatedJointProb: p,
      correlationMultiplier: 1.0,
      recommendations: ['Add another correlated market to boost combined value without adding disproportionate risk.'],
    };
  }

  const ids = new Set(markets.map(m => m.id));
  const alerts: SynergyAlert[] = [];
  let jointMultiplier = 1.0;
  let penaltyPoints = 0;
  let bonusPoints = 0;

  // Helper to check if market has id
  const has = (id: string) => ids.has(id);
  const getMarket = (id: string) => markets.find(m => m.id === id);

  // ── 1. HARD MATHEMATICAL CONFLICTS (Fatal Collisions) ──────────────────────
  if (has('total_under_1_5') && has('btts_yes')) {
    alerts.push({
      type: 'conflict',
      marketIds: ['total_under_1_5', 'btts_yes'],
      marketLabels: ['Under 1.5 Goals', 'Both Teams to Score - Yes'],
      message: 'Fatal Collision: Both Teams to Score requires at least 2 goals (1-1 min), which makes Under 1.5 impossible.',
      adjustmentFactor: 0.0,
    });
    jointMultiplier *= 0.0;
    penaltyPoints += 100;
  }

  if (has('home_win') && (has('double_chance_x2') || has('away_win'))) {
    alerts.push({
      type: 'conflict',
      marketIds: ['home_win', has('double_chance_x2') ? 'double_chance_x2' : 'away_win'],
      marketLabels: ['Home Win', has('double_chance_x2') ? 'Draw or Away (X2)' : 'Away Win'],
      message: 'Mutual Exclusion: Home Win directly contradicts Draw / Away selection.',
      adjustmentFactor: 0.0,
    });
    jointMultiplier *= 0.0;
    penaltyPoints += 100;
  }

  if (has('clean_sheet_home') && has('btts_yes')) {
    alerts.push({
      type: 'conflict',
      marketIds: ['clean_sheet_home', 'btts_yes'],
      marketLabels: ['Home Clean Sheet', 'BTTS Yes'],
      message: 'Fatal Collision: Home Clean Sheet means Away scores 0, which makes BTTS Yes impossible.',
      adjustmentFactor: 0.0,
    });
    jointMultiplier *= 0.0;
    penaltyPoints += 100;
  }

  // ── 2. HIGH RISK / HEAVY FRICTION CONFLICTS ────────────────────────────────
  if (has('total_under_2_5') && has('total_over_1_5')) {
    // Exact 2 goals required
    alerts.push({
      type: 'redundancy',
      marketIds: ['total_under_2_5', 'total_over_1_5'],
      marketLabels: ['Under 2.5', 'Over 1.5'],
      message: 'Narrow Window: Combination requires exactly 2 total goals (e.g. 2-0, 1-1, 0-2).',
      adjustmentFactor: 0.65,
    });
    jointMultiplier *= 0.65;
    penaltyPoints += 25;
  }

  if (has('total_over_3_5') && (has('clean_sheet_home') || has('clean_sheet_away'))) {
    alerts.push({
      type: 'conflict',
      marketIds: ['total_over_3_5', has('clean_sheet_home') ? 'clean_sheet_home' : 'clean_sheet_away'],
      marketLabels: ['Over 3.5 Goals', 'Clean Sheet'],
      message: 'High Friction: Over 3.5 with a Clean Sheet requires a heavy blowout (4-0, 5-0+).',
      adjustmentFactor: 0.55,
    });
    jointMultiplier *= 0.55;
    penaltyPoints += 30;
  }

  // ── 3. REDUNDANT COMBINATIONS ──────────────────────────────────────────────
  if (has('home_win') && has('double_chance_1x')) {
    alerts.push({
      type: 'redundancy',
      marketIds: ['home_win', 'double_chance_1x'],
      marketLabels: ['Home Win', 'Double Chance 1X'],
      message: 'Redundant Selection: Double Chance 1X is already satisfied by Home Win.',
      adjustmentFactor: 0.95,
    });
    penaltyPoints += 15;
  }

  // ── 4. REINFORCING POSITIVE SYNERGIES ──────────────────────────────────────
  if (has('home_win') && has('total_over_1_5')) {
    alerts.push({
      type: 'synergy',
      marketIds: ['home_win', 'total_over_1_5'],
      marketLabels: ['Home Win', 'Over 1.5 Goals'],
      message: 'Positive Synergy: Most home victories (2-0, 2-1, 3-0, 3-1) naturally hit Over 1.5.',
      adjustmentFactor: 1.18,
    });
    jointMultiplier *= 1.18;
    bonusPoints += 20;
  }

  if (has('btts_yes') && has('total_over_2_5')) {
    alerts.push({
      type: 'synergy',
      marketIds: ['btts_yes', 'total_over_2_5'],
      marketLabels: ['Both Teams to Score', 'Over 2.5 Goals'],
      message: 'Strong Reinforcement: When both teams score, 1 additional goal clinches Over 2.5 (82% co-occurrence).',
      adjustmentFactor: 1.25,
    });
    jointMultiplier *= 1.25;
    bonusPoints += 25;
  }

  if (has('double_chance_1x') && has('total_under_3_5')) {
    alerts.push({
      type: 'synergy',
      marketIds: ['double_chance_1x', 'total_under_3_5'],
      marketLabels: ['1X Double Chance', 'Under 3.5 Goals'],
      message: 'Defensive Anchor: Low-scoring home fixtures heavily protect the 1X result.',
      adjustmentFactor: 1.15,
    });
    jointMultiplier *= 1.15;
    bonusPoints += 18;
  }

  // Calculate naive joint probability (assuming independent)
  const naiveJointProb = markets.reduce((acc, m) => acc * m.probability, 1);
  const correlatedJointProb = Math.min(0.98, Math.max(0, naiveJointProb * jointMultiplier));

  // Compute final synergy score
  let baseScore = 70 + bonusPoints - penaltyPoints;
  const synergyScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Determine status classification
  let status: SynergyStatus = 'balanced';
  let statusLabel = 'Balanced Combination';
  let badgeColor = 'text-blue-300 bg-blue-500/20 border-blue-500/40';

  if (penaltyPoints >= 80) {
    status = 'conflict';
    statusLabel = 'FATAL COMBINATION CONFLICT';
    badgeColor = 'text-rose-300 bg-rose-500/20 border-rose-500/40';
  } else if (penaltyPoints >= 25) {
    status = 'redundant';
    statusLabel = 'High Friction / Redundancy Detected';
    badgeColor = 'text-amber-300 bg-amber-500/20 border-amber-500/40';
  } else if (bonusPoints >= 15) {
    status = 'optimal_synergy';
    statusLabel = 'REINFORCING STATISTICAL SYNERGY';
    badgeColor = 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
  }

  // Build strategic recommendations
  const recommendations: string[] = [];
  if (status === 'conflict') {
    recommendations.push('Remove the conflicting leg immediately to prevent an un-winnable ticket.');
  } else if (status === 'optimal_synergy') {
    recommendations.push('This selection pair has high co-occurrence probability, giving you greater resilience than raw multiplied odds.');
  } else if (status === 'redundant') {
    recommendations.push('Consider upgrading one leg to a higher-value market or dropping the overlapping condition.');
  } else {
    recommendations.push('Clean independent combination with stable market distribution.');
  }

  return {
    synergyScore,
    status,
    statusLabel,
    badgeColor,
    alerts,
    naiveJointProb,
    correlatedJointProb,
    correlationMultiplier: +jointMultiplier.toFixed(2),
    recommendations,
  };
}
