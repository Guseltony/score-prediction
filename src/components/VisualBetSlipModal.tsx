import React, { useRef, useState, useEffect } from 'react';
import type { RolloverBucket } from '../types';
import { downloadTicketAsPNG } from '../utils/exportUtils';

interface VisualBetSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  bucket: RolloverBucket;
  compoundedOdds: number;
  projectedReturn: number;
}

const VisualBetSlipModal: React.FC<VisualBetSlipModalProps> = ({
  isOpen,
  onClose,
  bucket,
  compoundedOdds,
  projectedReturn,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Lock body scroll and support ESC key
  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const picks = bucket.picks;
  const currency = bucket.currencySymbol || '₦';
  const isWon = (picks.length > 0 && picks.every(p => p.status === 'won')) || bucket.status === 'won';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadTicketAsPNG(bucket, picks, compoundedOdds, projectedReturn, currency);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyText = () => {
    const text = [
      `${isWon ? '🏆 [STAGE WON]' : '🎟️'} ${bucket.name} — Stage ${bucket.currentStage}/${bucket.maxDays}`,
      `Odds: ${compoundedOdds.toFixed(2)}x | Stake: ${currency}${bucket.currentStake.toLocaleString()}`,
      `${isWon ? 'Payout Won' : 'Potential Return'}: ${currency}${projectedReturn.toLocaleString()}`,
      `--------------------------`,
      ...picks.map((p, i) => `${i + 1}. ${p.matchInfo.homeTeam} vs ${p.matchInfo.awayTeam} ➔ ${p.label} (@ ${p.odds.toFixed(2)})${p.status === 'won' || isWon ? ' ✅ WON' : ''}`),
      `--------------------------`,
      `Generated with AI Score Predictor Pro`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-full flex items-center justify-center">
        <div 
          className={`bg-slate-900 border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-scaleIn relative ${
            isWon ? 'border-amber-500/50 shadow-emerald-500/10' : 'border-slate-700/70'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
        
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between shrink-0 ${
          isWon ? 'bg-emerald-950/50 border-emerald-800/60' : 'bg-slate-950/50 border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{isWon ? '🏆' : '🎴'}</span>
            <h3 className={`text-sm font-black uppercase tracking-wider ${isWon ? 'text-amber-300' : 'text-white'}`}>
              {isWon ? 'Winning Stage Slip' : 'Visual Bet Slip'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Visual Slip Card Preview */}
        <div className="p-6 bg-slate-950/70 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <div
            ref={cardRef}
            className={`border rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden ${
              isWon
                ? 'bg-gradient-to-b from-slate-900 to-emerald-950/50 border-emerald-500/50 shadow-emerald-950/30'
                : 'bg-slate-900 border-indigo-500/30'
            }`}
          >
            {/* Top gradient strip */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
              isWon
                ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-yellow-300'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
            }`} />

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  isWon ? 'text-amber-400' : 'text-indigo-400'
                }`}>
                  {isWon ? '★ Stage Won Slip ★' : 'AI Bet Slip'}
                </span>
                <h4 className="text-base font-black text-white">{bucket.name}</h4>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                isWon
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/20'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {isWon ? `🏆 Stage ${bucket.currentStage} Won` : `Stage ${bucket.currentStage}`}
              </span>
            </div>

            {/* Picks list */}
            <div className="space-y-2.5 pt-2">
              {picks.map((p) => {
                const pickWon = p.status === 'won' || isWon;
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl p-3 flex items-center justify-between border ${
                      pickWon
                        ? 'bg-emerald-950/30 border-emerald-500/40'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-200">
                        {p.matchInfo.homeTeam} vs {p.matchInfo.awayTeam}
                      </p>
                      <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${
                        pickWon ? 'text-emerald-300' : 'text-indigo-300'
                      }`}>
                        <span>{p.emoji || '🎯'}</span>
                        <strong className="text-white">{p.label}</strong>
                        {pickWon && <span className="text-[10px] font-black text-emerald-400 ml-1">✓ WON</span>}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-black text-emerald-400">
                      @{p.odds.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Slip summary footer */}
            <div className={`rounded-xl p-3.5 space-y-1.5 text-xs border ${
              isWon
                ? 'bg-emerald-950/50 border-emerald-500/40 shadow-inner'
                : 'bg-indigo-950/40 border-indigo-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Combined Odds:</span>
                <span className="font-mono font-black text-amber-300 text-sm">{compoundedOdds.toFixed(2)}x</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Stage Stake:</span>
                <span className="font-mono font-bold text-white">{currency}{bucket.currentStake.toLocaleString()}</span>
              </div>
              <div className={`flex items-center justify-between pt-1 border-t ${
                isWon ? 'border-emerald-500/30' : 'border-indigo-500/20'
              }`}>
                <span className={`font-bold ${isWon ? 'text-amber-300' : 'text-emerald-400'}`}>
                  {isWon ? '🏆 Total Won & Paid Out:' : 'Potential Payout:'}
                </span>
                <span className="font-mono font-black text-emerald-400 text-base">{currency}{projectedReturn.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-[9px] text-slate-500 text-center uppercase tracking-widest pt-1">
              Verified by Correct Score Intelligence Engine
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={handleCopyText}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span>{copied ? '✅' : '📋'}</span>
            <span>{copied ? 'Copied Slip!' : 'Copy Text'}</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg ${
              isWon
                ? 'bg-gradient-to-r from-emerald-600 via-amber-600 to-yellow-500 hover:from-emerald-500 hover:to-yellow-400 shadow-emerald-600/30'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30'
            }`}
          >
            <span>📥</span>
            <span>{downloading ? 'Generating...' : isWon ? 'Download Won PNG' : 'Download PNG'}</span>
          </button>
        </div>

      </div>
    </div>
  </div>
  );
};

export default VisualBetSlipModal;
