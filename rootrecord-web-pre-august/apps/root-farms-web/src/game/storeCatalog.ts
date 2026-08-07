export type ProtectionKind = "gopher" | "mice" | "rabbit" | "birds";

export type StoreToggleKind = ProtectionKind | "lightning_meteorologist" | "cypress_trees";
export type FarmhandToolKind = StoreToggleKind;
export type FarmhandToolPurchaseKind =
  | "buy_gopher_tool"
  | "buy_mice_tool"
  | "buy_rabbit_tool"
  | "buy_birds_tool"
  | "buy_lightning_rod"
  | "buy_cypress_tool";

export type StoreProtectionItem = {
  kind: StoreToggleKind;
  title: string;
  blurb: string;
  feePctLabel: string;
  feePct: number;
  toolPurchaseKind: FarmhandToolPurchaseKind;
  toolName: string;
  toolAction: string;
  oneTimeCost: number;
};

export const LIGHTNING_ROD_COST = 1_000_000;

export const STORE_PROTECTIONS: StoreProtectionItem[] = [
  {
    kind: "gopher",
    title: "Gopher protection",
    blurb: "Stops gophers gnawing rows across the unlocked field. −1% income rate.",
    feePctLabel: "−1% income rate",
    feePct: 0.01,
    toolPurchaseKind: "buy_gopher_tool",
    toolName: "Burrow shovel",
    toolAction: "Buy shovel",
    oneTimeCost: 1_000_000,
  },
  {
    kind: "mice",
    title: "Field mice protection",
    blurb: "Stops mice destroying row slots across the unlocked field. −1% income rate.",
    feePctLabel: "−1% income rate",
    feePct: 0.01,
    toolPurchaseKind: "buy_mice_tool",
    toolName: "Mouse traps",
    toolAction: "Buy traps",
    oneTimeCost: 1_000_000,
  },
  {
    kind: "rabbit",
    title: "Rabbit protection",
    blurb: "Stops rabbits wiping rows across the unlocked field. −3% income rate.",
    feePctLabel: "−3% income rate",
    feePct: 0.03,
    toolPurchaseKind: "buy_rabbit_tool",
    toolName: "Rabbit fence",
    toolAction: "Buy fence",
    oneTimeCost: 1_000_000,
  },
  {
    kind: "birds",
    title: "Hire Uncle",
    blurb: "Uncle swats at birds with his cane to keep flocks away from the whole field. −10% income rate.",
    feePctLabel: "−10% income rate",
    feePct: 0.10,
    toolPurchaseKind: "buy_birds_tool",
    toolName: "Uncle's cane",
    toolAction: "Buy cane",
    oneTimeCost: 1_000_000,
  },
  {
    kind: "lightning_meteorologist",
    title: "Lightning meteorologist",
    blurb: "Grounds shared lightning row strikes across the unlocked field. −1% income rate.",
    feePctLabel: "−1% income rate",
    feePct: 0.01,
    toolPurchaseKind: "buy_lightning_rod",
    toolName: "Lightning rod",
    toolAction: "Buy rod",
    oneTimeCost: LIGHTNING_ROD_COST,
  },
  {
    kind: "cypress_trees",
    title: "Cypress windbreak",
    blurb: "Greatly reduces wind crop loss across the unlocked field. −5% income rate (shade).",
    feePctLabel: "−5% income rate",
    feePct: 0.05,
    toolPurchaseKind: "buy_cypress_tool",
    toolName: "Cypress saplings",
    toolAction: "Buy saplings",
    oneTimeCost: 1_000_000,
  },
];

export type FarmsStoreData = {
  protections: FarmsProtections;
  farmhand_tools: FarmsFarmhandTools;
  lightning_rod_owned: boolean;
  lightning_meteorologist: boolean;
  cypress_trees: boolean;
  root_clusters: boolean[];
};

export type FarmsProtections = {
  gopher: boolean;
  mice: boolean;
  rabbit: boolean;
  birds: boolean;
};

export type FarmsFarmhandTools = Record<FarmhandToolKind, boolean>;

export function defaultFarmsStore(): FarmsStoreData {
  return {
    protections: { gopher: false, mice: false, rabbit: false, birds: false },
    farmhand_tools: {
      gopher: false,
      mice: false,
      rabbit: false,
      birds: false,
      lightning_meteorologist: false,
      cypress_trees: false,
    },
    lightning_rod_owned: false,
    lightning_meteorologist: false,
    cypress_trees: false,
    root_clusters: [],
  };
}

export function parseFarmsStoreFromApi(
  protections?: FarmsProtections,
  store?: Partial<FarmsStoreData>,
): FarmsStoreData {
  const base = defaultFarmsStore();
  if (protections) base.protections = { ...base.protections, ...protections };
  if (store) {
    if (store.farmhand_tools) {
      const tools = store.farmhand_tools;
      base.farmhand_tools = {
        gopher: Boolean(tools.gopher),
        mice: Boolean(tools.mice),
        rabbit: Boolean(tools.rabbit),
        birds: Boolean(tools.birds),
        lightning_meteorologist: Boolean(tools.lightning_meteorologist),
        cypress_trees: Boolean(tools.cypress_trees),
      };
    }
    if (store.lightning_rod_owned != null) base.lightning_rod_owned = Boolean(store.lightning_rod_owned);
    if (store.lightning_meteorologist != null) base.lightning_meteorologist = Boolean(store.lightning_meteorologist);
    if (store.cypress_trees != null) base.cypress_trees = Boolean(store.cypress_trees);
    if (Array.isArray(store.root_clusters)) base.root_clusters = store.root_clusters.map(Boolean);
  }
  base.farmhand_tools.gopher ||= base.protections.gopher;
  base.farmhand_tools.mice ||= base.protections.mice;
  base.farmhand_tools.rabbit ||= base.protections.rabbit;
  base.farmhand_tools.birds ||= base.protections.birds;
  base.farmhand_tools.lightning_meteorologist ||= base.lightning_rod_owned || base.lightning_meteorologist;
  base.farmhand_tools.cypress_trees ||= base.cypress_trees;
  return base;
}

export function storeHasFarmhandTool(store: FarmsStoreData, kind: FarmhandToolKind): boolean {
  const tools = store.farmhand_tools ?? defaultFarmsStore().farmhand_tools;
  if (kind === "lightning_meteorologist") return Boolean(store.lightning_rod_owned || tools.lightning_meteorologist);
  return Boolean(tools[kind]);
}

export function farmhandToolCost(kind: FarmhandToolKind): number {
  return STORE_PROTECTIONS.find((item) => item.kind === kind)?.oneTimeCost ?? LIGHTNING_ROD_COST;
}

export function rootClusterIncomeMultiplier(store: FarmsStoreData): number {
  const active = Array.isArray(store.root_clusters) ? store.root_clusters.filter(Boolean).length : 0;
  return 1 + active * 0.05;
}

export function hasActiveFarmhand(store: FarmsStoreData): boolean {
  return Boolean(
    store.protections.gopher ||
      store.protections.mice ||
      store.protections.rabbit ||
      store.protections.birds ||
      store.lightning_meteorologist ||
      store.cypress_trees,
  );
}

export function vegetablesProtected(store: FarmsStoreData): boolean {
  return store.lightning_rod_owned && hasActiveFarmhand(store);
}

/** Multiplier on earnings (1 = full income rate). */
export function protectionIncomeMultiplier(store: FarmsStoreData): number {
  let reduction = 0;
  if (store.protections.gopher) reduction += 0.01;
  if (store.protections.mice) reduction += 0.01;
  if (store.protections.rabbit) reduction += 0.03;
  if (store.protections.birds) reduction += 0.10;
  if (store.lightning_meteorologist) reduction += 0.01;
  if (store.cypress_trees) reduction += 0.05;
  return Math.max(0, 1 - reduction);
}

export type VarmintEvent = {
  id: string;
  kind: string;
  plot_id: number | null;
  message: string;
  created_at: string;
};

export function isAdvisoryEvent(kind: string): boolean {
  return kind.startsWith("advisory_");
}

export function isAttackEvent(kind: string): boolean {
  return !isAdvisoryEvent(kind) && (kind.endsWith("_attack") || kind === "protection_disabled");
}

export function isBlockEvent(kind: string): boolean {
  return kind.endsWith("_blocked");
}
