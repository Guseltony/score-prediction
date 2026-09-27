import React, { useState, useCallback } from 'react';
import { generateId } from '../utils/formatTime';
import MatchAnalysisCard from './MatchAnalysisCard';
import SmartTicket from './SmartTicket';
import type { MatchCardResult, MatchCardInput } from './MatchAnalysisCard';
import type { TicketEntry } from './SmartTicket';

interface MatchSlot {
  id: string;
}

const ManualStudioPage: React.FC = () => {
  const [slots, setSlots] = useState<MatchSlot[]>([{ id: generateId() }]);
  const [ticketEntries, setTicketEntries] = useState<TicketEntry[]>([]);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(new Set());

  const handleAddMatch = useCallback(() => {
    setCollapsedSlots(prev => new Set([...prev, ...slots.map(s => s.id)]));
    setSlots(prev => [...prev, { id: generateId() }]);
  }, [slots]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedSlots(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
    setTicketEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleResult = useCallback(
    (id: string, result: MatchCardResult | null, input: MatchCardInput) => {
      if (!result) return;
      setTicketEntries(prev => {
        const existing = prev.findIndex(e => e.id === id);
        const entry: TicketEntry = {
          id,
          homeTeam: input.homeTeam,
          awayTeam: input.awayTeam,
          result,
        };
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = entry;
          return next;
        }
        return [...prev, entry];
      });
    },
    []
  );

  return (
    <div className="relative">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-white">Manual Studio</h2>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered multi-match analysis · Silent pipeline · Smart Ticket
          </p>
        </div>
        <button
          onClick={handleAddMatch}
          className="flex items-center gap-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/40
            hover:bg-indigo-600 hover:text-white font-bold py-2.5 px-5 rounded-xl transition-all duration-200"
        >
          <span className="text-lg leading-none">+</span>
          Add Match
        </button>
      </div>

      {/* Match cards */}
      <div className="space-y-8 pb-32">
        {slots.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <div className="text-5xl mb-4">⚽</div>
            <p className="text-slate-500 text-lg">No matches yet.</p>
            <button
              onClick={handleAddMatch}
              className="mt-4 text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
            >
              + Add your first match
            </button>
          </div>
        ) : (
          slots.map(slot => (
            <MatchAnalysisCard
              key={slot.id}
              id={slot.id}
              isCollapsed={collapsedSlots.has(slot.id)}
              onToggleCollapse={toggleCollapse}
              onResult={handleResult}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Floating Smart Ticket */}
      <SmartTicket entries={ticketEntries} />
    </div>
  );
};

export default ManualStudioPage;
