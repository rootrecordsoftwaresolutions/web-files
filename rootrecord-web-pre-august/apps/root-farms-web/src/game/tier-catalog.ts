/** Orchards (post-Horseradish) and vegetables (root level 20+). Costs mirror server farms-orchards.ts */
import type { PlotProgress } from "./types";

export type TierPlotProgress = PlotProgress;

export const ORCHARD_COUNT = 3;
export const VEGETABLE_COUNT = 10;
export const ROWS_PER_TIER = 10;
export const PLOT_GINGER = 10;
export const PLOT_HORSERADISH = 20;
export const ROOT_LEVEL_VEGETABLES = 20;

const ORCHARD_NAMES = [
  "Volcano tree",
  "Business tree",
  "Weather tree",
];

const ORCHARD_DESCRIPTIONS = [
  "Active for 24 hours after opening Kilauea Alerts. Adds +10% total farm earnings.",
  "Active for 24 hours after opening Business Manager. Adds +10% total farm earnings.",
  "Active for 24 hours after opening Weather Manager. Adds +10% total farm earnings.",
];

const VEGETABLE_NAMES = [
  "Tomato",
  "Pepper",
  "Lettuce",
  "Cucumber",
  "Squash",
  "Bean",
  "Corn",
  "Eggplant",
  "Spinach",
  "Kale",
];

const VEGETABLE_SCIENTIFIC_NAMES = [
  "Solanum lycopersicum",
  "Capsicum annuum",
  "Lactuca sativa",
  "Cucumis sativus",
  "Cucurbita pepo",
  "Phaseolus vulgaris",
  "Zea mays",
  "Solanum melongena",
  "Spinacia oleracea",
  "Brassica oleracea",
];

export function orchardName(id: number): string {
  return ORCHARD_NAMES[id - 1] ?? `Orchard ${id}`;
}

export function orchardDescription(id: number): string {
  return ORCHARD_DESCRIPTIONS[id - 1] ?? "Adds +10% total farm earnings while active.";
}

export function vegetableName(id: number): string {
  return VEGETABLE_NAMES[id - 1] ?? `Vegetable ${id}`;
}

export function vegetableScientificName(id: number): string {
  return VEGETABLE_SCIENTIFIC_NAMES[id - 1] ?? "Vegetable crop";
}

export function orchardUnlockCost(id: number): number {
  return Math.floor(1_000_000 * Math.pow(3.2, id - 1));
}

export function orchardRowCost(id: number, currentRows: number): number {
  return Math.floor(1_000_000 * Math.pow(10, currentRows) * Math.pow(1.15, id - 1));
}

export function vegetableUnlockCost(id: number): number {
  return Math.floor(250_000 * Math.pow(2.4, id - 1));
}

export function vegetableRowCost(id: number, currentRows: number): number {
  return Math.floor(80_000 * Math.pow(6.5, currentRows) * Math.pow(1.1, id - 1));
}

export function orchardGrowSec(id: number): number {
  return Math.floor(86_400 * (2 + id * 1.4));
}

export function vegetableGrowSec(id: number): number {
  return Math.floor(3_600 * (6 + id * 2.2));
}

export function horseradishComplete(plots: PlotProgress[]): boolean {
  const p = plots.find((x) => x.id === PLOT_HORSERADISH);
  return Boolean(p?.unlocked && (p.rowCount ?? 0) >= ROWS_PER_TIER);
}

export function computeRootLevel(plots: PlotProgress[], extraPlots: PlotProgress[] = []): number {
  const allPlots = [...plots, ...extraPlots];
  const unlockedPlots = allPlots.filter((p) => p.unlocked).length;
  const totalRows = allPlots.reduce((sum, p) => sum + (p.unlocked ? Math.max(0, Math.floor(p.rowCount) || 0) : 0), 0);
  return Math.max(1, unlockedPlots + Math.floor(totalRows / ROWS_PER_TIER));
}

export function vegetablesUnlocked(plots: PlotProgress[], extraPlots: PlotProgress[] = []): boolean {
  return computeRootLevel(plots, extraPlots) >= ROOT_LEVEL_VEGETABLES;
}

export function userHasStormHazards(plots: PlotProgress[]): boolean {
  const ginger = plots.find((p) => p.id === PLOT_GINGER);
  return Boolean(ginger?.unlocked && (ginger.rowCount ?? 0) >= 2);
}

export function createInitialTierPlots(count: number): TierPlotProgress[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    unlocked: false,
    rowCount: 0,
    rowsActive: 0,
    cycleProgress: 0,
  }));
}
