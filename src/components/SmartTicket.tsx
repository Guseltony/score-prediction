import React, { useState } from 'react';
import type { MatchCardResult, MatchCardInput } from './MatchAnalysisCard';

export interface TicketEntry {
  id: string;
  homeTeam: string;
  awayTeam: string;
  result: MatchCardResult;
}

interface SmartTicketProps {
  entries: TicketEntry[];
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   'text-emerald-400',
  medium: 'text-amber-400',
  low:    'text-slate-400',
};

const SmartTicket: React.FC<SmartTicketProps> = ({ entries }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const analyzed = entries.filter(e => e.result.ticketMarkets?.length > 0);

  if (analyzed.length === 0) return null;

  const combinedOdds = analyzed.reduce((acc, e) => {
    const odds = e.result.ticketMarkets[0]?.odds ?? 1;
    return acc * (odds > 1 ? odds : 1);
  }, 1);

  const handleCopy = () => {
    const text = analyzed.map(e => {
      const marketsStr = e.result.ticketMarkets
        .map(m => `  • ${m.label} @ ${m.odds?.toFixed(2) ?? '—'} (${Math.round(m.probability * 100)}%)`)
        .join('\n');
      return `${e.homeTeam} vs ${e.awayTeam}:\n${marketsStr}`;
    }).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 flex flex-col" style={{ maxHeight: 'calc(100vh - 80px)' }}>
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className="flex items-center justify-between w-full bg-indigo-700 hover:bg-indigo-600 text-white
          font-bold text-sm px-4 py-3 rounded-2xl shadow-2xl shadow-indigo-900/50 transition-all"
      >
        <span className="flex items-center gap-2">
          🎫 Smart Ticket
          <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-black">
            {analyzed.length}
          </span>
        </span>
        <span className="text-white/70 text-xs">{isOpen ? '▼' : '▲'}</span>
      </button>

      {/* Slip body */}
      {isOpen && (
        <div className="mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 divide-y divide-slate-800">
            {analyzed.map(entry => {
              const markets = entry.result.ticketMarkets;
              return (
                <div key={entry.id} className="px-4 py-3 hover:bg-slate-800/50 transition-colors">
                  <div className="text-xs text-slate-400 mb-2 truncate font-medium">
                    {entry.homeTeam} <span className="text-slate-600">vs</span> {entry.awayTeam}
                  </div>
                  <div className="space-y-2">
                    {markets.map((market, idx) => (
                      <div key={market.id} className={`flex items-center justify-between gap-2 ${idx > 0 ? 'opacity-80' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">{market.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-[13px] text-white font-bold truncate leading-tight">{market.label}</p>
                            <p className={`text-[9px] font-semibold capitalize ${CONFIDENCE_COLOR[market.confidence]}`}>
                              {Math.round(market.probability * 100)}% · {market.category.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        {market.odds && market.odds > 1 && (
                          <div className="text-right shrink-0">
                            <div className="text-[13px] font-black text-indigo-300">{market.odds.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer: accumulator + copy */}
          {analyzed.length > 1 && (
            <div className="border-t border-slate-700 px-4 py-3 bg-slate-800/50 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Accumulator Odds</span>
                <span className="text-white font-black text-base">{combinedOdds.toFixed(2)}</span>
              </div>
              <button
                onClick={handleCopy}
                className={`w-full py-2 rounded-lg font-bold text-sm transition-all
                  ${copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
              >
                {copied ? '✓ Copied!' : '📋 Copy Selections'}
              </button>
            </div>
          )}
          {analyzed.length === 1 && (
            <div className="border-t border-slate-700 px-4 py-3 bg-slate-800/50">
              <button
                onClick={handleCopy}
                className="w-full py-2 rounded-lg font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
              >
                {copied ? '✓ Copied!' : '📋 Copy Selection'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartTicket;
