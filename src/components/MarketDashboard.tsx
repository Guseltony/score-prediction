import React from 'react';
import type { MarketProbabilities, PredictionMode } from '../types';

interface MarketDashboardProps {
  markets: MarketProbabilities;
  predictionMode: PredictionMode;
  homeTeam?: string;
  awayTeam?: string;
}


function getPctColor(pct: number): string {
  if (pct >= 65) return 'text-emerald-400';
  if (pct >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getBarColor(pct: number): string {
  if (pct >= 65) return 'from-emerald-600 to-emerald-400';
  if (pct >= 40) return 'from-amber-600 to-amber-400';
  return 'from-red-700 to-red-500';
}

/**
 * Individual probability card with animated fill bar.
 */
const ProbCard: React.FC<{ label: string; pct: number; icon: string; flip?: boolean }> = ({
  label, pct, icon, flip = false,
}) => {
  const color = getPctColor(pct);
  const bar = getBarColor(pct);

  return (
    <div className={`relative rounded-xl p-4 border transition-all duration-200 hover:scale-[1.02]
      bg-slate-900/50 border-slate-700/50 hover:border-slate-600/70`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
          <span>{icon}</span> {label}
        </span>
        <span className={`text-xl font-black font-mono ${color}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${bar} transition-all duration-700`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {flip && (
        <p className="text-[10px] text-slate-600 mt-1.5 text-right">
          Opposite: {(100 - pct).toFixed(0)}%
        </p>
      )}
    </div>
  );
};

/**
 * MarketDashboard – Displays aggregated betting market probabilities.
 * Shows Over/Under (1.5/2.5/3.5), BTTS, and 1X2.
 */
const MarketDashboard: React.FC<MarketDashboardProps> = ({ markets, predictionMode, homeTeam, awayTeam }) => {
  const isUniform = predictionMode === 'uniform';
  const hasFixture = homeTeam && awayTeam;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">📈</span> Market Probabilities
        </h2>
        <span className="text-xs text-cyan-300 bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-1 rounded-full font-semibold">
          V2 Feature
        </span>
      </div>

      {/* Fixture context badge */}
      {hasFixture ? (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-white bg-slate-700/60 border border-slate-600/50
            px-3 py-1.5 rounded-full flex items-center gap-1.5">
            🏟️
            <span className="text-blue-300">{homeTeam}</span>
            <span className="text-slate-500">vs</span>
            <span className="text-violet-300">{awayTeam}</span>
          </span>
        </div>
      ) : (
        <p className="text-amber-500/60 text-xs mb-2 flex items-center gap-1">
          <span>⚠️</span> No fixture selected — probabilities are based on default xG
        </p>
      )}

      <p className="text-slate-500 text-xs mb-5">
        Aggregated from all selected scorelines{isUniform ? '' : ' using model probabilities'}.
      </p>


      {/* ── Correct Score Prediction ── */}
      {markets.topScore && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>🎯</span> Correct Score Prediction
          </p>

          {/* Top pick banner */}
          <div className="relative overflow-hidden rounded-2xl p-5 mb-3
            bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700
            shadow-xl border border-white/10">
            <div className="absolute inset-0 animate-shimmer" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">
                  Top Model Pick
                </p>
                <p className="text-4xl font-black text-white font-mono tracking-wide">
                  {markets.topScore}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-white/80 text-xs">
                    {markets.topScorePct.toFixed(1)}% model probability
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/70 text-xs">
                    Fair odds ≈ {markets.topScoreOdds}
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-center bg-white/15 rounded-xl px-3 py-2 text-center">
                <span className="text-[10px] text-white/60 font-semibold uppercase">Fair Odds</span>
                <span className="text-2xl font-black text-white font-mono">{markets.topScoreOdds}</span>
              </div>
            </div>
          </div>

          {/* Runners-up */}
          {markets.runner.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {markets.runner.map((r, i) => (
                <div key={r.score}
                  className="flex items-center justify-between rounded-xl px-4 py-3
                    bg-slate-900/50 border border-slate-700/50">
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase mb-0.5">
                      #{i + 2} Pick
                    </p>
                    <p className="text-xl font-black text-slate-200 font-mono">{r.score}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{r.pct.toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-600 font-semibold uppercase mb-0.5">Fair Odds</p>
                    <p className="text-base font-black text-slate-300 font-mono">{r.odds}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 1X2 Section */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>🏆</span> Match Result (1X2)
        </p>
        <div className="grid grid-cols-3 gap-3">
          <ProbCard label="Home Win" pct={markets.homeWin * 100} icon="🏠" />
          <ProbCard label="Draw" pct={markets.draw * 100} icon="⚖️" />
          <ProbCard label="Away Win" pct={markets.awayWin * 100} icon="✈️" />
        </div>
      </div>

      {/* Over/Under Section */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>⚽</span> Over / Under Goals
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
            <p className="text-xs text-slate-500 mb-2 font-semibold">1.5 Goals</p>
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-lg font-black font-mono ${getPctColor(markets.over15 * 100)}`}>
                Over {(markets.over15 * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full bg-gradient-to-r ${getBarColor(markets.over15 * 100)} transition-all duration-700`}
                style={{ width: `${markets.over15 * 100}%` }} />
            </div>
            <p className="text-[10px] text-slate-600">Under {(markets.under15 * 100).toFixed(0)}%</p>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 ring-1 ring-blue-500/20">
            <p className="text-xs text-blue-400 mb-2 font-semibold">2.5 Goals ★</p>
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-lg font-black font-mono ${getPctColor(markets.over25 * 100)}`}>
                Over {(markets.over25 * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full bg-gradient-to-r ${getBarColor(markets.over25 * 100)} transition-all duration-700`}
                style={{ width: `${markets.over25 * 100}%` }} />
            </div>
            <p className="text-[10px] text-slate-600">Under {(markets.under25 * 100).toFixed(0)}%</p>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
            <p className="text-xs text-slate-500 mb-2 font-semibold">3.5 Goals</p>
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-lg font-black font-mono ${getPctColor(markets.over35 * 100)}`}>
                Over {(markets.over35 * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full bg-gradient-to-r ${getBarColor(markets.over35 * 100)} transition-all duration-700`}
                style={{ width: `${markets.over35 * 100}%` }} />
            </div>
            <p className="text-[10px] text-slate-600">Under {(markets.under35 * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* BTTS Section */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>🎯</span> Both Teams To Score (BTTS)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ProbCard label="BTTS Yes" pct={markets.bttsYes * 100} icon="✅" flip />
          <ProbCard label="BTTS No" pct={markets.bttsNo * 100} icon="❌" flip />
        </div>
      </div>
    </div>
  );
};

export default MarketDashboard;
