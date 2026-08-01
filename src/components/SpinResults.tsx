import React, { useEffect, useState } from 'react';
import type { ScoreString } from '../types';

interface SpinResultsProps {
  singleResult: ScoreString | null;
  isSpinning: boolean;
}

/**
 * SpinResults – Displays the result of a single spin with reveal animation.
 */
const SpinResults: React.FC<SpinResultsProps> = ({ singleResult, isSpinning }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (singleResult) {
      setVisible(false);
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [singleResult]);

  if (!singleResult && !isSpinning) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
        <span className="text-2xl">🎯</span> Prediction Result
      </h2>

      <div className="flex flex-col items-center justify-center py-6">
        {isSpinning ? (
          <div className="flex flex-col items-center gap-4">
            {/* Spinning football */}
            <div className="text-6xl animate-spin">⚽</div>
            <p className="text-slate-400 text-sm animate-pulse">Selecting a score…</p>
          </div>
        ) : (
          <div
            className={`transition-all duration-500 ${
              visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            }`}
          >
            {/* Score display */}
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700
                rounded-3xl px-10 py-6 text-center shadow-2xl shadow-blue-900/50 border border-blue-500/30">
                <p className="text-blue-200/80 text-xs font-semibold uppercase tracking-widest mb-2">
                  Your Prediction
                </p>
                <p className="text-5xl sm:text-7xl font-black text-white tracking-tight font-mono">
                  {singleResult}
                </p>
              </div>
            </div>

            {/* Confetti emoji row */}
            <div className="mt-4 text-center text-2xl space-x-1 animate-bounce">
              🎉⚽🏆
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpinResults;
