import React, { useState } from 'react';
import type { ScoreString, XGSettings } from '../types';
import { applySmartFilter } from '../utils/smartFilter';
import type { SmartFilterResult } from '../utils/smartFilter';

interface SmartFilterPanelProps {
  scores: ScoreString[];
  xgSettings: XGSettings;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onFilterResult: (result: SmartFilterResult | null) => void;
}

/**
 * SmartFilterPanel – Toggle to apply xG-based logic filtering.
 * Shows which scores are eliminated and why.
 */
const SmartFilterPanel: React.FC<SmartFilterPanelProps> = ({
  scores,
  xgSettings,
  enabled,
  onToggle,
  onFilterResult,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const filterResult = enabled ? applySmartFilter(scores, xgSettings) : null;

  const handleToggle = (newEnabled: boolean) => {
    onToggle(newEnabled);
    onFilterResult(newEnabled ? applySmartFilter(scores, xgSettings) : null);
  };

  // Recompute & propagate whenever scores or xg change
  React.useEffect(() => {
    if (enabled) {
      onFilterResult(applySmartFilter(scores, xgSettings));
    }
  }, [scores, xgSettings, enabled]);

  const eliminated = filterResult ? [...filterResult.eliminated] : [];
  const kept = filterResult ? filterResult.kept.size : scores.length;
  const pctKept = scores.length > 0 ? Math.round((kept / scores.length) * 100) : 100;

  return (
    <div className={`rounded-2xl border p-5 backdrop-blur-sm shadow-xl transition-all duration-300
      ${enabled
        ? 'bg-amber-500/5 border-amber-500/30'
        : 'bg-slate-800/60 border-slate-700/50'
      }`}
    >
      {/* Header toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔍</span>
          <div>
            <h2 className="text-sm font-bold text-white">Smart Logic Filter</h2>
            <p className="text-xs text-slate-500">
              Auto-eliminate scores that contradict the xG data
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          id="smart-filter-toggle"
          onClick={() => handleToggle(!enabled)}
          className={`relative w-12 h-6 rounded-full border-2 transition-all duration-300 focus:outline-none
            ${enabled
              ? 'bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/30'
              : 'bg-slate-700 border-slate-600'
            }`}
          aria-label={enabled ? 'Disable smart filter' : 'Enable smart filter'}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full shadow-md transition-all duration-300
              ${enabled ? 'left-6 bg-white' : 'left-0.5 bg-slate-400'}`}
          />
        </button>
      </div>

      {/* Active state details */}
      {enabled && filterResult && (
        <div className="mt-4 animate-fade-in space-y-3">
          {/* Summary bar */}
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">
              <span className="text-white font-bold">{kept}</span> scores kept •{' '}
              <span className="text-amber-400 font-bold">{eliminated.length}</span> eliminated
            </span>
            <span className="text-slate-500">{pctKept}% remaining</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${pctKept}%` }}
            />
          </div>

          {/* Rule info */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-sm mt-0.5">⚡</span>
              <div>
                <p className="text-xs font-semibold text-amber-300 mb-1">
                  xG analysis: Home {xgSettings.homeXG.toFixed(1)} | Away {xgSettings.awayXG.toFixed(1)} |
                  Combined {(xgSettings.homeXG + xgSettings.awayXG).toFixed(1)}
                </p>
                <p className="text-xs text-amber-400/70 leading-relaxed">
                  {xgSettings.awayXG > xgSettings.homeXG * 1.6
                    ? 'Away team xG dominance → Home wins filtered out.'
                    : xgSettings.homeXG > xgSettings.awayXG * 1.6
                    ? 'Home team xG dominance → Away wins filtered out.'
                    : 'No strong xG dominance — standard goal-total filtering applied.'}
                  {(xgSettings.homeXG + xgSettings.awayXG) > 2.5
                    ? ' High combined xG → low-scoring results eliminated.'
                    : (xgSettings.homeXG + xgSettings.awayXG) < 1.5
                    ? ' Low combined xG → high-scoring results eliminated.'
                    : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Eliminated scores list */}
          {eliminated.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
              >
                <span className={`transition-transform duration-200 ${showDetails ? 'rotate-90' : ''}`}>▶</span>
                {showDetails ? 'Hide' : 'Show'} eliminated scores ({eliminated.length})
              </button>

              {showDetails && (
                <div className="mt-2 flex flex-wrap gap-1.5 animate-fade-in">
                  {eliminated.map((score) => (
                    <div
                      key={score}
                      title={filterResult.reasons[score]}
                      className="group relative"
                    >
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-1
                        bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg line-through">
                        {score}
                      </span>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10
                        bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-slate-300
                        whitespace-nowrap shadow-xl">
                        {filterResult.reasons[score]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartFilterPanel;
