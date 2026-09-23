/**
 * rolloverSimulator.ts
 *
 * Mathematical simulation and risk-of-ruin engine for multi-stage rollover campaigns.
 * Evaluates Pure Compounding vs Milestone Profit Banking vs Free-Roll Capital Recovery.
 */

export interface RolloverSimOptions {
  startingStake: number;
  stageOdds: number;
  stagesCount: number;
  winProbabilityPerStage: number; // estimated probability of each stage hitting (e.g. 0.82 for 2.00x combo)
  bankProfitPct: number;          // 0 to 1 (e.g. 0.25 for 25% profit banked each stage)
  bankMilestoneInterval?: number; // e.g. every 5 stages, or 1 for every stage
}

export interface StageSimulationPoint {
  stage: number;
  stake: number;
  payout: number;
  profitEarned: number;
  bankedThisStage: number;
  cumulativeBanked: number;
  nextStake: number;
  survivalProbability: number;
  expectedValue: number;
}

export interface StrategyComparison {
  name: string;
  description: string;
  terminalStakeIfAllWin: number;
  cumulativeBankedIfAllWin: number;
  totalRealizedIfAllWin: number;
  bustedStage5Retained: number;
  bustedStage10Retained: number;
  bustedStage15Retained: number;
  overallEV: number;
  riskOfTotalLossPct: number;
}

export interface RolloverSimResult {
  options: RolloverSimOptions;
  stages: StageSimulationPoint[];
  pureCompoundStages: StageSimulationPoint[];
  strategies: {
    pureCompound: StrategyComparison;
    milestoneBanking: StrategyComparison;
    capitalRecovery: StrategyComparison;
  };
  keyInsights: string[];
}

/**
 * Calculates a complete simulation breakdown for a rollover campaign.
 */
export function simulateRolloverJourney(options: RolloverSimOptions): RolloverSimResult {
  const {
    startingStake,
    stageOdds,
    stagesCount,
    winProbabilityPerStage,
    bankProfitPct,
  } = options;

  const p = Math.max(0.1, Math.min(0.99, winProbabilityPerStage));
  const odds = Math.max(1.05, stageOdds);
  const stagesN = Math.max(1, Math.min(30, stagesCount));
  const bankRate = Math.max(0, Math.min(0.9, bankProfitPct));

  // 1. Milestone Banking Trajectory
  const stages: StageSimulationPoint[] = [];
  let currentStake = startingStake;
  let runningCumulativeBanked = 0;

  for (let s = 1; s <= stagesN; s++) {
    const payout = currentStake * odds;
    const profit = payout - currentStake;
    const bankedThisStage = profit * bankRate;
    runningCumulativeBanked += bankedThisStage;
    const nextStake = payout - bankedThisStage;
    const survivalProb = Math.pow(p, s);
    const ev = (payout + runningCumulativeBanked) * survivalProb;

    stages.push({
      stage: s,
      stake: Math.round(currentStake),
      payout: Math.round(payout),
      profitEarned: Math.round(profit),
      bankedThisStage: Math.round(bankedThisStage),
      cumulativeBanked: Math.round(runningCumulativeBanked),
      nextStake: Math.round(nextStake),
      survivalProbability: survivalProb,
      expectedValue: Math.round(ev),
    });

    currentStake = nextStake;
  }

  // 2. Pure Compound Trajectory (0% banked)
  const pureCompoundStages: StageSimulationPoint[] = [];
  let pureStake = startingStake;
  for (let s = 1; s <= stagesN; s++) {
    const payout = pureStake * odds;
    const profit = payout - pureStake;
    const survivalProb = Math.pow(p, s);
    const ev = payout * survivalProb;

    pureCompoundStages.push({
      stage: s,
      stake: Math.round(pureStake),
      payout: Math.round(payout),
      profitEarned: Math.round(profit),
      bankedThisStage: 0,
      cumulativeBanked: 0,
      nextStake: Math.round(payout),
      survivalProbability: survivalProb,
      expectedValue: Math.round(ev),
    });

    pureStake = payout;
  }

  // 3. Capital Recovery Trajectory (Bank initial stake on Stage 2, then compound)
  let capStake = startingStake;
  let capBanked = 0;
  const capStages: { stage: number; payout: number; cumulativeBanked: number }[] = [];
  for (let s = 1; s <= stagesN; s++) {
    const payout = capStake * odds;
    let next = payout;
    if (s === 2) {
      capBanked = startingStake; // recover initial principal
      next = payout - startingStake;
    }
    capStages.push({ stage: s, payout, cumulativeBanked: capBanked });
    capStake = next;
  }

  // Helper for bust retention calculation
  const getRetainedAtBust = (stageList: StageSimulationPoint[], bustStage: number) => {
    const prev = stageList[bustStage - 2];
    return prev ? prev.cumulativeBanked : 0;
  };

  const pureCompFinal = pureCompoundStages[stagesN - 1];
  const milestoneFinal = stages[stagesN - 1];
  const capFinal = capStages[stagesN - 1];

  const strategies = {
    pureCompound: {
      name: 'Pure Compounding (100% Reinvest)',
      description: 'Maximum upside potential. If any single stage busts, 100% of accumulated funds are lost.',
      terminalStakeIfAllWin: pureCompFinal.payout,
      cumulativeBankedIfAllWin: 0,
      totalRealizedIfAllWin: pureCompFinal.payout,
      bustedStage5Retained: 0,
      bustedStage10Retained: 0,
      bustedStage15Retained: 0,
      overallEV: pureCompFinal.expectedValue,
      riskOfTotalLossPct: +(100 * (1 - Math.pow(p, stagesN))).toFixed(1),
    },
    milestoneBanking: {
      name: `Milestone Banking (${Math.round(bankRate * 100)}% Locked / Stage)`,
      description: 'Secures guaranteed cash in the bank at each winning stage while continuing to scale next bets.',
      terminalStakeIfAllWin: milestoneFinal.payout,
      cumulativeBankedIfAllWin: milestoneFinal.cumulativeBanked,
      totalRealizedIfAllWin: milestoneFinal.payout + milestoneFinal.cumulativeBanked,
      bustedStage5Retained: getRetainedAtBust(stages, 5),
      bustedStage10Retained: getRetainedAtBust(stages, 10),
      bustedStage15Retained: getRetainedAtBust(stages, 15),
      overallEV: milestoneFinal.expectedValue,
      riskOfTotalLossPct: 0, // Protected after Stage 1
    },
    capitalRecovery: {
      name: 'Principal Recovery Free-Roll',
      description: 'Withdraws 100% of initial stake after Stage 2. The remaining journey runs completely risk-free.',
      terminalStakeIfAllWin: Math.round(capFinal.payout),
      cumulativeBankedIfAllWin: Math.round(capFinal.cumulativeBanked),
      totalRealizedIfAllWin: Math.round(capFinal.payout + capFinal.cumulativeBanked),
      bustedStage5Retained: startingStake,
      bustedStage10Retained: startingStake,
      bustedStage15Retained: startingStake,
      overallEV: Math.round(capFinal.payout * Math.pow(p, stagesN) + startingStake * (1 - Math.pow(p, stagesN))),
      riskOfTotalLossPct: 0,
    },
  };

  // Generate actionable key insights
  const keyInsights: string[] = [
    `Stage Survival: There is a ${(Math.pow(p, 5) * 100).toFixed(1)}% probability of reaching Stage 5 and ${(Math.pow(p, 10) * 100).toFixed(1)}% for Stage 10.`,
    bankRate > 0
      ? `By banking ${Math.round(bankRate * 100)}%, you lock in ₦${(stages[4]?.cumulativeBanked || 0).toLocaleString()} by Stage 5 and ₦${(stages[9]?.cumulativeBanked || 0).toLocaleString()} by Stage 10 regardless of subsequent outcomes.`
      : 'Pure compounding generates exponential peak payouts but has a 0% capital retention rate if any leg fails.',
    `Recommended target odds bracket: 1.85x – 2.15x per stage to preserve high single-stage hit rate (>${(p * 100).toFixed(0)}%).`,
  ];

  return {
    options,
    stages,
    pureCompoundStages,
    strategies,
    keyInsights,
  };
}
