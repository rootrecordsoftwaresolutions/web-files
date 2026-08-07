export type PlotAccent = "green" | "cyan" | "blue" | "purple" | "amber";

export type PlotCatalogEntry = {
  id: number;
  name: string;
  scientificName: string;
  group: string;
  groupId: number;
  summary: string;
  climate: string;
  growNotes: string;
  rowLabel: string;
  maxRows: number;
  growTimeSec: number;
  baseRuPerRow: number;
  unlockLifetime: number;
  accent: PlotAccent;
};

export type PlotProgress = {
  id: number;
  unlocked: boolean;
  rowCount: number;
  rowsActive: number;
  cycleProgress: number;
};

export type GameSave = {
  version: 1 | 2;
  localBalance: number;
  lifetimeEarned: number;
  lastTickMs: number;
  lastSettledMs: number;
  plots: PlotProgress[];
};

export type TabId =
  | "plots"
  | "roots"
  | "orchards"
  | "vegetables"
  | "farmhands"
  | "market"
  | "transactions"
  | "guide"
  | "leaderboard"
  | "replant"
  | "settings";
