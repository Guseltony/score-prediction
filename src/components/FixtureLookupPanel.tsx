import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MatchInfo } from '../types';
import type { ApiTeamResult, RecentFixture } from '../api/types';
import { useTeamSearch } from '../hooks/useTeamSearch';
import { useTeamFixtures } from '../hooks/useTeamFixtures';
import { useHeadToHead } from '../hooks/useHeadToHead';
import { useAutoXG } from '../hooks/useAutoXG';

interface FixtureLookupPanelProps {
  matchInfo: MatchInfo;
  onMatchInfoChange: (info: MatchInfo) => void;
  onXGApply: (homeXG: number, awayXG: number) => void;
  onFixtureIdChange: (id: number | null) => void;
}

// ─── Debounced search input ──────────────────────────────────────────────────

function useDebounce(value: string, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Form badge ──────────────────────────────────────────────────────────────

const FormBadge: React.FC<{ result: 'W' | 'D' | 'L' }> = ({ result }) => {
  const styles = {
    W: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    D: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    L: 'bg-red-500/20 text-red-400 border-red-500/40',
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${styles[result]}`}
    >
      {result}
    </span>
  );
};

// ─── Team search dropdown ─────────────────────────────────────────────────────

interface TeamSearchInputProps {
  label: string;
  placeholder: string;
  value: string;
  selectedTeam: ApiTeamResult | null;
  onSelect: (team: ApiTeamResult) => void;
  onClear: () => void;
  inputId: string;
}

const TeamSearchInput: React.FC<TeamSearchInputProps> = ({
  label, placeholder, value, selectedTeam, onSelect, onClear, inputId,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(inputValue, 400);
  const { data: results, isFetching } = useTeamSearch(debouncedQuery);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => { setInputValue(value); }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (team: ApiTeamResult) => {
    setInputValue(team.team.name);
    setOpen(false);
    onSelect(team);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {label}
      </label>

      {selectedTeam ? (
        /* Selected state — show club card pill */
        <div className="flex items-center gap-3 bg-slate-900/70 border border-emerald-500/40 rounded-xl px-4 py-3">
          <img
            src={selectedTeam.team.logo}
            alt={selectedTeam.team.name}
            className="w-8 h-8 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{selectedTeam.team.name}</p>
            <p className="text-slate-500 text-xs">{selectedTeam.team.country}</p>
          </div>
          <button
            onClick={onClear}
            className="text-slate-500 hover:text-red-400 transition-colors text-lg leading-none"
            aria-label="Clear team selection"
          >
            ×
          </button>
        </div>
      ) : (
        /* Search state */
        <>
          <div className="relative">
            <input
              id={inputId}
              type="text"
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              autoComplete="off"
              className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-4 py-3 text-white
                placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2
                focus:ring-blue-500/20 transition-all duration-200 pr-10"
            />
            {isFetching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>

          {open && results && results.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600/60
              rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
              {results.slice(0, 8).map((r) => (
                <button
                  key={r.team.id}
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/60
                    transition-colors text-left border-b border-slate-700/40 last:border-0"
                >
                  <img
                    src={r.team.logo}
                    alt={r.team.name}
                    className="w-6 h-6 object-contain flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{r.team.name}</p>
                    <p className="text-slate-500 text-xs">{r.team.country}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {open && debouncedQuery.length >= 3 && !isFetching && results?.length === 0 && (
            <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600/60
              rounded-xl shadow-2xl px-4 py-3 text-slate-500 text-sm">
              No teams found for "{debouncedQuery}"
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Form table ───────────────────────────────────────────────────────────────

const FormTable: React.FC<{
  fixtures: RecentFixture[];
  teamName: string;
  isLoading: boolean;
}> = ({ fixtures, teamName, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 bg-slate-700/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!fixtures.length) {
    return <p className="text-slate-600 text-xs">No recent fixtures found</p>;
  }

  return (
    <div className="space-y-1.5">
      {fixtures.map((f) => {
        const isHome = f.homeTeam === teamName;
        const scored = isHome ? f.homeGoals : f.awayGoals;
        const conceded = isHome ? f.awayGoals : f.homeGoals;
        return (
          <div
            key={f.fixtureId}
            className="flex items-center gap-2 text-xs text-slate-400"
          >
            <FormBadge result={f.result} />
            <span className="font-mono text-white/80 shrink-0">
              {scored}–{conceded}
            </span>
            <span className="truncate">
              {isHome ? `vs ${f.awayTeam}` : `@ ${f.homeTeam}`}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

const FixtureLookupPanel: React.FC<FixtureLookupPanelProps> = ({
  matchInfo,
  onMatchInfoChange,
  onXGApply,
  onFixtureIdChange,
}) => {
  const [homeTeam, setHomeTeam] = useState<ApiTeamResult | null>(null);
  const [awayTeam, setAwayTeam] = useState<ApiTeamResult | null>(null);
  const [applied, setApplied] = useState(false);

  const homeId = homeTeam?.team.id ?? null;
  const awayId = awayTeam?.team.id ?? null;

  const { data: homeFixtures, isLoading: homeLoading } = useTeamFixtures(homeId);
  const { data: awayFixtures, isLoading: awayLoading } = useTeamFixtures(awayId);
  const { data: h2hFixtures, isLoading: h2hLoading } = useHeadToHead(homeId, awayId);

  const autoXG = useAutoXG(
    homeFixtures,
    awayFixtures,
    homeTeam?.team.name ?? '',
    awayTeam?.team.name ?? '',
  );

  // Sync team names to parent matchInfo
  useEffect(() => {
    onMatchInfoChange({
      homeTeam: homeTeam?.team.name ?? matchInfo.homeTeam,
      awayTeam: awayTeam?.team.name ?? matchInfo.awayTeam,
    });
  }, [homeTeam, awayTeam]);

  // Notify parent of fixture ID (for odds fetching)
  // We don't have a direct fixture ID from team search, so we emit null for now
  // (OddsDashboardPanel will have its own fixture search)
  useEffect(() => {
    onFixtureIdChange(null);
  }, [homeId, awayId]);

  const handleApplyXG = useCallback(() => {
    if (!autoXG) return;
    onXGApply(autoXG.suggestedHomeXG, autoXG.suggestedAwayXG);
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  }, [autoXG, onXGApply]);

  const bothSelected = homeTeam && awayTeam;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <span className="text-2xl">🔍</span> Fixture Lookup
      </h2>
      <p className="text-slate-500 text-xs mb-5">
        Search for teams to auto-load form data and calculate xG
      </p>

      {/* Team search inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <TeamSearchInput
          inputId="home-team-search"
          label="Home Team"
          placeholder="e.g. Celtic, Arsenal…"
          value={homeTeam?.team.name ?? ''}
          selectedTeam={homeTeam}
          onSelect={(t) => setHomeTeam(t)}
          onClear={() => setHomeTeam(null)}
        />
        <TeamSearchInput
          inputId="away-team-search"
          label="Away Team"
          placeholder="e.g. Dundee, Chelsea…"
          value={awayTeam?.team.name ?? ''}
          selectedTeam={awayTeam}
          onSelect={(t) => setAwayTeam(t)}
          onClear={() => setAwayTeam(null)}
        />
      </div>

      {/* Matchup banner */}
      {bothSelected && (
        <div className="mb-5 flex items-center justify-center gap-3 bg-gradient-to-r
          from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl px-6 py-3 animate-fade-in">
          <img src={homeTeam.team.logo} alt={homeTeam.team.name}
            className="w-8 h-8 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="text-white font-bold text-lg truncate max-w-[140px]">{homeTeam.team.name}</span>
          <span className="text-blue-400 font-black text-sm px-2 py-0.5 bg-blue-500/20 rounded-full shrink-0">VS</span>
          <span className="text-white font-bold text-lg truncate max-w-[140px]">{awayTeam.team.name}</span>
          <img src={awayTeam.team.logo} alt={awayTeam.team.name}
            className="w-8 h-8 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}

      {/* Club form cards */}
      {(homeTeam || awayTeam) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* Home form */}
          {homeTeam && (
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
              <div className="flex items-center gap-2 mb-3">
                <img src={homeTeam.team.logo} alt={homeTeam.team.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                  {homeTeam.team.name} — Last 5
                </p>
              </div>
              <FormTable
                fixtures={homeFixtures ?? []}
                teamName={homeTeam.team.name}
                isLoading={homeLoading}
              />
            </div>
          )}

          {/* Away form */}
          {awayTeam && (
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
              <div className="flex items-center gap-2 mb-3">
                <img src={awayTeam.team.logo} alt={awayTeam.team.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
                  {awayTeam.team.name} — Last 5
                </p>
              </div>
              <FormTable
                fixtures={awayFixtures ?? []}
                teamName={awayTeam.team.name}
                isLoading={awayLoading}
              />
            </div>
          )}
        </div>
      )}

      {/* H2H */}
      {bothSelected && (
        <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40 mb-5">
          <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-3">
            ⚔️ Head to Head — Last 5
          </p>
          {h2hLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-7 bg-slate-700/40 rounded animate-pulse" />
              ))}
            </div>
          ) : h2hFixtures?.length ? (
            <div className="space-y-1.5">
              {h2hFixtures.map((f) => (
                <div key={f.fixtureId} className="flex items-center gap-2 text-xs">
                  <FormBadge result={f.result} />
                  <span className="text-slate-400">
                    {f.homeTeam}{' '}
                    <span className="font-mono text-white font-bold">
                      {f.homeGoals}–{f.awayGoals}
                    </span>{' '}
                    {f.awayTeam}
                  </span>
                  <span className="ml-auto text-slate-600">
                    {new Date(f.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-xs">No H2H history available</p>
          )}
        </div>
      )}

      {/* Auto-xG suggestion */}
      {bothSelected && autoXG && (
        <div className="p-4 bg-gradient-to-r from-emerald-900/20 to-cyan-900/20
          border border-emerald-500/30 rounded-xl animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                ⚡ Suggested xG
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal capitalize
                  ${autoXG.confidence === 'high'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : autoXG.confidence === 'medium'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/20 text-red-400'
                  }`}>
                  {autoXG.confidence} confidence
                </span>
              </p>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{autoXG.suggestedHomeXG}</p>
                  <p className="text-xs text-slate-500">{homeTeam?.team.name} xG</p>
                </div>
                <span className="text-slate-600 font-bold">vs</span>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{autoXG.suggestedAwayXG}</p>
                  <p className="text-xs text-slate-500">{awayTeam?.team.name} xG</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Based on avg goals scored/conceded over last 5 matches
              </p>
            </div>

            <button
              onClick={handleApplyXG}
              className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200
                ${applied
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-lg hover:shadow-emerald-500/20'
                }`}
            >
              {applied ? '✅ Applied!' : 'Apply xG'}
            </button>
          </div>
        </div>
      )}

      {!homeTeam && !awayTeam && (
        <p className="text-xs text-slate-600 text-center">
          Type at least 3 characters to search for a team
        </p>
      )}
    </div>
  );
};

export default FixtureLookupPanel;
