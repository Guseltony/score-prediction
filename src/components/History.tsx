import React from 'react';
import type { HistoryEntry, PredictionMode } from '../types';
import { formatTime } from '../utils/formatTime';

const MODE_ICON: Record<PredictionMode, string> = {
  uniform: '🎲',
  poisson: '📐',
  historical: '📊',
};

interface HistoryProps {
  entries: HistoryEntry[];
  onClear: () => void;
}

/**
 * History – Session prediction history with clear option.
 */
const History: React.FC<HistoryProps> = ({ entries, onClear }) => {
  if (entries.length === 0) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">📜</span> Prediction History
          <span className="ml-1 bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {entries.length}
          </span>
        </h2>
        <button
          id="clear-history-btn"
          onClick={onClear}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200
            bg-red-600/20 border-red-500/40 text-red-300 hover:bg-red-600/40"
        >
          Clear History
        </button>
      </div>

      <div className="space-y-3">
        {[...entries].reverse().map((entry) => (
          <div
            key={entry.id}
            className="group bg-slate-700/40 border border-slate-600/30 rounded-xl p-4
              hover:border-blue-500/30 hover:bg-slate-700/60 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Match name */}
                {(entry.matchInfo.homeTeam || entry.matchInfo.awayTeam) ? (
                  <p className="text-white font-semibold text-sm truncate">
                    {entry.matchInfo.homeTeam || 'Home'}{' '}
                    <span className="text-slate-400">vs</span>{' '}
                    {entry.matchInfo.awayTeam || 'Away'}
                  </p>
                ) : (
                  <p className="text-slate-400 text-sm">No match name</p>
                )}

                {/* Suggested scores */}
                {entry.suggestedScores.length > 1 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.suggestedScores.map((s) => (
                      <span key={s} className="text-blue-300 font-mono font-bold text-xs bg-blue-600/20
                        border border-blue-500/30 rounded-lg px-2 py-0.5">
                        {s}
                      </span>
                    ))}
                    <span className="text-slate-500 text-xs self-center">tied</span>
                  </div>
                ) : null}

                {/* Meta */}
                <p className="text-slate-500 text-xs mt-1">
                  {MODE_ICON[entry.predictionMode ?? 'uniform']}{' '}
                  {entry.spinCount} spin{entry.spinCount !== 1 ? 's' : ''} ·{' '}
                  {entry.selectedScoresCount} score{entry.selectedScoresCount !== 1 ? 's' : ''} ·{' '}
                  {formatTime(entry.timestamp)}
                </p>
              </div>

              {/* Prediction badge */}
              <div className="shrink-0 bg-gradient-to-br from-blue-600 to-indigo-600
                rounded-xl px-3 py-2 text-center shadow-lg">
                <p className="text-xs text-blue-200 mb-0.5">Prediction</p>
                <p className="text-white font-black font-mono text-lg leading-none">
                  {entry.prediction}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default History;
