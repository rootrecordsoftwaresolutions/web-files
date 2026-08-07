import { OFFLINE_CAP_MS, PLOT_COUNT, getPlotCatalog, plotRuPerCycle } from "./catalog";

import type { GameSave, PlotProgress } from "./types";



export function createInitialPlots(): PlotProgress[] {

  return Array.from({ length: PLOT_COUNT }, (_, i) => {

    const id = i + 1;

    if (id === 1) {

      return { id, unlocked: true, rowCount: 1, rowsActive: 1, cycleProgress: 0 };

    }

    return { id, unlocked: false, rowCount: 0, rowsActive: 0, cycleProgress: 0 };

  });

}



export function createInitialSave(now = Date.now()): GameSave {

  return {

    version: 2,

    localBalance: 0,

    lifetimeEarned: 0,

    lastTickMs: now,

    lastSettledMs: now,

    plots: createInitialPlots(),

  };

}



/** Advance plot cycles only — does not mutate spendable balance (server-owned). */
export function simulatePlotTicks(
  save: GameSave,
  dtSec: number,
  incomeMultiplier = 1,
): { save: GameSave; earned: number } {
  if (dtSec <= 0) return { save, earned: 0 };
  const mult = Math.max(0, Number(incomeMultiplier) || 0);
  let earned = 0;
  const plots = save.plots.map((p) => {
    if (!p.unlocked || p.rowsActive <= 0) return p;
    const cat = getPlotCatalog(p.id);
    const rows = p.rowsActive;
    let prog = p.cycleProgress + dtSec / cat.growTimeSec;
    let plotEarned = 0;
    while (prog >= 1) {
      prog -= 1;
      plotEarned += plotRuPerCycle(cat, rows, p.rowCount) * mult;
    }
    earned += plotEarned;
    return { ...p, cycleProgress: prog };
  });
  return { save: { ...save, plots }, earned: Math.floor(earned) };
}

export function peekOfflineRu(save: GameSave, nowMs: number): number {
  const elapsed = Math.max(0, Math.min(nowMs - save.lastTickMs, OFFLINE_CAP_MS));
  if (elapsed <= 0) return 0;
  return simulatePlotTicks(save, elapsed / 1000).earned;
}

/** RU earned since last server settle (pending harvest until settled). */
export function peekUnsettledRu(save: GameSave, nowMs: number, incomeMultiplier = 1): number {
  const settledMs = Math.max(0, Math.floor(Number(save.lastSettledMs) || 0));
  const tickMs = Math.max(0, Math.floor(Number(save.lastTickMs) || 0));
  const anchor = settledMs > 0 ? settledMs : tickMs;
  const elapsed = Math.max(0, Math.min(nowMs - anchor, OFFLINE_CAP_MS));
  if (elapsed <= 0) return 0;
  return simulatePlotTicks(save, elapsed / 1000, incomeMultiplier).earned;
}

/** Catch plot timers up to now without crediting local balance. */
export function advancePlotsToNow(save: GameSave, nowMs: number): GameSave {
  const elapsed = Math.max(0, Math.min(nowMs - save.lastTickMs, OFFLINE_CAP_MS));
  if (elapsed <= 0) return { ...save, lastTickMs: nowMs };
  const { save: next } = simulatePlotTicks(save, elapsed / 1000);
  return { ...next, lastTickMs: nowMs };
}



export function canBuyPlotUnlock(save: GameSave, plotId: number): boolean {

  if (plotId <= 1) return false;

  const plot = save.plots.find((p) => p.id === plotId);

  if (!plot || plot.unlocked) return false;

  const prev = save.plots.find((p) => p.id === plotId - 1);

  if (!prev?.unlocked) return false;

  return true;

}



export function activePlotStats(save: GameSave): { activePlots: number; activeRows: number } {

  let activePlots = 0;

  let activeRows = 0;

  for (const p of save.plots) {

    if (p.unlocked && p.rowsActive > 0) {

      activePlots += 1;

      activeRows += p.rowsActive;

    }

  }

  return { activePlots, activeRows };

}

/** Unlocked plots and total purchased row slots (sum of rowCount). */
export function farmsProgressStats(save: GameSave): { plotsUnlocked: number; rowsAccumulated: number } {
  let plotsUnlocked = 0;
  let rowsAccumulated = 0;
  for (const p of save.plots) {
    if (!p.unlocked) continue;
    plotsUnlocked += 1;
    rowsAccumulated += Math.max(0, Math.floor(p.rowCount) || 0);
  }
  return { plotsUnlocked, rowsAccumulated };
}



export function totalRuPerSec(save: GameSave, incomeMultiplier = 1): number {
  const mult = Math.max(0, Number(incomeMultiplier) || 0);
  let sum = 0;
  for (const p of save.plots) {
    if (!p.unlocked || p.rowsActive <= 0) continue;
    const cat = getPlotCatalog(p.id);
    const per = plotRuPerCycle(cat, p.rowsActive, p.rowCount);
    sum += (per / cat.growTimeSec) * mult;
  }
  return sum;
}



export function totalRuPerHarvest(save: GameSave): number {

  let sum = 0;

  for (const p of save.plots) {

    if (!p.unlocked || p.rowsActive <= 0) continue;

    const cat = getPlotCatalog(p.id);

    sum += plotRuPerCycle(cat, p.rowsActive, p.rowCount);

  }

  return sum;

}


