import React from 'react';

/**
 * Header – Application title and subtitle.
 */
const Header: React.FC = () => {
  return (
    <header className="relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900" />
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
          <span className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
            Score Simulator
          </span>
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-3">
          <span className="bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
            Correct Score
          </span>{' '}
          <span className="text-white">Predictor</span>
        </h1>

        {/* Subtitle */}
        <p className="text-blue-200/80 text-lg max-w-xl mx-auto">
          Generate a random correct score prediction from your selected pool of possible outcomes.
        </p>

        {/* Decorative football icon */}
        <div className="mt-6 text-5xl select-none animate-bounce">⚽</div>
      </div>
    </header>
  );
};

export default Header;
