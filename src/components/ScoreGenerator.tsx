import React from 'react';

interface ScoreGeneratorProps {
  maxGoals: number;
  onMaxGoalsChange: (value: number) => void;
  onRegenerate: () => void;
}

/**
 * ScoreGenerator – Controls the maximum goals setting and score regeneration.
 */
const ScoreGenerator: React.FC<ScoreGeneratorProps> = ({
  maxGoals,
  onMaxGoalsChange,
  onRegenerate,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 10) {
      onMaxGoalsChange(val);
    }
  };

  const totalScores = (maxGoals + 1) * (maxGoals + 1);

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
        <span className="text-2xl">⚙️</span> Score Generator
      </h2>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        {/* Max Goals Input */}
        <div className="flex-1">
          <label
            htmlFor="max-goals-input"
            className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"
          >
            Maximum Goals Per Team
          </label>
          <div className="relative">
            <input
              id="max-goals-input"
              type="number"
              min={1}
              max={10}
              value={maxGoals}
              onChange={handleChange}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-4 py-3 text-white
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                transition-all duration-200 [appearance:textfield]
                [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          {maxGoals < 1 && (
            <p className="text-red-400 text-xs mt-1">Minimum 1 goal required</p>
          )}
        </div>

        {/* Quick presets */}
        <div className="flex gap-2">
          {[3, 5, 7].map((n) => (
            <button
              key={n}
              id={`preset-goals-${n}`}
              onClick={() => onMaxGoalsChange(n)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                ${maxGoals === n
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Regenerate Button */}
        <button
          id="regenerate-btn"
          onClick={onRegenerate}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
            text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200
            shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 hover:-translate-y-0.5 active:translate-y-0"
        >
          <span>🔄</span> Regenerate
        </button>
      </div>

      {/* Info */}
      <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm">
        <span className="bg-slate-700 rounded-lg px-3 py-1 text-blue-300 font-mono font-bold">
          {totalScores}
        </span>
        <span>possible scores from 0-0 to {maxGoals}-{maxGoals}</span>
      </div>
    </div>
  );
};

export default ScoreGenerator;
