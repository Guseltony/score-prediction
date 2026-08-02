import React from 'react';

/**
 * Header – Application title and subtitle — V2 Betting Analytics Dashboard.
 */
const Header: React.FC = () => {
  return (
    <header className="relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
          <span className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
            Betting Analytics Dashboard
          </span>
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400/80 text-xs font-bold">V2</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-3">
          <span className="bg-gradient-to-r from-blue-300 via-violet-300 to-indigo-300 bg-clip-text text-transparent">
            Correct Score
          </span>{' '}
          <span className="text-white">Predictor</span>
        </h1>

        {/* Subtitle */}
        <p className="text-blue-200/70 text-lg max-w-2xl mx-auto">
          Monte Carlo simulations · Smart xG filtering · Market probabilities · Value bet detection
        </p>

        {/* Feature pills */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {['🔬 Monte Carlo', '🔍 Smart Filter', '📈 Markets', '💎 Value Bets', '🧬 Modifiers'].map((f) => (
            <span key={f} className="text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1">
              {f}
            </span>
          ))}
        </div>

        {/* Decorative football icon */}
        <div className="mt-6 text-5xl select-none animate-bounce">⚽</div>
      </div>
    </header>
  );
};

export default Header;

