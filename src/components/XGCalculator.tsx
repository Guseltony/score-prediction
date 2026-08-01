import React, { useState, useCallback } from 'react';
import {
  calculateXG,
  parseMatchResult,
  parseH2HResult,
  LEAGUE_AVG_GOALS,
  HOME_ADVANTAGE_FACTOR,
  H2H_WEIGHT,
} from '../utils/calculateXG';
import type { XGCalculationResult, XGBreakdown } from '../utils/calculateXG';

interface XGCalculatorProps {
  homeTeamName: string;
  awayTeamName: string;
  onApply: (homeXG: number, awayXG: number) => void;
}

// ─── Match row types ──────────────────────────────────────────────────────────

interface ScoreRow {
  id: number;
  value: string;
}

let nextId = 1;
const makeRow = (value = ''): ScoreRow => ({ id: nextId++, value });
const DEFAULT_ROWS = (): ScoreRow[] => Array.from({ length: 5 }, () => makeRow());

// ─── Helper ───────────────────────────────────────────────────────────────────

function StrengthBadge({ value, isAttack }: { value: number; isAttack: boolean }) {
  const good = isAttack ? value > 1 : value < 1;
  const label = isAttack
    ? value >= 1.3 ? 'Strong' : value >= 0.9 ? 'Average' : 'Weak'
    : value <= 0.8 ? 'Solid' : value <= 1.1 ? 'Average' : 'Leaky';
  const color = good
    ? 'text-green-400 bg-green-500/10 border-green-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

// ─── Sub-component: match list editor ────────────────────────────────────────

interface MatchListProps {
  label: string;
  teamName: string;
  rows: ScoreRow[];
  isH2H?: boolean;
  placeholder?: string;
  onChange: (rows: ScoreRow[]) => void;
}

const MatchList: React.FC<MatchListProps> = ({
  label,
  teamName,
  rows,
  isH2H = false,
  placeholder = 'e.g. 2-1',
  onChange,
}) => {
  const update = (id: number, value: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, value } : r)));

  const remove = (id: number) => onChange(rows.filter((r) => r.id !== id));
  const add = () => onChange([...rows, makeRow()]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-500">
            {isH2H
              ? 'Format: Home-Away goals in that match'
              : `Format: Goals Scored - Goals Conceded by ${teamName || 'this team'}`}
          </p>
        </div>
        <span className="text-xs text-slate-500 bg-slate-700 rounded-lg px-2 py-0.5">
          {rows.filter(r => r.value.trim()).length} entered
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => {
          const parsed = parseMatchResult(row.value);
          const isValid = row.value.trim() === '' || parsed !== null;
          return (
            <div key={row.id} className="flex items-center gap-2">
              <span className="text-xs text-slate-600 w-5 text-right shrink-0">
                {idx + 1}.
              </span>
              <input
                type="text"
                value={row.value}
                onChange={(e) => update(row.id, e.target.value)}
                placeholder={placeholder}
                className={`flex-1 bg-slate-900/70 border rounded-lg px-3 py-1.5 text-white text-sm
                  placeholder-slate-600 focus:outline-none transition-colors
                  ${!isValid
                    ? 'border-red-500/60 focus:border-red-400'
                    : parsed
                    ? 'border-green-500/40 focus:border-green-400'
                    : 'border-slate-600 focus:border-blue-500'
                  }`}
              />
              {/* Parsed preview */}
              {parsed && (
                <div className="shrink-0 flex items-center gap-1 text-xs text-slate-400 w-16">
                  <span className="text-green-400 font-mono font-bold">{parsed.scored}</span>
                  <span>–</span>
                  <span className="text-red-400 font-mono font-bold">{parsed.conceded}</span>
                </div>
              )}
              <button
                onClick={() => remove(row.id)}
                className="shrink-0 text-slate-600 hover:text-red-400 transition-colors text-lg leading-none"
                title="Remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {rows.length < 10 && (
        <button
          onClick={add}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          <span>+</span> Add match
        </button>
      )}
    </div>
  );
};

// ─── Breakdown Panel ──────────────────────────────────────────────────────────

interface BreakdownPanelProps {
  result: XGCalculationResult;
  homeTeamName: string;
  awayTeamName: string;
}

const BreakdownPanel: React.FC<BreakdownPanelProps> = ({ result, homeTeamName, awayTeamName }) => {
  const { breakdown: b } = result;
  const home = homeTeamName || 'Home';
  const away = awayTeamName || 'Away';

  return (
    <div className="space-y-4">
      {/* Form averages */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Form Averages (per match)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
            <p className="text-xs text-slate-400 mb-2 font-medium">{home}</p>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Avg Scored</span>
              <span className="text-green-400 font-mono font-bold">{b.homeAvgScored}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-500">Avg Conceded</span>
              <span className="text-red-400 font-mono font-bold">{b.homeAvgConceded}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
              <span className="text-[10px] text-slate-500">Attack</span>
              <StrengthBadge value={b.homeAttackStrength} isAttack={true} />
              <span className="text-[10px] text-slate-500 ml-1">Defence</span>
              <StrengthBadge value={b.homeDefenseStrength} isAttack={false} />
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
            <p className="text-xs text-slate-400 mb-2 font-medium">{away}</p>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Avg Scored</span>
              <span className="text-green-400 font-mono font-bold">{b.awayAvgScored}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-500">Avg Conceded</span>
              <span className="text-red-400 font-mono font-bold">{b.awayAvgConceded}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
              <span className="text-[10px] text-slate-500">Attack</span>
              <StrengthBadge value={b.awayAttackStrength} isAttack={true} />
              <span className="text-[10px] text-slate-500 ml-1">Defence</span>
              <StrengthBadge value={b.awayDefenseStrength} isAttack={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Calculation steps */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Calculation Steps
        </p>
        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">League avg goals</span>
            <span className="text-slate-300">{LEAGUE_AVG_GOALS.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Home advantage ×</span>
            <span className="text-slate-300">{HOME_ADVANTAGE_FACTOR.toFixed(2)}</span>
          </div>
          <div className="border-t border-slate-700/50 pt-2 flex justify-between">
            <span className="text-blue-400">Base {home} xG</span>
            <span className="text-blue-300 font-bold">{b.baseHomeXG}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-400">Base {away} xG</span>
            <span className="text-purple-300 font-bold">{b.baseAwayXG}</span>
          </div>
          {b.h2hAdjusted && (
            <>
              <div className="border-t border-slate-700/50 pt-2 flex justify-between">
                <span className="text-amber-400">H2H avg ({home})</span>
                <span className="text-amber-300">{b.h2hHomeAvg}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-400">H2H avg ({away})</span>
                <span className="text-amber-300">{b.h2hAwayAvg}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Blend: 70% form + 30% H2H</span>
                <span className="text-slate-500">{((1 - H2H_WEIGHT) * 100).toFixed(0)}% / {(H2H_WEIGHT * 100).toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main XGCalculator Component ──────────────────────────────────────────────

const XGCalculator: React.FC<XGCalculatorProps> = ({ homeTeamName, awayTeamName, onApply }) => {
  const [homeRows, setHomeRows] = useState<ScoreRow[]>(DEFAULT_ROWS);
  const [awayRows, setAwayRows] = useState<ScoreRow[]>(DEFAULT_ROWS);
  const [h2hRows, setH2HRows] = useState<ScoreRow[]>(() => [makeRow(), makeRow(), makeRow()]);
  const [result, setResult] = useState<XGCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    setError(null);

    const homeMatches = homeRows
      .map((r) => parseMatchResult(r.value))
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const awayMatches = awayRows
      .map((r) => parseMatchResult(r.value))
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const h2hMatches = h2hRows
      .map((r) => parseH2HResult(r.value))
      .filter((m): m is NonNullable<typeof m> => m !== null);

    if (homeMatches.length === 0 && awayMatches.length === 0) {
      setError('Enter at least one match result for either team to calculate.');
      return;
    }

    setResult(calculateXG({ homeMatches, awayMatches, h2hMatches }));
  }, [homeRows, awayRows, h2hRows]);

  const handleApply = () => {
    if (result) onApply(result.homeXG, result.awayXG);
  };

  const home = homeTeamName || 'Home Team';
  const away = awayTeamName || 'Away Team';

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <span className="text-xl shrink-0">💡</span>
        <p className="text-xs text-slate-300 leading-relaxed">
          Enter each team's last 5–10 match results as <span className="text-white font-mono">Scored-Conceded</span>.
          Optionally add head-to-head results. The app will calculate statistically grounded xG values
          using the <span className="text-blue-300 font-medium">Dixon–Robinson model</span>.
        </p>
      </div>

      {/* Match inputs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
          <MatchList
            label={`${home} — Recent Results`}
            teamName={home}
            rows={homeRows}
            onChange={setHomeRows}
          />
        </div>
        <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
          <MatchList
            label={`${away} — Recent Results`}
            teamName={away}
            rows={awayRows}
            onChange={setAwayRows}
          />
        </div>
      </div>

      {/* H2H section */}
      <div className="bg-slate-900/30 rounded-xl p-4 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🆚</span>
          <p className="text-sm font-semibold text-amber-300">Head-to-Head Results</p>
          <span className="text-xs text-slate-500">(optional)</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Format: <span className="font-mono text-slate-400">{home} goals - {away} goals</span> in each historical meeting.
          These are weighted at 30% of the final xG.
        </p>
        <MatchList
          label=""
          teamName=""
          rows={h2hRows}
          isH2H
          placeholder={`e.g. 1-0 (${home} scored 1)`}
          onChange={setH2HRows}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Calculate button */}
      <button
        onClick={calculate}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600
          hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl
          transition-all duration-200 shadow-lg shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0"
      >
        <span>📐</span> Calculate xG from Stats
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-5 animate-fade-in">
          {/* xG output */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30
              rounded-2xl p-5 text-center">
              <p className="text-xs text-blue-300/70 font-semibold uppercase tracking-wider mb-1">
                {home} xG
              </p>
              <p className="text-5xl font-black text-white font-mono">{result.homeXG}</p>
              <p className="text-xs text-blue-400/60 mt-1">Expected Goals</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/30
              rounded-2xl p-5 text-center">
              <p className="text-xs text-purple-300/70 font-semibold uppercase tracking-wider mb-1">
                {away} xG
              </p>
              <p className="text-5xl font-black text-white font-mono">{result.awayXG}</p>
              <p className="text-xs text-purple-400/60 mt-1">Expected Goals</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>🔍</span> Calculation Breakdown
            </p>
            <BreakdownPanel result={result} homeTeamName={home} awayTeamName={away} />
          </div>

          {/* Apply button */}
          <button
            onClick={handleApply}
            className="w-full flex items-center justify-center gap-2
              bg-gradient-to-r from-green-600 to-emerald-600
              hover:from-green-500 hover:to-emerald-500
              text-white font-bold py-3 rounded-xl
              transition-all duration-200 shadow-lg shadow-green-900/30
              hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>✅</span> Apply — Use {result.homeXG} / {result.awayXG} in Poisson Model
          </button>
        </div>
      )}
    </div>
  );
};

export default XGCalculator;
