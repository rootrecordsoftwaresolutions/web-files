import { apiFetch, apiFetchNoBearer } from "./api";

export type EconomyLeaderEntry = {
  rank: number;
  balance: number;
  wallet_short: string;
  public_display_name: string | null;
  discord_username: string | null;
  discord_global_name: string | null;
  farms_plots_unlocked: number;
  farms_rows_accumulated: number;
};

export type EconomyLeaderboard = {
  ok: boolean;
  updated_at: string;
  total_circulation: number;
  count: number;
  entries: EconomyLeaderEntry[];
};

export type EconomyDailyPoint = {
  day: string;
  total_circulation: number;
  account_count: number;
};

export type EconomyDaily = {
  ok: boolean;
  updated_at: string;
  days: number;
  total_circulation: number;
  account_count: number;
  series: EconomyDailyPoint[];
};

export function economyEntryLabel(e: EconomyLeaderEntry): string {
  if (e.public_display_name) return e.public_display_name;
  if (e.discord_global_name) return e.discord_global_name;
  if (e.discord_username) {
    const u = e.discord_username.replace(/^@/, "");
    return `@${u}`;
  }
  return e.wallet_short;
}

export async function fetchEconomyDaily(days = 30): Promise<EconomyDaily | null> {
  try {
    const q = `?days=${encodeURIComponent(String(days))}`;
    const token = localStorage.getItem("rrfarms.token");
    const res = token
      ? await apiFetch(`/api/v1/economy/daily${q}`, { cache: "no-store" })
      : await apiFetchNoBearer(`/api/v1/economy/daily${q}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as EconomyDaily;
    if (!data?.ok || !Array.isArray(data.series)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchEconomyLeaderboard(): Promise<EconomyLeaderboard | null> {
  try {
    const token = localStorage.getItem("rrfarms.token");
    const res = token
      ? await apiFetch("/api/v1/economy/leaderboard", { cache: "no-store" })
      : await apiFetchNoBearer("/api/v1/economy/leaderboard", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as EconomyLeaderboard;
    if (!data?.ok || !Array.isArray(data.entries)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function patchPublicDisplayName(name: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await apiFetch("/api/v1/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_display_name: name }),
    });
    const data = (await res.json()) as { ok?: boolean; detail?: string };
    if (!res.ok) return { ok: false, detail: data.detail || "Could not save display name." };
    return { ok: Boolean(data.ok) };
  } catch {
    return { ok: false, detail: "Network error." };
  }
}
