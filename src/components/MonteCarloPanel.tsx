import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { ScoreString, ProbabilityMap, PredictionMode, SimCount, MonteCarloResult } from '../types';
import { runMonteCarlo } from '../utils/monteCarlo';
import { calculateValueBet, parseOdds } from '../utils/valueBet';
import type { SmartFilterResult } from '../utils/smartFilter';

interface MonteCarloPanelProps {
  scores: ScoreString[];
  probabilities: ProbabilityMap;
  predictionMode: PredictionMode;
  smartFilter?: SmartFilterResult | null;
}

const SIM_COUNTS: SimCount[] = [100, 500, 1000, 5000];

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/**
 * MonteCarloPanel – Run N instant simulations and display ranked scoreline results.
 * Includes per-row odds input for Value Bet identification.
 */
const MonteCarloPanel: React.FC<MonteCarloPanelProps> = ({
  scores,
  probabilities,
  predictionMode,
  smartFilter,
}) => {
  const [simCount, setSimCount] = useState<SimCount>(1000);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [copied, setCopied] = useState(false);
  // Per-row bookmaker odds
  const [oddsMap, setOddsMap] = useState<Record<ScoreString, string>>({});

  // Detect fixture/probability changes → mark result as stale
  const prevKey = useRef('');
  useEffect(() => {
    const key = scores.join(',') + JSON.stringify(probabilities);
    if (prevKey.current && prevKey.current !== key) {
      setIsStale(true);
    }
    prevKey.current = key;
  }, [scores, probabilities]);

  const handleSimulate = useCallback(async () => {
    if (scores.length === 0) return;
    setRunning(true);
    setResult(null);
    setIsStale(false);
    // Allow a brief render tick before heavy computation
    await new Promise((r) => setTimeout(r, 30));

    // If smart filter is active, only simulate on kept scores
    const simScores = smartFilter
      ? scores.filter((s) => smartFilter.kept.has(s))
      : scores;

    // Rebuild a normalised probability map for the filtered set
    const filteredProbs: ProbabilityMap = {};
    let total = 0;
    for (const s of simScores) {
      filteredProbs[s] = probabilities[s] ?? 0;
      total += filteredProbs[s];
    }
    if (total > 0) {
      for (const s of simScores) filteredProbs[s] /= total;
    }

    const res = runMonteCarlo(simScores, filteredProbs, simCount);
    setResult(res);
    setRunning(false);
  }, [scores, probabilities, simCount, smartFilter]);

  const handleCopyTop = useCallback(() => {
    if (!result) return;
    const top = result.ranked[0];
    navigator.clipboard.writeText(top.score).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  const showModelPct = predictionMode !== 'uniform';
  const eliminatedCount = smartFilter ? smartFilter.eliminated.size : 0;

  // Top pick derived values
  const topPick = result?.ranked[0];
  const topPickConfidence = topPick
    ? topPick.pct < 8 ? 'Low' : topPick.pct < 15 ? 'Moderate' : 'High'
    : null;
  const topPickColor = topPickConfidence === 'High'
    ? 'from-emerald-600 to-emerald-500'
    : topPickConfidence === 'Moderate'
    ? 'from-amber-600 to-amber-500'
    : 'from-slate-600 to-slate-500';

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🔬</span> Monte Carlo Simulation
        </h2>
        <span className="text-xs text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2.5 py-1 rounded-full font-semibold">
          V2 Feature
        </span>
      </div>
      <p className="text-slate-500 text-xs mb-5">
        Run thousands of instant weighted simulations to find the most statistically likely scores.
      </p>

      {/* Sim count selector + Run button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1.5 flex-1">
          {SIM_COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => setSimCount(n)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-150
                ${simCount === n
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                }`}
            >
              {n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
        </div>

        <button
          id="run-monte-carlo-btn"
          onClick={handleSimulate}
          disabled={running || scores.length === 0}
          className={`relative overflow-hidden group flex items-center justify-center gap-2
            px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200
            ${running || scores.length === 0
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-violet-500 hover:-translate-y-0.5 active:translate-y-0'
            }`}
        >
          {!running && (
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700
              bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          )}
          {running ? <><Spinner /> Simulating…</> : <><span>⚡</span> Simulate {simCount >= 1000 ? `${simCount / 1000}k` : simCount}×</>}
        </button>
      </div>

      {/* Stale warning */}
      {isStale && result && !running && (
        <div className="flex items-center justify-between gap-2 text-xs
          bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 mb-4 animate-fade-in">
          <div className="flex items-center gap-2 text-amber-400">
            <span>⚠️</span>
            <span>Fixture or settings changed — results may be outdated.</span>
          </div>
          <button
            onClick={handleSimulate}
            className="text-xs font-bold text-amber-300 hover:text-white bg-amber-500/20
              hover:bg-amber-500/40 px-3 py-1 rounded-lg transition-all"
          >
            Re-run ↻
          </button>
        </div>
      )}

      {/* Smart filter notice */}
      {smartFilter && eliminatedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20
          rounded-xl px-3 py-2 mb-4">
          <span>🔍</span>
          Smart Filter active — simulating on <strong className="text-amber-300">{smartFilter.kept.size}</strong> scores
          ({eliminatedCount} eliminated)
        </div>
      )}

      {/* Loading state */}
      {running && (
        <div className="flex flex-col items-center gap-3 py-10 animate-pulse">
          <div className="text-4xl animate-spin">⚙️</div>
          <p className="text-slate-400 text-sm">Running {simCount.toLocaleString()} simulations…</p>
        </div>
      )}

      {/* Results */}
      {result && !running && (
        <div className="animate-fade-in space-y-4">

          {/* ── Top Pick Prediction Banner ── */}
          {topPick && (
            <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${topPickColor}
              shadow-xl border border-white/10`}>
              <div className="absolute inset-0 animate-shimmer" />
              <div className="relative flex items-center justify-between gap-4">
                <div>
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                    🎯 Top Simulation Prediction
                  </p>
                  <p className="text-4xl font-black text-white font-mono tracking-wide">
                    {topPick.score}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-white/80 text-xs">
                      {topPick.pct.toFixed(1)}% of {result.simCount.toLocaleString()} simulations
                    </span>
                    <span className="text-white/40">·</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                      bg-white/20 text-white`}>
                      {topPickConfidence} Confidence
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCopyTop}
                  title="Copy top score to clipboard"
                  className="shrink-0 flex flex-col items-center gap-1 bg-white/20 hover:bg-white/30
                    transition-all rounded-xl px-4 py-3 text-white"
                >
                  <span className="text-xl">{copied ? '✅' : '📋'}</span>
                  <span className="text-[10px] font-semibold">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
            <span className="text-purple-400 font-semibold">{result.simCount.toLocaleString()} simulations</span>
            <span>·</span>
            <span>{result.ranked.length} unique scores</span>
            <span>·</span>
            <span className="text-slate-400">Enter bookie odds to find value bets →</span>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-700/60">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">#</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-3">Score</th>
                  <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-3">Sim %</th>
                  {showModelPct && (
                    <th className="text-center text-xs font-semibold text-amber-400/70 uppercase tracking-wider px-3 py-3 hidden sm:table-cell">
                      Model %
                    </th>
                  )}
                  <th className="text-center text-xs font-semibold text-emerald-400/70 uppercase tracking-wider px-3 py-3">
                    Odds
                  </th>
                  <th className="text-center text-xs font-semibold text-emerald-400/70 uppercase tracking-wider px-3 py-3 hidden md:table-cell">
                    EV
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {result.ranked.map(({ score, count, pct, modelPct }, idx) => {
                  const oddsInput = oddsMap[score] ?? '';
                  const parsedOdds = parseOdds(oddsInput);
                  const vb = parsedOdds
                    ? calculateValueBet(parsedOdds, (showModelPct ? modelPct : pct) / 100)
                    : null;
                  const isTop = idx === 0;
                  const isValue = vb?.isValue === true;
                  const isStrong = vb?.isStrongValue === true;

                  return (
                    <tr
                      key={score}
                      className={`transition-colors duration-150
                        ${isStrong
                          ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20'
                          : isValue
                          ? 'bg-emerald-500/5'
                          : isTop
                          ? 'bg-purple-600/10'
                          : 'hover:bg-slate-700/30'
                        }`}
                    >
                      {/* Rank */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${isTop ? 'text-purple-300' : 'text-slate-500'}`}>
                          {idx + 1}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold text-base ${isTop ? 'text-purple-300' : isValue ? 'text-emerald-300' : 'text-white'}`}>
                            {score}
                          </span>
                          {isTop && <span className="text-[10px] bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/30">Top</span>}
                          {isStrong && <span className="text-[10px] bg-emerald-600/30 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">🔥 Value</span>}
                          {isValue && !isStrong && <span className="text-[10px] bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20">+EV</span>}
                        </div>
                        {/* Bar */}
                        <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden w-full min-w-[60px]">
                          <div
                            className={`h-full rounded-full ${isStrong ? 'bg-emerald-500' : isTop ? 'bg-purple-500' : 'bg-slate-500'}`}
                            style={{ width: `${Math.min(pct * 3, 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Sim % */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold ${isTop ? 'text-purple-300' : 'text-slate-300'}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Model % */}
                      {showModelPct && (
                        <td className="px-3 py-3 text-center hidden sm:table-cell">
                          <span className="text-sm text-amber-400">{modelPct.toFixed(1)}%</span>
                        </td>
                      )}

                      {/* Odds Input */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min="1.01"
                          step="0.5"
                          placeholder="e.g. 8.0"
                          value={oddsInput}
                          onChange={(e) => setOddsMap((prev) => ({ ...prev, [score]: e.target.value }))}
                          className={`w-20 text-center text-xs font-mono rounded-lg px-2 py-1 border transition-all duration-200
                            bg-slate-900/70 text-white placeholder-slate-600
                            focus:outline-none focus:ring-1
                            ${isStrong
                              ? 'border-emerald-500/60 focus:ring-emerald-500/30'
                              : isValue
                              ? 'border-emerald-500/40 focus:ring-emerald-500/20'
                              : 'border-slate-600 focus:ring-blue-500/30'
                            }`}
                        />
                      </td>

                      {/* EV */}
                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        {vb ? (
                          <div>
                            <span className={`text-xs font-bold ${vb.isStrongValue ? 'text-emerald-400' : vb.isValue ? 'text-emerald-500/80' : 'text-red-400'}`}>
                              {vb.isValue ? '+' : ''}{(vb.expectedValue * 100).toFixed(1)}%
                            </span>
                            <div className={`text-[10px] ${vb.isValue ? 'text-emerald-600' : 'text-red-600'}`}>
                              {vb.isValue ? 'edge' : 'no edge'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Top simulation result
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Value bet detected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60 inline-block" /> Model probability
            </span>
          </div>
        </div>
      )}

      {!result && !running && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="text-4xl opacity-40">🔬</div>
          <p className="text-slate-500 text-sm">Click <strong className="text-slate-300">Simulate</strong> to run the engine</p>
          <p className="text-slate-600 text-xs max-w-xs">
            1,000 simulations converge very close to the theoretical Poisson distribution — eliminating random noise from individual spins.
          </p>
        </div>
      )}
    </div>
  );
};

export default MonteCarloPanel;
