import React from 'react';
import type { SpinSession, ProbabilityMap, PredictionMode } from '../types';
import { getSortedFrequency } from '../utils/countFrequency';

interface FrequencyTableProps {
  session: SpinSession;
  isSpinning: boolean;
  probabilities?: ProbabilityMap;
  predictionMode: PredictionMode;
}

const MODE_LABELS: Record<PredictionMode, string> = {
  uniform: 'Theoretical',
  poisson: 'Poisson %',
  historical: 'Historical %',
  'odds-blended': 'Blended %',
};

/**
 * FrequencyTable – Shows results from a multi-spin session.
 * Includes a theoretical probability column when using Poisson or Historical mode.
 */
const FrequencyTable: React.FC<FrequencyTableProps> = ({
  session,
  isSpinning,
  probabilities = {},
  predictionMode,
}) => {
  const { results, frequency, suggestedScores } = session;
  const sortedEntries = getSortedFrequency(frequency);
  const maxCount = sortedEntries[0]?.[1] ?? 0;
  const showTheory = predictionMode !== 'uniform';
  const n = session.spinCount;

  if (isSpinning) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <span className="text-2xl">📊</span> {n}-Spin Results
        </h2>
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="text-5xl animate-spin">⚽</div>
          <p className="text-slate-400 animate-pulse">Running {n} spins…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
        <span className="text-2xl">📊</span> {n}-Spin Results
      </h2>

      {/* Individual spin results — collapsed if > 20 */}
      {n <= 20 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Individual Spins
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {results.map(({ spinNumber, score }) => (
              <div
                key={spinNumber}
                className="bg-slate-700/60 rounded-xl p-2 text-center border border-slate-600/30
                  hover:border-blue-500/40 transition-all duration-200"
              >
                <p className="text-xs text-slate-500 mb-0.5">Spin {spinNumber}</p>
                <p className="text-white font-bold font-mono">{score}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {n > 20 && (
        <p className="text-xs text-slate-500 mb-4 italic">
          {n} individual results hidden — see frequency table below.
        </p>
      )}

      {/* Frequency Table */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Frequency Table
        </h3>
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700/60">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Score</th>
                <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-3">Count</th>
                <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-3">Actual %</th>
                {showTheory && (
                  <th className="text-center text-xs font-semibold text-amber-400/70 uppercase tracking-wider px-3 py-3">
                    {MODE_LABELS[predictionMode]}
                  </th>
                )}
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                  Distribution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sortedEntries.map(([score, count]) => {
                const isTop = count === maxCount;
                const actualPct = ((count / n) * 100).toFixed(1);
                const theoryPct = showTheory
                  ? ((probabilities[score] ?? 0) * 100).toFixed(1)
                  : null;

                return (
                  <tr
                    key={score}
                    className={`transition-colors duration-150 ${isTop ? 'bg-blue-600/10' : 'hover:bg-slate-700/30'}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`font-mono font-bold text-base ${isTop ? 'text-blue-300' : 'text-white'}`}>
                        {score}
                      </span>
                      {isTop && (
                        <span className="ml-2 text-xs bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-500/30">
                          Top
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-bold ${isTop ? 'text-blue-300' : 'text-slate-300'}`}>{count}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-sm font-semibold ${isTop ? 'text-blue-300' : 'text-slate-400'}`}>
                        {actualPct}%
                      </span>
                    </td>
                    {showTheory && (
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-semibold text-amber-400">{theoryPct}%</span>
                      </td>
                    )}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isTop ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-slate-500'}`}
                            style={{ width: `${(count / n) * 100}%` }}
                          />
                        </div>
                        {showTheory && (
                          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className="h-full rounded-full bg-amber-500/60 transition-all duration-500"
                              style={{ width: `${(probabilities[score] ?? 0) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {showTheory && (
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded bg-blue-500 inline-block" /> Actual frequency
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded bg-amber-500/60 inline-block" /> {MODE_LABELS[predictionMode]}
            </span>
          </div>
        )}
      </div>

      {/* Suggested prediction */}
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🏆</span>
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
            Suggested Prediction
          </h3>
        </div>

        {suggestedScores.length === 1 ? (
          <div>
            <p className="text-3xl font-black text-white font-mono">{suggestedScores[0]}</p>
            {showTheory && (
              <p className="text-xs text-amber-400/60 mt-1">
                Model probability: {((probabilities[suggestedScores[0]] ?? 0) * 100).toFixed(2)}%
              </p>
            )}
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-3 mb-2">
              {suggestedScores.map((score) => (
                <span key={score} className="text-2xl font-black text-white font-mono bg-amber-500/20
                  border border-amber-500/30 rounded-xl px-4 py-2">
                  {score}
                </span>
              ))}
            </div>
            <p className="text-amber-400/70 text-xs">
              Tied at {maxCount} occurrence{maxCount !== 1 ? 's' : ''} each
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FrequencyTable;
