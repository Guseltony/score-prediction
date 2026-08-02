import React from 'react';

/**
 * Footer – Application footer with V2 disclaimer.
 */
const Footer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-slate-700/50 py-8 text-center">
      <p className="text-slate-500 text-sm">
        ⚽ <span className="text-slate-400 font-medium">Correct Score Predictor V2</span> — Analytics Dashboard.
        For entertainment purposes only.
      </p>
      <p className="text-slate-600 text-xs mt-1">
        Monte Carlo · Poisson · Smart Filter · Market Probabilities · Value Bets · Built with React + TypeScript + Vite
      </p>
    </footer>
  );
};

export default Footer;

