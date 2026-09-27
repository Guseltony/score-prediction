import React, { useState } from 'react';
import type { AnalyzedMatch } from '../services/batchAnalyzer';

interface Props {
  match: AnalyzedMatch;
}

type TabType = 'picks' | 'goals' | 'h2h' | 'risks';

// ── Correct market IDs from betBuilder.ts ──────────────────────────────────────
// Total: over15, over25, over35, over45
// Under: under25, under35
// BTTS:  gg (yes), ng (no)
// Home:  home_ov05, home_ov15, home_ov25
// Away:  away_ov05, away_ov15, away_ov25

const AutomatedMatchCard: React.FC<Props> = ({ match }) => {
  const [activeTab, setActiveTab] = useState<TabType>('picks');
  const [expanded, setExpanded] = useState(false);

  const { bbResult, intelligenceInput, homeTeam, awayTeam, date, rawAiFixture } = match;

  const homeGoals   = bbResult.goalRange?.homeExact  ?? 0;
  const awayGoals   = bbResult.goalRange?.awayExact  ?? 0;
  const totalGoals  = bbResult.goalRange?.exact       ?? 0;
  const h1Goals     = bbResult.goalRange?.expectedH1 ?? 0;
  const h2Goals     = bbResult.goalRange?.expectedH2 ?? 0;

  const homeRank    = intelligenceInput.homeLeagueRank ?? 0;
  const awayRank    = intelligenceInput.awayLeagueRank ?? 0;
  const homeForm    = intelligenceInput.homeForm || '—';
  const awayForm    = intelligenceInput.awayForm || '—';

  // Correct score predictions
  const csFirst    = bbResult.mcTop3?.[0] ?? bbResult.finalScore ?? '-';
  const csSecond   = bbResult.mcTop3?.[1] ?? null;
  const csThird    = bbResult.mcTop3?.[2] ?? null;
  const [csh, csa] = csFirst.split('-').map(Number);

  // Market lookup helpers — using REAL IDs from betBuilder.ts
  const mkt  = (id: string) => bbResult.allMarkets.find(m => m.id === id);
  const prob = (id: string) => mkt(id)?.probability ?? 0;
  const pct  = (id: string) => `${(prob(id) * 100).toFixed(0)}%`;

  // Risk badge
  const riskLevel = bbResult.riskAnalysis?.level ?? 'safe';
  const riskStyle: Record<string, { stripe: string; badge: string; glow: string }> = {
    safe:         { stripe: 'from-emerald-500 to-teal-400',    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', glow: 'shadow-emerald-500/10' },
    moderate:     { stripe: 'from-amber-500 to-yellow-400',    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',     glow: 'shadow-amber-500/10' },
    dangerous:    { stripe: 'from-rose-500 to-red-400',        badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',        glow: 'shadow-rose-500/10' },
    extreme_danger:{ stripe: 'from-red-600 to-pink-500',       badge: 'bg-red-600/15 text-red-300 border-red-600/40',          glow: 'shadow-red-600/10' },
  };
  const rs = riskStyle[riskLevel] ?? riskStyle.safe;

  // Form letter colouring
  const formChar = (ch: string) => {
    if (ch === 'W') return 'text-emerald-400 font-black';
    if (ch === 'D') return 'text-amber-400 font-bold';
    return 'text-rose-400 font-bold';
  };

  // Tactical note from rank gap engine
  const rankGap  = homeRank && awayRank ? Math.abs(homeRank - awayRank) : null;
  const tactical = (intelligenceInput as any).__tacticalNote as string | undefined;

  // ── Progress bar component ─────────────────────────────────────────────────
  const Bar: React.FC<{ label: string; val: number; colorClass?: string; delay?: number }> = ({
    label, val, colorClass = '', delay = 0
  }) => {
    const p = Math.min(1, Math.max(0, val));
    const pctNum = Math.round(p * 100);
    const auto  = p >= 0.65 ? 'bar-high' : p >= 0.45 ? 'bar-mid' : 'bar-low';
    return (
      <div className="space-y-1" style={{ animationDelay: `${delay}ms` }}>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-semibold">{label}</span>
          <span className={`text-[10px] font-black ${p >= 0.65 ? 'text-emerald-400' : p >= 0.45 ? 'text-amber-400' : 'text-rose-400'}`}>
            {pctNum}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden relative">
          <div
            className={`h-full rounded-full animate-bar-grow ${colorClass || auto}`}
            style={{ width: `${pctNum}%` }}
          />
        </div>
      </div>
    );
  };

  const tabs: { id: TabType; icon: string; label: string }[] = [
    { id: 'picks', icon: '🎯', label: 'Picks' },
    { id: 'goals', icon: '⚽', label: 'Goals' },
    { id: 'h2h',   icon: '🤝', label: 'H2H' },
    { id: 'risks', icon: '⚠️', label: 'Risks' },
  ];

  return (
    <div className={`relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-[#090f1e] shadow-2xl ${rs.glow} transition-all duration-300 hover:scale-[1.01] hover:border-white/20 animate-fade-in`}>

      {/* Top gradient stripe */}
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${rs.stripe} opacity-90`} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        {/* Meta row */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              {rawAiFixture?.competition?.name ?? match.country ?? '—'} · {date}
            </p>
            {rankGap !== null && rankGap <= 2 && (
              <p className="text-[10px] text-purple-400 font-semibold mt-0.5">
                ⚖️ Closely ranked rivals (#{homeRank} vs #{awayRank})
              </p>
            )}
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${rs.badge}`}>
            {bbResult.riskAnalysis?.badgeLabel ?? riskLevel.toUpperCase()}
          </span>
        </div>

        {/* Teams + Score */}
        <div className="flex items-center gap-2">
          {/* Home team */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate leading-tight">{homeTeam}</p>
            <div className="flex items-center gap-0.5 mt-0.5">
              {homeRank > 0 && (
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded font-bold mr-1">#{homeRank}</span>
              )}
              {homeForm.split('').slice(0, 5).map((ch, i) => (
                <span key={i} className={`text-[9px] ${formChar(ch)}`}>{ch}</span>
              ))}
            </div>
          </div>

          {/* Score block */}
          <div className="flex flex-col items-center shrink-0 px-2">
            <div className="flex items-center gap-1">
              <span className="text-3xl font-black text-white tabular-nums leading-none">
                {isNaN(csh) ? '?' : csh}
              </span>
              <span className="text-slate-600 text-xl font-black">–</span>
              <span className="text-3xl font-black text-white tabular-nums leading-none">
                {isNaN(csa) ? '?' : csa}
              </span>
            </div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
              Predicted
            </p>
            {(csSecond || csThird) && (
              <div className="flex gap-1 mt-1">
                {csSecond && (
                  <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5">
                    {csSecond}
                  </span>
                )}
                {csThird && (
                  <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5">
                    {csThird}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Away team */}
          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-black text-white truncate leading-tight">{awayTeam}</p>
            <div className="flex items-center justify-end gap-0.5 mt-0.5">
              {awayForm.split('').slice(0, 5).map((ch, i) => (
                <span key={i} className={`text-[9px] ${formChar(ch)}`}>{ch}</span>
              ))}
              {awayRank > 0 && (
                <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 rounded font-bold ml-1">#{awayRank}</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-3 grid grid-cols-4 rounded-xl overflow-hidden border border-white/5 text-center">
          {[
            { label: 'xG', value: `${homeGoals.toFixed(1)}–${awayGoals.toFixed(1)}`, color: 'text-indigo-300' },
            { label: '1H',  value: h1Goals.toFixed(1), color: 'text-cyan-300' },
            { label: '2H',  value: h2Goals.toFixed(1), color: 'text-cyan-300' },
            { label: 'Und2.5', value: pct('under25'), color: 'text-rose-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="py-2 bg-white/[0.03] border-r border-white/5 last:border-0">
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
              <p className={`text-xs font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
      <div className="flex border-t border-b border-white/5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-bold transition-all duration-200
              ${activeTab === t.id
                ? 'bg-indigo-600/20 text-indigo-300 border-b-2 border-indigo-500'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-b-2 border-transparent'
              }`}
          >
            <span className="text-xs">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ───────────────────────────────────────────────────── */}
      <div className="p-4 flex-1">

        {/* PICKS TAB */}
        {activeTab === 'picks' && (
          <div className="space-y-1.5">
            {bbResult.topPicks.slice(0, expanded ? 10 : 5).map((pick, i) => (
              <div
                key={pick.id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all
                  ${i === 0
                    ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border-emerald-500/30'
                    : i < 3
                    ? 'bg-white/[0.04] border-white/8 hover:bg-white/[0.07]'
                    : 'bg-transparent border-white/5 hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{pick.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${i === 0 ? 'text-emerald-100' : 'text-slate-200'}`}>
                      {pick.label}
                    </p>
                    {pick.tacticalNote && (
                      <p className="text-[9px] text-slate-500 truncate">{pick.tacticalNote}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-sm font-black tabular-nums ${i === 0 ? 'text-emerald-300' : 'text-white'}`}>
                    {(pick.probability * 100).toFixed(0)}%
                  </p>
                  <p className={`text-[9px] uppercase font-bold ${
                    pick.confidence === 'high' ? 'text-emerald-500'
                    : pick.confidence === 'medium' ? 'text-amber-500'
                    : 'text-slate-600'
                  }`}>{pick.confidence}</p>
                </div>
              </div>
            ))}

            {bbResult.topPicks.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-6">No strong picks found.</p>
            )}

            {bbResult.topPicks.length > 5 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-full mt-2 py-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
              >
                {expanded
                  ? '↑ Show Less'
                  : `↓ See All Top ${Math.min(10, bbResult.topPicks.length)} Picks`}
              </button>
            )}
          </div>
        )}

        {/* GOALS TAB */}
        {activeTab === 'goals' && (
          <div className="space-y-4">
            {/* Total goal lines */}
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Total Goals</p>
              <div className="space-y-2">
                <Bar label="Over 1.5" val={prob('over15')} delay={0} />
                <Bar label="Over 2.5" val={prob('over25')} delay={60} />
                <Bar label="Over 3.5" val={prob('over35')} delay={120} />
                <Bar label="Over 4.5" val={prob('over45')} delay={180} />
              </div>
            </div>

            {/* Team goal lines */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2 truncate">
                  {homeTeam.split(' ')[0]}
                </p>
                <div className="space-y-2">
                  <Bar label="Ov 0.5" val={prob('home_ov05')} colorClass="bar-blue" delay={0} />
                  <Bar label="Ov 1.5" val={prob('home_ov15')} colorClass="bar-blue" delay={60} />
                  <Bar label="Ov 2.5" val={prob('home_ov25')} colorClass="bar-blue" delay={120} />
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-2 truncate">
                  {awayTeam.split(' ')[0]}
                </p>
                <div className="space-y-2">
                  <Bar label="Ov 0.5" val={prob('away_ov05')} colorClass="bar-purple" delay={0} />
                  <Bar label="Ov 1.5" val={prob('away_ov15')} colorClass="bar-purple" delay={60} />
                  <Bar label="Ov 2.5" val={prob('away_ov25')} colorClass="bar-purple" delay={120} />
                </div>
              </div>
            </div>

            {/* BTTS */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">BTTS Yes</p>
                <p className="text-lg font-black text-emerald-300">{pct('gg')}</p>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-rose-500 uppercase font-bold tracking-wider">BTTS No</p>
                <p className="text-lg font-black text-rose-300">{pct('ng')}</p>
              </div>
            </div>
          </div>
        )}

        {/* H2H TAB */}
        {activeTab === 'h2h' && (
          <div>
            {rawAiFixture?.rawHeadToHead?.length ? (
              <div className="space-y-1.5">
                {rawAiFixture.rawHeadToHead.slice(0, 6).map((h2h, idx) => {
                  const parts = (h2h.score || '0-0').split('-').map(Number);
                  const hs = parts[0] ?? 0;
                  const as2 = parts[1] ?? 0;
                  const homeW = hs > as2, awayW = as2 > hs;
                  return (
                    <div key={idx} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-white/[0.04] border border-white/5 text-xs">
                      <span className="text-slate-500 text-[9px] w-20 shrink-0">{h2h.date}</span>
                      <span className={`flex-1 text-right font-semibold truncate ${homeW ? 'text-white' : 'text-slate-500'}`}>
                        {h2h.homeTeam}
                      </span>
                      <span className={`font-black px-2 shrink-0 text-sm ${homeW ? 'text-emerald-400' : awayW ? 'text-rose-400' : 'text-amber-400'}`}>
                        {h2h.score}
                      </span>
                      <span className={`flex-1 font-semibold truncate ${awayW ? 'text-white' : 'text-slate-500'}`}>
                        {h2h.awayTeam}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <span className="text-2xl">🤝</span>
                <p className="text-slate-500 text-xs mt-2">No head-to-head history available.</p>
              </div>
            )}
          </div>
        )}

        {/* RISKS TAB */}
        {activeTab === 'risks' && (
          <div className="space-y-2">
            {match.validation?.alerts?.length ? (
              match.validation.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex gap-2 text-xs
                    ${alert.severity === 'critical'
                      ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                    }`}
                >
                  <span className="shrink-0">{alert.severity === 'critical' ? '🚨' : '⚠️'}</span>
                  <p>{alert.message}</p>
                </div>
              ))
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex gap-2">
                <span>✅</span> Data validated — no significant risks detected.
              </div>
            )}
            {bbResult.riskAnalysis && (
              <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs font-bold text-white">{bbResult.riskAnalysis.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{bbResult.riskAnalysis.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomatedMatchCard;
