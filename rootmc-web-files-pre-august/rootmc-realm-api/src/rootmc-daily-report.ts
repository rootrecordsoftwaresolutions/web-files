/**
 * RootMC daily server status report — runs at midnight HST (10:00 UTC).
 * Posts economy, Towny, mcMMO, leaderboards, and Discord activity to a configured channel.
 */

import {
  gatherDiscordOperationalHighlights,
  type DiscordOperationalHighlight,
} from "./rootmc-daily-discord-ops";
import type { TreasuryReportBrief } from "./rootmc-treasury";
import type { D1Database } from "@cloudflare/workers-types";

import { resolveEconomyServerId } from "./realm-lib";
import { FEATURED_SERVER_DEFAULTS } from "./rootmc-server";
import { economySystemAccountSqlFilter } from "./rootmc-economy-accounts";
import {
  netWorthLeaderboard,
  refreshServerNetWorth,
  serverItemTotals,
  shopListingsForServer,
  shopPriceCatalog,
} from "./rootmc-economy";
import {
  discordBotFetch,
  fetchGuildSummary,
  listGuildTextChannels,
} from "./discord-rootmc-api";
import type { RootMcTownyDiscordEnv } from "./discord-rootmc-towny";
import { treasuryBriefForReports, readGoldMintedBreakdown } from "./rootmc-treasury";
import { playtimeLeaderboardForServer } from "./rootstat-minecraft";
import type { RootMcAiEnv } from "./rootmc-world-ai";

export type RootMcDailyReportEnv = RootMcTownyDiscordEnv &
  RootMcAiEnv & {
    DISCORD_ROOTMC_DAILY_REPORT_CHANNEL_ID?: string;
    DISCORD_ROOTMC_ECONOMY_ANNOUNCE_CHANNEL_ID?: string;
    DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
    DISCORD_ROOTMC_OPERATIONS_FORUM_CHANNEL_ID?: string;
    DISCORD_ROOTMC_APPEALS_FORUM_CHANNEL_ID?: string;
  };

type DailyMetrics = {
  serverId: string;
  serverName: string;
  dayKey: string;
  rootmcOk: boolean;
  rootstatOk: boolean;
  gameVersion: string;
  linked: number;
  towny: Awaited<ReturnType<typeof townySnapshot>>;
  economy: Awaited<ReturnType<typeof economyTotals>>;
  playtime: Awaited<ReturnType<typeof playtimeLeaderboardForServer>>;
  netWorth: Awaited<ReturnType<typeof netWorthLeaderboard>>;
  mcmmo: Awaited<ReturnType<typeof mcmmoLeaderboard>>;
  discord: Awaited<ReturnType<typeof discordActivityForDay>>;
  discordOps: DiscordOperationalHighlight[];
  items: Awaited<ReturnType<typeof serverItemTotals>>;
  shops: Awaited<ReturnType<typeof shopListingsForServer>>;
  prices: Awaited<ReturnType<typeof shopPriceCatalog>>;
  treasury: TreasuryReportBrief;
};

const EMBED_GOLD = 0xc9a227;
const HST_OFFSET_MS = 10 * 60 * 60 * 1000;
const TEXT_CHANNEL_SCAN_LIMIT = 25;
const MESSAGE_PAGE_LIMIT = 5;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

/** HST calendar day that just ended when cron fires at 10:00 UTC (midnight HST). */
export function previousHstDayKey(at = new Date()): string {
  const hstMs = at.getTime() - HST_OFFSET_MS - 24 * 60 * 60 * 1000;
  const d = new Date(hstMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hstDayBoundsMs(dayKey: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(`${dayKey}T00:00:00-10:00`);
  const endMs = Date.parse(`${dayKey}T23:59:59.999-10:00`);
  return { startMs, endMs };
}

function snowflakeFromMs(ms: number): string {
  return String((BigInt(Math.floor(ms)) - 1420070400000n) << 22n);
}

function formatGold(value: number): string {
  const n = Math.max(0, Number(value) || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M Gold`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k Gold`;
  if (Number.isInteger(n)) return `${n.toLocaleString()} Gold`;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Gold`;
}

function formatPlaytime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h`;
  }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function playerLine(rank: number, name: string | null, detail: string): string {
  const label = name ? `**${name}**` : "_unknown_";
  return `\`${rank}.\` ${label} — ${detail}`;
}

export async function resolveServerId(db: D1Database): Promise<string> {
  const row = await db
    .prepare(
      `SELECT server_id FROM rootstat_servers
       WHERE featured = 1
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .first<{ server_id: string }>();
  return str(row?.server_id) || FEATURED_SERVER_DEFAULTS.server_id;
}

async function serverStatusRow(db: D1Database, serverId: string) {
  return db
    .prepare(
      `SELECT server_name, game_version, rootmc_plugin_version,
              rootmc_last_seen_at, rootstat_last_seen_at
       FROM rootstat_servers
       WHERE server_id = ?
       LIMIT 1`,
    )
    .bind(serverId)
    .first<Record<string, unknown>>();
}

async function mcmmoLeaderboard(db: D1Database, serverId: string, limit = 5) {
  const { results } = await db
    .prepare(
      `SELECT minecraft_username, power_level
       FROM rootstat_mcmmo_stats
       WHERE server_id = ?
       ORDER BY power_level DESC
       LIMIT ?`,
    )
    .bind(serverId, limit)
    .all<{ minecraft_username: string | null; power_level: number }>();
  return results || [];
}

async function economyTotals(db: D1Database, serverId: string) {
  const net = await db
    .prepare(
      `SELECT COUNT(*) AS players,
              COALESCE(SUM(total_value), 0) AS total_net_worth,
              COALESCE(SUM(balance_value), 0) AS total_balance,
              MAX(synced_at) AS latest_synced_at
       FROM rootstat_player_net_worth
       WHERE server_id = ?
       ${economySystemAccountSqlFilter}`,
    )
    .bind(serverId)
    .first<{
      players: number;
      total_net_worth: number;
      total_balance: number;
      latest_synced_at: string | null;
    }>();

  const shops = await db
    .prepare(
      `SELECT COUNT(*) AS c, MAX(synced_at) AS latest_synced_at
       FROM rootstat_shop_listings WHERE server_id = ?`,
    )
    .bind(serverId)
    .first<{ c: number; latest_synced_at: string | null }>();

  const prices = await db
    .prepare(`SELECT COUNT(*) AS c FROM rootstat_shop_prices WHERE server_id = ? AND avg_price > 0`)
    .bind(serverId)
    .first<{ c: number }>();

  const goldSupply = await readGoldMintedBreakdown(db, serverId);

  const syncedCandidates = [str(net?.latest_synced_at), str(shops?.latest_synced_at)].filter(Boolean);
  const syncedAt = syncedCandidates.sort().pop() || null;

  return {
    trackedPlayers: Number(net?.players) || 0,
    totalNetWorth: Number(net?.total_net_worth) || 0,
    totalBalance: Number(net?.total_balance) || 0,
    totalGoldMinted: goldSupply.total_gold_mined,
    totalGoldMined: goldSupply.total_gold_mined,
    shopListings: Number(shops?.c) || 0,
    pricedItems: Number(prices?.c) || 0,
    syncedAt,
  };
}

async function townySnapshot(db: D1Database, serverId: string) {
  const totals = await db
    .prepare(
      `SELECT
         COALESCE(SUM(plot_count), 0) AS total_plots,
         COALESCE(SUM(town_balance_gold), 0) AS total_town_banks,
         MAX(synced_at) AS latest_synced_at
       FROM rootmc_towny_towns
       WHERE server_id = ? AND is_active = 1`,
    )
    .bind(serverId)
    .first<{ total_plots: number; total_town_banks: number; latest_synced_at: string | null }>();

  const towns = await db
    .prepare(
      `SELECT town_name, mayor_name, resident_count, nation_name, is_capital, plot_count, town_balance_gold
       FROM rootmc_towny_towns
       WHERE server_id = ? AND is_active = 1
       ORDER BY plot_count DESC, resident_count DESC, town_name COLLATE NOCASE ASC
       LIMIT 40`,
    )
    .bind(serverId)
    .all<Record<string, unknown>>();

  const nations = await db
    .prepare(
      `SELECT nation_name, leader_name, town_count
       FROM rootmc_towny_nations
       WHERE server_id = ? AND is_active = 1
       ORDER BY town_count DESC, nation_name COLLATE NOCASE ASC
       LIMIT 12`,
    )
    .bind(serverId)
    .all<Record<string, unknown>>();

  const townCount = await db
    .prepare(`SELECT COUNT(*) AS c FROM rootmc_towny_towns WHERE server_id = ? AND is_active = 1`)
    .bind(serverId)
    .first<{ c: number }>();

  const nationCount = await db
    .prepare(`SELECT COUNT(*) AS c FROM rootmc_towny_nations WHERE server_id = ? AND is_active = 1`)
    .bind(serverId)
    .first<{ c: number }>();

  const totalPlots = Math.max(0, Math.floor(Number(totals?.total_plots) || 0));
  const townRows = towns.results || [];

  return {
    townCount: Number(townCount?.c) || 0,
    nationCount: Number(nationCount?.c) || 0,
    totalPlots,
    totalTownBanks: Math.max(0, Number(totals?.total_town_banks) || 0),
    syncedAt: str(totals?.latest_synced_at) || null,
    plotCountsAvailable: totalPlots > 0,
    towns: townRows,
    nations: nations.results || [],
  };
}

async function linkedPlayerCount(db: D1Database, serverId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(DISTINCT l.minecraft_uuid) AS c
       FROM rootstat_minecraft_links l
       INNER JOIN rootstat_player_playtime p
         ON p.minecraft_uuid = l.minecraft_uuid AND p.server_id = ?`,
    )
    .bind(serverId)
    .first<{ c: number }>();
  return Number(row?.c) || 0;
}

async function upsertDiscoveredChannels(
  db: D1Database,
  guildId: string,
  channels: { id: string; name: string; type: number; position?: number; parent_id?: string | null }[],
): Promise<void> {
  const ts = nowIso();
  for (const ch of channels.slice(0, 80)) {
    await db
      .prepare(
        `INSERT INTO discord_discovered_channels
           (channel_id, guild_id, name, type, position, parent_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(channel_id) DO UPDATE SET
           guild_id = excluded.guild_id,
           name = excluded.name,
           type = excluded.type,
           position = excluded.position,
           parent_id = excluded.parent_id,
           updated_at = excluded.updated_at`,
      )
      .bind(
        ch.id,
        guildId,
        ch.name,
        ch.type,
        Number(ch.position) || 0,
        ch.parent_id || null,
        ts,
      )
      .run();
  }
}

async function countChannelMessagesInWindow(
  token: string,
  channelId: string,
  startMs: number,
  endMs: number,
): Promise<number> {
  const after = snowflakeFromMs(startMs);
  let before: string | undefined;
  let total = 0;

  for (let page = 0; page < MESSAGE_PAGE_LIMIT; page++) {
    const params = new URLSearchParams({ limit: "100", after });
    if (before) params.set("before", before);
    const res = await discordBotFetch(
      token,
      `/channels/${encodeURIComponent(channelId)}/messages?${params}`,
    );
    if (!res.ok) break;
    const msgs = (await res.json()) as { id: string; timestamp?: string }[];
    if (!msgs.length) break;

    for (const msg of msgs) {
      const ts = Date.parse(msg.timestamp || "");
      if (Number.isNaN(ts)) continue;
      if (ts < startMs) continue;
      if (ts > endMs) continue;
      total += 1;
    }

    if (msgs.length < 100) break;
    before = msgs[msgs.length - 1]?.id;
    if (!before) break;
  }

  return total;
}

async function discordActivityForDay(
  env: RootMcDailyReportEnv,
  dayKey: string,
): Promise<{ totalMessages: number; topChannels: { name: string; count: number }[]; memberCount: number }> {
  const token = str(env.DISCORD_ROOTMC_BOT_TOKEN);
  const guildId = str(env.DISCORD_ROOTMC_GUILD_ID);
  if (!token || !guildId) {
    return { totalMessages: 0, topChannels: [], memberCount: 0 };
  }

  const { startMs, endMs } = hstDayBoundsMs(dayKey);
  const guild = await fetchGuildSummary(token, guildId);
  const channels = await listGuildTextChannels(token, guildId);
  await upsertDiscoveredChannels(env.DB, guildId, channels);

  const counts: { name: string; count: number }[] = [];
  let totalMessages = 0;

  for (const ch of channels.slice(0, TEXT_CHANNEL_SCAN_LIMIT)) {
    const count = await countChannelMessagesInWindow(token, ch.id, startMs, endMs);
    if (count > 0) counts.push({ name: ch.name, count });
    totalMessages += count;
  }

  counts.sort((a, b) => b.count - a.count);

  const d1Rows = await env.DB.prepare(
    `SELECT d.channel_id, d.message_count, c.name
     FROM discord_activity_daily_by_channel d
     LEFT JOIN discord_discovered_channels c ON c.channel_id = d.channel_id
     WHERE d.day = ? AND c.guild_id = ?
     ORDER BY d.message_count DESC
     LIMIT 5`,
  )
    .bind(dayKey, guildId)
    .all<{ channel_id: string; message_count: number; name: string | null }>();

  const d1Total = (d1Rows.results || []).reduce((s, r) => s + (Number(r.message_count) || 0), 0);
  if (d1Total > totalMessages) {
    totalMessages = d1Total;
    const fromD1 = (d1Rows.results || [])
      .filter((r) => Number(r.message_count) > 0)
      .map((r) => ({ name: str(r.name) || r.channel_id.slice(-6), count: Number(r.message_count) || 0 }));
    if (fromD1.length) {
      counts.length = 0;
      counts.push(...fromD1);
    }
  }

  return {
    totalMessages,
    topChannels: counts.slice(0, 5),
    memberCount: guild?.memberCount || 0,
  };
}

function pluginOnline(lastSeen: string | null | undefined, windowMs: number): boolean {
  if (!lastSeen) return false;
  const ms = Date.parse(lastSeen);
  return !Number.isNaN(ms) && Date.now() - ms < windowMs;
}

async function gatherDailyMetrics(
  env: RootMcDailyReportEnv,
  dayKey: string,
  serverId?: string,
): Promise<DailyMetrics> {
  const featuredId = str(serverId) || (await resolveServerId(env.DB));
  const economyServerId = await resolveEconomyServerId(env.DB, featuredId, FEATURED_SERVER_DEFAULTS.server_id);
  await refreshServerNetWorth(env.DB, economyServerId);

  const server = await serverStatusRow(env.DB, featuredId);
  const serverName = str(server?.server_name) || FEATURED_SERVER_DEFAULTS.server_name;
  const rootmcOk = pluginOnline(str(server?.rootmc_last_seen_at), 15 * 60 * 1000);
  const rootstatOk = pluginOnline(str(server?.rootstat_last_seen_at), 24 * 60 * 60 * 1000);
  const { startMs, endMs } = hstDayBoundsMs(dayKey);

  const [towny, economy, playtime, netWorth, mcmmo, linked, discord, discordOps, items, shops, prices, treasury] =
    await Promise.all([
    townySnapshot(env.DB, featuredId),
    economyTotals(env.DB, economyServerId),
    playtimeLeaderboardForServer(env.DB, featuredId, 25),
    netWorthLeaderboard(env.DB, economyServerId, 15),
    mcmmoLeaderboard(env.DB, featuredId, 15),
    linkedPlayerCount(env.DB, featuredId),
    discordActivityForDay(env, dayKey),
    gatherDiscordOperationalHighlights(env, startMs, endMs),
    serverItemTotals(env.DB, economyServerId, 30),
    shopListingsForServer(env.DB, economyServerId, 50),
    shopPriceCatalog(env.DB, economyServerId, 50),
    treasuryBriefForReports(env.DB, featuredId),
  ]);

  return {
    serverId: featuredId,
    serverName,
    dayKey,
    rootmcOk,
    rootstatOk,
    gameVersion: str(server?.game_version) || FEATURED_SERVER_DEFAULTS.game_version,
    linked,
    towny,
    economy,
    playtime,
    netWorth,
    mcmmo,
    discord,
    discordOps,
    items,
    shops,
    prices,
    treasury,
  };
}

export { gatherDailyMetrics, type DailyMetrics, EMBED_GOLD, nowIso, formatGold, formatPlaytime, playerLine };

type WaitUntilCtx = { waitUntil: (promise: Promise<unknown>) => void };

const ROOTMC_SCHEDULED_CATEGORIES = ["economy_intel", "towns", "nations"] as const;

/** Run all daily reports (daily + category briefs in isolated Worker invocations). */
export function scheduleRootMcDailyReports(env: RootMcDailyReportEnv, ctx: WaitUntilCtx): void {
  ctx.waitUntil(
    (async () => {
      const { runFullDailyReportSuite } = await import("./rootmc-daily-report-runner");
      await runFullDailyReportSuite(env);
    })().catch((e) => console.error("rootmc_daily_reports_failed", e instanceof Error ? e.message : String(e))),
  );
}

export async function runRootMcDailyReportCron(env: RootMcDailyReportEnv): Promise<void> {
  const { runFullDailyReportSuite } = await import("./rootmc-daily-report-runner");
  await runFullDailyReportSuite(env);
}
