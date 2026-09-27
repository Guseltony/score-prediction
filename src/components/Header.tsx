import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="relative overflow-hidden border-b border-white/5">
      {/* Dark base + Messi background image */}
      <div className="absolute inset-0 bg-[#04080f]" />
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: 'url(/messi.jpg)', backgroundPosition: 'center 15%' }}
      />
      {/* Overlay gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#04080f] via-[#04080f]/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04080f] via-transparent to-transparent" />
      {/* Glow orbs */}
      <div className="absolute -top-24 left-1/4 w-[600px] h-[400px] bg-indigo-600/15 rounded-full blur-[130px]" />
      <div className="absolute -bottom-20 right-0    w-[400px] h-[400px] bg-purple-600/12  rounded-full blur-[110px]" />
      <div className="absolute top-0    right-1/3    w-[300px] h-[300px] bg-cyan-500/8    rounded-full blur-[100px]" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10 py-12 flex items-center justify-between gap-8">
        {/* Left: Branding */}
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-4">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-[0.2em]">
              AI Prediction Engine · V3
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
            Score
            <span className="block mt-1 text-gold-gradient">
              Predictor AI
            </span>
          </h1>
          <p className="mt-3 text-slate-400 text-sm max-w-sm leading-relaxed">
            Monte Carlo · xG Intelligence · Smart Markets · Rank-Gap Tactics
          </p>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            {[
              { icon: '⚡', label: 'Real-time xG', color: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' },
              { icon: '🧠', label: 'AI Tactical Engine', color: 'bg-purple-500/10 border-purple-500/20 text-purple-300' },
              { icon: '🎯', label: 'Score Predictions', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' },
              { icon: '📊', label: '30+ Markets', color: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
            ].map(({ icon, label, color }) => (
              <span key={label} className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${color}`}>
                {icon} {label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Messi accent image */}
        <div className="hidden lg:block relative shrink-0">
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#04080f] z-10 w-16 left-0" />
          <img
            src="/messi.jpg"
            alt="Football Legend"
            className="h-52 w-auto object-cover object-top rounded-2xl opacity-80 shadow-2xl glow-indigo"
            style={{ maskImage: 'linear-gradient(to left, black 60%, transparent 100%)' }}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
