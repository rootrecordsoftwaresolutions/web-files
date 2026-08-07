import { CATALOG_HASH, PLOT_COUNT, getPlotCatalog } from "../game/catalog";
import type { TierPlotProgress } from "../game/tier-catalog";
import {
  parseFarmsStoreFromApi,
  type FarmsStoreData,
  type StoreToggleKind,
  type VarmintEvent,
} from "../game/storeCatalog";

import type { GameSave } from "../game/types";

import { apiFetch } from "./api";

function storedTruthy(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export type OrchardAppBonusTree = {
  id: number;
  key: "volcano" | "business" | "weather" | string;
  name: string;
  unlocked: boolean;
  used_recently: boolean;
  active: boolean;
  bonus_pct: number;
  last_open_at: string | null;
};

export type OrchardAppBonus = {
  multiplier: number;
  active_count: number;
  trees: OrchardAppBonusTree[];
};

export type MembershipBonusTree = {
  key: "monthly_member" | "lifetime_member" | string;
  name: string;
  active: boolean;
  bonus_pct: number;
  blurb: string;
};

export type MembershipBonus = {
  multiplier: number;
  bonus_pct: number;
  monthly_active: boolean;
  lifetime_active: boolean;
  pro_redeemed_until: string | null;
  trees: MembershipBonusTree[];
};

export type FarmhandCheckinStatus = {
  active: boolean;
  last_checkin_at: string | null;
  expires_at: string | null;
  window_hours: number;
};

export type DiceMarketRequest = {
  id: string;
  stake: number;
  status: "open" | "resolved" | "tie" | string;
  creator_label: string;
  joiner_label: string | null;
  creator_roll: number | null;
  joiner_roll: number | null;
  winner_label: string | null;
  is_mine: boolean;
  can_join: boolean;
  can_cancel: boolean;
  created_at: string;
  joined_at: string | null;
  resolved_at: string | null;
};

export type MarketLimit = {
  used: number;
  limit: number;
  remaining: number;
  locked: boolean;
  locked_until: string | null;
};

export type DiceMarketResponse = {
  ok: true;
  balance: number;
  requests: DiceMarketRequest[];
  detail?: string;
  cost?: number;
  pro_redeemed_until?: string | null;
  pro_unlocked?: boolean;
  membership_bonus?: MembershipBonus;
  market_limit?: MarketLimit;
};

export type MarketWheelSpinResponse = {
  ok: true;
  cost: number;
  prize: number;
  label: string;
  net: number;
  visual_index: number;
  balance: number;
  detail?: string;
  market_limit?: MarketLimit;
};

export type MarketRouletteSpinResponse = {
  ok: true;
  game: "roulette";
  amount: number;
  bet_kind: string;
  bet_number: number | null;
  outcome_number: number;
  outcome_color: "red" | "black" | "green" | string;
  multiplier: number;
  won: boolean;
  payout: number;
  payout_capped?: boolean;
  net: number;
  balance: number;
  detail?: string;
  market_limit?: MarketLimit;
};

export type MarketHiLoResponse = {
  ok: true;
  game: "hi_lo";
  active: boolean;
  session_id?: string;
  stake: number;
  bank: number;
  current_card: number;
  current_rank: number;
  current_suit: string;
  current_label: string;
  rounds: number;
  status: string;
  guess?: "high" | "low" | string;
  next_card?: number;
  next_rank?: number;
  next_suit?: string;
  next_label?: string;
  tie?: boolean;
  won?: boolean;
  payout?: number;
  net?: number;
  balance: number;
  detail?: string;
  market_limit?: MarketLimit;
};

function parseRootPlots(raw: unknown): GameSave["plots"] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: GameSave["plots"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = Math.floor(Number(o.id) || 0);
    if (id < 1 || id > PLOT_COUNT) continue;
    const cat = getPlotCatalog(id);
    const unlocked = Boolean(o.unlocked) || id === 1;
    const rowCount = unlocked
      ? Math.min(cat.maxRows, Math.max(id === 1 ? 1 : 0, Math.floor(Number(o.rowCount ?? o.row_count) || 0)))
      : 0;
    let rowsActive = unlocked
      ? Math.min(rowCount, Math.max(0, Math.floor(Number(o.rowsActive ?? o.rows_active) || 0)))
      : 0;
    if (rowsActive <= 0 && rowCount > 0) rowsActive = rowCount;
    out.push({
      id,
      unlocked,
      rowCount,
      rowsActive,
      cycleProgress: Math.max(0, Math.min(Number(o.cycleProgress ?? o.cycle_progress) || 0, 50)),
    });
  }
  return out.length ? out : undefined;
}

export type FarmsStateResponse = {
  ok: boolean;
  balance: number;
  progress_version: number;
  last_settled_ms: number;
  lifetime_farms_earned: number;
  plots?: GameSave["plots"];
  orchards?: TierPlotProgress[];
  vegetables?: TierPlotProgress[];
  store?: FarmsStoreData;
  root_level?: number;
  orchards_unlocked?: boolean;
  vegetables_unlocked?: boolean;
  vegetables_protected?: boolean;
  farmhand_checkin?: FarmhandCheckinStatus;
  lightning_row?: number | null;
  daily_remaining?: number;
  ru_per_sec?: number;
  protection_fee_per_minute?: number;
  varmint_events?: VarmintEvent[];
  pending_ru?: number;
  orchard_app_bonus?: OrchardAppBonus;
  membership_bonus?: MembershipBonus;
};

export type FarmsPurchaseKind =
  | "unlock_plot"
  | "row_slot"
  | "root_cluster"
  | "buy_gopher_tool"
  | "buy_mice_tool"
  | "buy_rabbit_tool"
  | "buy_birds_tool"
  | "buy_lightning_rod"
  | "buy_cypress_tool"
  | "orchard_unlock"
  | "orchard_row"
  | "vegetable_unlock"
  | "vegetable_row";

export type FarmsPurchaseOk = {
  balance: number;
  progress_version: number;
  last_settled_ms: number;
  lifetime_farms_earned: number;
  plots: GameSave["plots"];
  orchards?: TierPlotProgress[];
  vegetables?: TierPlotProgress[];
  store?: FarmsStoreData;
  cost: number;
  rejected?: true;
  detail?: string;
  varmint_events?: VarmintEvent[];
  orchard_app_bonus?: OrchardAppBonus;
  membership_bonus?: MembershipBonus;
  farmhand_checkin?: FarmhandCheckinStatus;
};

function parseTierPlots(raw: unknown): TierPlotProgress[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item) => {
    const o = item as Record<string, unknown>;
    const unlocked = Boolean(o.unlocked);
    const rowCount = unlocked
      ? Math.min(10, Math.max(1, Math.floor(Number(o.rowCount ?? o.row_count) || 0)))
      : 0;
    let rowsActive = unlocked
      ? Math.min(rowCount, Math.max(0, Math.floor(Number(o.rowsActive ?? o.rows_active) || 0)))
      : 0;
    if (rowsActive <= 0 && rowCount > 0) rowsActive = rowCount;
    return {
      id: Math.floor(Number(o.id) || 0),
      unlocked,
      rowCount,
      rowsActive,
      cycleProgress: Math.max(0, Math.min(Number(o.cycleProgress ?? o.cycle_progress) || 0, 50)),
    };
  });
}

function parseOrchardAppBonus(raw: unknown): OrchardAppBonus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const rawTrees = Array.isArray(o.trees) ? o.trees : [];
  const trees = rawTrees
    .map((item) => {
      const t = item as Record<string, unknown>;
      return {
        id: Math.max(1, Math.floor(Number(t.id) || 0)),
        key: String(t.key || ""),
        name: String(t.name || ""),
        unlocked: t.unlocked === true,
        used_recently: t.used_recently === true,
        active: t.active === true,
        bonus_pct: Math.max(0, Math.floor(Number(t.bonus_pct) || 0)),
        last_open_at: typeof t.last_open_at === "string" && t.last_open_at ? t.last_open_at : null,
      } satisfies OrchardAppBonusTree;
    })
    .filter((t) => t.id > 0 && t.name);
  return {
    multiplier: Math.max(1, Number(o.multiplier) || 1),
    active_count: Math.max(0, Math.floor(Number(o.active_count) || 0)),
    trees,
  };
}

function parseMembershipBonus(raw: unknown): MembershipBonus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const rawTrees = Array.isArray(o.trees) ? o.trees : [];
  const trees = rawTrees
    .map((item) => {
      const t = item as Record<string, unknown>;
      return {
        key: String(t.key || ""),
        name: String(t.name || ""),
        active: t.active === true,
        bonus_pct: Math.max(0, Math.floor(Number(t.bonus_pct) || 0)),
        blurb: String(t.blurb || ""),
      } satisfies MembershipBonusTree;
    })
    .filter((t) => t.key && t.name);
  return {
    multiplier: Math.max(1, Number(o.multiplier) || 1),
    bonus_pct: Math.max(0, Math.floor(Number(o.bonus_pct) || 0)),
    monthly_active: o.monthly_active === true,
    lifetime_active: o.lifetime_active === true,
    pro_redeemed_until: typeof o.pro_redeemed_until === "string" && o.pro_redeemed_until ? o.pro_redeemed_until : null,
    trees,
  };
}

function parseMarketLimit(raw: unknown): MarketLimit | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    used: Math.max(0, Math.floor(Number(o.used) || 0)),
    limit: Math.max(0, Math.floor(Number(o.limit) || 0)),
    remaining: Math.max(0, Math.floor(Number(o.remaining) || 0)),
    locked: o.locked === true,
    locked_until: typeof o.locked_until === "string" && o.locked_until ? o.locked_until : null,
  };
}

function parseFarmhandCheckin(raw: unknown): FarmhandCheckinStatus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    active: o.active === true,
    last_checkin_at: typeof o.last_checkin_at === "string" && o.last_checkin_at ? o.last_checkin_at : null,
    expires_at: typeof o.expires_at === "string" && o.expires_at ? o.expires_at : null,
    window_hours: Math.max(1, Math.floor(Number(o.window_hours) || 48)),
  };
}

function parseDiceMarketResponse(data: Record<string, unknown>): DiceMarketResponse {
  const rawRequests = Array.isArray(data.requests) ? data.requests : [];
  const requests = rawRequests
    .map((item) => {
      const o = item as Record<string, unknown>;
      return {
        id: String(o.id || ""),
        stake: Math.max(0, Math.floor(Number(o.stake) || 0)),
        status: String(o.status || "open"),
        creator_label: String(o.creator_label || "Farmer"),
        joiner_label: typeof o.joiner_label === "string" && o.joiner_label ? o.joiner_label : null,
        creator_roll: o.creator_roll != null ? Math.max(1, Math.floor(Number(o.creator_roll) || 0)) : null,
        joiner_roll: o.joiner_roll != null ? Math.max(1, Math.floor(Number(o.joiner_roll) || 0)) : null,
        winner_label: typeof o.winner_label === "string" && o.winner_label ? o.winner_label : null,
        is_mine: o.is_mine === true,
        can_join: o.can_join === true,
        can_cancel: o.can_cancel === true,
        created_at: String(o.created_at || ""),
        joined_at: typeof o.joined_at === "string" && o.joined_at ? o.joined_at : null,
        resolved_at: typeof o.resolved_at === "string" && o.resolved_at ? o.resolved_at : null,
      } satisfies DiceMarketRequest;
    })
    .filter((r) => r.id && r.stake > 0);
  return {
    ok: true,
    balance: Math.max(0, Math.floor(Number(data.balance) || 0)),
    requests,
    detail: typeof data.detail === "string" ? data.detail : undefined,
    cost: data.cost != null ? Math.max(0, Math.floor(Number(data.cost) || 0)) : undefined,
    pro_redeemed_until: typeof data.pro_redeemed_until === "string" && data.pro_redeemed_until ? data.pro_redeemed_until : null,
    pro_unlocked: storedTruthy(data.pro_unlocked || data.proUnlocked),
    membership_bonus: parseMembershipBonus(data.membership_bonus),
    market_limit: parseMarketLimit(data.market_limit),
  };
}

function parsePurchaseBody(data: Record<string, unknown>, progressVersion: number): FarmsPurchaseOk | null {
  const plots = parseRootPlots(data.plots);
  if (!plots || data.progress_version == null) return null;
  const detail = typeof data.detail === "string" ? data.detail : undefined;
  const storeRaw = data.store as Record<string, unknown> | undefined;
  const store = storeRaw
    ? parseFarmsStoreFromApi(
        storeRaw.protections as FarmsStoreData["protections"] | undefined,
        storeRaw as Partial<FarmsStoreData>,
      )
    : undefined;
  return {
    balance: Math.floor(Number(data.balance) || 0),
    progress_version: Math.floor(Number(data.progress_version) || progressVersion),
    last_settled_ms: Math.floor(Number(data.last_settled_ms) || Date.now()),
    lifetime_farms_earned: Math.floor(Number(data.lifetime_farms_earned) || 0),
    plots,
    orchards: parseTierPlots(data.orchards),
    vegetables: parseTierPlots(data.vegetables),
    store,
    cost: Math.floor(Number(data.cost) || 0),
    detail,
    varmint_events: Array.isArray(data.varmint_events)
      ? (data.varmint_events as VarmintEvent[])
      : undefined,
    orchard_app_bonus: parseOrchardAppBonus(data.orchard_app_bonus),
    membership_bonus: parseMembershipBonus(data.membership_bonus),
    farmhand_checkin: parseFarmhandCheckin(data.farmhand_checkin),
  };
}

function parseFarmsStateResponse(data: Record<string, unknown>): FarmsStateResponse | null {
  if (data.ok === false) return null;
  const balance = Math.max(0, Math.floor(Number(data.balance ?? data.ledger_balance) || 0));
  const progress_version = Math.floor(Number(data.progress_version) || 1);
  const last_settled_ms = Math.floor(Number(data.last_settled_ms) || Date.now());
  const lifetime_farms_earned = Math.max(0, Math.floor(Number(data.lifetime_farms_earned) || 0));
  const plots = parseRootPlots(data.plots);
  const storeRaw = data.store as Record<string, unknown> | undefined;
  const protRaw = data.protections as Record<string, unknown> | undefined;
  const store = parseFarmsStoreFromApi(
    protRaw
      ? {
          gopher: Boolean(protRaw.gopher),
          mice: Boolean(protRaw.mice),
          rabbit: Boolean(protRaw.rabbit),
          birds: Boolean(protRaw.birds),
        }
      : undefined,
    storeRaw as Partial<FarmsStoreData> | undefined,
  );
  const varmint_events = Array.isArray(data.varmint_events)
    ? (data.varmint_events as VarmintEvent[])
    : undefined;
  const lightning_row =
    data.lightning_row === null || data.lightning_row === undefined
      ? data.lightning_row === null
        ? null
        : undefined
      : Math.floor(Number(data.lightning_row));
  return {
    ok: true,
    balance,
    progress_version,
    last_settled_ms,
    lifetime_farms_earned,
    plots,
    orchards: parseTierPlots(data.orchards),
    vegetables: parseTierPlots(data.vegetables),
    store,
    root_level: data.root_level != null ? Math.floor(Number(data.root_level)) : undefined,
    orchards_unlocked: data.orchards_unlocked === true,
    vegetables_unlocked: data.vegetables_unlocked === true,
    vegetables_protected: data.vegetables_protected === true,
    farmhand_checkin: parseFarmhandCheckin(data.farmhand_checkin),
    lightning_row,
    daily_remaining: data.daily_remaining != null ? Math.floor(Number(data.daily_remaining)) : undefined,
    ru_per_sec: data.ru_per_sec != null ? Number(data.ru_per_sec) : undefined,
    protection_fee_per_minute:
      data.protection_fee_per_minute != null ? Math.floor(Number(data.protection_fee_per_minute)) : undefined,
    varmint_events,
    pending_ru: data.pending_ru != null ? Math.max(0, Math.floor(Number(data.pending_ru))) : undefined,
    orchard_app_bonus: parseOrchardAppBonus(data.orchard_app_bonus),
    membership_bonus: parseMembershipBonus(data.membership_bonus),
  };
}

export async function postStoreToggle(
  kind: StoreToggleKind,
  enabled: boolean,
  progressVersion: number,
): Promise<FarmsStateResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/store/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        enabled,
        progress_version: progressVersion,
        catalog_hash: CATALOG_HASH,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return parseFarmsStateResponse(data);
  } catch {
    return null;
  }
}

/** @deprecated use postStoreToggle */
export const postStoreProtectionToggle = postStoreToggle;

export async function postVarmintAck(eventIds: string[]): Promise<boolean> {
  try {
    const res = await apiFetch("/api/v1/farms/varmint/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_ids: eventIds }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchFarmsState(): Promise<FarmsStateResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/state", { method: "GET" });
    if (res.status === 404 || res.status === 501) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return parseFarmsStateResponse(data);
  } catch {
    return null;
  }
}

export type FarmsSettleOk = {
  ok: true;
  granted: number;
  raw_granted?: number;
  balance: number;
  last_settled_ms: number;
  progress_version: number;
  lifetime_farms_earned?: number;
  plots?: GameSave["plots"];
  orchards?: TierPlotProgress[];
  vegetables?: TierPlotProgress[];
  daily_remaining?: number;
  harvest_cooldown_sec?: number;
  pending_ru?: number;
  detail?: string;
  daily_cap_blocked?: boolean;
  ad_bonus_granted?: number;
  orchard_app_bonus?: OrchardAppBonus;
  membership_bonus?: MembershipBonus;
};

export type FarmsSettleErr = {
  ok: false;
  status: number;
  detail?: string;
  retry_after_sec?: number;
  balance?: number;
  pending_ru?: number;
  progress_version?: number;
  last_settled_ms?: number;
  lifetime_farms_earned?: number;
  plots?: GameSave["plots"];
};

export type FarmsSettleResult = FarmsSettleOk | FarmsSettleErr | null;

export type FarmsRewardedAdBonusOk = {
  ok: true;
  bonus_granted: number;
  balance: number;
  lifetime_farms_earned?: number;
};

function parseFarmsSettleBody(
  data: Record<string, unknown>,
  progressVersion: number,
  clientNowMs: number,
): Omit<FarmsSettleOk, "ok"> {
  return {
    granted: Math.floor(Number(data.granted) || 0),
    raw_granted: data.raw_granted != null ? Math.floor(Number(data.raw_granted)) : undefined,
    balance: Math.floor(Number(data.balance) || 0),
    last_settled_ms: Math.floor(Number(data.last_settled_ms) || clientNowMs),
    progress_version: Math.floor(Number(data.progress_version) || progressVersion),
    lifetime_farms_earned:
      data.lifetime_farms_earned != null ? Math.floor(Number(data.lifetime_farms_earned)) : undefined,
    plots: parseRootPlots(data.plots),
    orchards: parseTierPlots(data.orchards),
    vegetables: parseTierPlots(data.vegetables),
    daily_remaining: data.daily_remaining != null ? Math.floor(Number(data.daily_remaining)) : undefined,
    harvest_cooldown_sec:
      data.harvest_cooldown_sec != null ? Math.floor(Number(data.harvest_cooldown_sec) || 60) : undefined,
    pending_ru: data.pending_ru != null ? Math.max(0, Math.floor(Number(data.pending_ru))) : undefined,
    detail: typeof data.detail === "string" ? data.detail : undefined,
    daily_cap_blocked: data.daily_cap_blocked === true,
    ad_bonus_granted:
      data.ad_bonus_granted != null ? Math.max(0, Math.floor(Number(data.ad_bonus_granted))) : undefined,
    orchard_app_bonus: parseOrchardAppBonus(data.orchard_app_bonus),
    membership_bonus: parseMembershipBonus(data.membership_bonus),
  };
}

export async function postFarmsSettle(
  clientNowMs: number,
  progressVersion: number,
  plots?: GameSave["plots"],
  opts?: { rewardedDouble?: boolean },
): Promise<FarmsSettleResult> {
  try {
    const res = await apiFetch("/api/v1/farms/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_now_ms: clientNowMs,
        progress_version: progressVersion,
        catalog_hash: CATALOG_HASH,
        plots,
        rewarded_double: opts?.rewardedDouble === true,
      }),
    });

    if (res.status === 404 || res.status === 501) return null;

    const data = (await res.json()) as Record<string, unknown>;

    if (res.status === 429) {
      return {
        ok: false,
        status: 429,
        detail: typeof data.detail === "string" ? data.detail : undefined,
        retry_after_sec: Math.max(1, Math.floor(Number(data.retry_after_sec) || 60)),
        balance: data.balance != null ? Math.floor(Number(data.balance)) : undefined,
        pending_ru: data.pending_ru != null ? Math.max(0, Math.floor(Number(data.pending_ru))) : undefined,
        progress_version: data.progress_version != null ? Math.floor(Number(data.progress_version)) : undefined,
        last_settled_ms: data.last_settled_ms != null ? Math.floor(Number(data.last_settled_ms)) : undefined,
      };
    }

    if (res.status === 409) {
      return {
        ok: false,
        status: 409,
        detail: typeof data.detail === "string" ? data.detail : undefined,
        ...parseFarmsSettleBody(data, progressVersion, clientNowMs),
      };
    }

    if (!res.ok) return null;

    return { ok: true, ...parseFarmsSettleBody(data, progressVersion, clientNowMs) };
  } catch {
    return null;
  }
}

export async function postFarmsRewardedAdBonus(): Promise<FarmsRewardedAdBonusOk | null> {
  try {
    const res = await apiFetch("/api/v1/farms/rewarded-ad-bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      bonus_granted: Math.max(0, Math.floor(Number(data.bonus_granted) || 0)),
      balance: Math.max(0, Math.floor(Number(data.balance) || 0)),
      lifetime_farms_earned:
        data.lifetime_farms_earned != null ? Math.max(0, Math.floor(Number(data.lifetime_farms_earned) || 0)) : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchDiceMarket(): Promise<DiceMarketResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/dice", { method: "GET" });
    if (!res.ok) return null;
    return parseDiceMarketResponse((await res.json()) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function postDiceRequest(stake: number): Promise<DiceMarketResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/dice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH, stake: Math.max(0, Math.floor(Number(stake) || 0)) }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return parseDiceMarketResponse(data);
  } catch {
    return null;
  }
}

export async function postDiceJoin(id: string): Promise<DiceMarketResponse | null> {
  try {
    const res = await apiFetch(`/api/v1/farms/market/dice/${encodeURIComponent(id)}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return parseDiceMarketResponse(data);
  } catch {
    return null;
  }
}

export async function postDiceCancel(id: string): Promise<DiceMarketResponse | null> {
  try {
    const res = await apiFetch(`/api/v1/farms/market/dice/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return parseDiceMarketResponse(data);
  } catch {
    return null;
  }
}

export async function postMarketDonation(amount: number): Promise<DiceMarketResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/donate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH, amount: Math.max(0, Math.floor(Number(amount) || 0)) }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return parseDiceMarketResponse(data);
  } catch {
    return null;
  }
}

export async function postMarketMonthlyPass(): Promise<DiceMarketResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/monthly-pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return parseDiceMarketResponse(data);
  } catch {
    return null;
  }
}

export async function postMarketWheelSpin(): Promise<MarketWheelSpinResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/wheel/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: true,
        cost: 0,
        prize: 0,
        label: "",
        net: 0,
        visual_index: 0,
        balance: Math.max(0, Math.floor(Number(data.balance) || 0)),
        detail: typeof data.detail === "string" ? data.detail : undefined,
        market_limit: parseMarketLimit(data.market_limit),
      };
    }
    return {
      ok: true,
      cost: Math.max(0, Math.floor(Number(data.cost) || 0)),
      prize: Math.max(0, Math.floor(Number(data.prize) || 0)),
      label: String(data.label || ""),
      net: Math.floor(Number(data.net) || 0),
      visual_index: Math.max(0, Math.min(99, Math.floor(Number(data.visual_index) || 0))),
      balance: Math.max(0, Math.floor(Number(data.balance) || 0)),
      detail: typeof data.detail === "string" ? data.detail : undefined,
      market_limit: parseMarketLimit(data.market_limit),
    };
  } catch {
    return null;
  }
}

export async function postMarketRouletteSpin(
  amount: number,
  betKind: string,
  number?: number,
): Promise<MarketRouletteSpinResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/roulette/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalog_hash: CATALOG_HASH,
        amount: Math.max(0, Math.floor(Number(amount) || 0)),
        bet_kind: betKind,
        number,
      }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      game: "roulette",
      amount: Math.max(0, Math.floor(Number(data.amount) || 0)),
      bet_kind: String(data.bet_kind || betKind),
      bet_number: data.bet_number == null ? null : Math.floor(Number(data.bet_number) || 0),
      outcome_number: Math.max(0, Math.floor(Number(data.outcome_number) || 0)),
      outcome_color: String(data.outcome_color || ""),
      multiplier: Math.max(0, Math.floor(Number(data.multiplier) || 0)),
      won: Boolean(data.won),
      payout: Math.max(0, Math.floor(Number(data.payout) || 0)),
      payout_capped: data.payout_capped === true,
      net: Math.floor(Number(data.net) || 0),
      balance: Math.max(0, Math.floor(Number(data.balance) || 0)),
      detail: typeof data.detail === "string" ? data.detail : undefined,
      market_limit: parseMarketLimit(data.market_limit),
    };
  } catch {
    return null;
  }
}

function parseMarketHiLoResponse(data: Record<string, unknown>): MarketHiLoResponse {
  return {
    ok: true,
    game: "hi_lo",
    active: data.active === true,
    session_id: typeof data.session_id === "string" && data.session_id ? data.session_id : undefined,
    stake: Math.max(0, Math.floor(Number(data.stake ?? data.amount) || 0)),
    bank: Math.max(0, Math.floor(Number(data.bank ?? data.payout ?? data.amount) || 0)),
    current_card: Math.max(0, Math.floor(Number(data.current_card ?? data.next_card ?? data.first_card) || 0)),
    current_rank: Math.max(0, Math.floor(Number(data.current_rank) || 0)),
    current_suit: String(data.current_suit || ""),
    current_label: String(data.current_label || data.next_label || data.first_label || ""),
    rounds: Math.max(0, Math.floor(Number(data.rounds) || 0)),
    status: String(data.status || (data.active === true ? "active" : "")),
    guess: data.guess == null ? undefined : String(data.guess),
    next_card: data.next_card == null ? undefined : Math.max(0, Math.floor(Number(data.next_card) || 0)),
    next_rank: data.next_rank == null ? undefined : Math.max(0, Math.floor(Number(data.next_rank) || 0)),
    next_suit: data.next_suit == null ? undefined : String(data.next_suit || ""),
    next_label: data.next_label == null ? undefined : String(data.next_label || ""),
    tie: data.tie == null ? undefined : Boolean(data.tie),
    won: data.won == null ? undefined : Boolean(data.won),
    payout: data.payout == null ? undefined : Math.max(0, Math.floor(Number(data.payout) || 0)),
    net: data.net == null ? undefined : Math.floor(Number(data.net) || 0),
    balance: Math.max(0, Math.floor(Number(data.balance) || 0)),
    detail: typeof data.detail === "string" ? data.detail : undefined,
    market_limit: parseMarketLimit(data.market_limit),
  };
}

export async function fetchMarketHiLoState(): Promise<MarketHiLoResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/hi-lo/state", { method: "GET" });
    if (!res.ok) return null;
    return parseMarketHiLoResponse((await res.json()) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function postMarketHiLoStart(amount: number): Promise<MarketHiLoResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/hi-lo/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalog_hash: CATALOG_HASH,
        amount: Math.max(0, Math.floor(Number(amount) || 0)),
      }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return parseMarketHiLoResponse(data);
  } catch {
    return null;
  }
}

export async function postMarketHiLoGuess(guess: "high" | "low"): Promise<MarketHiLoResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/hi-lo/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH, guess }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return parseMarketHiLoResponse(data);
  } catch {
    return null;
  }
}

export async function postMarketHiLoCashOut(): Promise<MarketHiLoResponse | null> {
  try {
    const res = await apiFetch("/api/v1/farms/market/hi-lo/cash-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog_hash: CATALOG_HASH }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return parseMarketHiLoResponse(data);
  } catch {
    return null;
  }
}

export async function postFarmsPurchase(
  kind: FarmsPurchaseKind,
  plotId: number,
  progressVersion: number,
): Promise<FarmsPurchaseOk | null> {
  try {
    const res = await apiFetch("/api/v1/farms/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        plot_id: plotId,
        progress_version: progressVersion,
        catalog_hash: CATALOG_HASH,
        client_now_ms: Date.now(),
      }),
    });

    if (res.status === 404 || res.status === 501) return null;

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const parsed = parsePurchaseBody(data, progressVersion);
      if (parsed) return { ...parsed, rejected: true as const };
      return null;
    }

    const parsed = parsePurchaseBody(data, progressVersion);
    if (!parsed) return null;
    return parsed;
  } catch {
    return null;
  }
}
