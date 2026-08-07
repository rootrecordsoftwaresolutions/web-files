/**
 * Posts live realm economy stats to #general once per hour.
 */

import type { D1Database } from "@cloudflare/workers-types";

import { discordBotFetch } from "./discord-rootmc-api";
import { formatGold, roundGold } from "./discord-rootmc-economy";
import { economySystemAccountSqlFilter } from "./rootmc-economy-accounts";
import { resolveServerId } from "./rootmc-daily-report";
import { FEATURED_SERVER_ADDRESS, publicServerAddress } from "./rootmc-server";
import { goldFoundLeaderboardForServer } from "./rootmc-gold-found";
import { reserveGoldMinedUrl } from "./rootmc-site";
import { treasuryBriefForReports, readPostResetNoteSupplySnapshot } from "./rootmc-treasury";

export type RootMcLiveEconomyStatusEnv = {
  DB: D1Database;
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
  SITE_URL?: string;
};

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

const LIVE_STATS_MAX_AGE_MS = 12 * 60 * 1000;
const MCSTATUS_API_BASE = "https://api.mcstatus.io/v2/status/java";

/** Strip URL scheme/trailing slash; keep host or host:port for mcstatus.io. */
export function parseJavaServerEndpoint(address: string): string {
  const trimmed = str(address) || FEATURED_SERVER_ADDRESS;
  return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/** Live player count via Minecraft server list ping (mcstatus.io). */
export async function queryJavaServerOnlinePlayers(serverAddress: string): Promise<number | null> {
  const endpoint = parseJavaServerEndpoint(serverAddress);
  if (!endpoint) return null;

  const url = `${MCSTATUS_API_BASE}/${encodeURIComponent(endpoint)}?timeout=4`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn("rootmc_server_ping_http", endpoint, res.status);
      return null;
    }
    const body = (await res.json()) as { online?: boolean; players?: { online?: number } };
    if (!body.online) return 0;
    return Math.max(0, Math.floor(Number(body.players?.online) || 0));
  } catch (e) {
    console.warn(
      "rootmc_server_ping_failed",
      endpoint,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

async function readHeartbeatOnlinePlayerCount(
  db: D1Database,
  serverId: string,
): Promise<number | null> {
  try {
    const live = await db
      .prepare(
        `SELECT online_players, updated_at FROM rootmc_server_live_stats WHERE server_id = ? LIMIT 1`,
      )
      .bind(serverId)
      .first<{ online_players: number; updated_at: string }>();
    const updatedAt = Date.parse(str(live?.updated_at));
    if (
      live &&
      Number.isFinite(updatedAt) &&
      Date.now() - updatedAt <= LIVE_STATS_MAX_AGE_MS
    ) {
      return Math.max(0, Math.floor(Number(live.online_players) || 0));
    }
  } catch {
    // Table may not exist until migration 0118 is applied.
  }
  return null;
}

async function readOnlinePlayerCount(
  db: D1Database,
  serverId: string,
  serverAddress: string,
): Promise<number> {
  const pinged = await queryJavaServerOnlinePlayers(serverAddress);
  if (pinged !== null) {
    await upsertServerLiveStats(db, serverId, pinged);
    return pinged;
  }

  const heartbeat = await readHeartbeatOnlinePlayerCount(db, serverId);
  return heartbeat ?? 0;
}

async function readServerAddress(db: D1Database, serverId: string): Promise<string> {
  const row = await db
    .prepare(`SELECT server_address FROM rootstat_servers WHERE server_id = ? LIMIT 1`)
    .bind(serverId)
    .first<{ server_address: string | null }>();
  return publicServerAddress(row?.server_address);
}

async function readTopPlayer(
  db: D1Database,
  serverId: string,
): Promise<{ username: string; balance: number } | null> {
  const fromNetWorth = await db
    .prepare(
      `SELECT minecraft_username, balance_value
       FROM rootstat_player_net_worth
       WHERE server_id = ?
       ${economySystemAccountSqlFilter}
       ORDER BY balance_value DESC
       LIMIT 1`,
    )
    .bind(serverId)
    .first<{ minecraft_username: string | null; balance_value: number }>();
  if (fromNetWorth && Number(fromNetWorth.balance_value) > 0) {
    return {
      username: str(fromNetWorth.minecraft_username) || "Unknown",
      balance: Math.max(0, Number(fromNetWorth.balance_value) || 0),
    };
  }
  const fromBalances = await db
    .prepare(
      `SELECT minecraft_username, balance
       FROM rootstat_player_balances
       WHERE server_id = ?
       ${economySystemAccountSqlFilter}
       ORDER BY balance DESC
       LIMIT 1`,
    )
    .bind(serverId)
    .first<{ minecraft_username: string | null; balance: number }>();
  if (!fromBalances) {
    return null;
  }
  return {
    username: str(fromBalances.minecraft_username) || "Unknown",
    balance: Math.max(0, Number(fromBalances.balance) || 0),
  };
}

async function readTopGoldMiner(
  db: D1Database,
  serverId: string,
): Promise<{ username: string; minedSinceJuly: number } | null> {
  const rows = await goldFoundLeaderboardForServer(db, serverId, 1, "since_july");
  const top = rows[0];
  if (!top) {
    return null;
  }
  const physical = roundGold(top.mined_ore_since_july_g + top.mined_block_since_july_g);
  if (physical <= 0) {
    return null;
  }
  return {
    username: str(top.minecraft_username) || "Unknown",
    minedSinceJuly: physical,
  };
}

export function buildLiveEconomyStatusMessage(input: {
  serverAddress: string;
  onlinePlayers: number;
  walletGold: number;
  goldInCirculation: number;
  reserveVaultNotes: number;
  reserveGold: number;
  totalGoldMined: number;
  topPlayer: { username: string; balance: number } | null;
  topGoldMiner?: { username: string; minedSinceJuly: number } | null;
  goldMinedUrl?: string;
  backingPct?: number | null;
  dynamicTaxPct?: number | null;
  economyUrl?: string;
}): string {
  const topPlayerLine = input.topPlayer
    ? `**${input.topPlayer.username}** — **${formatGold(input.topPlayer.balance)}**`
    : "_No player wallets tracked yet._";
  const address = str(input.serverAddress) || FEATURED_SERVER_ADDRESS;
  const goldMinedUrl = str(input.goldMinedUrl) || reserveGoldMinedUrl();
  const topMinerLine =
    input.topGoldMiner && input.topGoldMiner.minedSinceJuly > 0
      ? `• **Top miner (since July 1):** **${input.topGoldMiner.username}** — **${formatGold(input.topGoldMiner.minedSinceJuly)}**\n`
      : "";
  const economyUrl = str(input.economyUrl) || "https://rootmc.net/economy/";
  const backingPct = Number(input.backingPct);
  const dynamicTaxPct = Number(input.dynamicTaxPct);
  const backingSuffix = Number.isFinite(backingPct)
    ? ` (${backingPct.toFixed(1)}% wallet Notes backed by /mint)`
    : "";
  const taxLine =
    Number.isFinite(dynamicTaxPct) && dynamicTaxPct > 0
      ? `• **Transaction tax:** **${dynamicTaxPct.toFixed(2)}%**${backingSuffix} · [economy](${economyUrl})\n`
      : `• **Transaction tax:** **0.10%**${backingSuffix || " (wallet Notes fully backed)"} · [economy](${economyUrl})\n`;
  const circulationLine = `• **Gold in circulation (wallets):** ${formatGold(input.walletGold)}\n`;

  return (
    `**Realm snapshot**\n` +
    `• **Server:** \`${address}\`\n` +
    `• **Players online:** ${input.onlinePlayers}\n` +
    `• **Top player:** ${topPlayerLine} · same as \`/baltop players\`\n` +
    `• **Wallet gold (all players):** ${formatGold(input.walletGold)}\n` +
    `• **TOTAL GOLD MINED ALL TIME:** **${formatGold(input.totalGoldMined)}** · [audited ledger](${goldMinedUrl})\n` +
    topMinerLine +
    taxLine +
    `• **Server Reserve (gap bucket):** ${formatGold(input.reserveGold)} · offsets unclaimed/lost/tax differences\n` +
    circulationLine.trimEnd()
  );
}

export async function upsertServerLiveStats(
  db: D1Database,
  serverId: string,
  onlinePlayers: number,
  updatedAt = nowIso(),
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO rootmc_server_live_stats (server_id, online_players, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(server_id) DO UPDATE SET
           online_players = excluded.online_players,
           updated_at = excluded.updated_at`,
      )
      .bind(serverId, Math.max(0, Math.floor(onlinePlayers)), updatedAt)
      .run();
  } catch (e) {
    console.warn(
      "rootmc_live_stats_upsert",
      e instanceof Error ? e.message : String(e),
    );
  }
}

export async function runLiveEconomyStatusPost(
  env: RootMcLiveEconomyStatusEnv,
): Promise<{ ok: boolean; detail: string }> {
  const token = str(env.DISCORD_ROOTMC_BOT_TOKEN);
  const channelId = str(env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID);
  if (!token || !channelId) {
    return { ok: false, detail: "missing bot token or general chat channel id" };
  }

  const serverId = await resolveServerId(env.DB);
  const serverAddress = await readServerAddress(env.DB, serverId);
  try {
    const { refreshTreasuryVaultFromMysql } = await import("./rootmc-mysql-economy-pull");
    await refreshTreasuryVaultFromMysql(env);
  } catch {
    // Hyperdrive unavailable
  }
  const [onlinePlayers, treasury, topPlayer, topGoldMiner, noteSupply] = await Promise.all([
    readOnlinePlayerCount(env.DB, serverId, serverAddress),
    treasuryBriefForReports(env.DB, serverId),
    readTopPlayer(env.DB, serverId),
    readTopGoldMiner(env.DB, serverId),
    readPostResetNoteSupplySnapshot(env.DB, serverId),
  ]);

  const reserveGold = roundGold(Number(treasury.reserve_balance) || 0);
  const walletGold = roundGold(Number(noteSupply.player_notes_g) || 0);
  const siteUrl = str(env.SITE_URL) || "https://rootmc.net";
  const content = buildLiveEconomyStatusMessage({
    serverAddress,
    onlinePlayers,
    walletGold,
    goldInCirculation: roundGold(Number(noteSupply.total_notes_g) || 0),
    reserveVaultNotes: roundGold(Number(noteSupply.reserve_notes_g) || 0),
    reserveGold,
    totalGoldMined: roundGold(Number(noteSupply.gold_mined_g) || 0),
    topPlayer,
    topGoldMiner,
    goldMinedUrl: reserveGoldMinedUrl(env),
    backingPct: noteSupply.backing_pct,
    dynamicTaxPct: noteSupply.dynamic_tax_pct,
    economyUrl: `${siteUrl.replace(/\/$/, "")}/economy/`,
  });

  const postRes = await discordBotFetch(token, `/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });
  if (!postRes.ok) {
    const errText = await postRes.text().catch(() => "");
    return { ok: false, detail: `discord post failed ${postRes.status}: ${errText.slice(0, 200)}` };
  }

  return {
    ok: true,
    detail: `posted online=${onlinePlayers} circulation=${formatGold(noteSupply.total_notes_g)}`,
  };
}
