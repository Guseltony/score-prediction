import React, { useState } from 'react';
import type { PredictionMode, XGSettings } from '../types';
import XGCalculator from './XGCalculator';

interface XGControlsProps {
  mode: PredictionMode;
  xgSettings: XGSettings;
  homeTeamName: string;
  awayTeamName: string;
  onModeChange: (mode: PredictionMode) => void;
  onXGChange: (settings: XGSettings) => void;
}

const MODES: { id: PredictionMode; label: string; icon: string; description: string }[] = [
  {
    id: 'uniform',
    label: 'Uniform',
    icon: '🎲',
    description: 'Every score has equal probability — pure random.',
  },
  {
    id: 'poisson',
    label: 'Poisson (xG)',
    icon: '📐',
    description: 'Statistically weighted using Expected Goals. Realistic score distribution.',
  },
  {
    id: 'historical',
    label: 'Historical',
    icon: '📊',
    description: 'Weighted by real football data. Rare scorelines are very unlikely.',
  },
];

/**
 * XGControls – Mode selector, xG sliders, and integrated xG calculator from team stats.
 */
const XGControls: React.FC<XGControlsProps> = ({
  mode,
  xgSettings,
  homeTeamName,
  awayTeamName,
  onModeChange,
  onXGChange,
}) => {
  const [showCalculator, setShowCalculator] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState(false);

  const handleApplyXG = (homeXG: number, awayXG: number) => {
    onXGChange({ homeXG, awayXG });
    setShowCalculator(false);
    setAppliedMsg(true);
    setTimeout(() => setAppliedMsg(false), 3000);
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <span className="text-2xl">🧠</span> Prediction Model
      </h2>
      <p className="text-slate-500 text-xs mb-5">
        Choose how scores are selected during each spin
      </p>

      {/* Mode tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
        {MODES.map(({ id, label, icon, description }) => (
          <button
            key={id}
            id={`mode-${id}`}
            onClick={() => onModeChange(id)}
            className={`text-left p-3.5 rounded-xl border transition-all duration-200
              ${mode === id
                ? 'bg-blue-600/20 border-blue-500/60 ring-1 ring-blue-500/40'
                : 'bg-slate-700/40 border-slate-600/40 hover:border-slate-500/60 hover:bg-slate-700/60'
              }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{icon}</span>
              <span className={`text-sm font-bold ${mode === id ? 'text-blue-300' : 'text-white'}`}>
                {label}
              </span>
              {mode === id && (
                <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              )}
            </div>
            <p className="text-xs text-slate-400 leading-tight">{description}</p>
          </button>
        ))}
      </div>

      {/* ── Poisson panel ── */}
      {mode === 'poisson' && (
        <div className="space-y-4 animate-fade-in">
          {/* Manual slider section */}
          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡</span> Expected Goals (xG)
              </p>
              {appliedMsg && (
                <span className="text-xs text-green-400 flex items-center gap-1 animate-fade-in">
                  ✅ Stats applied!
                </span>
              )}
            </div>

            <div className="space-y-4">
              <XGSlider
                id="home-xg"
                label="Home xG"
                emoji="🏠"
                value={xgSettings.homeXG}
                onChange={(v) => onXGChange({ ...xgSettings, homeXG: v })}
              />
              <XGSlider
                id="away-xg"
                label="Away xG"
                emoji="✈️"
                value={xgSettings.awayXG}
                onChange={(v) => onXGChange({ ...xgSettings, awayXG: v })}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Typical: Home 1.2–1.8 · Away 0.8–1.5
              </p>
              {/* Quick reset */}
              <button
                onClick={() => onXGChange({ homeXG: 1.5, awayXG: 1.2 })}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Reset defaults
              </button>
            </div>
          </div>

          {/* ── Calculator toggle ── */}
          <div className="border border-slate-700/40 rounded-xl overflow-hidden">
            <button
              id="toggle-xg-calculator"
              onClick={() => setShowCalculator((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3
                bg-slate-900/30 hover:bg-slate-700/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📥</span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">
                    Calculate xG from Team Stats
                  </p>
                  <p className="text-xs text-slate-500">
                    Enter recent match results + H2H to auto-derive xG
                  </p>
                </div>
              </div>
              <span className={`text-slate-400 transition-transform duration-200 ${showCalculator ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {showCalculator && (
              <div className="p-4 border-t border-slate-700/30 animate-fade-in">
                <XGCalculator
                  homeTeamName={homeTeamName}
                  awayTeamName={awayTeamName}
                  onApply={handleApplyXG}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historical info */}
      {mode === 'historical' && (
        <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40 animate-fade-in">
          <p className="text-xs text-slate-400 leading-relaxed">
            Based on Premier League & top European league data across multiple seasons.
            Scores like{' '}
            <span className="text-white font-mono font-semibold">1-1</span>,{' '}
            <span className="text-white font-mono font-semibold">1-0</span> and{' '}
            <span className="text-white font-mono font-semibold">2-1</span> are weighted
            ~10× more likely than high-scoring results like 4-3 or 5-2.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── XG Slider ────────────────────────────────────────────────────────────────

interface XGSliderProps {
  id: string;
  label: string;
  emoji: string;
  value: number;
  onChange: (v: number) => void;
}

const XGSlider: React.FC<XGSliderProps> = ({ id, label, emoji, value, onChange }) => {
  const pct = ((value - 0.1) / 3.9) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="text-sm text-slate-300 flex items-center gap-1.5">
          <span>{emoji}</span> {label}
        </label>
        <span className="text-blue-300 font-mono font-bold text-sm bg-blue-500/20 border border-blue-500/30
          rounded-lg px-2.5 py-0.5 min-w-[3.5rem] text-center">
          {value.toFixed(1)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0.1}
        max={4.0}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600
          [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
        style={{ background: `linear-gradient(to right, #3b82f6 ${pct}%, #334155 ${pct}%)` }}
      />
      <div className="flex justify-between text-xs text-slate-600 mt-1">
        <span>0.1</span>
        <span>2.0</span>
        <span>4.0</span>
      </div>
    </div>
  );
};

export default XGControls;
