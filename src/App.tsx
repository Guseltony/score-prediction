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
import { useRandomScore } from './hooks/useRandomScore';

import Header from './components/Header';
import MatchForm from './components/MatchForm';
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
import History from './components/History';
import Footer from './components/Footer';

const DEFAULT_MAX_GOALS = 5;
const DEFAULT_XG: XGSettings = { homeXG: 1.5, awayXG: 1.2 };
const DEFAULT_MODIFIERS: AdvancedModifiers = {
  homeAdvantageEnabled: false,
  formWeightRecency: 0,
};

function App() {
  // ── Core state ────────────────────────────────────────────────────────────
  const [matchInfo, setMatchInfo] = useState<MatchInfo>({ homeTeam: '', awayTeam: '' });
  const [maxGoals, setMaxGoals] = useState(DEFAULT_MAX_GOALS);
  const [allScores, setAllScores] = useState<ScoreString[]>(() => generateScores(DEFAULT_MAX_GOALS));
  const [selectedScores, setSelectedScores] = useState<Set<ScoreString>>(
    () => new Set(generateScores(DEFAULT_MAX_GOALS))
  );

  // ── Prediction model state ────────────────────────────────────────────────
  const [predictionMode, setPredictionMode] = useState<PredictionMode>('poisson');
  const [xgSettings, setXGSettings] = useState<XGSettings>(DEFAULT_XG);

  // ── V2: Advanced modifiers ────────────────────────────────────────────────
  const [modifiers, setModifiers] = useState<AdvancedModifiers>(DEFAULT_MODIFIERS);

  // ── V2: Smart filter ─────────────────────────────────────────────────────
  const [smartFilterEnabled, setSmartFilterEnabled] = useState(false);
  const [smartFilterResult, setSmartFilterResult] = useState<SmartFilterResult | null>(null);

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

  const probabilities = useMemo<ProbabilityMap>(() => {
    if (selectedArray.length === 0) return {};
    if (predictionMode === 'poisson') {
      return calculatePoissonProbabilities(
        xgSettings.homeXG,
        xgSettings.awayXG,
        selectedArray,
        homeAdvMultiplier,
      );
    }
    if (predictionMode === 'historical') {
      return getHistoricalProbabilities(selectedArray);
    }
    // Uniform: equal weight
    const uniform: ProbabilityMap = {};
    selectedArray.forEach((s) => { uniform[s] = 1 / selectedArray.length; });
    return uniform;
  }, [predictionMode, xgSettings, selectedArray, homeAdvMultiplier]);

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
      };
      setHistory((prev) => [...prev, entry]);
    }
  }, [spinSession, isSpinning]);

  // ── Persist history ───────────────────────────────────────────────────────
  useEffect(() => { saveHistory(history); }, [history]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    clearPersistedHistory();
  }, []);

  // ── Smart filter handler ──────────────────────────────────────────────────
  const handleSmartFilterToggle = useCallback((enabled: boolean) => {
    setSmartFilterEnabled(enabled);
    setSmartFilterResult(enabled ? applySmartFilter(selectedArray, xgSettings) : null);
  }, [selectedArray, xgSettings]);

  const handleSmartFilterResult = useCallback((result: SmartFilterResult | null) => {
    setSmartFilterResult(result);
  }, []);

  // ── Derived display values ────────────────────────────────────────────────
  const suggestedScores = spinSession?.suggestedScores ?? (singleResult ? [singleResult] : []);
  const hasResult = !!(singleResult || spinSession);
  const showSingleResult = (singleResult || isSpinning) && !spinSession;
  const showMultiResult = spinSession != null;

  // Show analytics panels only for analytical modes
  const isAnalyticsMode = predictionMode !== 'uniform';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Row 1: Match info + Score generator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MatchForm matchInfo={matchInfo} onChange={setMatchInfo} />
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
          homeTeamName={matchInfo.homeTeam}
          awayTeamName={matchInfo.awayTeam}
          modifiers={modifiers}
          onModeChange={setPredictionMode}
          onXGChange={setXGSettings}
          onModifiersChange={setModifiers}
        />

        {/* V2: Smart Filter — Poisson mode only */}
        {predictionMode === 'poisson' && (
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

        {/* V2: Market Probabilities Dashboard — analytical modes only */}
        {isAnalyticsMode && (
          <MarketDashboard
            markets={marketProbabilities}
            predictionMode={predictionMode}
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
          />
        )}

        {/* History (persisted across sessions) */}
        <History entries={history} onClear={handleClearHistory} />

      </main>

      <Footer />
    </div>
  );
}

export default App;
