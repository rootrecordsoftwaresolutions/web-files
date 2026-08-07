/** Canonical RootMC Discord report channel IDs (must match wrangler.toml). */

import type { RootMcDedicatedChannelCategory } from "./rootmc-grok-prompts";

export const ROOTMC_CHANNEL_DAILY_SUMMARY = "1516395175780286615";
export const ROOTMC_CHANNEL_ECONOMY = "1516804780884889621";
export const ROOTMC_CHANNEL_TOWNS = "1516282373426249878";
export const ROOTMC_CHANNEL_NATIONS = "1516283667364974602";

export const ROOTMC_CATEGORY_CHANNEL_ID: Record<RootMcDedicatedChannelCategory, string> = {
  economy_intel: ROOTMC_CHANNEL_ECONOMY,
  towns: ROOTMC_CHANNEL_TOWNS,
  nations: ROOTMC_CHANNEL_NATIONS,
};

type ChannelEnv = {
  DISCORD_ROOTMC_DAILY_REPORT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ECONOMY_ANNOUNCE_CHANNEL_ID?: string;
  DISCORD_ROOTMC_TOWN_INFO_CHANNEL_ID?: string;
  DISCORD_ROOTMC_NATION_INFO_CHANNEL_ID?: string;
};

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function resolveDailySummaryChannelId(env: ChannelEnv): string {
  return str(env.DISCORD_ROOTMC_DAILY_REPORT_CHANNEL_ID) || ROOTMC_CHANNEL_DAILY_SUMMARY;
}

export function resolveCategoryChannelId(
  env: ChannelEnv,
  category: RootMcDedicatedChannelCategory,
): string {
  const fallback = ROOTMC_CATEGORY_CHANNEL_ID[category];
  if (category === "economy_intel") {
    return str(env.DISCORD_ROOTMC_ECONOMY_ANNOUNCE_CHANNEL_ID) || fallback;
  }
  if (category === "towns") {
    return str(env.DISCORD_ROOTMC_TOWN_INFO_CHANNEL_ID) || fallback;
  }
  if (category === "nations") {
    return str(env.DISCORD_ROOTMC_NATION_INFO_CHANNEL_ID) || fallback;
  }
  return fallback;
}
