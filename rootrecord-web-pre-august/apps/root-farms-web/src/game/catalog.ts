import type { PlotAccent, PlotCatalogEntry } from "./types";
import { PLOT_COUNT, getRootSpecies } from "./roots-catalog";

export { PLOT_COUNT, ROOT_GROUP_LABELS, getRootSpecies } from "./roots-catalog";
export type { RootGroupId, RootSpeciesDef } from "./roots-catalog";

export const ROWS_PER_PLOT = 10;
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export const FULL_FIELD_BONUS = 1.1;
export const FIRST_PLOT_ATOMIC_PER_SEC = 1;
export const ROOTS_DAILY_PRODUCTION_CAP_ATOMIC = 100_000_000;
export const CATALOG_HASH = "root-farms-v11";
export const ROOT_CLUSTER_COUNT = 6;
export const ROOT_CLUSTER_SIZE = 10;
export const ROOT_CLUSTER_BONUS = 0.05;
export const ROOT_CLUSTER_COSTS_ATOMIC = [1_000_000, 5_000_000, 10_000_000, 15_000_000, 20_000_000, 25_000_000] as const;
export const ROOT_CLUSTER_NAMES = [
  "Root Cluster Tree I",
  "Root Cluster Tree II",
  "Root Cluster Tree III",
  "Root Cluster Tree IV",
  "Root Cluster Tree V",
  "Root Cluster Tree VI",
] as const;

const GROUP_ACCENT: Record<number, PlotAccent> = {
  1: "green",
  2: "cyan",
  3: "blue",
  4: "purple",
  5: "amber",
  6: "green",
};

/** Plot 1 = 1s; plot 65 = 1 day — geometric spread across all tiers. */
const GROW_TIME_MIN_SEC = 1;
const GROW_TIME_MAX_SEC = 86_400;

function growTimeSecForLevel(id: number): number {
  if (id <= 1) return GROW_TIME_MIN_SEC;
  if (id >= PLOT_COUNT) return GROW_TIME_MAX_SEC;
  const exp = (id - 1) / (PLOT_COUNT - 1);
  const t = GROW_TIME_MIN_SEC * Math.pow(GROW_TIME_MAX_SEC / GROW_TIME_MIN_SEC, exp);
  return Math.round(t * 100) / 100;
}

function baseRuPerRowForLevel(id: number, growTimeSec: number): number {
  const ruPerSec = FIRST_PLOT_ATOMIC_PER_SEC * Math.pow(1.018, id - 1);
  return Math.max(1, Math.floor(ruPerSec * growTimeSec));
}

function buildPlot(id: number): PlotCatalogEntry {
  const species = getRootSpecies(id);
  const growTimeSec = growTimeSecForLevel(id);
  return {
    id,
    name: species.name,
    scientificName: species.scientificName,
    group: species.group,
    groupId: species.groupId,
    summary: species.summary,
    climate: species.climate,
    growNotes: species.growNotes,
    rowLabel: "Growing row",
    maxRows: ROWS_PER_PLOT,
    growTimeSec,
    baseRuPerRow: baseRuPerRowForLevel(id, growTimeSec),
    unlockLifetime: 0,
    accent: GROUP_ACCENT[species.groupId] ?? "green",
  };
}

export const PLOTS: PlotCatalogEntry[] = Array.from({ length: PLOT_COUNT }, (_, k) => buildPlot(k + 1));

export function getPlotCatalog(id: number): PlotCatalogEntry {
  return PLOTS[id - 1] ?? PLOTS[0];
}

/** Plot 2 ≈ 800 RU; each next plot ~1.72× (plot 10 ≈ 52k, plot 20 ≈ 2.4M). */
export function plotUnlockCost(plotId: number): number {
  if (plotId <= 1) return 0;
  const tier = plotId - 1;
  return Math.floor(800 * Math.pow(1.72, tier - 1));
}

/** Rows scale with plot tier and slot index — later plots cost much more per row. */
export function rowSlotCost(plotId: number, currentRows: number): number {
  const tier = plotId - 1;
  return Math.floor(90 * Math.pow(1.58, currentRows) * Math.pow(1.28, tier));
}

export function plotRuPerCycle(cat: PlotCatalogEntry, rowsActive: number, rowCount: number): number {
  if (rowsActive <= 0) return 0;
  const base = rowsActive * cat.baseRuPerRow;
  const full = rowCount > 1 && rowsActive >= rowCount;
  const bonus = full ? FULL_FIELD_BONUS : 1;
  return Math.floor(base * bonus);
}

export function plotRuPerSec(cat: PlotCatalogEntry, rowsActive: number, rowCount: number): number {
  const per = plotRuPerCycle(cat, rowsActive, rowCount);
  if (per <= 0 || cat.growTimeSec <= 0) return 0;
  return per / cat.growTimeSec;
}

export function rootClusterRange(clusterId: number): { start: number; end: number } {
  const id = Math.min(ROOT_CLUSTER_COUNT, Math.max(1, Math.floor(clusterId) || 1));
  const start = (id - 1) * ROOT_CLUSTER_SIZE + 1;
  return { start, end: Math.min(PLOT_COUNT, start + ROOT_CLUSTER_SIZE - 1) };
}

export function rootClusterCost(clusterId: number): number {
  return ROOT_CLUSTER_COSTS_ATOMIC[clusterId - 1] ?? ROOT_CLUSTER_COSTS_ATOMIC[ROOT_CLUSTER_COSTS_ATOMIC.length - 1];
}

export function rootClusterName(clusterId: number): string {
  return ROOT_CLUSTER_NAMES[clusterId - 1] ?? `Root Cluster Tree ${clusterId}`;
}
