import React from 'react';
import type { MatchInfo, ScoreString, PredictionMode, ProbabilityMap } from '../types';
import { formatTime } from '../utils/formatTime';

interface SuggestionCardProps {
  matchInfo: MatchInfo;
  selectedCount: number;
  totalSpins: number;
  suggestedScores: ScoreString[];
  singleResult: ScoreString | null;
  generatedAt: Date | null;
  predictionMode: PredictionMode;
  probabilities?: ProbabilityMap;
}

const MODE_BADGE: Record<PredictionMode, { label: string; color: string }> = {
  uniform:        { label: '🎲 Uniform',      color: 'bg-slate-600/40 text-slate-300 border-slate-500/40' },
  poisson:        { label: '📐 Poisson',      color: 'bg-blue-600/30 text-blue-300 border-blue-500/40' },
  historical:     { label: '📊 Historical',   color: 'bg-amber-600/30 text-amber-300 border-amber-500/40' },
  'odds-blended': { label: '📡 Odds-Blended', color: 'bg-violet-600/30 text-violet-300 border-violet-500/40' },
};

/**
 * SuggestionCard – Match summary with prediction confidence and mode indicator.
 */
const SuggestionCard: React.FC<SuggestionCardProps> = ({
  matchInfo,
  selectedCount,
  totalSpins,
  suggestedScores,
  singleResult,
  generatedAt,
  predictionMode,
  probabilities = {},
}) => {
  const { homeTeam, awayTeam } = matchInfo;
  const hasSuggestion = suggestedScores.length > 0 || singleResult;
  if (!hasSuggestion) return null;

  const displayScore = suggestedScores.length > 0 ? suggestedScores[0] : singleResult!;
  const confidencePct = ((probabilities[displayScore] ?? 0) * 100);
  const showConfidence = predictionMode !== 'uniform' && confidencePct > 0;
  const badge = MODE_BADGE[predictionMode];

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-blue-900/30 to-indigo-900/30
      border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm shadow-2xl shadow-blue-900/20">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📋</span> Match Summary
          </h2>
          {/* Mode badge */}
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {/* Match vs banner */}
        {homeTeam && awayTeam && (
          <div className="flex items-center justify-center gap-3 bg-slate-700/40 rounded-xl px-4 py-3 mb-5">
            <span className="text-white font-semibold truncate max-w-[140px]">{homeTeam}</span>
            <span className="text-blue-400 font-black text-xs px-2 py-0.5 bg-blue-500/20 rounded-full shrink-0">VS</span>
            <span className="text-white font-semibold truncate max-w-[140px]">{awayTeam}</span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatItem label="Selected Scores" value={selectedCount} icon="🎯" />
          <StatItem label="Total Spins" value={totalSpins} icon="🎰" />
          <StatItem label="Suggestions" value={suggestedScores.length || 1} icon="🏆" />
          <StatItem label="Generated" value={generatedAt ? formatTime(generatedAt) : '—'} icon="🕐" />
        </div>

        {/* Main suggestion */}
        <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20
          border border-blue-500/30 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-300/70 font-semibold uppercase tracking-wider mb-1">
                Suggested Prediction
              </p>
              <p className="text-4xl font-black text-white font-mono">{displayScore}</p>
              {suggestedScores.length > 1 && (
                <p className="text-xs text-slate-400 mt-1">
                  +{suggestedScores.length - 1} more tied score{suggestedScores.length > 2 ? 's' : ''}
                </p>
              )}
            </div>
            <span className="text-5xl">🏆</span>
          </div>

          {/* Confidence score */}
          {showConfidence && (
            <div className="mt-4 pt-4 border-t border-blue-500/20">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Model confidence</span>
                <span className={`font-bold ${confidencePct >= 10 ? 'text-green-400' : confidencePct >= 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {confidencePct.toFixed(2)}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700
                    ${confidencePct >= 10 ? 'bg-green-500' : confidencePct >= 5 ? 'bg-amber-500' : 'bg-slate-500'}`}
                  style={{ width: `${Math.min(confidencePct * 5, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                {confidencePct >= 10
                  ? 'High probability score — strong statistical backing.'
                  : confidencePct >= 5
                  ? 'Moderate probability — reasonable prediction.'
                  : 'Low probability — unlikely but possible.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface StatItemProps {
  label: string;
  value: number | string;
  icon: string;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, icon }) => (
  <div className="bg-slate-700/40 rounded-xl p-3 text-center border border-slate-600/30">
    <div className="text-xl mb-1">{icon}</div>
    <div className="text-lg font-bold text-white">{value}</div>
    <div className="text-xs text-slate-400">{label}</div>
  </div>
);

export default SuggestionCard;
