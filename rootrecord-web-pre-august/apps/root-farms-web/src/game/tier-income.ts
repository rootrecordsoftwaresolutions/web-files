import type { TierPlotProgress } from "./tier-catalog";
import { orchardGrowSec, vegetableGrowSec } from "./tier-catalog";

function tierRuPerCycle(p: TierPlotProgress, _growSec: number, ruPerRow: number): number {
  if (p.rowsActive <= 0) return 0;
  const full = p.rowCount > 1 && p.rowsActive >= p.rowCount;
  const base = p.rowsActive * ruPerRow;
  return Math.floor(base * (full ? 1.08 : 1));
}

function orchardRuPerRow(id: number, growSec: number): number {
  return Math.max(50, Math.floor(120 * Math.pow(4.2, id - 1) * (growSec / 86_400)));
}

function vegetableRuPerRow(id: number): number {
  return Math.max(5, Math.floor(8 * Math.pow(2.1, id - 1)));
}

export function tierTotalRuPerHarvest(
  plots: TierPlotProgress[],
  growSecFor: (id: number) => number,
  ruFor: (id: number, growSec: number) => number,
): number {
  let sum = 0;
  for (const p of plots) {
    if (!p.unlocked || p.rowsActive <= 0) continue;
    const grow = growSecFor(p.id);
    sum += tierRuPerCycle(p, grow, ruFor(p.id, grow));
  }
  return sum;
}

export function tierTotalRuPerSec(
  plots: TierPlotProgress[],
  growSecFor: (id: number) => number,
  ruFor: (id: number, growSec: number) => number,
  incomeMultiplier = 1,
): number {
  const mult = Math.max(0, Number(incomeMultiplier) || 0);
  let sum = 0;
  for (const p of plots) {
    if (!p.unlocked || p.rowsActive <= 0) continue;
    const grow = growSecFor(p.id);
    const per = tierRuPerCycle(p, grow, ruFor(p.id, grow));
    sum += per / grow;
  }
  return sum * mult;
}

export function orchardHarvestTotal(plots: TierPlotProgress[]): number {
  return tierTotalRuPerHarvest(plots, orchardGrowSec, orchardRuPerRow);
}

export function orchardPlotHarvestTotal(plot: TierPlotProgress): number {
  const grow = orchardGrowSec(plot.id);
  return tierRuPerCycle(plot, grow, orchardRuPerRow(plot.id, grow));
}

export function orchardIncomePerSec(plots: TierPlotProgress[], incomeMultiplier = 1): number {
  return tierTotalRuPerSec(plots, orchardGrowSec, orchardRuPerRow, incomeMultiplier);
}

export function vegetableHarvestTotal(plots: TierPlotProgress[]): number {
  return tierTotalRuPerHarvest(plots, vegetableGrowSec, (id, _grow) => vegetableRuPerRow(id));
}

export function vegetablePlotHarvestTotal(plot: TierPlotProgress): number {
  const grow = vegetableGrowSec(plot.id);
  return tierRuPerCycle(plot, grow, vegetableRuPerRow(plot.id));
}

export function vegetableIncomePerSec(plots: TierPlotProgress[], incomeMultiplier = 1): number {
  return tierTotalRuPerSec(plots, vegetableGrowSec, (id, _grow) => vegetableRuPerRow(id), incomeMultiplier);
}
