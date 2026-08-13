import React from 'react';
import { type EVResult } from '../utils/evCalculator';

interface Props {
  evResults: EVResult[];
}

const EVDashboard: React.FC<Props> = ({ evResults }) => {
  if (!evResults || evResults.length === 0) return null;

  const positiveEV = evResults.filter(r => r.ev > 0).slice(0, 6);

  if (positiveEV.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 shadow-xl mt-6">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <span>📈</span> +EV Dashboard (Value Bets)
        </h2>
        <p className="text-slate-400 text-sm">No mathematically profitable correct score bets found based on current odds.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-emerald-500/30 rounded-2xl p-6 shadow-xl mt-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400"></div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📈</span> +EV Dashboard (Value Bets)
        </h2>
        <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-lg font-bold">
          {positiveEV.length} edges found
        </span>
      </div>

      <p className="text-slate-400 text-xs mb-4">
        Scores where our model's probability is higher than the Bookmaker's implied probability (derived algorthmically from 1X2 odds).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {positiveEV.map((res, i) => (
          <div key={res.score} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex flex-col relative overflow-hidden">
            {i === 0 && <div className="absolute -right-6 top-2 bg-emerald-500 text-white text-[10px] font-bold py-0.5 px-6 rotate-45 shadow-sm">BEST</div>}

            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-black text-white font-mono">{res.score}</span>
              <span className="text-lg font-bold text-emerald-400">
                +{(res.ev * 100).toFixed(1)}% EV
              </span>
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-700/50 pt-2 mt-1">
              <div>
                <span className="block text-slate-500">True Prob</span>
                <span className="text-white font-bold">{(res.modelProb * 100).toFixed(1)}%</span>
              </div>
              <div className="text-right">
                <span className="block text-slate-500">Bookie Odds</span>
                <span className="text-white font-bold">~{res.impliedOdds.toFixed(2)}</span>
                <span className="text-slate-500 ml-1">({(res.bookmakerProb * 100).toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EVDashboard;
