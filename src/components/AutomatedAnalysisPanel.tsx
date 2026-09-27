import React, { useState } from 'react';
import type { AnalyzedMatch } from '../services/batchAnalyzer';
import { analyzeAIFixtures } from '../services/aiAnalyzer';
import { analyzeLeagueForDate, SUPPORTED_LEAGUES } from '../services/batchAnalyzer';
import aiFixturesData from '../data/ai_fixtures.json';
import AutomatedMatchCard from './AutomatedMatchCard';
import type { AiScrapedFixture } from '../types';

const AutomatedAnalysisPanel: React.FC = () => {
  const [results, setResults] = useState<AnalyzedMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  // Backend form state
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number>(0); // 0 means all leagues
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSeason, setSelectedSeason] = useState<number>(new Date().getFullYear());

  React.useEffect(() => {
    // Fetch leagues from backend database
    fetch('http://localhost:3001/api/leagues')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLeagues(data);
        }
      })
      .catch(err => console.error('Failed to fetch leagues:', err));
  }, []);

  const handleRunJSON = async () => {
    setIsLoading(true);
    setResults([]);
    setProgressMsg('Loading AI Fixtures from JSON...');
    
    setTimeout(() => {
      try {
        const analyzed = analyzeAIFixtures(aiFixturesData as unknown as AiScrapedFixture[], (msg) => {
          setProgressMsg(msg);
        });
        setResults(analyzed);
      } catch (err) {
        console.error(err);
        setProgressMsg('Error running JSON analysis');
      } finally {
        setIsLoading(false);
      }
    }, 100); // small delay to allow UI to render loading state
  };

  const handleRunBackend = async () => {
    setIsLoading(true);
    setResults([]);
    const leagueMsg = selectedLeague === 0 ? 'All Leagues' : `League ${selectedLeague}`;
    setProgressMsg(`Running Backend API for ${leagueMsg} on ${selectedDate}...`);
    
    try {
      // Fetch pre-built AiFixtures from your personal backend
      let url = `http://localhost:3001/api/fixtures?date=${selectedDate}`;
      if (selectedLeague !== 0) {
        url += `&league=${selectedLeague}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Backend API error: ${res.statusText}`);
      
      const fixtures: AiScrapedFixture[] = await res.json();
      
      if (fixtures.length === 0) {
        setProgressMsg(`No fixtures found for ${leagueMsg} on ${selectedDate}`);
        setIsLoading(false);
        return;
      }

      setProgressMsg(`Analyzing ${fixtures.length} matches...`);
      const analyzed = analyzeAIFixtures(fixtures, (msg) => setProgressMsg(msg));
      setResults(analyzed);
    } catch (err) {
      console.error(err);
      setProgressMsg('Error running Backend API analysis');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Hero Control Panel ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-[#090f1e]">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-purple-900/15 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-lg">⚡</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-tight">Automated Analysis</h2>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Batch AI Engine</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* JSON Option */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 space-y-3 hover:border-indigo-500/40 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-lg">📄</span>
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">JSON File</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Analyse all matches from the local <code className="bg-white/5 px-1 rounded text-indigo-300 text-[10px]">ai_fixtures.json</code> file.
              </p>
              <button
                onClick={handleRunJSON}
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40"
              >
                Run JSON Analysis
              </button>
            </div>

            {/* Backend Option */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3 hover:border-emerald-500/40 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-lg">🗄️</span>
                <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Backend API</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Fetch live matches from your sports database and analyse instantly.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedLeague}
                  onChange={(e) => setSelectedLeague(Number(e.target.value))}
                  className="bg-[#04080f] border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white focus:border-emerald-500/50 focus:outline-none"
                  disabled={isLoading}
                >
                  <option value={0}>All Leagues</option>
                  {leagues.length > 0 ? (
                    leagues.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.country})</option>
                    ))
                  ) : (
                    SUPPORTED_LEAGUES.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.country})</option>
                    ))
                  )}
                </select>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-[#04080f] border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white focus:border-emerald-500/50 focus:outline-none"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleRunBackend}
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40"
              >
                Run Backend Analysis
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="mt-4 flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-xs text-indigo-300 font-semibold">{progressMsg}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <h3 className="text-base font-black text-white">
                Analysis Results
                <span className="ml-2 text-sm font-bold text-indigo-400">({results.length} matches)</span>
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((res, i) => (
              <AutomatedMatchCard key={`${res.fixtureId}-${i}`} match={res} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedAnalysisPanel;
