import React, { useState, useMemo, useEffect } from 'react';
import { simulateRolloverJourney } from '../utils/rolloverSimulator';
import type { RolloverSimOptions } from '../utils/rolloverSimulator';

interface RolloverSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStake?: number;
  defaultOdds?: number;
  defaultStages?: number;
  activeBucketName?: string;
  onApplyToBucket?: (settings: { stake: number; odds: number; stagesCount: number }) => void;
}

const RolloverSimulatorModal: React.FC<RolloverSimulatorProps> = ({
  isOpen,
  onClose,
  defaultStake = 2000,
  defaultOdds = 2.00,
  defaultStages = 20,
  activeBucketName,
  onApplyToBucket,
}) => {
  const [stake, setStake] = useState<number>(defaultStake);
  const [odds, setOdds] = useState<number>(defaultOdds);
  const [stagesCount, setStagesCount] = useState<number>(defaultStages);
  const [winProb, setWinProb] = useState<number>(0.80);
  const [bankPct, setBankPct] = useState<number>(0.25);
  const [activeTab, setActiveTab] = useState<'strategies' | 'table'>('strategies');
  const [applied, setApplied] = useState<boolean>(false);

  // Sync internal state when external bucket settings change
  useEffect(() => {
    setStake(defaultStake);
    setOdds(defaultOdds);
    setStagesCount(defaultStages);
  }, [defaultStake, defaultOdds, defaultStages]);

  const handleApply = () => {
    if (onApplyToBucket) {
      onApplyToBucket({ stake, odds, stagesCount });
      setApplied(true);
      setTimeout(() => setApplied(false), 2500);
    }
  };

  const simResult = useMemo(() => {
    const opts: RolloverSimOptions = {
      startingStake: Math.max(100, stake || 1000),
      stageOdds: Math.max(1.10, odds || 2.00),
      stagesCount: Math.max(1, Math.min(30, stagesCount || 10)),
      winProbabilityPerStage: winProb,
      bankProfitPct: bankPct,
    };
    return simulateRolloverJourney(opts);
  }, [stake, odds, stagesCount, winProb, bankPct]);

  if (!isOpen) return null;

  const { strategies, stages, keyInsights } = simResult;

  return (
    <div className="p-5 sm:p-7 rounded-3xl bg-slate-900/95 border border-indigo-500/50 shadow-2xl space-y-6 animate-section-reveal">
      
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/25 shrink-0">
            🧮
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                Rollover Journey &amp; Risk Simulator
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Interactive Studio
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Mathematical trajectory modeling · Pure compounding vs milestone profit banking
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          {onApplyToBucket && (
            <button
              onClick={handleApply}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 border border-emerald-400/30 active:scale-95"
              title="Apply these simulated parameters to your active campaign"
            >
              <span>{applied ? '✅' : '⚡'}</span>
              <span>{applied ? 'Synced to Campaign!' : `Apply to ${activeBucketName || 'Campaign'}`}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 shadow-sm"
            title="Close simulator panel"
          >
            <span>✕</span>
            <span>Hide</span>
          </button>
        </div>
      </div>

      {/* 1. Control Sliders & Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-slate-950/60 rounded-2xl border border-slate-800">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Starting Stake (₦)
          </label>
          <input
            type="number"
            min={100}
            max={1000000}
            step={500}
            value={stake}
            onChange={(e) => setStake(parseFloat(e.target.value) || 1000)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Target Stage Odds (x)
          </label>
          <input
            type="number"
            min={1.20}
            max={10.0}
            step={0.05}
            value={odds}
            onChange={(e) => setOdds(parseFloat(e.target.value) || 2.00)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Stages ({stagesCount} Days)
            </label>
          </div>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={stagesCount}
            onChange={(e) => setStagesCount(parseInt(e.target.value, 10))}
            className="w-full h-2 rounded-full appearance-none bg-slate-700 accent-indigo-500 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Profit Banked: {Math.round(bankPct * 100)}%
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={0.75}
            step={0.05}
            value={bankPct}
            onChange={(e) => setBankPct(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-slate-700 accent-purple-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('strategies')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'strategies'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          📊 Strategy Comparison
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'table'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          📅 Stage-by-Stage Table
        </button>
      </div>

      {/* 2. Strategies View */}
      {activeTab === 'strategies' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card A: Pure Compounding */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">High Variance</span>
                <span className="text-[10px] font-black bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">
                  All or Nothing
                </span>
              </div>
              <h3 className="text-sm font-black text-white mb-1">{strategies.pureCompound.name}</h3>
              <p className="text-[11px] text-slate-400 mb-4">{strategies.pureCompound.description}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Max Terminal Win:</span>
                <span className="font-mono font-bold text-amber-400">₦{strategies.pureCompound.terminalStakeIfAllWin.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Banked if Bust at S5:</span>
                <span className="font-mono font-bold text-red-400">₦0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Risk of Total Loss:</span>
                <span className="font-mono font-bold text-red-400">{strategies.pureCompound.riskOfTotalLossPct}%</span>
              </div>
            </div>
          </div>

          {/* Card B: Milestone Banking */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-950 border border-indigo-500/40 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-indigo-500/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Recommended</span>
                <span className="text-[10px] font-black bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Protected Floor
                </span>
              </div>
              <h3 className="text-sm font-black text-white mb-1">{strategies.milestoneBanking.name}</h3>
              <p className="text-[11px] text-slate-300 mb-4">{strategies.milestoneBanking.description}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-indigo-500/20 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Guaranteed Banked:</span>
                <span className="font-mono font-black text-emerald-400">₦{strategies.milestoneBanking.cumulativeBankedIfAllWin.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Next Final Stake:</span>
                <span className="font-mono font-bold text-indigo-300">₦{strategies.milestoneBanking.terminalStakeIfAllWin.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Realized:</span>
                <span className="font-mono font-black text-white">₦{strategies.milestoneBanking.totalRealizedIfAllWin.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Card C: Capital Recovery */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zero Risk</span>
                <span className="text-[10px] font-black bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">
                  Free-Roll
                </span>
              </div>
              <h3 className="text-sm font-black text-white mb-1">{strategies.capitalRecovery.name}</h3>
              <p className="text-[11px] text-slate-400 mb-4">{strategies.capitalRecovery.description}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Recovered at S2:</span>
                <span className="font-mono font-bold text-emerald-400">₦{stake.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Terminal Payout:</span>
                <span className="font-mono font-bold text-indigo-300">₦{strategies.capitalRecovery.terminalStakeIfAllWin.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Risk of Capital Loss:</span>
                <span className="font-mono font-bold text-emerald-400">0.0% (Post-S2)</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 3. Stage-by-Stage Table View */}
      {activeTab === 'table' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <th className="p-3">Stage</th>
                <th className="p-3">Stake</th>
                <th className="p-3">Payout ({odds.toFixed(2)}x)</th>
                <th className="p-3 text-emerald-400">Banked ({Math.round(bankPct * 100)}%)</th>
                <th className="p-3 text-indigo-300">Cumul. Banked</th>
                <th className="p-3">Next Stake</th>
                <th className="p-3">Survival %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {stages.map((row) => (
                <tr key={row.stage} className="hover:bg-slate-850/60 transition-colors">
                  <td className="p-3 font-bold text-white">Stage {row.stage}</td>
                  <td className="p-3 text-slate-300">₦{row.stake.toLocaleString()}</td>
                  <td className="p-3 text-amber-300 font-bold">₦{row.payout.toLocaleString()}</td>
                  <td className="p-3 text-emerald-400 font-bold">+₦{row.bankedThisStage.toLocaleString()}</td>
                  <td className="p-3 text-indigo-300 font-black">₦{row.cumulativeBanked.toLocaleString()}</td>
                  <td className="p-3 text-slate-200">₦{row.nextStake.toLocaleString()}</td>
                  <td className="p-3 text-slate-400">{(row.survivalProbability * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Key Insights Alert */}
      <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl space-y-1.5 text-xs text-indigo-200">
        <p className="font-bold text-indigo-300 flex items-center gap-1.5">
          <span>💡</span> Simulation Insights &amp; Optimal Strategy:
        </p>
        {keyInsights.map((insight, idx) => (
          <p key={idx} className="text-[11px] text-indigo-200/80 leading-relaxed">• {insight}</p>
        ))}
      </div>

      {/* Panel Footer */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span className="text-slate-500 text-center sm:text-left">
          Calculated via geometric progression &amp; independent Markov probability chains.
        </span>
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-colors border border-slate-700 w-full sm:w-auto"
        >
          Hide Simulator
        </button>
      </div>

    </div>
  );
};

export default RolloverSimulatorModal;
