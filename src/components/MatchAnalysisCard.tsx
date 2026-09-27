import React, { useState, useRef, useCallback } from 'react';
import type { BBResult, BBMarket } from '../types';
import type { MatchIntelligenceInput } from '../utils/matchIntelligence';
import { applyMatchIntelligence } from '../utils/matchIntelligence';
import { generateScores } from '../utils/generateScores';
import { calculatePoissonProbabilities } from '../utils/poisson';
import { calculateBlendedProbabilities } from '../utils/oddsBlend';
import { calculateMarketProbabilities } from '../utils/marketProbabilities';
import { runMonteCarlo } from '../utils/monteCarlo';
import { runBetBuilder } from '../utils/betBuilder';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MatchCardInput {
  homeTeam: string;
  awayTeam: string;
  homeScores: string[];
  awayScores: string[];
  homeLeagueRank: string;
  awayLeagueRank: string;
  homeWinOdds: string;
  drawOdds: string;
  awayWinOdds: string;
  totalGoalLine: string;
  totalGoalOdds: string;
  homeGoalLine: string;
  homeGoalOdds: string;
  awayGoalLine: string;
  awayGoalOdds: string;
}

export interface MatchCardResult {
  bbResult: BBResult;
  homeForm: string;
  awayForm: string;
  homeAttackRating: number;
  homeDefenseRating: number;
  awayAttackRating: number;
  awayDefenseRating: number;
  adjustedHomeXG: number;
  adjustedAwayXG: number;
  over05: number; over15: number; over25: number; over35: number; over45: number;
  homeOver05: number; homeOver15: number; homeOver25: number;
  awayOver05: number; awayOver15: number; awayOver25: number;
  ticketMarkets: BBMarket[];
}

function emptyInput(): MatchCardInput {
  return {
    homeTeam: '', awayTeam: '',
    homeScores: ['', '', '', '', ''],
    awayScores: ['', '', '', '', ''],
    homeLeagueRank: '', awayLeagueRank: '',
    homeWinOdds: '', drawOdds: '', awayWinOdds: '',
    totalGoalLine: '', totalGoalOdds: '',
    homeGoalLine: '', homeGoalOdds: '',
    awayGoalLine: '', awayGoalOdds: '',
  };
}

// ─── Pipeline helpers ──────────────────────────────────────────────────────────

function parseScoresToForm(scores: string[]): string {
  return scores.map(s => {
    if (!s.trim()) return '';
    const p = s.trim().split('-');
    if (p.length !== 2) return '';
    const h = parseInt(p[0], 10), a = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(a)) return '';
    return h > a ? 'W' : h < a ? 'L' : 'D';
  }).filter(Boolean).join('');
}

function calculateGoalAverages(scores: string[]) {
  let gf = 0;
  let ga = 0;
  let matches = 0;
  for (const s of scores) {
    if (!s.trim()) continue;
    const p = s.trim().split('-');
    if (p.length !== 2) continue;
    const h = parseInt(p[0], 10);
    const a = parseInt(p[1], 10);
    if (!isNaN(h) && !isNaN(a)) {
      gf += h;
      ga += a;
      matches++;
    }
  }
  return { 
    gf: matches > 0 ? gf / matches : 1.35, 
    ga: matches > 0 ? ga / matches : 1.35 
  };
}

function deriveRatings(form: string, rank: number, gf: number, ga: number) {
  const rankRating = Math.max(1, 10 - ((rank - 1) / 23) * 9);
  const wins = (form.match(/W/g) || []).length;
  const boost = form.length > 0 ? (wins / form.length) * 2 - 1 : 0;
  
  const baseRating = rankRating + boost * 1.5;
  
  // Differentiate attack and defense based on goal scoring/conceding patterns
  // Average team scores/concedes ~1.35 per match
  const attackBoost = (gf - 1.35) * 1.5; 
  const defenseBoost = (1.35 - ga) * 1.5; 

  return {
    attack: Math.round(Math.min(10, Math.max(1, baseRating + attackBoost)) * 10) / 10,
    defense: Math.round(Math.min(10, Math.max(1, baseRating + defenseBoost)) * 10) / 10,
  };
}

function goalProbs(scores: string[], probs: Record<string, number>, isHome: boolean) {
  let o05 = 0, o15 = 0, o25 = 0;
  for (const s of scores) {
    const p = probs[s] ?? 0; if (!p) continue;
    const g = isHome ? parseInt(s.split('-')[0], 10) : parseInt(s.split('-')[1], 10);
    if (g > 0.5) o05 += p;
    if (g > 1.5) o15 += p;
    if (g > 2.5) o25 += p;
  }
  return { o05, o15, o25 };
}

export function runAnalysisPipeline(input: MatchCardInput): MatchCardResult {
  const homeOdds = parseFloat(input.homeWinOdds) || 0;
  const drawOdds  = parseFloat(input.drawOdds)    || 0;
  const awayOdds  = parseFloat(input.awayWinOdds) || 0;
  const homeRank  = parseInt(input.homeLeagueRank, 10) || 10;
  const awayRank  = parseInt(input.awayLeagueRank, 10) || 10;

  const homeForm  = parseScoresToForm(input.homeScores);
  const awayForm  = parseScoresToForm(input.awayScores);
  
  const homeAvg = calculateGoalAverages(input.homeScores);
  const awayAvg = calculateGoalAverages(input.awayScores);
  
  const homeR = deriveRatings(homeForm, homeRank, homeAvg.gf, homeAvg.ga);
  const awayR = deriveRatings(awayForm, awayRank, awayAvg.gf, awayAvg.ga);
  
  // Blend goals for and opponent's goals against
  const baseHomeXG = homeAvg.gf * 0.5 + awayAvg.ga * 0.5;
  const baseAwayXG = awayAvg.gf * 0.5 + homeAvg.ga * 0.5;

  const intelInput: MatchIntelligenceInput = {
    baseHomeXG, baseAwayXG,
    homeOdds, drawOdds, awayOdds,
    homeAttackRating: homeR.attack, homeDefenseRating: homeR.defense,
    awayAttackRating: awayR.attack, awayDefenseRating: awayR.defense,
    homeForm, awayForm, h2hHomeBias: 0,
    competition: 'league', homeAdvantageEnabled: true,
    volatilityFactor: 0, pitchTilt: 0,
    homeLeagueRank: homeRank,
    awayLeagueRank: awayRank,
  };

  const intel  = applyMatchIntelligence(intelInput);
  const scores = generateScores(5);
  const poissonProbs = calculatePoissonProbabilities(intel.adjustedHomeXG, intel.adjustedAwayXG, scores, 1.0);

  let finalProbs = poissonProbs;
  if (homeOdds > 1 && drawOdds > 1 && awayOdds > 1) {
    finalProbs = calculateBlendedProbabilities({
      scores, modelProbabilities: poissonProbs, correctScoreOdds: {},
      matchOdds: { homeWin: homeOdds, draw: drawOdds, awayWin: awayOdds }, alpha: 0.6,
    });
  }

  const mcResult = runMonteCarlo(scores, finalProbs, 1000);
  const mcTop3   = mcResult.ranked.slice(0, 3).map(r => r.score);
  const bbResult = runBetBuilder({ scores, probabilities: finalProbs, mcTop3, intelligenceInput: intelInput });
  const mkt      = calculateMarketProbabilities(scores, finalProbs);

  let over05 = 0, over45 = 0;
  for (const s of scores) {
    const p = finalProbs[s] ?? 0; if (!p) continue;
    const [h, a] = s.split('-').map(Number);
    if (h + a > 0.5) over05 += p;
    if (h + a > 4.5) over45 += p;
  }

  const hg = goalProbs(scores, finalProbs, true);
  const ag = goalProbs(scores, finalProbs, false);

  const ticketMarkets: BBMarket[] = [];
  const seenCats = new Set<string>();
  for (const m of bbResult.topPicks) {
    if (!seenCats.has(m.category)) {
      ticketMarkets.push(m);
      seenCats.add(m.category);
    }
    if (ticketMarkets.length >= 4) break;
  }

  return {
    bbResult, homeForm, awayForm,
    homeAttackRating: homeR.attack, homeDefenseRating: homeR.defense,
    awayAttackRating: awayR.attack, awayDefenseRating: awayR.defense,
    adjustedHomeXG: intel.adjustedHomeXG, adjustedAwayXG: intel.adjustedAwayXG,
    over05, over15: mkt.over15, over25: mkt.over25, over35: mkt.over35, over45,
    homeOver05: hg.o05, homeOver15: hg.o15, homeOver25: hg.o25,
    awayOver05: ag.o05, awayOver15: ag.o15, awayOver25: ag.o25,
    ticketMarkets,
  };
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

const FORM_CHIP: Record<string, string> = {
  W: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  D: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  L: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const FormChip: React.FC<{ ch: string }> = ({ ch }) => (
  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-black ${FORM_CHIP[ch] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
    {ch}
  </span>
);

const ProbBar: React.FC<{ label: string; value: number; accent?: string }> = ({ label, value, accent = '#3b82f6' }) => {
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className="text-slate-400">{label}</span>
        <span className="font-black text-white tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  );
};

// ─── Market category definitions ───────────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: string; label: string; accent: string; border: string; bg: string }> = {
  result:        { icon: '🎯', label: 'Match Result',      accent: '#3b82f6', border: 'border-blue-500/20',    bg: 'bg-blue-500/5' },
  double_chance: { icon: '🔀', label: 'Double Chance',     accent: '#8b5cf6', border: 'border-violet-500/20',  bg: 'bg-violet-500/5' },
  total:         { icon: '⚽', label: 'Total Goals',       accent: '#10b981', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
  btts:          { icon: '🤝', label: 'Both Teams Score',  accent: '#f59e0b', border: 'border-amber-500/20',   bg: 'bg-amber-500/5' },
  home:          { icon: '🏠', label: 'Home Team Goals',   accent: '#06b6d4', border: 'border-cyan-500/20',    bg: 'bg-cyan-500/5' },
  away:          { icon: '✈️', label: 'Away Team Goals',   accent: '#f43f5e', border: 'border-rose-500/20',    bg: 'bg-rose-500/5' },
  halftime:      { icon: '⏱️', label: 'Half Time',         accent: '#a78bfa', border: 'border-violet-400/20',  bg: 'bg-violet-400/5' },
  handicap:      { icon: '📊', label: 'Handicap',          accent: '#fb923c', border: 'border-orange-500/20',  bg: 'bg-orange-500/5' },
  multigoals:    { icon: '🎰', label: 'Multi-Goals',       accent: '#e879f9', border: 'border-fuchsia-500/20', bg: 'bg-fuchsia-500/5' },
  corners:       { icon: '📐', label: 'Corners',           accent: '#64748b', border: 'border-slate-500/30',   bg: 'bg-slate-500/5' },
};

const CONF_BADGE: Record<string, string> = {
  high:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low:    'bg-slate-700/50 text-slate-500 border-slate-600/30',
};

interface MarketPillProps { market: BBMarket; isTop: boolean }

const MarketPill: React.FC<MarketPillProps> = ({ market, isTop }) => {
  const pct = Math.round(market.probability * 100);
  const cat = CATEGORY_META[market.category] ?? CATEGORY_META.result;
  return (
    <div className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all
      ${isTop
        ? `${cat.border} ${cat.bg} shadow-sm`
        : 'border-white/5 bg-white/3 hover:bg-white/5'
      }`}
    >
      {isTop && (
        <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
          TOP
        </span>
      )}
      <span className="text-base shrink-0">{market.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-100 truncate leading-tight">{market.label}</p>
        <div className="h-1 rounded-full bg-white/8 mt-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: cat.accent }}
          />
        </div>
      </div>
      <div className="text-right shrink-0 pl-2">
        <div className="text-sm font-black text-white tabular-nums">{pct}%</div>
        <span className={`text-[10px] border rounded-full px-1.5 py-0.5 font-bold ${CONF_BADGE[market.confidence]}`}>
          {market.confidence}
        </span>
      </div>
    </div>
  );
};

interface CategorySectionProps {
  catKey: string;
  markets: BBMarket[];
  topIds: Set<string>;
}

const CategorySection: React.FC<CategorySectionProps> = ({ catKey, markets, topIds }) => {
  const [collapsed, setCollapsed] = useState(false);
  const meta = CATEGORY_META[catKey] ?? { icon: '📌', label: catKey, accent: '#64748b', border: 'border-slate-600/20', bg: 'bg-slate-600/5' };
  const topCount = markets.filter(m => topIds.has(m.id)).length;

  return (
    <div className={`rounded-2xl border overflow-hidden ${meta.border}`}>
      {/* Category header */}
      <button
        onClick={() => setCollapsed(p => !p)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${meta.bg} hover:brightness-110 transition-all`}
      >
        <span className="text-lg">{meta.icon}</span>
        <span className="flex-1 text-left text-sm font-bold text-slate-200">{meta.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{markets.length} markets</span>
          {topCount > 0 && (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
              {topCount} top
            </span>
          )}
          <span className="text-slate-500 text-xs ml-1">{collapsed ? '▶' : '▼'}</span>
        </div>
      </button>

      {/* Markets grid */}
      {!collapsed && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {markets.map(m => (
            <MarketPill key={m.id} market={m} isTop={topIds.has(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Score box row ─────────────────────────────────────────────────────────────

interface ScoreBoxRowProps {
  scores: string[];
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onScore: (idx: number, val: string) => void;
}

function getScoreState(score: string): 'W' | 'D' | 'L' | null {
  const p = score.trim().split('-');
  if (p.length !== 2) return null;
  const h = parseInt(p[0], 10), a = parseInt(p[1], 10);
  if (isNaN(h) || isNaN(a)) return null;
  return h > a ? 'W' : h < a ? 'L' : 'D';
}

const ScoreBoxRow: React.FC<ScoreBoxRowProps> = ({ scores, refs, onScore }) => {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Enter') { e.preventDefault(); refs.current[idx + 1]?.focus(); }
  };
  
  const stateColor = (state: 'W' | 'D' | 'L' | null) => {
    switch (state) {
      case 'W': return 'bg-emerald-900/40 border-emerald-500/50 text-emerald-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50';
      case 'D': return 'bg-amber-900/40 border-amber-500/50 text-amber-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-500/50';
      case 'L': return 'bg-rose-900/40 border-rose-500/50 text-rose-400 focus:border-rose-400 focus:ring-1 focus:ring-rose-500/50';
      default:  return 'bg-slate-900 border-slate-600 text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 shadow-inner';
    }
  };

  return (
    <div className="flex gap-1.5">
      {[0, 1, 2, 3, 4].map(i => {
        const state = getScoreState(scores[i] ?? '');
        return (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text" maxLength={5} placeholder={`${i + 1}`}
            value={scores[i] ?? ''}
            onChange={e => onScore(i, e.target.value)}
            onKeyDown={e => handleKey(e, i)}
            className={`flex-1 min-w-0 border rounded-xl px-1 py-2.5 text-center text-xs font-black font-mono placeholder-slate-700 focus:outline-none transition-all ${stateColor(state)}`}
          />
        );
      })}
    </div>
  );
};

// ─── Shared input components ───────────────────────────────────────────────────

const TextInput: React.FC<{ placeholder?: string; value: string; onChange: (v: string) => void; align?: 'right' }> = 
  ({ placeholder, value, onChange, align }) => (
  <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
    className={`w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white font-bold
      placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 shadow-inner transition-all
      ${align === 'right' ? 'text-right' : ''}`}
  />
);

const NumInput: React.FC<{ placeholder?: string; value: string; onChange: (v: string) => void; align?: 'right' }> =
  ({ placeholder, value, onChange, align }) => (
  <input type="number" step="0.01" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
    className={`w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white font-bold
      placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 shadow-inner transition-all
      ${align === 'right' ? 'text-right' : ''}`}
  />
);

const Label: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <label className={`block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ${right ? 'text-right' : ''}`}>
    {children}
  </label>
);

interface GoalGroupProps {
  label: string;
  lineValue: string;
  oddsValue: string;
  onLine: (v: string) => void;
  onOdds: (v: string) => void;
  includeHalf?: boolean; // adds 0.5
}

const GoalGroup: React.FC<GoalGroupProps> = ({ label, lineValue, oddsValue, onLine, onOdds, includeHalf }) => (
  <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-3">
    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-2.5">{label}</p>
    <div className="flex gap-2">
      <div className="flex-1">
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Line</label>
        <select value={lineValue} onChange={e => onLine(e.target.value)}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white font-bold
            focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-inner"
        >
          <option value="">—</option>
          {includeHalf && <option value="0.5">0.5</option>}
          <option value="1.5">1.5</option>
          <option value="2.5">2.5</option>
          <option value="3.5">3.5</option>
          <option value="4.5">4.5</option>
        </select>
      </div>
      <div className="flex-1">
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Odds</label>
        <input type="number" step="0.01" value={oddsValue} placeholder="1.90" onChange={e => onOdds(e.target.value)}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white font-bold
            focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-inner"
        />
      </div>
    </div>
  </div>
);

// ─── Stat badge ────────────────────────────────────────────────────────────────
const StatBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className={`rounded-lg px-2.5 py-1.5 border text-center ${color}`}>
    <div className="text-[10px] text-current opacity-60 uppercase font-bold">{label}</div>
    <div className="text-sm font-black">{value}</div>
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

export interface MatchAnalysisCardProps {
  id: string;
  onResult: (id: string, result: MatchCardResult | null, input: MatchCardInput) => void;
  onDelete: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (id: string) => void;
}

const MatchAnalysisCard: React.FC<MatchAnalysisCardProps> = ({ id, onResult, onDelete, isCollapsed, onToggleCollapse }) => {
  const [input, setInput]           = useState<MatchCardInput>(emptyInput);
  const [result, setResult]         = useState<MatchCardResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [showAllMarkets, setShowAllMarkets] = useState(false);

  const homeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const awayRefs = useRef<(HTMLInputElement | null)[]>([]);

  const patch = useCallback((p: Partial<MatchCardInput>) => setInput(prev => ({ ...prev, ...p })), []);
  const setHS  = (i: number, v: string) => { const a = [...input.homeScores]; a[i] = v; patch({ homeScores: a }); };
  const setAS  = (i: number, v: string) => { const a = [...input.awayScores];  a[i] = v; patch({ awayScores: a  }); };

  const handlePredict = () => {
    if (!input.homeTeam.trim() || !input.awayTeam.trim()) return;
    setIsPredicting(true);
    setTimeout(() => {
      try {
        const r = runAnalysisPipeline(input);
        setResult(r); onResult(id, r, input);
      } catch (e) { console.error(e); }
      finally { setIsPredicting(false); }
    }, 50);
  };

  const bb = result?.bbResult;

  // Group markets
  const topIds    = new Set((bb?.topPicks ?? []).map(m => m.id));
  const allMarkets = bb?.allMarkets ?? [];
  const displayMkts: BBMarket[] = showAllMarkets ? allMarkets : (bb?.topPicks ?? []);

  const grouped = displayMkts.reduce<Record<string, BBMarket[]>>((acc, m) => {
    const cat = m.category ?? 'other';
    (acc[cat] ??= []).push(m);
    return acc;
  }, {});

  const categoryOrder = ['result', 'double_chance', 'total', 'btts', 'home', 'away', 'halftime', 'handicap', 'multigoals', 'corners'];
  const orderedCats   = [
    ...categoryOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)),
  ];

  const topScores = bb?.scorePool.slice(0, 10) ?? [];

  return (
    <div className="glass rounded-2xl overflow-hidden shadow-2xl w-full animate-fade-in">
      
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div 
        className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/2 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => onToggleCollapse?.(id)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-lg">
            ⚽
          </div>
          <div>
            <p className="text-sm font-black text-white leading-tight">
              {input.homeTeam || 'Home'} <span className="text-slate-600 font-normal text-xs">vs</span> {input.awayTeam || 'Away'}
            </p>
            {result ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-semibold">
                  {isCollapsed && bb ? `Analysis ready — ${bb.mcTop3?.[0] || bb.finalScore || '?'} Predicted` : 'Analysis ready'}
                </span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">Not analysed yet</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-slate-500 hover:text-white transition-colors text-xs">
            {isCollapsed ? '▼ Expand' : '▲ Collapse'}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(id); }} 
            className="text-slate-600 hover:text-rose-400 transition-colors p-1"
          >
            ✕
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* ── Inputs ──────────────────────────────────────────────────────────── */}
          <div className="p-5 space-y-5">

        {/* Team names */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Home Team</Label>
            <TextInput placeholder="e.g. Man City" value={input.homeTeam} onChange={v => patch({ homeTeam: v })} />
            <div className="mt-2">
              <Label>League Rank</Label>
              <NumInput placeholder="e.g. 3" value={input.homeLeagueRank} onChange={v => patch({ homeLeagueRank: v })} />
            </div>
          </div>
          <div>
            <Label right>Away Team</Label>
            <TextInput placeholder="e.g. Arsenal" value={input.awayTeam} onChange={v => patch({ awayTeam: v })} align="right" />
            <div className="mt-2">
              <Label right>League Rank</Label>
              <NumInput placeholder="e.g. 8" value={input.awayLeagueRank} onChange={v => patch({ awayLeagueRank: v })} align="right" />
            </div>
          </div>
        </div>

        {/* Recent Scores */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Home Recent (↵ to advance)</Label>
            <ScoreBoxRow scores={input.homeScores} refs={homeRefs} onScore={setHS} />
          </div>
          <div>
            <Label right>Away Recent (↵ to advance)</Label>
            <ScoreBoxRow scores={input.awayScores} refs={awayRefs} onScore={setAS} />
          </div>
        </div>

        {/* Match Odds + Goal Markets */}
        <div className="bg-white/3 border border-white/6 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Match Odds & Markets</p>

          {/* 1X2 */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Home Win (1)', val: input.homeWinOdds, key: 'homeWinOdds' as const },
              { label: 'Draw  (X)',    val: input.drawOdds,    key: 'drawOdds'    as const },
              { label: 'Away Win (2)', val: input.awayWinOdds, key: 'awayWinOdds' as const },
            ].map(({ label, val, key }) => (
              <div key={key}>
                <Label>{label}</Label>
                <NumInput placeholder="2.00" value={val} onChange={v => patch({ [key]: v })} />
              </div>
            ))}
          </div>

          {/* Goal Markets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <GoalGroup
              label="Total Goals"
              lineValue={input.totalGoalLine} oddsValue={input.totalGoalOdds}
              onLine={v => patch({ totalGoalLine: v })} onOdds={v => patch({ totalGoalOdds: v })}
            />
            <GoalGroup
              label="Home Goals"
              lineValue={input.homeGoalLine} oddsValue={input.homeGoalOdds}
              onLine={v => patch({ homeGoalLine: v })} onOdds={v => patch({ homeGoalOdds: v })}
              includeHalf
            />
            <GoalGroup
              label="Away Goals"
              lineValue={input.awayGoalLine} oddsValue={input.awayGoalOdds}
              onLine={v => patch({ awayGoalLine: v })} onOdds={v => patch({ awayGoalOdds: v })}
              includeHalf
            />
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handlePredict}
          disabled={isPredicting || !input.homeTeam.trim() || !input.awayTeam.trim()}
          className={`w-full py-3.5 rounded-xl font-black text-base transition-all duration-200 select-none
            ${isPredicting || !input.homeTeam.trim() || !input.awayTeam.trim()
              ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99] border border-blue-500/30'
            }`}
        >
          {isPredicting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Running AI Analysis...
            </span>
          ) : '🧠 Run Predictor'}
        </button>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {result && bb && (
        <div className="border-t border-white/5 divide-y divide-white/5">

          {/* Form + Ratings */}
          <div className="px-5 py-5 grid grid-cols-2 gap-6">
            {/* Home */}
            <div>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">{input.homeTeam || 'Home'}</p>
              <div className="flex gap-1 flex-wrap mb-3">
                {result.homeForm
                  ? result.homeForm.split('').map((ch, i) => <FormChip key={i} ch={ch} />)
                  : <span className="text-slate-600 text-xs italic">No form data</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatBadge label="ATK" value={result.homeAttackRating.toFixed(1)} color="text-emerald-300 bg-emerald-500/10 border-emerald-500/20" />
                <StatBadge label="DEF" value={result.homeDefenseRating.toFixed(1)} color="text-blue-300 bg-blue-500/10 border-blue-500/20" />
                <StatBadge label="xG" value={result.adjustedHomeXG.toFixed(2)} color="text-slate-300 bg-white/5 border-white/10" />
              </div>
            </div>
            {/* Away */}
            <div className="text-right">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">{input.awayTeam || 'Away'}</p>
              <div className="flex gap-1 flex-wrap justify-end mb-3">
                {result.awayForm
                  ? result.awayForm.split('').map((ch, i) => <FormChip key={i} ch={ch} />)
                  : <span className="text-slate-600 text-xs italic">No form data</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                <StatBadge label="ATK" value={result.awayAttackRating.toFixed(1)} color="text-emerald-300 bg-emerald-500/10 border-emerald-500/20" />
                <StatBadge label="DEF" value={result.awayDefenseRating.toFixed(1)} color="text-blue-300 bg-blue-500/10 border-blue-500/20" />
                <StatBadge label="xG" value={result.adjustedAwayXG.toFixed(2)} color="text-slate-300 bg-white/5 border-white/10" />
              </div>
            </div>
          </div>

          {/* Correct Scores */}
          <div className="px-5 py-5">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">🎯 Correct Score Predictions</h4>
            <div className="grid grid-cols-5 gap-2">
              {topScores.map((score, i) => {
                const medals = [
                  'bg-amber-500/20 border-amber-400/40 text-amber-200',
                  'bg-slate-500/20 border-slate-400/40 text-slate-200',
                  'bg-orange-800/20 border-orange-700/40 text-orange-300',
                ];
                return (
                  <div key={score} className={`flex flex-col items-center rounded-xl border py-3 px-1 text-center
                    ${i < 3 ? medals[i] : 'bg-white/3 border-white/6 text-slate-400'}`}
                  >
                    <span className="text-base font-black">{score}</span>
                    {i === 0 && <span className="text-[9px] mt-1 opacity-60">Best</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Goal Range */}
          <div className="px-5 py-5">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">📐 Expected Goal Range</h4>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { l: 'Expected', v: bb.goalRange.exact.toFixed(1), s: 'goals' },
                { l: 'Min',      v: String(bb.goalRange.min),      s: 'goals' },
                { l: 'Max',      v: String(bb.goalRange.max),      s: 'goals' },
                { l: '1H / 2H', v: `${bb.goalRange.expectedH1}/${bb.goalRange.expectedH2}`, s: 'split' },
              ].map(({ l, v, s }) => (
                <div key={l} className="bg-white/4 border border-white/6 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">{l}</p>
                  <p className="text-lg font-black text-white mt-1">{v}</p>
                  <p className="text-[9px] text-slate-600">{s}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-3 text-center">
                <p className="text-[9px] text-blue-400 uppercase tracking-wider font-bold">Home xG</p>
                <p className="text-xl font-black text-blue-300 mt-1">{bb.goalRange.homeExact.toFixed(1)}</p>
              </div>
              <div className="bg-rose-500/8 border border-rose-500/15 rounded-xl p-3 text-center">
                <p className="text-[9px] text-rose-400 uppercase tracking-wider font-bold">Away xG</p>
                <p className="text-xl font-black text-rose-300 mt-1">{bb.goalRange.awayExact.toFixed(1)}</p>
              </div>
            </div>
          </div>

          {/* Over Goals */}
          <div className="px-5 py-5">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">📈 Goal Probability</h4>
            <div className="space-y-2.5 mb-5">
              <ProbBar label="Over 0.5" value={result.over05} accent="#10b981" />
              <ProbBar label="Over 1.5" value={result.over15} accent="#3b82f6" />
              <ProbBar label="Over 2.5" value={result.over25} accent="#6366f1" />
              <ProbBar label="Over 3.5" value={result.over35} accent="#f59e0b" />
              <ProbBar label="Over 4.5" value={result.over45} accent="#f43f5e" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">{input.homeTeam || 'Home'} Goals</p>
                <div className="space-y-2">
                  <ProbBar label="Ov 0.5" value={result.homeOver05} accent="#06b6d4" />
                  <ProbBar label="Ov 1.5" value={result.homeOver15} accent="#3b82f6" />
                  <ProbBar label="Ov 2.5" value={result.homeOver25} accent="#6366f1" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-2">{input.awayTeam || 'Away'} Goals</p>
                <div className="space-y-2">
                  <ProbBar label="Ov 0.5" value={result.awayOver05} accent="#fb7185" />
                  <ProbBar label="Ov 1.5" value={result.awayOver15} accent="#f43f5e" />
                  <ProbBar label="Ov 2.5" value={result.awayOver25} accent="#e11d48" />
                </div>
              </div>
            </div>
          </div>

          {/* Markets */}
          <div className="px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                💎 Market Intelligence
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">
                  {showAllMarkets ? `All ${allMarkets.length}` : `Top ${bb.topPicks.length}`}
                </span>
                <button
                  onClick={() => setShowAllMarkets(p => !p)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all
                    ${showAllMarkets
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30'
                      : 'bg-white/5 text-slate-400 border-white/8 hover:bg-white/8 hover:text-white'
                    }`}
                >
                  {showAllMarkets ? '↑ Show Top Only' : '↓ Show All Markets'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {orderedCats.map(cat => (
                <CategorySection key={cat} catKey={cat} markets={grouped[cat]} topIds={topIds} />
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default MatchAnalysisCard;
