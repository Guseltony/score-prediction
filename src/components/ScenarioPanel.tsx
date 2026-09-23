import React, { useMemo, useState } from 'react';
import type { ScoreString, ProbabilityMap } from '../types';
import { computeScenarios } from '../utils/scenarioEngine';
import type { RiskLevel, ScenarioBucket, ScenarioResult } from '../utils/scenarioEngine';
import type { MatchIntelligenceInput } from '../utils/matchIntelligence';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScenarioPanelProps {
  scores: ScoreString[];
  probabilities: ProbabilityMap;
  adjustedHomeXG: number;
  adjustedAwayXG: number;
  homeTeam?: string;
  awayTeam?: string;
  intelligence?: Partial<MatchIntelligenceInput>;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskLevel, { badge: string; glow: string; icon: string }> = {
  LOW:    { badge: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', glow: 'shadow-emerald-900/30', icon: '🟢' },
  MEDIUM: { badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300',       glow: 'shadow-amber-900/30',   icon: '🟡' },
  HIGH:   { badge: 'bg-rose-500/20 border-rose-500/40 text-rose-300',          glow: 'shadow-rose-900/30',    icon: '🔴' },
};

const CONFIDENCE_STYLES: Record<RiskLevel, { color: string; bar: string }> = {
  HIGH:   { color: 'text-emerald-400', bar: 'bg-emerald-500' },
  MEDIUM: { color: 'text-amber-400',   bar: 'bg-amber-500'   },
  LOW:    { color: 'text-rose-400',    bar: 'bg-rose-500'     },
};

const BUCKET_THEME = {
  mostLikely: {
    border: 'border-blue-500/40',
    bg: 'bg-gradient-to-br from-blue-950/40 via-indigo-950/20 to-slate-900',
    header: 'text-blue-300',
    bar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    scorePill: 'bg-blue-500/15 border-blue-500/30 text-blue-200',
    topPill: 'bg-blue-600/40 border-blue-400/50 text-blue-100 font-black shadow-sm',
  },
  upset: {
    border: 'border-amber-500/40',
    bg: 'bg-gradient-to-br from-amber-950/40 via-orange-950/20 to-slate-900',
    header: 'text-amber-300',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
    scorePill: 'bg-amber-500/15 border-amber-500/30 text-amber-200',
    topPill: 'bg-amber-600/40 border-amber-400/50 text-amber-100 font-black shadow-sm',
  },
  volatile: {
    border: 'border-rose-500/40',
    bg: 'bg-gradient-to-br from-rose-950/40 via-red-950/20 to-slate-900',
    header: 'text-rose-300',
    bar: 'bg-gradient-to-r from-rose-500 to-red-500',
    scorePill: 'bg-rose-500/15 border-rose-500/30 text-rose-200',
    topPill: 'bg-rose-600/40 border-rose-400/50 text-rose-100 font-black shadow-sm',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface BucketCardProps {
  bucket: ScenarioBucket;
  theme: typeof BUCKET_THEME[keyof typeof BUCKET_THEME];
  showFull: boolean;
}

const BucketCard: React.FC<BucketCardProps> = ({ bucket, theme }) => {
  const pct = Math.round(bucket.combinedProbability * 100);

  return (
    <div className={`rounded-2xl border p-4 transition-all duration-300 shadow-md ${theme.border} ${theme.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{bucket.emoji}</span>
          <div>
            <p className={`text-xs font-black uppercase tracking-wider ${theme.header}`}>
              {bucket.label}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{bucket.description}</p>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-full border ${theme.topPill}`}>
          {pct}%
        </span>
      </div>

      {/* Probability bar */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ${theme.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Score pills */}
      {bucket.scores.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {bucket.scores.map(s => (
            <span
              key={s}
              className={`font-mono text-xs font-bold px-2.5 py-1 rounded-xl border
                transition-all ${s === bucket.topScore ? theme.topPill : theme.scorePill}`}
            >
              {s === bucket.topScore && <span className="mr-1">★</span>}
              {s}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-slate-600">No scores in this bucket</p>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ScenarioPanel: React.FC<ScenarioPanelProps> = ({
  scores,
  probabilities,
  adjustedHomeXG,
  adjustedAwayXG,
  homeTeam,
  awayTeam,
  intelligence,
}) => {
  const [open, setOpen] = useState(true);

  const result: ScenarioResult | null = useMemo(() => {
    if (scores.length === 0) return null;
    return computeScenarios(
      scores,
      probabilities,
      adjustedHomeXG,
      adjustedAwayXG,
      intelligence,
    );
  }, [scores, probabilities, adjustedHomeXG, adjustedAwayXG, intelligence]);

  if (!result) return null;

  const riskStyle = RISK_STYLES[result.upsetRisk];
  const confStyle = CONFIDENCE_STYLES[result.modelConfidence];
  const confPct = result.modelConfidence === 'HIGH' ? 85 : result.modelConfidence === 'MEDIUM' ? 55 : 25;

  const favLabel =
    result.favourite === 'home' ? homeTeam || 'Home Team'
    : result.favourite === 'away' ? awayTeam || 'Away Team'
    : 'Evenly Matched';

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">

      {/* ── Collapsible header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎲</span>
          <div className="text-left">
            <p className="text-sm font-black text-white">Scenario Engine Breakdown</p>
            <p className="text-xs text-slate-400">
              Most Likely · Upset · Volatile Matrix · Upset Risk:{' '}
              <span className={riskStyle.badge.includes('emerald') ? 'text-emerald-400 font-bold' : riskStyle.badge.includes('amber') ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>
                {result.upsetRisk}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black px-3 py-1 rounded-full border ${riskStyle.badge}`}>
            {riskStyle.icon} {result.upsetRisk} RISK
          </span>
          <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-4 border-t border-slate-700/50">

          {/* ── Outlook banner ── */}
          <div className="mt-4 bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4">
            <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>📋</span> Tactical Scenario Outlook
            </p>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{result.outlook}</p>
          </div>

          {/* ── Favourite + xG split ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3.5 text-center">
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">
                🏠 {homeTeam || 'Home'} xG
              </p>
              <p className="text-2xl font-black text-blue-300 font-mono">{adjustedHomeXG.toFixed(2)}</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Favoured</p>
              <p className="text-xs font-black text-white text-center truncate max-w-full px-1">{favLabel}</p>
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskStyle.badge}`}>
                {riskStyle.icon} {result.upsetRisk}
              </div>
            </div>
            <div className="col-span-1 bg-purple-500/10 border border-purple-500/30 rounded-2xl p-3.5 text-center">
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1">
                ✈️ {awayTeam || 'Away'} xG
              </p>
              <p className="text-2xl font-black text-purple-300 font-mono">{adjustedAwayXG.toFixed(2)}</p>
            </div>
          </div>

          {/* ── Three scenario cards ── */}
          <div className="space-y-3">
            <BucketCard bucket={result.mostLikely} theme={BUCKET_THEME.mostLikely} showFull={true} />
            <BucketCard bucket={result.upset}      theme={BUCKET_THEME.upset}      showFull={true} />
            <BucketCard bucket={result.volatile}   theme={BUCKET_THEME.volatile}   showFull={true} />
          </div>

          {/* ── Upset Risk detail ── */}
          <div className={`rounded-2xl border p-4 ${
            riskStyle.badge.includes('emerald')
              ? 'bg-emerald-950/30 border-emerald-500/30'
              : riskStyle.badge.includes('amber')
              ? 'bg-amber-950/30 border-amber-500/30'
              : 'bg-rose-950/30 border-rose-500/30'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs font-black uppercase tracking-wider ${
                riskStyle.badge.includes('emerald') ? 'text-emerald-400'
                : riskStyle.badge.includes('amber') ? 'text-amber-400'
                : 'text-rose-400'
              }`}>
                {riskStyle.icon} Upset Risk Factor: {result.upsetRisk}
              </p>
            </div>
            {result.activeFactors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {result.activeFactors.map(f => (
                  <span key={f} className="text-[10px] bg-slate-900/80 border border-slate-700/60
                    text-slate-300 px-2.5 py-1 rounded-xl font-bold">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Model Confidence ── */}
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                📊 Model Confidence
              </p>
              <span className={`text-xs font-black ${confStyle.color}`}>
                {result.modelConfidence}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${confStyle.bar}`}
                style={{ width: `${confPct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioPanel;
