/**
 * rolloverCampaigns.ts
 *
 * Multi-Bucket Rollover Engine with:
 *   - Target Tolerance Evaluation (Building / Optimal / Caution / Greed)
 *   - Milestone Profit Banking & Safe Bankroll Allocation
 *   - Stage Progression & Completed Campaign History
 */

import type { RolloverBucket, RolloverPick, RolloverStageHistory } from '../types';
import { generateId } from './formatTime';

// ─── 🛡️ Daily Cap Types ───────────────────────────────────────────────────────────────────────

export type DailyCapZone = 'safe' | 'warning' | 'locked';

export interface DailyCapStatus {
  winsToday: number;    // how many stages have been won today
  cap: number;          // the applicable cap for today (weekday or weekend)
  isWeekend: boolean;   // whether today is Saturday or Sunday
  zone: DailyCapZone;   // safe | warning | locked
  title: string;
  message: string;
  overrideActive: boolean; // true if user bypassed the cap today
}


export const DEFAULT_BUCKETS: RolloverBucket[] = [
  {
    id: 'bucket_20_day',
    name: '🏆 20-Day Compound Challenge',
    category: '20_day',
    targetOdds: 2.0,
    maxDays: 20,
    currentStage: 1,
    initialStake: 2000,
    currentStake: 2000,
    bankedProfit: 0,
    currencySymbol: '₦',
    status: 'drafting',
    picks: [],
    history: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'bucket_top_leagues',
    name: '🌟 Top 5 Leagues Main Ticket',
    category: 'top_leagues',
    targetOdds: 1.85,
    maxDays: 1,
    currentStage: 1,
    initialStake: 5000,
    currentStake: 5000,
    bankedProfit: 0,
    currencySymbol: '₦',
    status: 'drafting',
    picks: [],
    history: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'bucket_weekend',
    name: '📅 Weekend Value Accumulator',
    category: 'weekend',
    targetOdds: 3.0,
    maxDays: 1,
    currentStage: 1,
    initialStake: 1000,
    currentStake: 1000,
    bankedProfit: 0,
    currencySymbol: '₦',
    status: 'drafting',
    picks: [],
    history: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export type TargetZone = 'building' | 'optimal' | 'caution' | 'greed';

export interface TargetEvaluation {
  zone: TargetZone;
  ratio: number;
  progressPct: number;
  badgeLabel: string;
  badgeClass: string;
  cardClass: string;
  title: string;
  message: string;
  isTargetAchieved: boolean;
}

/**
 * Progressive Target & Greed Evaluation
 *
 * Rules:
 *   - ratio < 1.00: Building (e.g. 1.50x on a 2.00x target)
 *   - 1.00 <= ratio <= 1.15: Optimal Green Zone (e.g. 2.00x - 2.30x on 2.00x)
 *   - 1.15 < ratio <= 1.25: Caution Yellow (e.g. 2.31x - 2.50x on 2.00x) -> Early Warning
 *   - ratio > 1.25: Greed / High Variance Red (e.g. > 2.50x on 2.00x) -> Excessive Risk
 */
export function evaluateTargetStatus(
  compoundedOdds: number,
  targetOdds: number
): TargetEvaluation {
  if (compoundedOdds <= 1.0001) {
    return {
      zone: 'building',
      ratio: 0,
      progressPct: 0,
      badgeLabel: 'DRAFTING',
      badgeClass: 'bg-slate-700/60 text-slate-300 border-slate-600/40',
      cardClass: 'border-slate-700/50 bg-slate-900/40',
      title: 'Drafting Ticket',
      message: `Add 1–5 high-confidence picks to reach your ${targetOdds.toFixed(2)}x target.`,
      isTargetAchieved: false,
    };
  }

  const ratio = compoundedOdds / targetOdds;
  const progressPct = Math.min(100, Math.round(ratio * 100));
  const excessPct = Math.round((ratio - 1) * 100);

  if (ratio < 1.0) {
    return {
      zone: 'building',
      ratio: +ratio.toFixed(2),
      progressPct,
      badgeLabel: `BUILDING (${progressPct}%)`,
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      cardClass: 'border-blue-500/30 bg-blue-950/20',
      title: 'Building Ticket',
      message: `Current: ${compoundedOdds.toFixed(2)}x. Need ${(targetOdds / compoundedOdds).toFixed(2)}x more odds to reach ${targetOdds.toFixed(2)}x goal.`,
      isTargetAchieved: false,
    };
  }

  if (ratio <= 1.15) {
    // e.g. 2.00x to 2.30x for a 2.00x target
    return {
      zone: 'optimal',
      ratio: +ratio.toFixed(2),
      progressPct: 100,
      badgeLabel: '🎯 OPTIMAL TARGET ZONE',
      badgeClass: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 animate-pulse',
      cardClass: 'border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-slate-900 shadow-lg shadow-emerald-500/10',
      title: `Target ${targetOdds.toFixed(2)}x Achieved (Optimal Range)`,
      message: `Combined odds (${compoundedOdds.toFixed(2)}x) are right in the sweet spot! Stop adding fixtures and lock in your stage slip.`,
      isTargetAchieved: true,
    };
  }

  if (ratio <= 1.25) {
    // e.g. 2.31x to 2.50x for a 2.00x target
    return {
      zone: 'caution',
      ratio: +ratio.toFixed(2),
      progressPct: 100,
      badgeLabel: `⚠️ CAUTION: OVER-PEG (+${excessPct}%)`,
      badgeClass: 'bg-amber-500/25 text-amber-300 border-amber-500/40',
      cardClass: 'border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-orange-950/20 to-slate-900 shadow-md shadow-amber-500/10',
      title: `Approaching Upper Tolerance (+${excessPct}% over peg)`,
      message: `Combined odds (${compoundedOdds.toFixed(2)}x) exceed your ${targetOdds.toFixed(2)}x target. We advise locking now before adding more legs.`,
      isTargetAchieved: true,
    };
  }

  // ratio > 1.25 (e.g. > 2.50x for a 2.00x target)
  return {
    zone: 'greed',
    ratio: +ratio.toFixed(2),
    progressPct: 100,
    badgeLabel: `🚨 GREED ALERT (+${excessPct}%)`,
    badgeClass: 'bg-red-500/25 text-red-300 border-red-500/50',
    cardClass: 'border-red-500/50 bg-gradient-to-r from-red-950/50 via-rose-950/30 to-slate-900 shadow-xl shadow-red-500/15',
    title: `High Variance Alert: Excessive Odds (+${excessPct}% over goal)`,
    message: `Combined odds (${compoundedOdds.toFixed(2)}x) carry unnecessary mathematical risk for a ${targetOdds.toFixed(2)}x campaign. Consider dropping 1 leg or downgrading to a safer market.`,
    isTargetAchieved: true,
  };
}

/** Advance a bucket to the next stage after winning, optionally banking a portion of profits */
export function advanceBucketStage(
  bucket: RolloverBucket,
  bankedAmount: number = 0
): RolloverBucket {
  let compoundedOdds = 1;
  for (const pick of bucket.picks) {
    compoundedOdds *= pick.odds || (1 / Math.max(0.01, pick.probability));
  }

  const grossPayout = +(bucket.currentStake * compoundedOdds).toFixed(2);
  const clampedBank = Math.max(0, Math.min(grossPayout - 100, bankedAmount));
  const nextStageStake = +(grossPayout - clampedBank).toFixed(2);

  const completedStage: RolloverStageHistory = {
    stageNumber: bucket.currentStage,
    stake: bucket.currentStake,
    compoundedOdds: +compoundedOdds.toFixed(2),
    payout: grossPayout,
    bankedAmount: clampedBank,
    picks: [...bucket.picks],
    completedAt: new Date(),
    status: 'won',
  };

  return {
    ...bucket,
    currentStage: bucket.currentStage + 1,
    currentStake: nextStageStake,
    bankedProfit: +(bucket.bankedProfit + clampedBank).toFixed(2),
    status: 'drafting',
    picks: [],
    history: [...bucket.history, completedStage],
    updatedAt: new Date(),
  };
}

/** Reset / Restart a bucket from Stage 1 */
export function restartBucketCampaign(
  bucket: RolloverBucket,
  newInitialStake?: number
): RolloverBucket {
  const stake = newInitialStake ?? bucket.initialStake;
  return {
    ...bucket,
    currentStage: 1,
    currentStake: stake,
    status: 'drafting',
    picks: [],
    updatedAt: new Date(),
  };
}

// ─── 🛡️ Protective Shield: Daily Stage Cap Evaluator ────────────────────────

/**
 * Evaluates whether the user has hit their daily stage cap.
 *
 * Reads bucket.history for stages completed TODAY (by completedAt timestamp),
 * compares against the weekday/weekend cap, and returns a zone:
 *   safe     → below warning threshold
 *   warning  → one stage below cap (amber caution)
 *   locked   → at or above cap (red lock, requires override)
 *
 * If shieldEnabled === false OR shieldOverrideUsedToday === true,
 * always returns zone:'safe' so UI is unblocked.
 */
export function evaluateDailyCap(bucket: RolloverBucket): DailyCapStatus {
  // Master switch
  const shieldEnabled = bucket.shieldEnabled !== false; // default true
  const overrideActive = bucket.shieldOverrideUsedToday === true;

  const weekdayCap = bucket.weekdayStageCap ?? 2;
  const weekendCap = bucket.weekendStageCap ?? 4;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const cap = isWeekend ? weekendCap : weekdayCap;

  // Count stages won today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const winsToday = bucket.history.filter(h => {
    if (h.status !== 'won') return false;
    const completedAt = h.completedAt ? new Date(h.completedAt) : null;
    return completedAt !== null && completedAt >= todayStart;
  }).length;

  // If shield is off or override is active, always safe
  if (!shieldEnabled || overrideActive) {
    return {
      winsToday,
      cap,
      isWeekend,
      zone: 'safe',
      title: 'Shield Active (Override)',
      message: 'Daily cap overridden. Proceed with discipline.',
      overrideActive,
    };
  }

  const dayLabel = isWeekend ? 'weekend' : 'weekday';

  if (winsToday >= cap) {
    return {
      winsToday,
      cap,
      isWeekend,
      zone: 'locked',
      title: `🔴 Daily Stage Cap Reached (${winsToday}/${cap} ${dayLabel} wins)`,
      message: `You have already won ${winsToday} stage${winsToday > 1 ? 's' : ''} today. Your protective shield has locked new play to prevent greed-driven loss. Resume tomorrow or use the override — but understand the risk.`,
      overrideActive: false,
    };
  }

  if (winsToday >= cap - 1 && cap > 1) {
    return {
      winsToday,
      cap,
      isWeekend,
      zone: 'warning',
      title: `⚠️ Approaching Daily Cap (${winsToday}/${cap} ${dayLabel} wins)`,
      message: `You are one win from your daily cap. If this stage also wins, consider banking before continuing. Protect what you've earned.`,
      overrideActive: false,
    };
  }

  return {
    winsToday,
    cap,
    isWeekend,
    zone: 'safe',
    title: '',
    message: '',
    overrideActive: false,
  };
}
