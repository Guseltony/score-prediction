import React, { useState, useCallback, useRef, useMemo } from 'react';
import type {
  ScoreString, ProbabilityMap, BBResult, BBMarket, BBSpinRound, RolloverPick, MatchInfo,
  FixtureRiskAnalysis, RolloverBucket,
} from '../types';
import { runBetBuilder, getRolloverSafetyScore } from '../utils/betBuilder';
import { runMonteCarlo } from '../utils/monteCarlo';
import type { MatchIntelligenceInput } from '../utils/matchIntelligence';
import { calculateBetBuilderSynergy } from '../utils/betBuilderSynergy';
import type { SynergyAnalysis } from '../utils/betBuilderSynergy';
import { classifyShieldMarkets, isOutsideShield as checkOutsideShield } from '../utils/shieldMarkets';
import type { ShieldTier } from '../utils/shieldMarkets';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BetBuilderPanelProps {
  scores: ScoreString[];
  probabilities: ProbabilityMap;
  homeTeam?: string;
  awayTeam?: string;
  intelligenceInput?: Partial<MatchIntelligenceInput>;
  rolloverPicks?: RolloverPick[];
  buckets?: RolloverBucket[];
  activeBucketId?: string;
  onSelectActiveBucket?: (id: string) => void;
  onAddToRollover?: (market: BBMarket, odds: number) => void;
  onSwapRolloverPick?: (existingPickId: string, newMarket: BBMarket, odds: number) => void;
  onRemoveRolloverPick?: (pickId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  total:         'Total Goals',
  result:        'Match Result',
  double_chance: 'Double Chance (1X / X2)',
  btts:          'Both Teams Score',
  home:          'Home Team',
  away:          'Away Team',
  handicap:      'Handicap Lines',
  multigoals:    'Multi-Goals Windows',
  corners:       'Corner Markets 📐 Tactical Estimate',
  halftime:      'Half Time',
};

const CONFIDENCE_STYLES: Record<string, { card: string; chip: string; badge: string; glow: string }> = {
  high: {
    card:  'bg-gradient-to-br from-emerald-500/20 to-green-600/10 border-emerald-500/40',
    chip:  'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25',
    badge: 'bg-emerald-500/30 text-emerald-300 border-emerald-500/40',
    glow:  'shadow-emerald-500/20',
  },
  medium: {
    card:  'bg-gradient-to-br from-amber-500/15 to-orange-600/10 border-amber-500/30',
    chip:  'bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20',
    badge: 'bg-amber-500/25 text-amber-300 border-amber-500/30',
    glow:  'shadow-amber-500/10',
  },
  low: {
    card:  'bg-slate-800/60 border-slate-700/40',
    chip:  'bg-slate-700/50 border border-slate-600/40 text-slate-400 hover:bg-slate-700/70',
    badge: 'bg-slate-700/60 text-slate-400 border-slate-600/40',
    glow:  '',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SpinningIcon = () => (
  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ─── MultiGoalWaterfall ───────────────────────────────────────────────────────────

interface MultiGoalWaterfallProps {
  allMarkets: BBMarket[];
  homeTeam?: string;
  awayTeam?: string;
}

const MultiGoalWaterfall: React.FC<MultiGoalWaterfallProps> = ({ allMarkets, homeTeam, awayTeam }) => {
  const findProb = (id: string) => allMarkets.find(m => m.id === id)?.probability ?? 0;

  const matchLines = [
    { label: 'Over 1.5', id: 'over15' },
    { label: 'Over 2.5', id: 'over25' },
    { label: 'Over 3.5', id: 'over35' },
    { label: 'Over 4.5', id: 'over45' },
    { label: 'Over 5.5', id: 'over55' },
  ];

  const homeLines = [
    { label: '1+ Goals', id: 'home_ov05' },
    { label: '2+ Goals', id: 'home_ov15' },
    { label: '3+ Goals', id: 'home_ov25' },
    { label: '4+ Goals', id: 'home_ov35' },
    { label: '5+ Goals', id: 'home_ov45' },
  ];

  const awayLines = [
    { label: '1+ Goals', id: 'away_ov05' },
    { label: '2+ Goals', id: 'away_ov15' },
    { label: '3+ Goals', id: 'away_ov25' },
    { label: '4+ Goals', id: 'away_ov35' },
    { label: '5+ Goals', id: 'away_ov45' },
  ];

  // Probability bar color
  const barColor = (p: number) => {
    if (p >= 0.70) return 'bg-emerald-500';
    if (p >= 0.50) return 'bg-blue-500';
    if (p >= 0.30) return 'bg-amber-500';
    return 'bg-rose-500';
  };
  const textColor = (p: number) => {
    if (p >= 0.70) return 'text-emerald-400';
    if (p >= 0.50) return 'text-blue-400';
    if (p >= 0.30) return 'text-amber-400';
    return 'text-rose-400';
  };
  const badge = (p: number) => {
    if (p >= 0.75) return { label: 'HIGH', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    if (p >= 0.55) return { label: 'MED',  cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
    if (p >= 0.35) return { label: 'LOW',  cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    return           { label: 'RARE', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  };

  const homeScore1 = findProb('home_ov05');
  const awayScore1 = findProb('away_ov05');
  const homeDominant = homeScore1 >= awayScore1;
  const bestMatchLine = matchLines.reduce((best, l) => {
    const p = findProb(l.id);
    return p >= 0.50 && p > findProb(best.id) ? l : best;
  }, matchLines[0]);

  return (
    <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-700/50 bg-gradient-to-r from-indigo-950/60 to-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-xs font-black text-white uppercase tracking-wider">Multi-Goal Analysis</span>
          <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase">
            Goal Tendency
          </span>
        </div>
        {/* Best bet badge */}
        <div className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
          🎯 Best Line: {bestMatchLine.label} @ {(findProb(bestMatchLine.id) * 100).toFixed(0)}%
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Column 1: Match Goal Lines ── */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">⚽ Match Total Lines</p>
          <div className="space-y-2">
            {matchLines.map(({ label, id }) => {
              const p = findProb(id);
              const pct = Math.round(p * 100);
              const b = badge(p);
              return (
                <div key={id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-slate-300">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${b.cls}`}>{b.label}</span>
                      <span className={`text-xs font-black font-mono ${textColor(p)}`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor(p)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Column 2: Home Team Scoring Tendency ── */}
        <div className="lg:border-l lg:border-slate-700/40 lg:pl-4">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">
            🏠 {homeTeam || 'Home'} Tendency
          </p>
          <div className="space-y-2">
            {homeLines.map(({ label, id }, i) => {
              const p = findProb(id);
              const pct = Math.round(p * 100);
              return (
                <div key={id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className={`text-xs font-black font-mono ${textColor(p)}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-emerald-500' : barColor(p)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Column 3: Away Team Scoring Tendency ── */}
        <div className="lg:border-l lg:border-slate-700/40 lg:pl-4">
          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3">
            ✈️ {awayTeam || 'Away'} Tendency
          </p>
          <div className="space-y-2">
            {awayLines.map(({ label, id }, i) => {
              const p = findProb(id);
              const pct = Math.round(p * 100);
              return (
                <div key={id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className={`text-xs font-black font-mono ${textColor(p)}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-purple-500' : barColor(p)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Goal Verdict ── */}
      {(() => {
        const lineProbs = matchLines.map(l => ({ ...l, p: findProb(l.id) }));
        const lock    = [...lineProbs].filter(l => l.p >= 0.88).pop();
        const primary = [...lineProbs].filter(l => l.p >= 0.65 && l.p < 0.88).pop();
        const stretch = [...lineProbs].filter(l => l.p >= 0.48 && l.p < 0.65).pop();

        let summary = '';
        if (!lock && !primary && !stretch) {
          summary = 'This appears to be a tightly contested, low-scoring fixture. Under markets may offer value.';
        } else if (lock && lock.label !== 'Over 1.5') {
          summary = `${lock.label} is near-certain — this is a high-scoring fixture.${ primary ? ` ${primary.label} is the primary expected market.` : '' }${ stretch ? ` ${stretch.label} is the stretch if form holds.` : '' }`;
        } else if (lock) {
          summary = `Over 1.5 is near-certain.${ primary ? ` ${primary.label} is the primary expected outcome.` : ' Match may stay tight — goals expected but scoreline likely compact.' }${ stretch ? ` ${stretch.label} worth considering with market support.` : '' }`;
        } else if (primary) {
          summary = `${primary.label} is the primary expected outcome.${ stretch ? ` ${stretch.label} is the stretch bet — check market signals before committing.` : '' }`;
        } else {
          summary = `${stretch!.label} is the highest-confidence line. Match likely stays compact — consider Under markets.`;
        }

        const rows: Array<{ line: typeof lock; tier: string; emoji: string; cls: string; barCls: string; textCls: string }> = [];
        if (lock)    rows.push({ line: lock,    tier: 'NEAR-CERTAIN', emoji: '🔒', cls: 'bg-emerald-500/15 border-emerald-500/35', barCls: 'bg-emerald-500', textCls: 'text-emerald-300' });
        if (primary) rows.push({ line: primary, tier: 'PRIMARY BET',  emoji: '🎯', cls: 'bg-blue-500/15 border-blue-500/30',     barCls: 'bg-blue-500',    textCls: 'text-blue-300'    });
        if (stretch) rows.push({ line: stretch, tier: 'STRETCH BET',  emoji: '⚡', cls: 'bg-amber-500/10 border-amber-500/25',  barCls: 'bg-amber-500',   textCls: 'text-amber-300'  });

        if (rows.length === 0) return null;
        return (
          <div className="px-4 pt-4 pb-3 border-t border-slate-700/50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <span>⚽</span> Goal Verdict
            </p>
            <div className="space-y-2 mb-3">
              {rows.map(({ line, tier, emoji, cls, barCls, textCls }) => (
                <div key={line!.id} className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${cls}`}>
                  <span className="text-base shrink-0">{emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-black ${textCls}`}>{line!.label} — {tier}</span>
                      <span className={`text-xs font-mono font-black ${textCls}`}>{Math.round(line!.p * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.round(line!.p * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 rounded-xl px-3 py-2.5 border border-slate-700/40">
              {summary}
            </p>
          </div>
        );
      })()}

      {/* ── Attacking Threat Footer ── */}
      <div className="px-5 py-3 border-t border-slate-700/50 bg-slate-900/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${homeDominant ? 'text-emerald-400' : 'text-purple-400'}`}>
            {homeDominant ? '🏠' : '✈️'}
          </span>
          <p className="text-xs text-slate-300">
            <strong className={homeDominant ? 'text-emerald-400' : 'text-purple-400'}>
              {homeDominant ? (homeTeam || 'Home') : (awayTeam || 'Away')}
            </strong>
            {' '}has higher attacking threat ({Math.round(Math.max(homeScore1, awayScore1) * 100)}% to score)
          </p>
        </div>
        <div className="text-[10px] text-slate-500">
          vs {Math.round(Math.min(homeScore1, awayScore1) * 100)}%
        </div>
      </div>
    </div>
  );
};

// ─── Master Score Engine ────────────────────────────────────────────────────

interface MasterSignal {
  label: string;
  score: ScoreString;
  agrees: boolean;
  detail: string;
}

interface MasterScoreResult {
  score: ScoreString;
  confidence: 'very_high' | 'high' | 'medium' | 'low';
  signalAgreement: number;
  isMarketCompatible: boolean;
  compatibilityNote: string;
  signals: MasterSignal[];
}

function computeMasterScore(
  result: BBResult,
  probabilities: ProbabilityMap,
): MasterScoreResult {
  const votes = new Map<ScoreString, number>();

  const addVote = (score: ScoreString, weight: number) => {
    if (!score || score === '—') return;
    votes.set(score, (votes.get(score) ?? 0) + weight);
  };

  // Signal 1: Monte Carlo top 3 (3× weight for #1, 2× for #2, 1× for #3)
  result.mcTop3.forEach((s, i) => addVote(s, (3 - i) * 3));

  // Signal 2: Bet Builder final score (direct highest-probability pick)
  addVote(result.finalScore, 6);

  // Signal 3: Spinner frequency — count score appearances across 3 rounds
  const spinCount = new Map<ScoreString, number>();
  result.spinRounds.forEach(round => {
    (round.topScores ?? []).slice(0, 3).forEach((s, i) =>
      spinCount.set(s, (spinCount.get(s) ?? 0) + (3 - i))
    );
    if (round.finalPick) spinCount.set(round.finalPick, (spinCount.get(round.finalPick) ?? 0) + 3);
  });
  [...spinCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .forEach(([s, cnt], i) => addVote(s, (2 - i) * 2 * Math.min(1, cnt / 5)));

  // Boost all votes by Poisson probability (market-calibrated scores rise to the top)
  votes.forEach((w, score) => {
    const prob = probabilities[score] ?? 0;
    votes.set(score, w * (1 + prob * 8));
  });

  // Determine winner
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const master: ScoreString = sorted[0]?.[0] ?? result.finalScore;

  // Market compatibility: master score total vs adjusted xG total
  const parseScore = (s: ScoreString) => {
    const p = s.split('-');
    return { home: parseInt(p[0] ?? '0', 10), away: parseInt(p[1] ?? '0', 10) };
  };
  const masterGoals = parseScore(master);
  const expectedTotal = result.goalRange.homeExact + result.goalRange.awayExact;
  const masterTotal = masterGoals.home + masterGoals.away;
  const isMarketCompatible = Math.abs(masterTotal - expectedTotal) <= 1.5;
  const compatibilityNote = isMarketCompatible
    ? `Score total (${masterTotal}) aligns with adjusted xG total of ${expectedTotal.toFixed(1)}`
    : `Score total (${masterTotal}) differs from adjusted xG (${expectedTotal.toFixed(1)}) — treat as indicative`;

  // Build human-readable signal breakdown
  const spinTopScore = [...spinCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const signals: MasterSignal[] = [
    {
      label: 'Monte Carlo (500 iterations)',
      score: result.mcTop3[0] ?? '—',
      agrees: result.mcTop3[0] === master,
      detail: `${((probabilities[result.mcTop3[0] ?? ''] ?? 0) * 100).toFixed(1)}% Poisson probability`,
    },
    {
      label: 'Bet Builder Engine',
      score: result.finalScore,
      agrees: result.finalScore === master,
      detail: 'Highest probability from score pool',
    },
    {
      label: 'Spin Rounds Consensus',
      score: spinTopScore,
      agrees: spinTopScore === master,
      detail: `Most frequent across 3×20 spinner rounds`,
    },
    {
      label: 'Market Compatibility',
      score: master,
      agrees: isMarketCompatible,
      detail: compatibilityNote,
    },
  ];

  const agreeCount = signals.filter(s => s.agrees).length;
  const confidence = agreeCount >= 4 ? 'very_high'
    : agreeCount >= 3 ? 'high'
    : agreeCount >= 2 ? 'medium' : 'low';

  return { score: master, confidence, signalAgreement: agreeCount, isMarketCompatible, compatibilityNote, signals };
}

// ─── MasterScorePanel Component ───────────────────────────────────────────────

interface MasterScorePanelProps {
  result: BBResult;
  probabilities: ProbabilityMap;
  homeTeam?: string;
  awayTeam?: string;
}

const MasterScorePanel: React.FC<MasterScorePanelProps> = ({ result, probabilities, homeTeam, awayTeam }) => {
  const master = useMemo(() => computeMasterScore(result, probabilities), [result, probabilities]);

  const confStyle = {
    very_high: { badge: 'bg-emerald-500/25 text-emerald-200 border-emerald-500/50', ring: 'ring-emerald-500/40', label: 'VERY HIGH', glow: 'shadow-emerald-900/40' },
    high:      { badge: 'bg-blue-500/25 text-blue-200 border-blue-500/50',       ring: 'ring-blue-500/30',    label: 'HIGH',      glow: 'shadow-blue-900/30'    },
    medium:    { badge: 'bg-amber-500/20 text-amber-200 border-amber-500/40',    ring: 'ring-amber-500/25',   label: 'MEDIUM',    glow: 'shadow-amber-900/20'   },
    low:       { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/35',       ring: 'ring-rose-500/20',    label: 'LOW',       glow: 'shadow-rose-900/20'    },
  }[master.confidence];

  const matchStr = homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : 'this fixture';

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/25 shadow-xl ${confStyle.glow} ring-1 ${confStyle.ring}`}>
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative px-5 py-3.5 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <span className="text-xs font-black text-white uppercase tracking-wider">Consensus Correct Score</span>
          <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase">
            Multi-Signal
          </span>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${confStyle.badge}`}>
          {confStyle.label} CONFIDENCE
        </span>
      </div>

      {/* Score display */}
      <div className="relative px-5 py-5 flex items-center gap-6">
        <div className="flex-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Weighted consensus for {matchStr}
          </p>
          <p className="text-5xl font-black text-white font-mono tracking-tight">
            {master.score}
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            {master.signalAgreement}/4 signals agree
            {master.isMarketCompatible
              ? <span className="text-emerald-400 ml-1.5">· ✅ Market-compatible</span>
              : <span className="text-amber-400 ml-1.5">· ⚠️ Check xG alignment</span>
            }
          </p>
        </div>

        {/* Signal agreement meter */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Agreement</p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-3 h-8 rounded-sm transition-all ${
                  i < master.signalAgreement
                    ? master.confidence === 'very_high' ? 'bg-emerald-400'
                      : master.confidence === 'high' ? 'bg-blue-400'
                      : master.confidence === 'medium' ? 'bg-amber-400'
                      : 'bg-rose-400'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <p className={`text-xs font-black mt-1 ${confStyle.badge.split(' ').find(c => c.startsWith('text-'))}`}>
            {master.signalAgreement}/4
          </p>
        </div>
      </div>

      {/* Signal breakdown */}
      <div className="relative px-5 pb-5 grid grid-cols-2 gap-2">
        {master.signals.map((sig, i) => (
          <div
            key={i}
            className={`rounded-xl border px-3 py-2 ${
              sig.agrees
                ? 'bg-emerald-500/8 border-emerald-500/25'
                : 'bg-slate-800/60 border-slate-700/40'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm">{sig.agrees ? '✅' : '⬜'}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                {sig.label}
              </span>
            </div>
            <p className="text-xs font-mono font-bold text-white ml-5">{sig.score}</p>
            <p className="text-[10px] text-slate-500 ml-5 leading-snug">{sig.detail}</p>
          </div>
        ))}
      </div>

      {/* Compatibility note */}
      <div className="relative px-5 pb-4">
        <p className="text-[10px] text-slate-500 bg-slate-900/60 border border-slate-700/30 rounded-xl px-3 py-2">
          📐 {master.compatibilityNote}
        </p>
      </div>
    </div>
  );
};

interface GoalRangeBarProps {
  exact: number;
  min: number;
  max: number;
  homeExact: number;
  awayExact: number;
  expectedH1: number;
  expectedH2: number;
}

const GoalRangeBar: React.FC<GoalRangeBarProps> = ({ exact, min, max, homeExact, awayExact, expectedH1, expectedH2 }) => {
  const pct = max > 0 ? Math.min((exact / (max + 1)) * 100, 100) : 50;

  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Expected Goals</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{exact}</span>
            <span className="text-slate-400 text-sm">goals</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-indigo-400/80 text-[10px] font-bold uppercase tracking-wider mb-1.5">Model Score</p>
          <span className="text-xl font-black text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20">
            {Math.round(homeExact)}-{Math.round(awayExact)}
          </span>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Range</p>
          <span className="text-xl font-bold text-slate-200">{min} – {max}</span>
        </div>
      </div>

      {/* Main bar */}
      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden mb-3">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {/* Exact marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80"
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* Sub-breakdowns */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-700/40 text-xs text-slate-400">
        <div>
          <span className="text-slate-500">Home xG: </span>
          <span className="text-slate-200 font-bold">{homeExact}</span>
        </div>
        <div>
          <span className="text-slate-500">Away xG: </span>
          <span className="text-slate-200 font-bold">{awayExact}</span>
        </div>
        <div>
          <span className="text-slate-500">1H Expected: </span>
          <span className="text-slate-200 font-bold">{expectedH1}</span>
        </div>
        <div>
          <span className="text-slate-500">2H Expected: </span>
          <span className="text-slate-200 font-bold">{expectedH2}</span>
        </div>
      </div>
    </div>
  );
};

interface FixtureRiskBannerProps {
  risk: FixtureRiskAnalysis;
}

const FixtureRiskBanner: React.FC<FixtureRiskBannerProps> = ({ risk }) => {
  const [expanded, setExpanded] = useState(risk.level === 'extreme_danger' || risk.level === 'dangerous');

  const theme = {
    extreme_danger: {
      container: 'border-red-500/70 bg-gradient-to-br from-red-950/80 via-rose-950/40 to-slate-900 shadow-2xl shadow-red-500/25 ring-1 ring-red-500/40',
      badge: 'bg-red-500/30 text-red-300 border-red-500/60',
      icon: '🚨',
      titleColor: 'text-red-300',
      barColor: 'bg-gradient-to-r from-orange-500 via-rose-500 to-red-600',
      alertIcon: '⚠️',
      buttonBg: 'bg-red-500/20 hover:bg-red-500/30 text-red-200 border-red-500/40',
      indicatorText: 'NO-BET ZONE / EXTREME DANGER',
    },
    dangerous: {
      container: 'border-amber-500/60 bg-gradient-to-br from-amber-950/60 via-orange-950/30 to-slate-900 shadow-xl shadow-amber-500/15 ring-1 ring-amber-500/30',
      badge: 'bg-amber-500/25 text-amber-300 border-amber-500/40',
      icon: '⚠️',
      titleColor: 'text-amber-300',
      barColor: 'bg-gradient-to-r from-yellow-500 to-amber-500',
      alertIcon: '⚡',
      buttonBg: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30',
      indicatorText: 'DANGEROUS FIXTURE',
    },
    moderate: {
      container: 'border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900',
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: '⚖️',
      titleColor: 'text-indigo-200',
      barColor: 'bg-indigo-500',
      alertIcon: 'ℹ️',
      buttonBg: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600/40',
      indicatorText: 'MODERATE RISK',
    },
    safe: {
      container: 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: '🟢',
      titleColor: 'text-emerald-300',
      barColor: 'bg-gradient-to-r from-teal-500 to-emerald-500',
      alertIcon: '✅',
      buttonBg: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/30',
      indicatorText: 'STABLE FIXTURE',
    },
  }[risk.level];

  return (
    <div className={`border rounded-2xl p-4 transition-all duration-300 ${theme.container}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`text-2xl ${risk.level === 'extreme_danger' ? 'animate-bounce' : 'animate-pulse'}`}>
            {theme.icon}
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${theme.badge}`}>
                {theme.indicatorText}
              </span>
              <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50">
                Outcome Chaos: {Math.round(risk.entropy1X2 * 100)}%
              </span>
              <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50">
                Top Edge: {Math.round(risk.maxMarketProbability * 100)}%
              </span>
            </div>
            <h3 className={`text-sm font-black mt-1 ${theme.titleColor}`}>
              {risk.title}
            </h3>
          </div>
        </div>

        {/* Risk Score Meter */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-slate-400">Risk Index</p>
            <p className="text-base font-black text-white">{risk.score}<span className="text-xs text-slate-400 font-normal">/100</span></p>
          </div>
          <div className="w-20 sm:w-28 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-700 ${theme.barColor}`}
              style={{ width: `${Math.min(100, Math.max(5, risk.score))}%` }}
            />
          </div>
          {risk.reasons.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-colors ${theme.buttonBg}`}
            >
              {expanded ? 'Hide Triggers' : `Triggers (${risk.reasons.length})`}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-200 mt-2.5 leading-relaxed font-medium">
        {risk.summary}
      </p>

      {/* Expanded list of mathematical / tactical risk triggers */}
      {expanded && risk.reasons.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5 animate-fadeIn">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>{theme.alertIcon}</span> Mathematical &amp; Tactical Danger Triggers:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {risk.reasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300">
                <span className="text-amber-400 mt-0.5">•</span>
                <span className="leading-snug">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface MarketCardProps {
  market: BBMarket;
  rank: number;
  existingFixturePick?: RolloverPick;
  isTicketFull?: boolean;
  onAddToRollover?: (market: BBMarket, odds: number) => void;
  onSwapRolloverPick?: (existingPickId: string, newMarket: BBMarket, odds: number) => void;
  onRemoveRolloverPick?: (pickId: string) => void;
}

const MarketCard: React.FC<MarketCardProps> = ({
  market,
  rank,
  existingFixturePick,
  isTicketFull,
  onAddToRollover,
  onSwapRolloverPick,
  onRemoveRolloverPick,
}) => {
  const style = CONFIDENCE_STYLES[market.confidence];
  const pct = Math.round(market.probability * 100);
  const fairOdds = +(1 / Math.max(0.01, market.probability)).toFixed(2);
  const defaultOdds = market.odds || fairOdds;
  const [customOdds, setCustomOdds] = useState<number>(defaultOdds);

  const isBookieTrap = customOdds > fairOdds * 1.30; // 30% massive discrepancy

  const isCurrentSelection = existingFixturePick?.marketId === market.id;
  const isDifferentSelectionInTicket = !!existingFixturePick && !isCurrentSelection;

  const handleAction = () => {
    if (isCurrentSelection && onRemoveRolloverPick && existingFixturePick) {
      onRemoveRolloverPick(existingFixturePick.id);
    } else if (isDifferentSelectionInTicket && onSwapRolloverPick && existingFixturePick) {
      onSwapRolloverPick(existingFixturePick.id, market, customOdds);
    } else if (onAddToRollover) {
      onAddToRollover(market, customOdds);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border px-3 py-2.5 transition-all duration-300
      hover:-translate-y-0.5 hover:shadow-lg ${style.card} ${style.glow}`}>
      {/* Shimmer on high confidence */}
      {market.confidence === 'high' && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer
          bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      )}

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{market.emoji}</span>
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider
              ${market.confidence === 'high' ? 'text-emerald-400/70'
              : market.confidence === 'medium' ? 'text-amber-400/70'
              : 'text-slate-500'}`}>
              #{rank} · {CATEGORY_LABEL[market.category] ?? market.category}
            </p>
            <p className="text-white font-bold text-xs mt-0.5">{market.label}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>
            {market.confidence === 'high' ? '🔥' : market.confidence === 'medium' ? '✅' : '📊'} {pct}%
          </span>
          <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700/50">
            Fair Odds: {fairOdds.toFixed(2)}
          </span>
        </div>
      </div>

      {market.tacticalNote && (
        <p className="text-[10px] text-slate-400 italic mb-1.5">
          {market.tacticalNote}
        </p>
      )}

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-700/60 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700
            ${market.confidence === 'high' ? 'bg-gradient-to-r from-emerald-500 to-green-400'
            : market.confidence === 'medium' ? 'bg-gradient-to-r from-amber-500 to-orange-400'
            : 'bg-slate-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Rollover Controls */}
      {onAddToRollover && (market.confidence === 'high' || market.confidence === 'medium') && (
        <div className="mt-2 pt-2 border-t border-slate-700/40 flex flex-col gap-2">
          {isBookieTrap && (
            <div className="text-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-400 px-2 py-1.5 rounded flex items-start gap-1.5 animate-pulse">
              <span>🚨</span>
              <span><strong>Bookie Trap Warning:</strong> Bookmaker odds ({customOdds.toFixed(2)}) heavily deviate from AI Fair Odds ({fairOdds.toFixed(2)}). Check for injuries/rotation!</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-700/50">
              <span className="text-[10px] font-bold text-slate-400">Odds:</span>
              <input
                type="number"
                step="0.01"
                value={customOdds}
                onChange={(e) => setCustomOdds(Math.max(1.01, parseFloat(e.target.value) || defaultOdds))}
                className="w-12 bg-transparent text-amber-400 font-bold text-xs focus:outline-none"
                title="Enter exact bookmaker odds"
              />
            </div>

            {isCurrentSelection ? (
              <button
                onClick={handleAction}
                className="grow py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-rose-500/20 hover:text-rose-300 border border-emerald-500/40 transition-colors flex items-center justify-center gap-1"
                title="Click to remove selection"
              >
                <span>✓ In Rollover</span>
                <span className="text-[10px] opacity-60">(Remove)</span>
              </button>
            ) : isDifferentSelectionInTicket ? (
              <button
                onClick={handleAction}
                className="grow py-1.5 px-3 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/40 transition-colors"
                title="1 selection per fixture rule: click to swap this match pick"
              >
                🔄 Swap Pick
              </button>
            ) : isTicketFull ? (
              <span className="grow py-1.5 px-3 text-center rounded-lg text-xs font-semibold bg-slate-800 text-slate-500 border border-slate-700">
                Slip Full (5/5)
              </span>
            ) : (
              <button
                onClick={handleAction}
                className={`grow py-1.5 px-3 rounded-lg text-xs font-bold transition-colors
                  ${market.confidence === 'high' 
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 border border-amber-500/30'}`}
              >
                + Add to Ticket
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface MarketChipProps {
  market: BBMarket;
  isTop: boolean;
  existingFixturePick?: RolloverPick;
  isTicketFull?: boolean;
  isOutsideShield?: boolean;
  onAddToRollover?: (market: BBMarket, odds: number) => void;
  onSwapRolloverPick?: (existingPickId: string, newMarket: BBMarket, odds: number) => void;
  onRemoveRolloverPick?: (pickId: string) => void;
}

const MarketChip: React.FC<MarketChipProps> = ({
  market,
  isTop,
  existingFixturePick,
  isTicketFull,
  isOutsideShield = false,
  onAddToRollover,
  onSwapRolloverPick,
  onRemoveRolloverPick,
}) => {
  const style = CONFIDENCE_STYLES[market.confidence];
  const pct = Math.round(market.probability * 100);
  const defaultOdds = market.odds || +(1 / Math.max(0.01, market.probability)).toFixed(2);
  const [customOdds, setCustomOdds] = React.useState(defaultOdds);

  const isCurrentSelection = existingFixturePick?.marketId === market.id;
  const isDifferentSelectionInTicket = !!existingFixturePick && !isCurrentSelection;

  const handleChipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentSelection && onRemoveRolloverPick && existingFixturePick) {
      onRemoveRolloverPick(existingFixturePick.id);
      return;
    }
    if (isDifferentSelectionInTicket && onSwapRolloverPick && existingFixturePick) {
      onSwapRolloverPick(existingFixturePick.id, market, customOdds);
    } else if (onAddToRollover && !isTicketFull) {
      onAddToRollover(market, customOdds);
    }
  };

  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl
      text-xs transition-all duration-150 cursor-default ${style.chip}
      ${isTop ? 'ring-1 ring-inset ' + (
        market.confidence === 'high' ? 'ring-emerald-500/40' :
        market.confidence === 'medium' ? 'ring-amber-500/30' : 'ring-slate-600/40'
      ) : ''}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span>{market.emoji}</span>
        <span className="font-semibold">{market.label}</span>
        {isTop && <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded font-bold">TOP</span>}
        {/* 🛡️ Outside shield warning badge */}
        {isOutsideShield && (
          <span
            className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
            title="This market is outside your system's top recommendations for this fixture. Proceed with caution."
          >
            ⚠️ OUTSIDE SHIELD
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-700/50">
          <span className="text-[9px] font-bold text-slate-500">Fair:</span>
          <input
            type="number"
            step="0.01"
            value={customOdds}
            onChange={(e) => setCustomOdds(Math.max(1.01, parseFloat(e.target.value) || defaultOdds))}
            className="w-10 bg-transparent text-amber-400/80 font-bold text-[10px] focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <span className="font-bold opacity-80">{pct}%</span>
        {onAddToRollover && (market.confidence === 'high' || market.confidence === 'medium') && (
          <button
            onClick={handleChipClick}
            className={`px-2 py-0.5 rounded transition-colors text-[10px] font-black
              ${isCurrentSelection ? 'bg-emerald-500 text-slate-950' : 
                isDifferentSelectionInTicket ? 'bg-blue-500/30 text-blue-300 hover:bg-blue-500/50' :
                isTicketFull ? 'bg-slate-700 text-slate-500 cursor-not-allowed' :
                'bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500/50'}`}
            title={isCurrentSelection ? 'In Rollover' : isDifferentSelectionInTicket ? 'Swap match pick' : 'Add to Rollover'}
          >
            {isCurrentSelection ? '✓' : isDifferentSelectionInTicket ? '🔄' : '+'}
          </button>
        )}
      </div>
    </div>
  );
};


interface SpinAuditTrailProps {
  mcTop3: ScoreString[];
  spinRounds: BBSpinRound[];
  homeTeam?: string;
  awayTeam?: string;
}

const SpinAuditTrail: React.FC<SpinAuditTrailProps> = ({ mcTop3, spinRounds, homeTeam, awayTeam }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3
          text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>🔍</span>
          <span className="font-semibold">Audit Trail: Monte Carlo &amp; Spinner Inputs</span>
        </div>
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-700/30 pt-3 space-y-3 text-xs">
          <div>
            <p className="text-slate-500 font-semibold mb-1">Monte Carlo Top 3 (500 iterations):</p>
            <div className="flex gap-2">
              {mcTop3.map((s, i) => (
                <span key={i} className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                  #{i + 1} {s}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-slate-500 font-semibold">3 Spinner Rounds (20 spins each):</p>
            {spinRounds.map(r => (
              <div key={r.roundNumber} className="flex items-center gap-2 text-slate-400">
                <span className="font-mono text-slate-500">Round {r.roundNumber}:</span>
                <span className="text-slate-300 font-semibold">
                  Top: {r.topScores.join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Same-Game Correlation & Synergy Banner ──────────────────────────────────

const SynergyBanner: React.FC<{ synergy: SynergyAnalysis | null }> = ({ synergy }) => {
  const [expanded, setExpanded] = useState(false);
  if (!synergy || synergy.alerts.length === 0) return null;

  return (
    <div className={`p-4 rounded-2xl border transition-all duration-300 ${
      synergy.status === 'conflict'
        ? 'bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-950/30'
        : synergy.status === 'optimal_synergy'
        ? 'bg-emerald-950/30 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
        : 'bg-amber-950/30 border-amber-500/40'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">
            {synergy.status === 'conflict' ? '🚨' : synergy.status === 'optimal_synergy' ? '🔗' : '⚠️'}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${synergy.badgeColor}`}>
                {synergy.statusLabel}
              </span>
              {synergy.correlationMultiplier !== 1.0 && (
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {synergy.correlationMultiplier > 1 ? `+${Math.round((synergy.correlationMultiplier - 1) * 100)}% Co-occurrence Boost` : `${Math.round((synergy.correlationMultiplier - 1) * 100)}% Friction`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {synergy.alerts[0]?.message}
            </p>
          </div>
        </div>

        {synergy.alerts.length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-slate-400 hover:text-white font-bold shrink-0"
          >
            {expanded ? '▲ Hide' : `+${synergy.alerts.length - 1} More`}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2 text-xs">
          {synergy.alerts.slice(1).map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-slate-300">
              <span>•</span>
              <p>{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const BetBuilderPanel: React.FC<BetBuilderPanelProps> = ({
  scores,
  probabilities,
  homeTeam,
  awayTeam,
  intelligenceInput,
  rolloverPicks = [],
  buckets,
  activeBucketId,
  onSelectActiveBucket,
  onAddToRollover,
  onSwapRolloverPick,
  onRemoveRolloverPick,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BBResult | null>(null);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [marketFilter, setMarketFilter] = useState<'top' | 'goals' | 'multigoals' | 'handicap' | 'double_chance' | 'halftime' | 'corners'>('top');
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeBucket = buckets?.find(b => b.id === activeBucketId) ?? buckets?.[0];
  const effectivePicks = activeBucket?.picks ?? rolloverPicks;

  // Check if this fixture already has a pick in the rollover ticket
  const currentMatchH = (homeTeam || '').trim().toLowerCase();
  const currentMatchA = (awayTeam || '').trim().toLowerCase();
  
  const existingFixturePick = effectivePicks.find(p => {
    const pH = (p.matchInfo.homeTeam || '').trim().toLowerCase();
    const pA = (p.matchInfo.awayTeam || '').trim().toLowerCase();
    if (currentMatchH && currentMatchA) {
      return pH === currentMatchH && pA === currentMatchA;
    }
    return false;
  });

  const isTicketFull = effectivePicks.length >= 5 && !existingFixturePick;

  const synergy = useMemo(() => {
    if (!result || result.topPicks.length <= 1) return null;
    return calculateBetBuilderSynergy(result.topPicks, probabilities);
  }, [result, probabilities]);

  const handleGenerate = useCallback(() => {
    setIsRunning(true);
    setResult(null);

    setTimeout(() => {
      // Step 1: Run 500-iteration Monte Carlo to find top 3 baseline scores
      const mc = runMonteCarlo(scores, probabilities, 500);
      const mcTop3 = mc.ranked.slice(0, 3).map(x => x.score);

      // Step 2: Run full Bet Builder engine
      const bb = runBetBuilder({
        scores,
        probabilities,
        mcTop3,
        intelligenceInput,
      });

      setResult(bb);
      setIsRunning(false);
    }, 400);
  }, [scores, probabilities, intelligenceInput]);

  const handleCopyFinal = useCallback(() => {
    if (!result) return;
    const match = homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : 'Match';
    const text = `🎯 Bet Builder Prediction for ${match}\nFinal Score: ${result.finalScore}\nExpected Goals: ${result.goalRange.exact}\nTop Markets:\n` +
      result.topPicks.map((m, i) => `  ${i + 1}. ${m.emoji} ${m.label} (${Math.round(m.probability * 100)}%)`).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result, homeTeam, awayTeam]);

  // Group allMarkets by category
  const marketsByCategory = React.useMemo(() => {
    if (!result) return {};
    const map: Record<string, BBMarket[]> = {};
    for (const m of result.allMarkets) {
      if (!map[m.category]) map[m.category] = [];
      map[m.category].push(m);
    }
    return map;
  }, [result]);

  const displayedMarkets = useMemo(() => {
    if (!result) return [];
    if (marketFilter === 'top') return result.topPicks;

    let list: BBMarket[] = [];
    if (marketFilter === 'goals') {
      list = result.allMarkets.filter(m => m.category === 'home' || m.category === 'away' || (m.category === 'total' && m.id.startsWith('over')));
    } else if (marketFilter === 'multigoals') {
      list = result.allMarkets.filter(m => m.category === 'multigoals' || (m.category === 'total' && m.id.startsWith('under')));
    } else if (marketFilter === 'handicap') {
      list = result.allMarkets.filter(m => m.category === 'handicap');
    } else if (marketFilter === 'double_chance') {
      list = result.allMarkets.filter(m => m.category === 'double_chance' || m.id.startsWith('dnb') || m.category === 'result');
    } else if (marketFilter === 'halftime') {
      list = result.allMarkets.filter(m => m.category === 'halftime');
    } else if (marketFilter === 'corners') {
      list = result.allMarkets.filter(m => m.category === 'corners');
    } else {
      return result.topPicks;
    }

    // Sort category tabs by safety priority and probability so safest/best outcomes rank at the top
    return [...list].sort((a, b) => getRolloverSafetyScore(b) - getRolloverSafetyScore(a));
  }, [result, marketFilter]);

  const topPickIds = React.useMemo(
    () => new Set(result?.topPicks.map(p => p.id) ?? []),
    [result]
  );

  // 🛡️ Shield Markets classification (v2 — full BBResult context + contradiction detection)
  const shieldTier = useMemo(() => {
    if (!result) return null;
    return classifyShieldMarkets(result);
  }, [result]);

  // Win Ratio Calculation for UI Display
  const winRatios = useMemo(() => {
    if (!result) return null;
    const h = Math.round((result.allMarkets.find(m => m.id === 'home_win')?.probability || 0) * 100);
    const a = Math.round((result.allMarkets.find(m => m.id === 'away_win')?.probability || 0) * 100);
    const d = Math.round((result.allMarkets.find(m => m.id === 'draw')?.probability || 0) * 100);
    return { h, a, d };
  }, [result]);

  return (
    <div ref={panelRef} className="space-y-4">
      {/* ── CTA Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br
        from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h2 className="text-xl font-black text-white tracking-tight">
                AI Bet Builder Engine
              </h2>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Multi-Market
              </span>
            </div>
            <p className="text-slate-400 text-xs max-w-lg">
              Combines Monte Carlo simulation &amp; statistical variance to predict the most resilient betting markets for this match.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isRunning || scores.length === 0}
            className={`shrink-0 flex items-center gap-2.5 px-6 py-3.5 rounded-2xl
              font-black text-sm text-white transition-all duration-300 shadow-xl
              ${isRunning
                ? 'bg-indigo-700/60 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 hover:scale-[1.02] active:scale-[0.98] shadow-indigo-500/25'
              }`}
          >
            {isRunning ? (
              <>
                <SpinningIcon />
                <span>Analyzing Match...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Generate Prediction</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Results Container ── */}
      {result && (
        <div className="space-y-4 animate-fadeIn">
          {/* Active rollover fixture status badge */}
          {existingFixturePick && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-blue-300 font-semibold flex items-center gap-1.5">
                <span>🛡️</span> In Rollover Ticket: <strong className="text-white font-bold">{existingFixturePick.label}</strong> (@ {existingFixturePick.odds.toFixed(2)})
              </span>
              <span className="text-slate-400 text-[11px]">
                1 pick per match limit active
              </span>
            </div>
          )}

          {/* 1. Fixture Risk & Volatility Alert Banner */}
          <FixtureRiskBanner risk={result.riskAnalysis} />

          {/* 1b. 🛡️ Shield Markets Panel */}
          {shieldTier && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-slate-700/50 bg-gradient-to-r from-rose-950/50 via-slate-900 to-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🛡️</span>
                  <span className="text-xs font-black text-white uppercase tracking-wider">Shield Markets</span>
                  <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full uppercase">
                    {shieldTier.mustHave.length + shieldTier.recommended.length} markets
                  </span>
                </div>
                {shieldTier.shouldSkipFixture ? (
                  <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 border border-rose-500/30 px-2 py-1 rounded-full animate-pulse">
                    🚫 SKIP FIXTURE
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 hidden sm:block">
                    If no 🔴 markets available → leave this fixture
                  </span>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* Skip fixture notice */}
                {shieldTier.shouldSkipFixture && (
                  <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300 leading-relaxed">
                    🚫 <strong>No must-have markets found.</strong> This fixture is too unpredictable for confident staking. Find a different match.
                  </div>
                )}

                {/* Must-Have tier */}
                {shieldTier.mustHave.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <span>🔴</span> Must-Have — Find These or Skip Fixture
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {shieldTier.mustHave.map(m => (
                        <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span>{m.emoji}</span>
                            <span className="font-bold text-white">{m.label}</span>
                          </div>
                          <span className="font-black text-rose-300 shrink-0">{Math.round(m.probability * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended tier */}
                {shieldTier.recommended.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <span>⭐</span> Recommended — Good if Available
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {shieldTier.recommended.map(m => (
                        <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span>{m.emoji}</span>
                            <span className="font-semibold text-slate-200">{m.label}</span>
                          </div>
                          <span className="font-black text-amber-400 shrink-0">{Math.round(m.probability * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary line */}
                <p className="text-[10px] text-slate-500 border-t border-slate-700/40 pt-3 leading-relaxed">
                  💡 {shieldTier.summary}
                </p>
              </div>
            </div>
          )}

          {/* 2. Goal Range Bar */}
          <GoalRangeBar {...result.goalRange} />

          {/* 3. Multi-Goal Waterfall — Over lines + Team Scoring Tendencies */}
          <MultiGoalWaterfall
            allMarkets={result.allMarkets}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
          />

          {/* 3b. 🧠 Consensus Correct Score — Master Score Panel */}
          <MasterScorePanel
            result={result}
            probabilities={probabilities}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
          />

          {/* 4. Same-Game Synergy & Correlation Analysis */}
          <SynergyBanner synergy={synergy} />

          {/* 5. Audit Trail (collapsible) */}
          <SpinAuditTrail
            mcTop3={result.mcTop3}
            spinRounds={result.spinRounds}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
          />

          {/* 6. Top Picks Grid & Category Filters */}
          <div>
            {winRatios && (
              <div className="mb-4 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="text-emerald-400">🏠 Home Win ({winRatios.h}%)</span>
                  <span className="text-slate-400">🤝 Draw ({winRatios.d}%)</span>
                  <span className="text-purple-400">✈️ Away Win ({winRatios.a}%)</span>
                </div>
                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${winRatios.h}%` }} />
                  <div className="h-full bg-slate-500" style={{ width: `${winRatios.d}%` }} />
                  <div className="h-full bg-purple-500" style={{ width: `${winRatios.a}%` }} />
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  🎯 Rollover Market Studio
                </span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  {displayedMarkets.length} Available
                </span>
              </div>

              {buckets && buckets.length > 0 && onSelectActiveBucket && (
                <div className="flex items-center gap-1.5 bg-slate-900/70 px-2.5 py-1 rounded-xl border border-slate-700/60 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Target:</span>
                  <select
                    value={activeBucketId || activeBucket?.id || ''}
                    onChange={(e) => onSelectActiveBucket(e.target.value)}
                    className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer"
                  >
                    {buckets.map(b => (
                      <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                        {b.name} (S{b.currentStage})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 custom-scrollbar">
              <button
                onClick={() => setMarketFilter('top')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  marketFilter === 'top'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>🔥</span> Top Safe Floor ({result.topPicks.length})
              </button>
              <button
                onClick={() => setMarketFilter('goals')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  marketFilter === 'goals'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>⚽</span> Team &amp; Match Goals
              </button>
              <button
                onClick={() => setMarketFilter('multigoals')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  marketFilter === 'multigoals'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>📊</span> Multi-Goals &amp; Ceilings
              </button>
              <button
                onClick={() => setMarketFilter('handicap')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  marketFilter === 'handicap'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>🛡️</span> Cushions &amp; Handicaps
              </button>
              <button
                onClick={() => setMarketFilter('double_chance')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  marketFilter === 'double_chance'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20 ring-1 ring-violet-400'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>⚔️</span> Double Chance &amp; DNB
              </button>
              <button
                onClick={() => setMarketFilter('halftime')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  marketFilter === 'halftime'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20 ring-1 ring-pink-400'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>⏱️</span> Halftime
              </button>
              <button
                onClick={() => setMarketFilter('corners')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  marketFilter === 'corners'
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md shadow-cyan-600/20 ring-1 ring-cyan-400'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>🚩</span> Corners
              </button>
            </div>

            {displayedMarkets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayedMarkets.map((market, i) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    rank={i + 1}
                    existingFixturePick={existingFixturePick}
                    isTicketFull={isTicketFull}
                    onAddToRollover={onAddToRollover}
                    onSwapRolloverPick={onSwapRolloverPick}
                    onRemoveRolloverPick={onRemoveRolloverPick}
                  />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm text-center py-4">No confident picks found for this category.</p>
            )}
          </div>

          {/* 4. All Markets — expandable chip grid */}
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAllMarkets(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5
                text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <span>📋</span>
                <span>All Markets</span>
                <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">
                  {result.allMarkets.length}
                </span>
              </div>
              <span className="text-slate-500 text-xs">{showAllMarkets ? '▲ Collapse' : '▼ Expand'}</span>
            </button>

            {showAllMarkets && (
              <div className="px-5 pb-5 border-t border-slate-700/30 pt-4 space-y-5">
                {Object.entries(marketsByCategory).map(([cat, markets]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      {CATEGORY_LABEL[cat] ?? cat}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {markets.map(m => (
                        <MarketChip
                          key={m.id}
                          market={m}
                          isTop={topPickIds.has(m.id)}
                          isOutsideShield={shieldTier ? checkOutsideShield(m, shieldTier) : false}
                          existingFixturePick={existingFixturePick}
                          isTicketFull={isTicketFull}
                          onAddToRollover={onAddToRollover}
                          onSwapRolloverPick={onSwapRolloverPick}
                          onRemoveRolloverPick={onRemoveRolloverPick}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Final Score Prediction — dramatic banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br
            from-amber-500/25 via-orange-500/15 to-rose-500/20
            border border-amber-500/30 p-6 shadow-xl shadow-amber-900/20">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent animate-pulse pointer-events-none" />

            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-amber-400/80 text-xs font-bold uppercase tracking-widest mb-2">
                  🎯 Final Score Prediction
                </p>
                <p className="text-6xl sm:text-7xl font-black text-white font-mono tracking-tight">
                  {result.finalScore}
                </p>
                <p className="text-amber-400/60 text-xs mt-2">
                  Highest probability score from combined pool
                </p>
              </div>

              <button
                onClick={handleCopyFinal}
                title="Copy final score"
                className="shrink-0 flex flex-col items-center gap-1.5
                  bg-white/15 hover:bg-white/25 transition-all rounded-xl px-5 py-4 text-white border border-white/20"
              >
                <span className="text-2xl">{copied ? '✅' : '📋'}</span>
                <span className="text-[10px] font-bold">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BetBuilderPanel;
