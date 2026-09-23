import type { RolloverBucket, RolloverPick, RolloverStageHistory } from '../types';

export async function downloadTicketAsPNG(
  bucket: RolloverBucket,
  picks: RolloverPick[],
  compoundedOdds: number,
  projectedReturn: number,
  currency: string
) {
  try {
    const isWon = (picks.length > 0 && picks.every(p => p.status === 'won')) || bucket.status === 'won';
    const hasLost = picks.some(p => p.status === 'lost') || bucket.status === 'busted';

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background
    if (isWon) {
      ctx.fillStyle = '#061a12';
      ctx.fillRect(0, 0, 800, 1000);
      const bgGlow = ctx.createRadialGradient(680, 120, 20, 680, 120, 350);
      bgGlow.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
      bgGlow.addColorStop(1, 'rgba(6, 26, 18, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, 800, 1000);
    } else if (hasLost) {
      ctx.fillStyle = '#180a0a';
      ctx.fillRect(0, 0, 800, 1000);
    } else {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 800, 1000);
    }

    // Gradient accent header strip
    const grad = ctx.createLinearGradient(0, 0, 800, 0);
    if (isWon) {
      grad.addColorStop(0, '#10b981');
      grad.addColorStop(0.5, '#f59e0b');
      grad.addColorStop(1, '#fbbf24');
    } else if (hasLost) {
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(1, '#991b1b');
    } else {
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(0.5, '#a855f7');
      grad.addColorStop(1, '#ec4899');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 12);

    // Card Header
    ctx.fillStyle = isWon ? '#fef08a' : '#ffffff';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText(isWon ? '🏆 STAGE WON · BET SLIP CLEARED' : 'SCORE INTELLIGENCE SLIP', 40, 62);

    ctx.fillStyle = isWon ? '#a7f3d0' : '#94a3b8';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(`Strategy: ${bucket.name} · Stage ${bucket.currentStage}`, 40, 88);

    // List picks
    let y = 140;
    picks.forEach((p) => {
      const pickWon = p.status === 'won' || isWon;

      ctx.fillStyle = pickWon ? '#064e3b50' : '#1e293b50';
      ctx.strokeStyle = pickWon ? '#10b98150' : '#33415550';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(40, y - 25, 720, 72, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(`${p.matchInfo.homeTeam} vs ${p.matchInfo.awayTeam}`, 60, y + 5);

      ctx.fillStyle = pickWon ? '#6ee7b7' : '#818cf8';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(`${p.emoji || '🎯'} ${p.label}`, 60, y + 34);

      if (pickWon) {
        ctx.fillStyle = '#10b98130';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(580, y - 10, 68, 24, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('✓ WON', 592, y + 6);
      }

      ctx.fillStyle = pickWon ? '#fef08a' : '#38bdf8';
      ctx.font = 'bold 18px Courier, monospace';
      ctx.fillText(`@ ${(p.odds || 1 / p.probability).toFixed(2)}`, 670, y + 20);

      y += 92;
    });

    // Bottom Totals Card
    const summaryY = Math.max(y + 20, 670);
    ctx.fillStyle = isWon ? '#064e3b40' : '#1e1b4b40';
    ctx.strokeStyle = isWon ? '#f59e0b80' : '#6366f160';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, summaryY, 720, 195, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isWon ? '#a7f3d0' : '#94a3b8';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Compounded Odds:', 70, summaryY + 45);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 24px Courier, monospace';
    ctx.fillText(`${compoundedOdds.toFixed(2)}x`, 240, summaryY + 45);

    ctx.fillStyle = isWon ? '#a7f3d0' : '#94a3b8';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Current Stage Stake:', 70, summaryY + 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Courier, monospace';
    ctx.fillText(`${currency}${bucket.currentStake.toLocaleString()}`, 240, summaryY + 90);

    ctx.fillStyle = isWon ? '#a7f3d0' : '#94a3b8';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(isWon ? 'Secured Payout / Won:' : 'Potential Payout:', 70, summaryY + 138);
    ctx.fillStyle = isWon ? '#34d399' : '#34d399';
    ctx.font = 'bold 28px Courier, monospace';
    ctx.fillText(`${currency}${projectedReturn.toLocaleString()}`, isWon ? 275 : 240, summaryY + 138);

    if (bucket.bankedProfit > 0 || isWon) {
      const profitAmount = bucket.bankedProfit > 0 ? bucket.bankedProfit : (projectedReturn - bucket.currentStake);
      ctx.fillStyle = '#10b98135';
      ctx.strokeStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(495, summaryY + 30, 240, 56, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(isWon ? '🎉 Net Profit Won:' : '🔒 Banked Profit:', 515, summaryY + 52);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px Courier, monospace';
      ctx.fillText(`${currency}${profitAmount.toLocaleString()}`, 515, summaryY + 72);
    }

    if (isWon) {
      ctx.save();
      ctx.translate(620, summaryY + 145);
      ctx.rotate(-0.15);
      ctx.fillStyle = '#10b98118';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-80, -25, 160, 50, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillText('PAID OUT', -48, 8);
      ctx.restore();
    }

    // Footer branding & Timestamp
    ctx.fillStyle = isWon ? '#059669' : '#64748b';
    ctx.font = '12px Inter, sans-serif';
    
    // Add Timestamp
    const timestampStr = new Date().toLocaleString();
    ctx.fillText(`Generated by Score Predictor AI Engine · ${timestampStr}`, 40, 970);

    const imageUri = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const prefix = isWon ? 'BetSlip_WON' : 'BetSlip_ACTIVE';
    link.download = `${prefix}_${bucket.name.replace(/\s+/g, '_')}_Stage${bucket.currentStage}.png`;
    link.href = imageUri;
    link.click();
  } catch (e) {
    console.error('Failed to generate PNG:', e);
  }
}

export function downloadLedgerCSV(history: RolloverStageHistory[], bucketName: string, currency: string) {
  // Columns: Stage, Timestamp, Stake, Compounded Odds, Gross Payout, Banked Amount, Net Rollover, Picks
  const header = ['Stage', 'Timestamp', 'Stake', 'Odds', 'Gross Payout', 'Banked Profit', 'Rolled Over', 'Picks', 'Status'];
  const rows = history.map(h => {
    const timestamp = h.completedAt ? new Date(h.completedAt).toLocaleString() : 'N/A';
    const picksSummary = h.picks.map(p => `${p.matchInfo.homeTeam} vs ${p.matchInfo.awayTeam} (${p.label})`).join(' | ');
    const rolledOver = h.payout - h.bankedAmount;

    return [
      h.stageNumber,
      `"${timestamp}"`, // quote to avoid commas breaking CSV
      `${currency}${h.stake.toFixed(2)}`,
      `${h.compoundedOdds.toFixed(2)}x`,
      `${currency}${h.payout.toFixed(2)}`,
      `${currency}${h.bankedAmount.toFixed(2)}`,
      `${currency}${rolledOver.toFixed(2)}`,
      `"${picksSummary}"`,
      h.status.toUpperCase()
    ].join(',');
  });

  const csvContent = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${bucketName.replace(/\s+/g, '_')}_Audit_Ledger.csv`);
  link.click();
}
