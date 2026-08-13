import React, { useState } from "react";
import type { MatchIntelligenceInput } from "../utils/matchIntelligence";

interface Props {
  homeTeam: string;
  awayTeam: string;
  value: Omit<MatchIntelligenceInput, "baseHomeXG" | "baseAwayXG">;
  onChange: (v: Omit<MatchIntelligenceInput, "baseHomeXG" | "baseAwayXG">) => void;
  result: { adjustedHomeXG: number; adjustedAwayXG: number; breakdown: any } | null;
}

const COMPETITIONS = [
  { value: "league",           label: "?? League" },
  { value: "champions_league", label: "? Champions League" },
  { value: "europa",           label: "?? Europa League" },
  { value: "cup",              label: "?? Domestic Cup" },
  { value: "championship",     label: "?? Championship/Div 2" },
  { value: "friendly",         label: "?? Friendly" },
  { value: "world_cup",        label: "?? World Cup / Intl." },
  { value: "other",            label: "? Other" },
];

function RatingSlider({ label, value, onChange, id, color = "violet" }: {
  label: string; value: number; onChange: (v: number) => void; id: string; color?: string;
}) {
  const pct = ((value - 1) / 9) * 100;
  const bg = color === "emerald"
    ? `linear-gradient(to right, #10b981 ${pct}%, #1e293b ${pct}%)`
    : `linear-gradient(to right, #7c3aed ${pct}%, #1e293b ${pct}%)`;
  const badge = color === "emerald" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
    : "text-violet-300 bg-violet-500/20 border-violet-500/30";
  const label2 = value <= 3 ? "Weak" : value <= 5 ? "Average" : value <= 7 ? "Good" : value <= 9 ? "Strong" : "Elite";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-slate-400">{label}</label>
        <span className={`text-xs font-bold px-2 py-0.5 rounded border min-w-[4rem] text-center ${badge}`}>
          {value}/10 · {label2}
        </span>
      </div>
      <input id={id} type="range" min={1} max={10} step={1} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
        style={{ background: bg }}
      />
    </div>
  );
}

function OddsInput({ label, value, onChange, id }: {
  label: string; value: number; onChange: (v: number) => void; id: string;
}) {
  return (
    <div className="text-center">
      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input id={id} type="number" min={1.01} max={100} step={0.01}
        value={value || ""}
        placeholder="e.g. 1.75"
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-slate-900 border border-slate-700 focus:border-violet-500 rounded-lg py-2 px-2 text-white text-center font-mono text-sm focus:outline-none"
      />
    </div>
  );
}

const MatchIntelligencePanel: React.FC<Props> = ({ homeTeam, awayTeam, value, onChange, result }) => {
  const [open, setOpen] = useState(true);

  const u = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });

  const hasOdds = value.homeOdds > 1 && value.drawOdds > 1 && value.awayOdds > 1;

  return (
    <div className="bg-slate-800/60 border border-violet-500/20 rounded-2xl overflow-hidden shadow-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">??</span>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Match Intelligence</p>
            <p className="text-xs text-slate-500">
              Odds · Attack/Defense · Form · H2H · Competition
              {hasOdds && <span className="ml-2 text-violet-400 font-semibold">· Odds loaded ?</span>}
            </p>
          </div>
        </div>
        <span className={`text-slate-400 transition-transform duration-200 text-sm ${open ? "rotate-180" : ""}`}>?</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-6 border-t border-slate-700/40">

          {/* Bookmaker Odds */}
          <div>
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3 mt-4 flex items-center gap-1.5">
              <span>??</span> Bookmaker 1X2 Odds
              <span className="text-slate-600 font-normal normal-case tracking-normal">(decimal, optional)</span>
            </p>
            <div className="grid grid-cols-3 gap-3">
              <OddsInput id="odds-home" label={`?? ${homeTeam || "Home"} Win`} value={value.homeOdds} onChange={v => u({ homeOdds: v })} />
              <OddsInput id="odds-draw" label="?? Draw" value={value.drawOdds} onChange={v => u({ drawOdds: v })} />
              <OddsInput id="odds-away" label={`?? ${awayTeam || "Away"} Win`} value={value.awayOdds} onChange={v => u({ awayOdds: v })} />
            </div>
            {hasOdds && result?.breakdown?.oddsImplied && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Home Win", val: result.breakdown.oddsImplied.homeWin },
                  { label: "Draw",     val: result.breakdown.oddsImplied.draw },
                  { label: "Away Win", val: result.breakdown.oddsImplied.awayWin },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-slate-900/60 rounded-lg py-1.5 px-2">
                    <div className="text-[10px] text-slate-500">{label}</div>
                    <div className="text-sm font-bold text-violet-300">{(val * 100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Competition */}
          <div>
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>???</span> Competition Type
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COMPETITIONS.map(({ value: v, label }) => (
                <button key={v} onClick={() => u({ competition: v })}
                  className={`text-xs py-2 px-3 rounded-lg border text-left transition-all ${
                    value.competition === v
                      ? "bg-violet-600/20 border-violet-500/60 text-violet-300"
                      : "bg-slate-900/40 border-slate-700/40 text-slate-400 hover:border-slate-500"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Form */}
          <div>
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>??</span> Recent Form
              <span className="text-slate-600 font-normal normal-case tracking-normal">(last 5 matches, most recent first: W/D/L)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">?? {homeTeam || "Home"} Form</label>
                <input type="text" maxLength={5} placeholder="e.g. WWDLW"
                  value={value.homeForm}
                  onChange={e => u({ homeForm: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-violet-500 rounded-lg py-2.5 px-3 text-white uppercase tracking-widest font-mono focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">?? {awayTeam || "Away"} Form</label>
                <input type="text" maxLength={5} placeholder="e.g. WLDLL"
                  value={value.awayForm}
                  onChange={e => u({ awayForm: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-violet-500 rounded-lg py-2.5 px-3 text-white uppercase tracking-widest font-mono focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Attack & Defense Ratings */}
          <div>
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>??</span> Attack & Defense Ratings
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <RatingSlider id="home-attack" label={`?? ${homeTeam || "Home"} Attack`} value={value.homeAttackRating} onChange={v => u({ homeAttackRating: v })} color="emerald" />
              <RatingSlider id="away-attack" label={`?? ${awayTeam || "Away"} Attack`} value={value.awayAttackRating} onChange={v => u({ awayAttackRating: v })} color="violet" />
              <RatingSlider id="home-defense" label={`??? ${homeTeam || "Home"} Defense`} value={value.homeDefenseRating} onChange={v => u({ homeDefenseRating: v })} color="emerald" />
              <RatingSlider id="away-defense" label={`??? ${awayTeam || "Away"} Defense`} value={value.awayDefenseRating} onChange={v => u({ awayDefenseRating: v })} color="violet" />
            </div>
          </div>

          {/* H2H Bias */}
          <div>
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>??</span> H2H Dominance
              <span className="text-slate-600 font-normal normal-case tracking-normal">(net goal difference, e.g. +3 = home wins H2H)</span>
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 min-w-[60px] text-right">Away wins</span>
              <input type="range" min={-10} max={10} step={1} value={value.h2hHomeBias}
                onChange={e => u({ h2hHomeBias: parseInt(e.target.value) })}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-600 [&::-webkit-slider-thumb]:cursor-pointer"
                style={{ background: `linear-gradient(to right, #334155 0%, #7c3aed ${(value.h2hHomeBias + 10) / 20 * 100}%, #334155 100%)` }}
              />
              <span className="text-xs text-slate-500 min-w-[60px]">Home wins</span>
              <span className="text-sm font-bold text-violet-300 min-w-[2rem] text-right">{value.h2hHomeBias > 0 ? "+" : ""}{value.h2hHomeBias}</span>
            </div>
          </div>

          {/* Home Advantage + Volatility */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/40 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white font-semibold">Home Advantage</p>
                <p className="text-xs text-slate-500 mt-0.5">+12% xG boost for home team</p>
              </div>
              <button
                onClick={() => u({ homeAdvantageEnabled: !value.homeAdvantageEnabled })}
                className={`relative shrink-0 w-12 h-6 rounded-full border-2 transition-all duration-300 ${
                  value.homeAdvantageEnabled ? "bg-violet-500 border-violet-400" : "bg-slate-700 border-slate-600"
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full shadow-md transition-all duration-300 ${
                  value.homeAdvantageEnabled ? "left-6 bg-white" : "left-0.5 bg-slate-400"
                }`} />
              </button>
            </div>

            <div className="bg-slate-900/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white font-semibold">?? Upset Factor</p>
                <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 rounded px-2 py-0.5">
                  {value.volatilityFactor === 0 ? "Off" : value.volatilityFactor < 0.4 ? "Low" : value.volatilityFactor < 0.7 ? "Medium" : "High"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2">Compresses xG gap — makes upsets more likely</p>
              <input type="range" min={0} max={1} step={0.1} value={value.volatilityFactor}
                onChange={e => u({ volatilityFactor: parseFloat(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-600 [&::-webkit-slider-thumb]:cursor-pointer"
                style={{ background: `linear-gradient(to right, #f59e0b ${value.volatilityFactor * 100}%, #1e293b ${value.volatilityFactor * 100}%)` }}
              />
            </div>
          </div>

          {/* Pitch Tilt */}
          <div className="bg-slate-900/40 rounded-xl p-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white font-semibold flex items-center gap-2">
                <span>âš½</span> Pitch Tilt (Expected Threat)
              </p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                value.pitchTilt === 0 ? "text-slate-400 border-slate-600 bg-slate-800" 
                : value.pitchTilt > 0 ? "text-emerald-400 border-emerald-500/50 bg-emerald-500/10" 
                : "text-violet-400 border-violet-500/50 bg-violet-500/10"
              }`}>
                {value.pitchTilt > 0 ? `+${value.pitchTilt} Home` : value.pitchTilt < 0 ? `${Math.abs(value.pitchTilt)} Away` : "Neutral"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">Adjust for periods of heavy dominance/possession</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-violet-400">Away</span>
              <input type="range" min={-10} max={10} step={1} value={value.pitchTilt}
                onChange={e => u({ pitchTilt: parseInt(e.target.value) })}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:cursor-pointer"
                style={{ background: `linear-gradient(to right, #8b5cf6 0%, #3b82f6 ${(value.pitchTilt + 10) * 5}%, #10b981 100%)` }}
              />
              <span className="text-xs text-emerald-400">Home</span>
            </div>
          </div>

          {/* Adjusted xG output */}
          {result && (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3">? Adjusted xG (All Factors Applied)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-emerald-400 font-mono">{result.adjustedHomeXG.toFixed(2)}</div>
                  <div className="text-xs text-slate-500 mt-1">?? {homeTeam || "Home"} xG</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-violet-400 font-mono">{result.adjustedAwayXG.toFixed(2)}</div>
                  <div className="text-xs text-slate-500 mt-1">?? {awayTeam || "Away"} xG</div>
                </div>
              </div>
              {result.breakdown.oddsImplied && (
                <p className="text-[10px] text-violet-400/70 text-center mt-2">
                  Bookmaker implied: Home {(result.breakdown.oddsImplied.homeWin * 100).toFixed(0)}% / Draw {(result.breakdown.oddsImplied.draw * 100).toFixed(0)}% / Away {(result.breakdown.oddsImplied.awayWin * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchIntelligencePanel;

