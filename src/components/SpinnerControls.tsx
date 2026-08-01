import React from 'react';
import type { SpinCount } from '../types';

interface SpinnerControlsProps {
  disabled: boolean;
  isSpinning: boolean;
  onSpinOnce: () => void;
  onSpinMulti: () => void;
  multiSpinCount: SpinCount;
  onMultiSpinCountChange: (count: SpinCount) => void;
  selectedCount: number;
}

const SPIN_COUNTS: SpinCount[] = [5, 10, 20, 50, 100];

const Spinner = () => (
  <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/**
 * SpinnerControls – Spin Once + multi-spin with configurable count (5/10/20/50/100).
 */
const SpinnerControls: React.FC<SpinnerControlsProps> = ({
  disabled,
  isSpinning,
  onSpinOnce,
  onSpinMulti,
  multiSpinCount,
  onMultiSpinCountChange,
  selectedCount,
}) => {
  const isDisabled = disabled || isSpinning;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <span className="text-2xl">🎰</span> Spinner
      </h2>

      {disabled && !isSpinning && (
        <div className="flex items-center gap-2 text-amber-400/80 text-sm mb-4
          bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2">
          <span>⚠️</span> Select at least one score to enable spinning
        </div>
      )}

      {!disabled && (
        <p className="text-slate-400 text-sm mb-4">
          <span className="text-blue-300 font-semibold">{selectedCount}</span> score
          {selectedCount !== 1 ? 's' : ''} in the pool
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ── Spin Once ── */}
        <button
          id="spin-once-btn"
          onClick={onSpinOnce}
          disabled={isDisabled}
          className={`relative overflow-hidden group flex items-center justify-center gap-3
            px-6 py-5 rounded-xl font-bold text-lg transition-all duration-200
            ${isDisabled
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/50'
              : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-900/60 hover:-translate-y-1 active:translate-y-0'
            }`}
        >
          {!isDisabled && (
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700
              bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          )}
          {isSpinning ? <><Spinner /> Spinning…</> : <><span className="text-2xl">🎯</span> Spin Once</>}
        </button>

        {/* ── Multi-Spin ── */}
        <div className="flex flex-col gap-2">
          {/* Count selector */}
          <div className="flex gap-1.5">
            {SPIN_COUNTS.map((count) => (
              <button
                key={count}
                id={`spin-count-${count}`}
                onClick={() => onMultiSpinCountChange(count)}
                disabled={isSpinning}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-150
                  ${multiSpinCount === count
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {count}
              </button>
            ))}
          </div>

          {/* Multi-spin button */}
          <button
            id="spin-multi-btn"
            onClick={onSpinMulti}
            disabled={isDisabled}
            className={`relative overflow-hidden group flex items-center justify-center gap-3
              px-6 py-4 rounded-xl font-bold text-lg transition-all duration-200 flex-1
              ${isDisabled
                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/50'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-900/60 hover:-translate-y-1 active:translate-y-0'
              }`}
          >
            {!isDisabled && (
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700
                bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}
            {isSpinning
              ? <><Spinner /> Spinning…</>
              : <><span className="text-xl">🔁</span> Spin {multiSpinCount}×</>
            }
          </button>
        </div>
      </div>

      {/* Insight callout for large spin counts */}
      {!disabled && multiSpinCount >= 50 && (
        <p className="mt-3 text-xs text-indigo-400/70 flex items-center gap-1.5">
          <span>💡</span>
          {multiSpinCount} spins gives a reliable frequency distribution — great with Poisson mode.
        </p>
      )}
    </div>
  );
};

export default SpinnerControls;
