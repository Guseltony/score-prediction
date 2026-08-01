import React from 'react';

/**
 * Footer – Application footer with disclaimer.
 */
const Footer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-slate-700/50 py-8 text-center">
      <p className="text-slate-500 text-sm">
        ⚽ <span className="text-slate-400 font-medium">Correct Score Predictor</span> — For
        entertainment purposes only. Not a betting tool.
      </p>
      <p className="text-slate-600 text-xs mt-1">
        Built with React · TypeScript · Vite · Tailwind CSS
      </p>
    </footer>
  );
};

export default Footer;
