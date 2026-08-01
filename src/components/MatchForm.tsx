import React from 'react';
import type { MatchInfo } from '../types';

interface MatchFormProps {
  matchInfo: MatchInfo;
  onChange: (info: MatchInfo) => void;
}

/**
 * MatchForm – Inputs for home and away team names.
 * Displays a "vs" banner when both fields are filled.
 */
const MatchForm: React.FC<MatchFormProps> = ({ matchInfo, onChange }) => {
  const { homeTeam, awayTeam } = matchInfo;
  const bothFilled = homeTeam.trim() && awayTeam.trim();

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
        <span className="text-2xl">🏟️</span> Match Information
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Home Team */}
        <div className="group">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Home Team
          </label>
          <input
            id="home-team-input"
            type="text"
            value={homeTeam}
            onChange={(e) => onChange({ ...matchInfo, homeTeam: e.target.value })}
            placeholder="e.g. Manchester United"
            className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500
              focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
              transition-all duration-200 group-hover:border-slate-500"
          />
        </div>

        {/* Away Team */}
        <div className="group">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Away Team
          </label>
          <input
            id="away-team-input"
            type="text"
            value={awayTeam}
            onChange={(e) => onChange({ ...matchInfo, awayTeam: e.target.value })}
            placeholder="e.g. Chelsea"
            className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500
              focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
              transition-all duration-200 group-hover:border-slate-500"
          />
        </div>
      </div>

      {/* Matchup Banner */}
      {bothFilled && (
        <div className="mt-5 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600/20 to-indigo-600/20
          border border-blue-500/30 rounded-xl px-6 py-3 animate-fade-in">
          <span className="text-white font-bold text-lg truncate max-w-[180px]">{homeTeam}</span>
          <span className="text-blue-400 font-black text-sm px-2 py-0.5 bg-blue-500/20 rounded-full shrink-0">VS</span>
          <span className="text-white font-bold text-lg truncate max-w-[180px]">{awayTeam}</span>
        </div>
      )}

      {/* Validation hint */}
      {!bothFilled && (
        <p className="mt-3 text-xs text-slate-500 text-center">
          Enter both team names to see the matchup
        </p>
      )}
    </div>
  );
};

export default MatchForm;
