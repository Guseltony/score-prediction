import React, { useState } from 'react';
import type { HistoryEntry, PredictionMode, ScoreString } from '../types';
import { formatTime } from '../utils/formatTime';
import { saveHistory } from '../utils/localStorage';

const MODE_ICON: Record<PredictionMode, string> = {
  uniform: '🎲',
  poisson: '📐',
  historical: '📊',
  'odds-blended': '📡',
};

interface HistoryProps {
  entries: HistoryEntry[];
  onClear: () => void;
  onUpdate: (entries: HistoryEntry[]) => void;
}

// ─── Accuracy stats ────────────────────────────────────────────────────────────

function computeAccuracy(entries: HistoryEntry[]) {
  const withResult = entries.filter((e) => e.actualResult);
  if (!withResult.length) return null;

  const exactCorrect = withResult.filter((e) => e.prediction === e.actualResult).length;
  const correctWinner = withResult.filter((e) => {
    if (!e.actualResult) return false;
    const [ph, pa] = e.prediction.split('-').map(Number);
    const [ah, aa] = e.actualResult.split('-').map(Number);
    const predResult = ph > pa ? 'H' : ph < pa ? 'A' : 'D';
    const actualResult = ah > aa ? 'H' : ah < aa ? 'A' : 'D';
    return predResult === actualResult;
  }).length;
  const within1Goal = withResult.filter((e) => {
    if (!e.actualResult) return false;
    const [ph, pa] = e.prediction.split('-').map(Number);
    const [ah, aa] = e.actualResult.split('-').map(Number);
    return Math.abs((ph + pa) - (ah + aa)) <= 1;
  }).length;

  return {
    total: withResult.length,
    exactCorrect,
    correctWinner,
    within1Goal,
  };
}

// ─── Result input ─────────────────────────────────────────────────────────────

const ResultInput: React.FC<{
  entryId: string;
  currentResult?: ScoreString;
  onSave: (entryId: string, result: ScoreString) => void;
}> = ({ entryId, currentResult, onSave }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentResult ?? '');

  const handleSave = () => {
    const trimmed = value.trim();
    // Simple validation: must match X-Y format
    if (/^\d+-\d+$/.test(trimmed)) {
      onSave(entryId, trimmed);
      setOpen(false);
    }
  };

  if (currentResult && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1"
      >
        <span className="font-mono text-emerald-400 font-bold">{currentResult}</span>
        <span className="text-slate-600">actual · edit</span>
      </button>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-600 hover:text-slate-400 transition-colors mt-1 underline underline-offset-2"
      >
        + Enter actual result
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="e.g. 1-0"
        autoFocus
        className="w-20 bg-slate-900/70 border border-slate-600 rounded-lg px-2 py-1 text-white
          text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
      />
      <button
        onClick={handleSave}
        className="text-xs bg-emerald-600/30 text-emerald-300 border border-emerald-500/30
          rounded-lg px-2 py-1 hover:bg-emerald-600/50 transition-colors"
      >
        Save
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const History: React.FC<HistoryProps> = ({ entries, onClear, onUpdate }) => {
  if (entries.length === 0) return null;

  const accuracy = computeAccuracy(entries);

  const handleResultSave = (entryId: string, result: ScoreString) => {
    const updated = entries.map((e) =>
      e.id === entryId ? { ...e, actualResult: result } : e
    );
    onUpdate(updated);
    saveHistory(updated);
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">📜</span> Prediction History
          <span className="ml-1 bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {entries.length}
          </span>
        </h2>
        <button
          id="clear-history-btn"
          onClick={onClear}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200
            bg-red-600/20 border-red-500/40 text-red-300 hover:bg-red-600/40"
        >
          Clear History
        </button>
      </div>

      {/* Accuracy summary — only shown when results have been entered */}
      {accuracy && (
        <div className="mb-5 p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            📈 Prediction Accuracy ({accuracy.total} results entered)
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">
                {((accuracy.exactCorrect / accuracy.total) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Exact Score</p>
              <p className="text-xs text-slate-600">{accuracy.exactCorrect}/{accuracy.total}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-blue-400">
                {((accuracy.correctWinner / accuracy.total) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Correct Winner</p>
              <p className="text-xs text-slate-600">{accuracy.correctWinner}/{accuracy.total}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-violet-400">
                {((accuracy.within1Goal / accuracy.total) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Within 1 Goal</p>
              <p className="text-xs text-slate-600">{accuracy.within1Goal}/{accuracy.total}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {[...entries].reverse().map((entry) => {
          const isCorrect = entry.actualResult && entry.prediction === entry.actualResult;
          return (
            <div
              key={entry.id}
              className={`group border rounded-xl p-4 transition-all duration-200
                ${isCorrect
                  ? 'bg-emerald-900/20 border-emerald-500/30 hover:border-emerald-500/50'
                  : entry.actualResult
                  ? 'bg-slate-700/40 border-red-500/20 hover:border-slate-500/40'
                  : 'bg-slate-700/40 border-slate-600/30 hover:border-blue-500/30 hover:bg-slate-700/60'
                }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Match name */}
                  {(entry.matchInfo.homeTeam || entry.matchInfo.awayTeam) ? (
                    <p className="text-white font-semibold text-sm truncate">
                      {entry.matchInfo.homeTeam || 'Home'}{' '}
                      <span className="text-slate-400">vs</span>{' '}
                      {entry.matchInfo.awayTeam || 'Away'}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-sm">No match name</p>
                  )}

                  {/* Suggested scores */}
                  {entry.suggestedScores.length > 1 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.suggestedScores.map((s) => (
                        <span key={s} className="text-blue-300 font-mono font-bold text-xs bg-blue-600/20
                          border border-blue-500/30 rounded-lg px-2 py-0.5">
                          {s}
                        </span>
                      ))}
                      <span className="text-slate-500 text-xs self-center">tied</span>
                    </div>
                  ) : null}

                  {/* Meta */}
                  <p className="text-slate-500 text-xs mt-1">
                    {MODE_ICON[entry.predictionMode ?? 'uniform']}{' '}
                    {entry.spinCount} spin{entry.spinCount !== 1 ? 's' : ''} ·{' '}
                    {entry.selectedScoresCount} score{entry.selectedScoresCount !== 1 ? 's' : ''} ·{' '}
                    {formatTime(entry.timestamp)}
                  </p>

                  {/* Actual result input */}
                  <ResultInput
                    entryId={entry.id}
                    currentResult={entry.actualResult}
                    onSave={handleResultSave}
                  />
                </div>

                {/* Prediction + result badges */}
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-600
                    rounded-xl px-3 py-2 text-center shadow-lg">
                    <p className="text-xs text-blue-200 mb-0.5">Prediction</p>
                    <p className="text-white font-black font-mono text-lg leading-none">
                      {entry.prediction}
                    </p>
                  </div>
                  {entry.actualResult && (
                    <div className={`rounded-xl px-3 py-1.5 text-center border
                      ${isCorrect
                        ? 'bg-emerald-500/20 border-emerald-500/40'
                        : 'bg-red-500/10 border-red-500/30'
                      }`}>
                      <p className="text-xs text-slate-400 mb-0.5">Actual</p>
                      <p className={`font-black font-mono text-sm leading-none
                        ${isCorrect ? 'text-emerald-300' : 'text-red-400'}`}>
                        {entry.actualResult}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default History;
