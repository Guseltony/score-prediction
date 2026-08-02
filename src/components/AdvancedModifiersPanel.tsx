import React from 'react';
import type { AdvancedModifiers } from '../types';

interface AdvancedModifiersProps {
  modifiers: AdvancedModifiers;
  onChange: (modifiers: AdvancedModifiers) => void;
}

/**
 * AdvancedModifiersPanel – Home Advantage toggle + Form Recency slider.
 * Embedded inside the Poisson/xG mode panel in XGControls.
 */
const AdvancedModifiersPanel: React.FC<AdvancedModifiersProps> = ({ modifiers, onChange }) => {
  const { homeAdvantageEnabled, formWeightRecency } = modifiers;

  return (
    <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40 space-y-5">
      <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
        <span>🧬</span> Advanced Modifiers
      </p>

      {/* Home Advantage toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-white font-semibold">Home Advantage Boost</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Applies a +12% boost to Home team xG. Teams historically score more at home.
          </p>
          {homeAdvantageEnabled && (
            <p className="text-xs text-violet-400 mt-1">
              ✓ Home xG will be multiplied by ×1.12 in the spin model
            </p>
          )}
        </div>
        <button
          id="home-advantage-toggle"
          onClick={() => onChange({ ...modifiers, homeAdvantageEnabled: !homeAdvantageEnabled })}
          className={`relative shrink-0 w-12 h-6 rounded-full border-2 transition-all duration-300 focus:outline-none
            ${homeAdvantageEnabled
              ? 'bg-violet-500 border-violet-400 shadow-lg shadow-violet-500/30'
              : 'bg-slate-700 border-slate-600'
            }`}
          aria-label={homeAdvantageEnabled ? 'Disable home advantage' : 'Enable home advantage'}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full shadow-md transition-all duration-300
              ${homeAdvantageEnabled ? 'left-6 bg-white' : 'left-0.5 bg-slate-400'}`}
          />
        </button>
      </div>

      {/* Form Recency slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-white font-semibold">Form Recency Weighting</p>
            <p className="text-xs text-slate-500 mt-0.5">
              How much to favour recent matches over older ones in xG calculation.
            </p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border min-w-[56px] text-center
            ${formWeightRecency < 0.33
              ? 'bg-slate-700/60 text-slate-300 border-slate-600'
              : formWeightRecency < 0.67
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-violet-500/20 text-violet-300 border-violet-500/30'
            }`}>
            {formWeightRecency < 0.33 ? 'Equal' : formWeightRecency < 0.67 ? 'Moderate' : 'Heavy'}
          </span>
        </div>
        <input
          id="form-recency-slider"
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={formWeightRecency}
          onChange={(e) => onChange({ ...modifiers, formWeightRecency: parseFloat(e.target.value) })}
          className="w-full h-2 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-600
            [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
          style={{
            background: `linear-gradient(to right, #7c3aed ${formWeightRecency * 100}%, #334155 ${formWeightRecency * 100}%)`
          }}
        />
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>Equal weight</span>
          <span>Recent ×2</span>
          <span>Recent ×4</span>
        </div>
      </div>
    </div>
  );
};

export default AdvancedModifiersPanel;
