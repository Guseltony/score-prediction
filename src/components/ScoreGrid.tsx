import React from 'react';
import type { ProbabilityMap, PredictionMode, ScoreString } from '../types';

interface ScoreGridProps {
  scores: ScoreString[];
  selectedScores: Set<ScoreString>;
  probabilities?: ProbabilityMap;
  predictionMode: PredictionMode;
  onToggle: (score: ScoreString) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

/**
 * ScoreGrid – Selectable score chips with an optional probability heatmap.
 * When mode is 'poisson' or 'historical', chips are tinted by likelihood.
 */
const ScoreGrid: React.FC<ScoreGridProps> = ({
  scores,
  selectedScores,
  probabilities = {},
  predictionMode,
  onToggle,
  onSelectAll,
  onClearAll,
}) => {
  const allSelected = scores.length > 0 && selectedScores.size === scores.length;
  const noneSelected = selectedScores.size === 0;
  const showHeatmap = predictionMode !== 'uniform' && scores.length > 0;

  // Normalise probabilities to 0–1 range relative to the max for visual scaling
  // Use reduce instead of spread to safely handle large arrays
  const maxProb = showHeatmap && Object.keys(probabilities).length > 0
    ? scores.reduce((max, s) => Math.max(max, probabilities[s] ?? 0), 0)
    : 1;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🎯</span> Score Selection
            <span className="bg-blue-600/30 text-blue-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-500/30">
              {selectedScores.size}/{scores.length}
            </span>
          </h2>
          {showHeatmap && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-500/10
              border border-amber-500/20 rounded-full px-2.5 py-1">
              <span>🌡️</span> Heatmap on
            </span>
          )}
        </div>

        {/* Bulk actions */}
        <div className="flex gap-2">
          <button
            id="select-all-btn"
            onClick={onSelectAll}
            disabled={allSelected}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200
              bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/40
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Select All
          </button>
          <button
            id="clear-all-btn"
            onClick={onClearAll}
            disabled={noneSelected}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200
              bg-red-600/20 border-red-500/40 text-red-300 hover:bg-red-600/40
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Score chip grid */}
      <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {scores.map((score) => {
          const isSelected = selectedScores.has(score);
          const prob = probabilities[score] ?? 0;
          const relativeIntensity = maxProb > 0 ? prob / maxProb : 0;

          // Heatmap glow: stronger blue for higher probability when NOT selected
          const heatmapBg = showHeatmap && !isSelected
            ? `rgba(59, 130, 246, ${relativeIntensity * 0.35})`
            : undefined;

          const probPct = showHeatmap ? (prob * 100).toFixed(1) : null;

          return (
            <button
              key={score}
              id={`score-chip-${score}`}
              onClick={() => onToggle(score)}
              title={
                showHeatmap
                  ? `${score} — ${probPct}% probability${isSelected ? ' (selected)' : ''}`
                  : `${isSelected ? 'Deselect' : 'Select'} ${score}`
              }
              style={heatmapBg ? { background: heatmapBg } : undefined}
              className={`relative group flex flex-col items-center justify-center rounded-xl text-xs font-bold
                transition-all duration-200 hover:scale-105 active:scale-95 py-1.5 px-1
                ${isSelected
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 ring-2 ring-blue-400/40'
                  : 'text-slate-300 hover:text-white border border-slate-600/50 hover:border-slate-500'
                }`}
            >
              {isSelected && (
                <span className="absolute top-0.5 right-0.5 text-[7px] text-blue-200">✓</span>
              )}
              <span className="text-xs font-bold leading-none">{score}</span>
              {showHeatmap && (
                <span className={`text-[9px] mt-0.5 font-medium leading-none
                  ${isSelected ? 'text-blue-200' : relativeIntensity > 0.5 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {probPct}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {scores.length === 0 && (
        <div className="text-center text-slate-500 py-8">
          Set a maximum goals value and click Regenerate
        </div>
      )}

      {/* Selection progress bar */}
      {scores.length > 0 && (
        <div className="mt-5">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>{selectedScores.size} selected</span>
            <span>{Math.round((selectedScores.size / scores.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(selectedScores.size / scores.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Heatmap legend */}
      {showHeatmap && scores.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-slate-500">Probability:</span>
          <div className="flex items-center gap-1 flex-1 max-w-[200px]">
            <span className="text-xs text-slate-600">Low</span>
            <div className="flex-1 h-2 rounded-full"
              style={{ background: 'linear-gradient(to right, rgba(59,130,246,0.05), rgba(59,130,246,0.35))' }} />
            <span className="text-xs text-amber-400">High</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreGrid;
