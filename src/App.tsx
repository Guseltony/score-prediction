import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  MatchInfo, HistoryEntry, ScoreString,
  PredictionMode, XGSettings, SpinCount, ProbabilityMap,
  AdvancedModifiers,
} from './types';
import { generateScores } from './utils/generateScores';
import { generateId } from './utils/formatTime';
import { calculatePoissonProbabilities } from './utils/poisson';
import { getHistoricalProbabilities } from './utils/historicalWeights';
import { calculateMarketProbabilities } from './utils/marketProbabilities';
import { applySmartFilter } from './utils/smartFilter';
import type { SmartFilterResult } from './utils/smartFilter';
import { saveHistory, loadHistory, clearPersistedHistory } from './utils/localStorage';
import { storageGet, storageSet, STORAGE_KEYS } from './utils/storage';
import { calculateBlendedProbabilities } from './utils/oddsBlend';
import { useRandomScore } from './hooks/useRandomScore';
import { useFixtureOdds } from './hooks/useFixtureOdds';
import type { ParsedMatchOdds, ParsedCorrectScoreOdds } from './api/types';

import Header from './components/Header';
import FixtureLookupPanel from './components/FixtureLookupPanel';
import ScoreGenerator from './components/ScoreGenerator';
import XGControls from './components/XGControls';
import ScoreGrid from './components/ScoreGrid';
import SpinnerControls from './components/SpinnerControls';
import SpinResults from './components/SpinResults';
import FrequencyTable from './components/FrequencyTable';
import SuggestionCard from './components/SuggestionCard';
import MonteCarloPanel from './components/MonteCarloPanel';
import MarketDashboard from './components/MarketDashboard';
import SmartFilterPanel from './components/SmartFilterPanel';
import OddsDashboardPanel from './components/OddsDashboardPanel';
import History from './components/History';
import Footer from './components/Footer';

const DEFAULT_MAX_GOALS = 5;
const DEFAULT_XG: XGSettings = { homeXG: 1.5, awayXG: 1.2 };
const DEFAULT_MODIFIERS: AdvancedModifiers = {
  homeAdvantageEnabled: false,
  formWeightRecency: 0,
};
const DEFAULT_FIXTURE: MatchInfo = { homeTeam: '', awayTeam: '' };
const DEFAULT_ODDS_ALPHA = 0.6;

function App() {
  // ── Core state (booted from localStorage) ────────────────────────────────
  const [matchInfo, setMatchInfo] = useState<MatchInfo>(
    () => storageGet<MatchInfo>(STORAGE_KEYS.LAST_FIXTURE, DEFAULT_FIXTURE)
  );
  const [maxGoals, setMaxGoals] = useState<number>(
    () => storageGet<number>(STORAGE_KEYS.MAX_GOALS, DEFAULT_MAX_GOALS)
  );
  const [allScores, setAllScores] = useState<ScoreString[]>(() => {
    const saved = storageGet<number>(STORAGE_KEYS.MAX_GOALS, DEFAULT_MAX_GOALS);
    return generateScores(saved);
  });
  const [selectedScores, setSelectedScores] = useState<Set<ScoreString>>(() => {
    const saved = storageGet<number>(STORAGE_KEYS.MAX_GOALS, DEFAULT_MAX_GOALS);
    return new Set(generateScores(saved));
  });

  // ── Prediction model state (booted from localStorage) ─────────────────────
  const [predictionMode, setPredictionMode] = useState<PredictionMode>(
    () => storageGet<PredictionMode>(STORAGE_KEYS.PREDICTION_MODE, 'poisson')
  );
  const [xgSettings, setXGSettings] = useState<XGSettings>(
    () => storageGet<XGSettings>(STORAGE_KEYS.XG_SETTINGS, DEFAULT_XG)
  );

  // ── V2: Advanced modifiers (booted from localStorage) ────────────────────
  const [modifiers, setModifiers] = useState<AdvancedModifiers>(
    () => storageGet<AdvancedModifiers>(STORAGE_KEYS.MODIFIERS, DEFAULT_MODIFIERS)
  );

  // ── V2: Smart filter (booted from localStorage) ──────────────────────────
  const [smartFilterEnabled, setSmartFilterEnabled] = useState<boolean>(
    () => storageGet<boolean>(STORAGE_KEYS.SMART_FILTER, false)
  );
  const [smartFilterResult, setSmartFilterResult] = useState<SmartFilterResult | null>(null);

  // ── V3: Odds-blended state ────────────────────────────────────────────────
  const [oddsAlpha, setOddsAlpha] = useState<number>(
    () => storageGet<number>(STORAGE_KEYS.ODDS_ALPHA, DEFAULT_ODDS_ALPHA)
  );
  const [fixtureId, setFixtureId] = useState<number | null>(null);

  // ── Live odds via TanStack Query ──────────────────────────────────────
  const {
    data: oddsData,
    isLoading: oddsLoading,
  } = useFixtureOdds(fixtureId);

  // Stable memoized values — prevents new object references on every render
  // (a bare `?? {}` creates a new object each render, causing infinite update loops)
  const liveMatchOdds = useMemo<ParsedMatchOdds | null>(
    () => oddsData?.matchOdds ?? null,
    [oddsData],
  );
  const liveCorrectScoreOdds = useMemo<ParsedCorrectScoreOdds>(
    () => oddsData?.correctScoreOdds ?? {},
    [oddsData],
  );
  // prefilledOdds is derived directly from liveCorrectScoreOdds — no setState needed
  const prefilledOdds = liveCorrectScoreOdds;
  const hasLiveOdds = Object.keys(liveCorrectScoreOdds).length > 0 || liveMatchOdds !== null;

  // ── Spin state ────────────────────────────────────────────────────────────
  const [multiSpinCount, setMultiSpinCount] = useState<SpinCount>(10);
  const [totalSpins, setTotalSpins] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  // ── History — load from localStorage on mount ─────────────────────────────
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const { isSpinning, singleResult, spinSession, spinOnce, spinN } = useRandomScore();

  // ── Computed probability map ──────────────────────────────────────────────
  const selectedArray = useMemo(() => Array.from(selectedScores), [selectedScores]);

  // Home advantage multiplier derived from modifiers
  const homeAdvMultiplier = predictionMode === 'poisson' && modifiers.homeAdvantageEnabled ? 1.12 : 1.0;

  const poissonProbabilities = useMemo<ProbabilityMap>(() => {
    if (selectedArray.length === 0) return {};
    return calculatePoissonProbabilities(
      xgSettings.homeXG,
      xgSettings.awayXG,
      selectedArray,
      homeAdvMultiplier,
    );
  }, [xgSettings, selectedArray, homeAdvMultiplier]);

  const probabilities = useMemo<ProbabilityMap>(() => {
    if (selectedArray.length === 0) return {};

    if (predictionMode === 'poisson') return poissonProbabilities;

    if (predictionMode === 'historical') return getHistoricalProbabilities(selectedArray);

    if (predictionMode === 'odds-blended') {
      return calculateBlendedProbabilities({
        scores: selectedArray,
        modelProbabilities: poissonProbabilities,
        correctScoreOdds: liveCorrectScoreOdds,
        matchOdds: liveMatchOdds,
        alpha: oddsAlpha,
      });
    }

    // Uniform: equal weight
    const uniform: ProbabilityMap = {};
    selectedArray.forEach((s) => { uniform[s] = 1 / selectedArray.length; });
    return uniform;
  }, [predictionMode, poissonProbabilities, selectedArray, liveCorrectScoreOdds, liveMatchOdds, oddsAlpha]);

  // ── V2: Market probabilities ──────────────────────────────────────────────
  const marketProbabilities = useMemo(
    () => calculateMarketProbabilities(selectedArray, probabilities),
    [selectedArray, probabilities],
  );

  // ── Score generation ──────────────────────────────────────────────────────
  const regenerateScores = useCallback(() => {
    const scores = generateScores(maxGoals);
    setAllScores(scores);
    setSelectedScores(new Set(scores));
  }, [maxGoals]);

  useEffect(() => { regenerateScores(); }, [maxGoals]);

  // ── Score selection ───────────────────────────────────────────────────────
  const toggleScore = useCallback((score: ScoreString) => {
    setSelectedScores((prev) => {
      const next = new Set(prev);
      next.has(score) ? next.delete(score) : next.add(score);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedScores(new Set(allScores)), [allScores]);
  const clearAll = useCallback(() => setSelectedScores(new Set()), []);

  // ── Spin options ──────────────────────────────────────────────────────────
  const spinOptions = useMemo(() => ({ mode: predictionMode, probabilities }), [predictionMode, probabilities]);

  // ── Spin handlers ─────────────────────────────────────────────────────────
  const handleSpinOnce = useCallback(async () => {
    await spinOnce(selectedArray, spinOptions);
    setTotalSpins((n) => n + 1);
    setGeneratedAt(new Date());
  }, [spinOnce, selectedArray, spinOptions]);

  const handleSpinMulti = useCallback(async () => {
    await spinN(selectedArray, multiSpinCount, spinOptions);
    setTotalSpins((n) => n + multiSpinCount);
    setGeneratedAt(new Date());
  }, [spinN, selectedArray, multiSpinCount, spinOptions]);

  // ── Add to history ────────────────────────────────────────────────────────
  useEffect(() => {
    if (singleResult && !isSpinning) {
      const entry: HistoryEntry = {
        id: generateId(),
        matchInfo,
        prediction: singleResult,
        timestamp: new Date(),
        spinCount: 1,
        selectedScoresCount: selectedScores.size,
        suggestedScores: [singleResult],
        predictionMode,
        fixtureId: fixtureId ?? undefined,
        oddsUsed: Object.keys(liveCorrectScoreOdds).length > 0 ? liveCorrectScoreOdds : undefined,
      };
      setHistory((prev) => [...prev, entry]);
    }
  }, [singleResult, isSpinning]);

  useEffect(() => {
    if (spinSession && !isSpinning) {
      const prediction = spinSession.suggestedScores[0] ?? '';
      const entry: HistoryEntry = {
        id: generateId(),
        matchInfo,
        prediction,
        timestamp: new Date(),
        spinCount: spinSession.spinCount,
        selectedScoresCount: selectedScores.size,
        suggestedScores: spinSession.suggestedScores,
        predictionMode,
        fixtureId: fixtureId ?? undefined,
        oddsUsed: Object.keys(liveCorrectScoreOdds).length > 0 ? liveCorrectScoreOdds : undefined,
      };
      setHistory((prev) => [...prev, entry]);
    }
  }, [spinSession, isSpinning]);

  // ── Persist history ───────────────────────────────────────────────────────
  useEffect(() => { saveHistory(history); }, [history]);

  // ── Persist UI preferences ────────────────────────────────────────────────
  useEffect(() => { storageSet(STORAGE_KEYS.XG_SETTINGS, xgSettings); }, [xgSettings]);
  useEffect(() => { storageSet(STORAGE_KEYS.PREDICTION_MODE, predictionMode); }, [predictionMode]);
  useEffect(() => { storageSet(STORAGE_KEYS.MODIFIERS, modifiers); }, [modifiers]);
  useEffect(() => { storageSet(STORAGE_KEYS.SMART_FILTER, smartFilterEnabled); }, [smartFilterEnabled]);
  useEffect(() => { storageSet(STORAGE_KEYS.MAX_GOALS, maxGoals); }, [maxGoals]);
  useEffect(() => { storageSet(STORAGE_KEYS.LAST_FIXTURE, matchInfo); }, [matchInfo]);
  useEffect(() => { storageSet(STORAGE_KEYS.ODDS_ALPHA, oddsAlpha); }, [oddsAlpha]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    clearPersistedHistory();
  }, []);

  // ── Smart filter handler ──────────────────────────────────────────────────
  const handleSmartFilterToggle = useCallback((enabled: boolean) => {
    setSmartFilterEnabled(enabled);
    setSmartFilterResult(
      enabled ? applySmartFilter(selectedArray, xgSettings, liveMatchOdds) : null
    );
  }, [selectedArray, xgSettings, liveMatchOdds]);

  const handleSmartFilterResult = useCallback((result: SmartFilterResult | null) => {
    setSmartFilterResult(result);
  }, []);

  // ── xG apply handler (from FixtureLookupPanel) ────────────────────────────
  const handleXGApply = useCallback((homeXG: number, awayXG: number) => {
    setXGSettings({ homeXG, awayXG });
    if (predictionMode === 'uniform') setPredictionMode('poisson');
  }, [predictionMode]);

  // ── Derived display values ────────────────────────────────────────────────
  const suggestedScores = spinSession?.suggestedScores ?? (singleResult ? [singleResult] : []);
  const hasResult = !!(singleResult || spinSession);
  const showSingleResult = (singleResult || isSpinning) && !spinSession;
  const showMultiResult = spinSession != null;

  // Show analytics panels only for analytical modes
  const isAnalyticsMode = predictionMode !== 'uniform';

  // Market dashboard only makes sense when there's a fixture context
  // (team names entered or xG changed from defaults)
  const DEFAULT_HOME_XG = 1.5;
  const DEFAULT_AWAY_XG = 1.2;
  const hasFixtureContext =
    !!(matchInfo.homeTeam || matchInfo.awayTeam) ||
    xgSettings.homeXG !== DEFAULT_HOME_XG ||
    xgSettings.awayXG !== DEFAULT_AWAY_XG;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Row 1: Fixture lookup + Score generator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FixtureLookupPanel
            matchInfo={matchInfo}
            onMatchInfoChange={setMatchInfo}
            onXGApply={handleXGApply}
            onFixtureIdChange={setFixtureId}
          />
          <ScoreGenerator
            maxGoals={maxGoals}
            onMaxGoalsChange={setMaxGoals}
            onRegenerate={regenerateScores}
          />
        </div>

        {/* Row 2: Prediction model controls (full width) */}
        <XGControls
          mode={predictionMode}
          xgSettings={xgSettings}
          modifiers={modifiers}
          oddsAlpha={oddsAlpha}
          hasLiveOdds={hasLiveOdds}
          onModeChange={setPredictionMode}
          onXGChange={setXGSettings}
          onModifiersChange={setModifiers}
          onOddsAlphaChange={setOddsAlpha}
        />

        {/* V2: Smart Filter — analytical modes only */}
        {(predictionMode === 'poisson' || predictionMode === 'odds-blended') && (
          <SmartFilterPanel
            scores={selectedArray}
            xgSettings={xgSettings}
            enabled={smartFilterEnabled}
            onToggle={handleSmartFilterToggle}
            onFilterResult={handleSmartFilterResult}
          />
        )}

        {/* Score selection grid with heatmap */}
        <ScoreGrid
          scores={allScores}
          selectedScores={selectedScores}
          probabilities={probabilities}
          predictionMode={predictionMode}
          smartFilterResult={smartFilterEnabled ? smartFilterResult : null}
          onToggle={toggleScore}
          onSelectAll={selectAll}
          onClearAll={clearAll}
        />

        {/* V2: Market Probabilities Dashboard — only when there's fixture context */}
        {isAnalyticsMode && hasFixtureContext && (
          <MarketDashboard
            markets={marketProbabilities}
            predictionMode={predictionMode}
            homeTeam={matchInfo.homeTeam || undefined}
            awayTeam={matchInfo.awayTeam || undefined}
          />
        )}

        {/* V3: Bookmaker Odds Dashboard — shown when odds are available */}
        {isAnalyticsMode && (
          <OddsDashboardPanel
            matchOdds={liveMatchOdds}
            correctScoreOdds={liveCorrectScoreOdds}
            modelProbabilities={probabilities}
            bookmakerName={oddsData?.bookmakerName ?? ''}
            isLoading={oddsLoading}
          />
        )}

        {/* Spinner controls */}
        <SpinnerControls
          disabled={selectedScores.size === 0}
          isSpinning={isSpinning}
          onSpinOnce={handleSpinOnce}
          onSpinMulti={handleSpinMulti}
          multiSpinCount={multiSpinCount}
          onMultiSpinCountChange={setMultiSpinCount}
          selectedCount={selectedScores.size}
        />

        {/* Single result */}
        {showSingleResult && (
          <SpinResults singleResult={singleResult} isSpinning={isSpinning} />
        )}

        {/* Multi-spin result table */}
        {showMultiResult && (
          <FrequencyTable
            session={spinSession!}
            isSpinning={isSpinning}
            probabilities={probabilities}
            predictionMode={predictionMode}
          />
        )}

        {/* Summary card with confidence */}
        {hasResult && (
          <SuggestionCard
            matchInfo={matchInfo}
            selectedCount={selectedScores.size}
            totalSpins={totalSpins}
            suggestedScores={suggestedScores}
            singleResult={singleResult}
            generatedAt={generatedAt}
            predictionMode={predictionMode}
            probabilities={probabilities}
          />
        )}

        {/* V2: Monte Carlo Simulation Panel — analytical modes */}
        {isAnalyticsMode && (
          <MonteCarloPanel
            scores={selectedArray}
            probabilities={probabilities}
            predictionMode={predictionMode}
            smartFilter={smartFilterEnabled ? smartFilterResult : null}
            prefilledOdds={prefilledOdds}
          />
        )}

        {/* History (persisted across sessions) */}
        <History entries={history} onClear={handleClearHistory} onUpdate={setHistory} />

      </main>

      <Footer />
    </div>
  );
}

export default App;
