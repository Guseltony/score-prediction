import React from 'react';
import type { ParsedMatchOdds, ParsedCorrectScoreOdds } from '../api/types';
import type { ProbabilityMap } from '../types';
import { stripMatchOddsVig } from '../utils/oddsBlend';

interface OddsDashboardPanelProps {
  matchOdds: ParsedMatchOdds | null;
  correctScoreOdds: ParsedCorrectScoreOdds;
  modelProbabilities: ProbabilityMap;
  bookmakerName: string;
  isLoading: boolean;
  onPrefilledOddsChange: (odds: Record<string, number>) => void;
}

// ─── Edge badge ───────────────────────────────────────────────────────────────

const EdgeBadge: React.FC<{ edgePct: number }> = ({ edgePct }) => {
  if (Math.abs(edgePct) < 1) {
    return <span className="text-slate-500 text-xs">≈ Neutral</span>;
  }
  const positive = edgePct > 0;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
      positive
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'bg-red-500/20 text-red-400 border border-red-500/30'
    }`}>
      {positive ? '+' : ''}{edgePct.toFixed(1)}%
    </span>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

const OddsDashboardPanel: React.FC<OddsDashboardPanelProps> = ({
  matchOdds,
  correctScoreOdds,
  modelProbabilities,
  bookmakerName,
  isLoading,
  onPrefilledOddsChange,
}) => {
  // Notify parent of correct score odds for MonteCarloPanel pre-fill
  React.useEffect(() => {
    onPrefilledOddsChange(correctScoreOdds);
  }, [correctScoreOdds]);

  if (isLoading) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📡</span>
          <h2 className="text-lg font-bold text-white">Bookmaker Odds</h2>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-700/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!matchOdds && Object.keys(correctScoreOdds).length === 0) {
    return null;
  }

  // Vig-stripped match odds
  const stripped = matchOdds ? stripMatchOddsVig(matchOdds) : null;

  // Model's 1X2 derived from score probabilities
  let modelHomeWin = 0, modelDraw = 0, modelAwayWin = 0;
  for (const [score, prob] of Object.entries(modelProbabilities)) {
    const [h, a] = score.split('-').map(Number);
    if (h > a) modelHomeWin += prob;
    else if (h === a) modelDraw += prob;
    else modelAwayWin += prob;
  }

  // Top correct score odds vs model
  const csEntries = Object.entries(correctScoreOdds)
    .map(([score, odds]) => ({
      score,
      bookieOdds: odds,
      bookieImplied: (1 / odds) * 100,
      modelPct: (modelProbabilities[score] ?? 0) * 100,
      edgePct: (modelProbabilities[score] ?? 0) * 100 - (1 / odds) * 100,
    }))
    .sort((a, b) => b.modelPct - a.modelPct)
    .slice(0, 8);

  const matchRows = stripped
    ? [
        {
          label: 'Home Win',
          icon: '🏠',
          bookieOdds: matchOdds!.homeWin,
          bookieImplied: stripped.homeWin * 100,
          modelPct: modelHomeWin * 100,
          edgePct: (modelHomeWin - stripped.homeWin) * 100,
        },
        {
          label: 'Draw',
          icon: '🤝',
          bookieOdds: matchOdds!.draw,
          bookieImplied: stripped.draw * 100,
          modelPct: modelDraw * 100,
          edgePct: (modelDraw - stripped.draw) * 100,
        },
        {
          label: 'Away Win',
          icon: '✈️',
          bookieOdds: matchOdds!.awayWin,
          bookieImplied: stripped.awayWin * 100,
          modelPct: modelAwayWin * 100,
          edgePct: (modelAwayWin - stripped.awayWin) * 100,
        },
      ]
    : [];

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📡</span>
          <div>
            <h2 className="text-lg font-bold text-white">Bookmaker Odds</h2>
            {bookmakerName && (
              <p className="text-xs text-slate-500">Source: {bookmakerName}</p>
            )}
          </div>
        </div>
        {stripped && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Overround</p>
            <p className="text-sm font-bold text-amber-400">{stripped.overround.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* 1X2 Comparison */}
      {matchRows.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Match Result (1X2) — Vig-Stripped vs Model
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left pb-2">Market</th>
                  <th className="text-right pb-2">Bookie Odds</th>
                  <th className="text-right pb-2">Bookie %</th>
                  <th className="text-right pb-2">Model %</th>
                  <th className="text-right pb-2">Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {matchRows.map((row) => (
                  <tr key={row.label}
                    className={`transition-colors ${row.edgePct > 3 ? 'bg-emerald-500/5' : ''}`}>
                    <td className="py-2.5 text-slate-300 flex items-center gap-1.5">
                      <span>{row.icon}</span> {row.label}
                    </td>
                    <td className="py-2.5 text-right font-mono text-white">
                      {row.bookieOdds.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right text-slate-400">
                      {row.bookieImplied.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right text-blue-300">
                      {row.modelPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right">
                      <EdgeBadge edgePct={row.edgePct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Correct Score top picks */}
      {csEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Correct Score — Model vs Bookie (Top 8)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left pb-2">Score</th>
                  <th className="text-right pb-2">Bookie Odds</th>
                  <th className="text-right pb-2">Bookie %</th>
                  <th className="text-right pb-2">Model %</th>
                  <th className="text-right pb-2">Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {csEntries.map((row) => (
                  <tr key={row.score}
                    className={`transition-colors ${row.edgePct > 1 ? 'bg-emerald-500/5' : ''}`}>
                    <td className="py-2 font-mono font-bold text-white">{row.score}</td>
                    <td className="py-2 text-right font-mono text-slate-300">
                      {row.bookieOdds.toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-slate-400">
                      {row.bookieImplied.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right text-blue-300">
                      {row.modelPct.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right">
                      <EdgeBadge edgePct={row.edgePct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600 mt-3">
            ✅ Green rows = model finds value vs bookmaker · Edge = Model% − Bookie%
          </p>
        </div>
      )}
    </div>
  );
};

export default OddsDashboardPanel;
