import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce(value: string, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Parse a score string like "2-1" → { scored: 2, conceded: 1 } or null */
function parseScoreStr(s: string): { scored: number; conceded: number } | null {
  const m = s.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  return { scored: parseInt(m[1], 10), conceded: parseInt(m[2], 10) };
}

/** Convert a manual score row to a RecentFixture (team-centric view) */
function manualToFixture(
  row: { score: string; opponent: string },
  teamName: string,
  idx: number
): RecentFixture | null {
  const parsed = parseScoreStr(row.score);
  if (!parsed) return null;
  const { scored, conceded } = parsed;
  const result: 'W' | 'D' | 'L' = scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
  return {
    fixtureId: -(idx + 1),          // negative = manual
    date: new Date().toISOString(),
    homeTeam: teamName,
    awayTeam: row.opponent || 'Unknown',
    homeGoals: scored,
    awayGoals: conceded,
    result,
  };
}

/** Merge manual (priority, most recent) with API fixtures to fill up to 5 */
function mergeFixtures(
  manual: RecentFixture[],
  api: RecentFixture[]
): RecentFixture[] {
  const needed = Math.max(0, 5 - manual.length);
  return [...manual, ...api.slice(0, needed)];
}

// ─── Form badge ───────────────────────────────────────────────────────────────

const FormBadge: React.FC<{ result: 'W' | 'D' | 'L'; manual?: boolean }> = ({ result, manual }) => {
  const styles = {
    W: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    D: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    L: 'bg-red-500/20 text-red-400 border-red-500/40',
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border
        ${styles[result]} ${manual ? 'ring-1 ring-violet-400/60' : ''}`}
      title={manual ? 'Manual entry' : 'API data'}
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
  onChangeText?: (text: string) => void;
}

const TeamSearchInput: React.FC<TeamSearchInputProps> = ({
  label, placeholder, value, selectedTeam, onSelect, onClear, inputId, onChangeText
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(inputValue, 400);
  const { data: results, isFetching, isError } = useTeamSearch(debouncedQuery);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSearching = debouncedQuery.trim().length >= 3;

  useEffect(() => { setInputValue(value); }, [value]);

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
        <div className="flex items-center gap-3 bg-slate-900/70 border border-emerald-500/40 rounded-xl px-4 py-3">
          <img
            src={selectedTeam.team.logo}
            alt={selectedTeam.team.name}
            className="w-8 h-8 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{selectedTeam.team.name}</p>
            <p className="text-slate-500 text-xs">{selectedTeam.team.country}</p>
          </div>
          <button
            onClick={() => {
              onClear();
              onChangeText?.('');
            }}
            className="text-slate-500 hover:text-red-400 transition-colors text-lg leading-none"
            title="Clear"
          >×</button>
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              id={inputId}
              type="text"
              value={inputValue}
              placeholder={placeholder}
              autoComplete="off"
              onChange={(e) => {
                setInputValue(e.target.value);
                setOpen(true);
                onChangeText?.(e.target.value);
              }}
              onFocus={() => setOpen(true)}
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

          {open && isError && (
            <div className="absolute z-[9999] mt-1 w-full bg-slate-800 border border-red-500/40
              rounded-xl shadow-2xl px-4 py-3">
              <p className="text-red-400 text-xs font-semibold">⚠️ API error — check your key or network</p>
              <p className="text-slate-600 text-xs mt-0.5">Ensure VITE_API_FOOTBALL_KEY is set in .env</p>
            </div>
          )}

          {open && isSearching && !isFetching && !isError && results && results.length === 0 && (
            <div className="absolute z-[9999] mt-1 w-full bg-slate-800 border border-slate-600/60
              rounded-xl shadow-2xl px-4 py-3 text-slate-500 text-sm">
              No teams found for "{debouncedQuery}"
            </div>
          )}

          {open && isSearching && !isFetching && !isError && results && results.length > 0 && (
            <div className="absolute z-[9999] mt-1 w-full bg-slate-800 border border-slate-600/60
              rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
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
        </>
      )}
    </div>
  );
};

// ─── Form table (merged API + manual) ────────────────────────────────────────

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
    return <p className="text-slate-600 text-xs">No results yet — add manually below ↓</p>;
  }

  return (
    <div className="space-y-1.5">
      {fixtures.map((f) => {
        const isHome = f.homeTeam === teamName;
        const scored = isHome ? f.homeGoals : f.awayGoals;
        const conceded = isHome ? f.awayGoals : f.homeGoals;
        const isManual = f.fixtureId < 0;
        return (
          <div key={f.fixtureId} className="flex items-center gap-2 text-xs text-slate-400">
            <FormBadge result={f.result} manual={isManual} />
            <span className="font-mono text-white/80 shrink-0">{scored}–{conceded}</span>
            <span className="truncate">{isHome ? `vs ${f.awayTeam}` : `@ ${f.homeTeam}`}</span>
            {isManual && (
              <span className="ml-auto text-violet-500 text-[10px] font-semibold">MANUAL</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Manual score input row ───────────────────────────────────────────────────

const ScoreRow: React.FC<{
  index: number;
  score: string;
  opponent: string;
  onScoreChange: (v: string) => void;
  onOpponentChange: (v: string) => void;
  onRemove: () => void;
}> = ({ index, score, opponent, onScoreChange, onOpponentChange, onRemove }) => {
  const parsed = parseScoreStr(score);
  const result = parsed
    ? parsed.scored > parsed.conceded ? 'W' : parsed.scored < parsed.conceded ? 'L' : 'D'
    : null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-600 text-xs w-3 shrink-0">{index + 1}.</span>
      <input
        type="text"
        placeholder="2-1"
        value={score}
        onChange={(e) => onScoreChange(e.target.value)}
        className={`w-16 bg-slate-900/60 border rounded-lg px-2 py-1.5 text-sm font-mono text-center
          text-white focus:outline-none focus:ring-1 transition-all
          ${result === 'W' ? 'border-emerald-500/50 focus:ring-emerald-500/30'
          : result === 'L' ? 'border-red-500/50 focus:ring-red-500/30'
          : result === 'D' ? 'border-amber-500/50 focus:ring-amber-500/30'
          : 'border-slate-600 focus:ring-blue-500/30'}`}
      />
      {result && <FormBadge result={result} manual />}
      <input
        type="text"
        placeholder="vs Opponent (optional)"
        value={opponent}
        onChange={(e) => onOpponentChange(e.target.value)}
        className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-2 py-1.5
          text-xs text-slate-300 placeholder-slate-600 focus:outline-none
          focus:border-slate-500 focus:ring-1 focus:ring-slate-500/20 transition-all"
      />
      <button
        onClick={onRemove}
        className="text-slate-600 hover:text-red-400 transition-colors text-base leading-none"
      >×</button>
    </div>
  );
};

// ─── Manual entry section ─────────────────────────────────────────────────────

interface ManualRow { score: string; opponent: string; }
const EMPTY_ROW: ManualRow = { score: '', opponent: '' };

const ManualEntrySection: React.FC<{
  homeTeamName: string;
  awayTeamName: string;
  homeRows: ManualRow[];
  awayRows: ManualRow[];
  h2hRows: ManualRow[];
  onHomeChange: (rows: ManualRow[]) => void;
  onAwayChange: (rows: ManualRow[]) => void;
  onH2HChange: (rows: ManualRow[]) => void;
}> = ({ homeTeamName, awayTeamName, homeRows, awayRows, h2hRows, onHomeChange, onAwayChange, onH2HChange }) => {

  const [open, setOpen] = useState(false);

  const editRow = (
    rows: ManualRow[],
    idx: number,
    field: 'score' | 'opponent',
    val: string,
    setter: (r: ManualRow[]) => void
  ) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: val };
    setter(next);
  };

  const removeRow = (rows: ManualRow[], idx: number, setter: (r: ManualRow[]) => void) => {
    setter(rows.filter((_, i) => i !== idx));
  };

  const addRow = (rows: ManualRow[], setter: (r: ManualRow[]) => void) => {
    if (rows.length < 5) setter([...rows, { ...EMPTY_ROW }]);
  };

  const renderSection = (
    title: string,
    color: string,
    rows: ManualRow[],
    setter: (r: ManualRow[]) => void,
    placeholder = 'Enter score (e.g. 2-1)'
  ) => (
    <div>
      <p className={`text-xs font-semibold ${color} uppercase tracking-wider mb-2`}>{title}</p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <ScoreRow
            key={i}
            index={i}
            score={row.score}
            opponent={row.opponent}
            onScoreChange={(v) => editRow(rows, i, 'score', v, setter)}
            onOpponentChange={(v) => editRow(rows, i, 'opponent', v, setter)}
            onRemove={() => removeRow(rows, i, setter)}
          />
        ))}
        {rows.length < 5 && (
          <button
            onClick={() => addRow(rows, setter)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <span className="text-base leading-none">+</span> Add result
          </button>
        )}
        {rows.length === 0 && (
          <p className="text-xs text-slate-600 italic">{placeholder}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="border border-violet-700/30 rounded-xl overflow-hidden mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3
          bg-violet-900/20 hover:bg-violet-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">✏️</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-violet-300">Manual 2026 Results</p>
            <p className="text-xs text-slate-500">
              Override or fill gaps — manual entries take priority over API data
            </p>
          </div>
        </div>
        <span className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="p-4 border-t border-violet-700/20 space-y-5 bg-slate-900/30 animate-fade-in">
          <p className="text-xs text-slate-500 bg-violet-900/20 border border-violet-700/30 rounded-lg px-3 py-2">
            Enter scores from the <strong className="text-violet-300">team's perspective</strong>:
            <br />e.g. "2-1" means the team scored 2, conceded 1 (W). Opponent name is optional.
          </p>

          {homeTeamName && renderSection(
            `🏠 ${homeTeamName} — Last 5`,
            'text-blue-300',
            homeRows,
            onHomeChange,
          )}

          {awayTeamName && renderSection(
            `✈️ ${awayTeamName} — Last 5`,
            'text-violet-300',
            awayRows,
            onAwayChange,
          )}

          {homeTeamName && awayTeamName && renderSection(
            '⚔️ Head to Head',
            'text-amber-300',
            h2hRows,
            onH2HChange,
            `Enter ${homeTeamName} scores vs ${awayTeamName}`
          )}
        </div>
      )}
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
  const [homeInput, setHomeInput] = useState('');
  const [awayInput, setAwayInput] = useState('');
  const [applied, setApplied] = useState(false);

  // Manual entry state
  const [manualHomeRows, setManualHomeRows] = useState<ManualRow[]>([]);
  const [manualAwayRows, setManualAwayRows] = useState<ManualRow[]>([]);
  const [manualH2HRows, setManualH2HRows] = useState<ManualRow[]>([]);

  const homeId = homeTeam?.team.id ?? null;
  const awayId = awayTeam?.team.id ?? null;

  const { data: apiHomeFixtures, isLoading: homeLoading } = useTeamFixtures(homeId);
  const { data: apiAwayFixtures, isLoading: awayLoading } = useTeamFixtures(awayId);
  const { data: apiH2HFixtures, isLoading: h2hLoading } = useHeadToHead(homeId, awayId);

  const effectiveHomeName = homeTeam?.team.name || homeInput.trim() || 'Home';
  const effectiveAwayName = awayTeam?.team.name || awayInput.trim() || 'Away';

  // Convert valid manual rows → RecentFixture[]
  const manualHomeFixtures = useMemo<RecentFixture[]>(() =>
    manualHomeRows
      .map((r, i) => manualToFixture(r, effectiveHomeName, i))
      .filter((f): f is RecentFixture => f !== null),
    [manualHomeRows, effectiveHomeName]
  );

  const manualAwayFixtures = useMemo<RecentFixture[]>(() =>
    manualAwayRows
      .map((r, i) => manualToFixture(r, effectiveAwayName, i))
      .filter((f): f is RecentFixture => f !== null),
    [manualAwayRows, effectiveAwayName]
  );

  const manualH2HFixtures = useMemo<RecentFixture[]>(() =>
    manualH2HRows
      .map((r, i) => manualToFixture(r, effectiveHomeName, i))
      .filter((f): f is RecentFixture => f !== null),
    [manualH2HRows, effectiveHomeName]
  );

  // Merged = manual first (priority), API fills the rest up to 5
  const mergedHomeFixtures = useMemo(
    () => mergeFixtures(manualHomeFixtures, apiHomeFixtures ?? []),
    [manualHomeFixtures, apiHomeFixtures]
  );

  const mergedAwayFixtures = useMemo(
    () => mergeFixtures(manualAwayFixtures, apiAwayFixtures ?? []),
    [manualAwayFixtures, apiAwayFixtures]
  );

  const mergedH2H = useMemo(
    () => mergeFixtures(manualH2HFixtures, apiH2HFixtures ?? []),
    [manualH2HFixtures, apiH2HFixtures]
  );

  // Single xG calculation on merged data
  const autoXG = useAutoXG(
    mergedHomeFixtures.length > 0 ? mergedHomeFixtures : undefined,
    mergedAwayFixtures.length > 0 ? mergedAwayFixtures : undefined,
    effectiveHomeName,
    effectiveAwayName,
  );

  // Sync team names to parent
  useEffect(() => {
    onMatchInfoChange({
      homeTeam: effectiveHomeName !== 'Home' ? effectiveHomeName : matchInfo.homeTeam,
      awayTeam: effectiveAwayName !== 'Away' ? effectiveAwayName : matchInfo.awayTeam,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveHomeName, effectiveAwayName]);

  // Propagate fixture ID for odds lookup
  useEffect(() => {
    onFixtureIdChange(null); // future: link to next fixture ID
  }, [homeTeam, awayTeam, onFixtureIdChange]);

  const handleApplyXG = () => {
    if (!autoXG) return;
    onXGApply(autoXG.suggestedHomeXG, autoXG.suggestedAwayXG);
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const bothSelected = homeTeam && awayTeam;
  const hasAnyData = mergedHomeFixtures.length > 0 || mergedAwayFixtures.length > 0;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <span className="text-2xl">🔍</span> Fixture Lookup & Stats
      </h2>
      <p className="text-slate-500 text-xs mb-1">
        Search teams to auto-load form, or enter 2026 results manually below
      </p>
      <p className="text-amber-500/70 text-xs mb-5 flex items-center gap-1">
        <span>⚠️</span> API: seasons 2022–2024 only · Manual entry overrides with current data
      </p>

      {/* Team search inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <TeamSearchInput
          inputId="home-team-search"
          label="Home Team"
          placeholder="e.g. Celtic, Arsenal…"
          value={homeTeam?.team.name ?? homeInput}
          selectedTeam={homeTeam}
          onChangeText={setHomeInput}
          onSelect={(t) => { setHomeTeam(t); setHomeInput(t.team.name); }}
          onClear={() => { setHomeTeam(null); setHomeInput(''); setManualHomeRows([]); }}
        />
        <TeamSearchInput
          inputId="away-team-search"
          label="Away Team"
          placeholder="e.g. Dundee, Chelsea…"
          value={awayTeam?.team.name ?? awayInput}
          selectedTeam={awayTeam}
          onChangeText={setAwayInput}
          onSelect={(t) => { setAwayTeam(t); setAwayInput(t.team.name); }}
          onClear={() => { setAwayTeam(null); setAwayInput(''); setManualAwayRows([]); }}
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

      {/* Club form cards — merged API + manual */}
      {(homeTeam || awayTeam) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {homeTeam && (
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
              <div className="flex items-center gap-2 mb-3">
                <img src={homeTeam.team.logo} alt={homeTeam.team.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                  {homeTeam.team.name} — Last 5
                </p>
                {manualHomeFixtures.length > 0 && (
                  <span className="ml-auto text-[10px] text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded">
                    {manualHomeFixtures.length} manual
                  </span>
                )}
              </div>
              <FormTable
                fixtures={mergedHomeFixtures}
                teamName={homeTeam.team.name}
                isLoading={homeLoading && manualHomeFixtures.length === 0}
              />
            </div>
          )}

          {awayTeam && (
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
              <div className="flex items-center gap-2 mb-3">
                <img src={awayTeam.team.logo} alt={awayTeam.team.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
                  {awayTeam.team.name} — Last 5
                </p>
                {manualAwayFixtures.length > 0 && (
                  <span className="ml-auto text-[10px] text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded">
                    {manualAwayFixtures.length} manual
                  </span>
                )}
              </div>
              <FormTable
                fixtures={mergedAwayFixtures}
                teamName={awayTeam.team.name}
                isLoading={awayLoading && manualAwayFixtures.length === 0}
              />
            </div>
          )}
        </div>
      )}

      {/* H2H */}
      {bothSelected && (
        <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
              ⚔️ Head to Head — Last 5
            </p>
            {manualH2HFixtures.length > 0 && (
              <span className="ml-auto text-[10px] text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded">
                {manualH2HFixtures.length} manual
              </span>
            )}
          </div>
          {h2hLoading && manualH2HFixtures.length === 0 ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-7 bg-slate-700/40 rounded animate-pulse" />
              ))}
            </div>
          ) : mergedH2H.length ? (
            <div className="space-y-1.5">
              {mergedH2H.map((f) => (
                <div key={f.fixtureId} className="flex items-center gap-2 text-xs">
                  <FormBadge result={f.result} manual={f.fixtureId < 0} />
                  <span className="text-slate-400">
                    {f.homeTeam}{' '}
                    <span className="font-mono text-white font-bold">
                      {f.homeGoals}–{f.awayGoals}
                    </span>{' '}
                    {f.awayTeam}
                  </span>
                  {f.fixtureId >= 0 && (
                    <span className="ml-auto text-slate-600">
                      {new Date(f.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                    </span>
                  )}
                  {f.fixtureId < 0 && (
                    <span className="ml-auto text-violet-500 text-[10px] font-semibold">MANUAL</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-xs">No H2H history — add manually below ↓</p>
          )}
        </div>
      )}

      {/* Manual entry section — ALWAYS SHOWN */}
      <ManualEntrySection
        homeTeamName={effectiveHomeName}
        awayTeamName={effectiveAwayName}
        homeRows={manualHomeRows}
        awayRows={manualAwayRows}
        h2hRows={manualH2HRows}
        onHomeChange={setManualHomeRows}
        onAwayChange={setManualAwayRows}
        onH2HChange={setManualH2HRows}
      />

      {/* Auto-xG suggestion — uses merged data */}
      {hasAnyData && autoXG && (
        <div className="mt-4 p-4 bg-gradient-to-r from-emerald-900/20 to-cyan-900/20
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
                {(manualHomeFixtures.length > 0 || manualAwayFixtures.length > 0) && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                    ✏️ includes manual
                  </span>
                )}
              </p>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{autoXG.suggestedHomeXG}</p>
                  <p className="text-xs text-slate-500">{effectiveHomeName} xG</p>
                </div>
                <span className="text-slate-600 font-bold">vs</span>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{autoXG.suggestedAwayXG}</p>
                  <p className="text-xs text-slate-500">{effectiveAwayName} xG</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {`Based on ${mergedHomeFixtures.length + mergedAwayFixtures.length} total matches`}
                {manualHomeFixtures.length + manualAwayFixtures.length > 0
                  ? ` (${manualHomeFixtures.length + manualAwayFixtures.length} manual + ${
                      (apiHomeFixtures?.length ?? 0) + (apiAwayFixtures?.length ?? 0)
                    } API)`
                  : ''}
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
              {applied ? '✅ Applied!' : 'Apply xG →'}
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
