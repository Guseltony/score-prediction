/**
 * GenerateButton.tsx
 *
 * Ultra-Premium AI Generated Predictor Engine Action Hero.
 * Seamlessly integrates simulation triggers with telemetry and instant prediction previews.
 */

import React from 'react';
import type { ScoreString, SpinSession } from '../types';

interface GenerateButtonProps {
  disabled: boolean;
  isSpinning: boolean;
  hasResult: boolean;
  suggestedScores: ScoreString[];
  spinSession: SpinSession | null;
  onGenerate: () => void;
}

const GenerateButton: React.FC<GenerateButtonProps> = ({
  disabled,
  isSpinning,
  hasResult,
  suggestedScores,
  spinSession,
  onGenerate,
}) => {
  const topScores = suggestedScores.slice(0, 5);

  return (
    <div className="w-full flex flex-col items-center gap-4">

      {/* ── Main Hero CTA button ── */}
      <button
        onClick={onGenerate}
        disabled={disabled || isSpinning}
        className={`
          relative group w-full max-w-xl py-4.5 px-8 rounded-3xl font-black text-base sm:text-lg
          transition-all duration-300 select-none overflow-hidden border shadow-2xl
          ${disabled || isSpinning
            ? 'bg-slate-800/80 border-slate-700 text-slate-500 cursor-not-allowed shadow-none'
            : hasResult
            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white border-indigo-400/40 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
            : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white border-indigo-300/50 shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer animate-generate-pulse'
          }
        `}
      >
        {/* Shimmer overlay animation */}
        {!disabled && !isSpinning && (
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
            -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
        )}

        <div className="relative flex items-center justify-center gap-3">
          {isSpinning ? (
            <>
              <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="tracking-tight font-black">Running 60× AI Simulation...</span>
            </>
          ) : (
            <>
              <span className="text-2xl animate-pulse">⚡</span>
              <span className="tracking-tight font-black">
                {hasResult ? 'Re-Run AI Generated Predictor' : 'Run AI Generated Predictor'}
              </span>
              <span className="text-2xl animate-pulse">⚡</span>
            </>
          )}
        </div>

        {!isSpinning && !disabled && (
          <p className="relative text-[11px] text-indigo-100/80 mt-1 font-medium text-center">
            Simulates 60 Monte Carlo iterations · Applies 5-phase tactical factors &amp; Poisson modeling
          </p>
        )}
      </button>

      {/* ── Top Predicted Scores Quick Preview ── */}
      {hasResult && topScores.length > 0 && !isSpinning && (
        <div className="flex items-center gap-2 flex-wrap justify-center animate-fadeIn">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
            Top AI Scorelines:
          </span>
          {topScores.map((score, idx) => (
            <span
              key={score}
              className={`font-mono text-xs font-black px-3 py-1 rounded-xl border transition-all ${
                idx === 0
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10 scale-105'
                  : 'bg-slate-900/70 text-slate-300 border-slate-700/60'
              }`}
            >
              {idx === 0 ? '👑 ' : ''}{score}
            </span>
          ))}
        </div>
      )}

    </div>
  );
};

export default GenerateButton;
