/**
 * Governance voting power — playtime × vote_points → share of 100%.
 * Each verified listing vote (all-time) = one vote point (baseline 1 when none).
 * Policy: https://rootmc.net/wiki/constitution/#governance-voting
 */

import type { D1Database } from "@cloudflare/workers-types";

import {
  canonicalListingSiteId,
  canonicalListingSiteIds,
  LISTING_SITE_MAX_POINTS,
  votePointsFromTotalVotes,
  VOTE_POINT_BASELINE,
} from "./rootmc-listing-sites";
import { playtimeStatsForPlayer } from "./rootstat-minecraft";

const MIN_PLAYTIME_SECONDS = 3600;

export type GovernancePowerRow = {
  minecraft_uuid: string;
  minecraft_username: string | null;
  discord_user_id: string | null;
  playtime_seconds: number;
  /** @deprecated Not used in voting power — always 0. */
  net_worth: number;
  /** @deprecated Not used in voting power — always 0. */
  stake: number;
  /** All-time verified listing votes (Votifier callbacks). */
  total_votes: number;
  /** max(1, total_votes) — multiplier in raw formula. */
  vote_points: number;
  /** @deprecated Use vote_points — kept for API compat (same numeric value). */
  site_multiplier: number;
  raw_weight: number;
  share_percent: number;
  /** Distinct canonical listing sites voted all-time (informational). */
  sites_voted: string[];
};

export type GovernancePowerSnapshot = {
  eligible_count: number;
  total_raw: number;
  rows: GovernancePowerRow[];
};

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeUuid(raw: unknown): string {
  return str(raw).toLowerCase();
}

/** @deprecated Net worth is not used in governance voting power. */
export function stakeFromNetWorth(_netWorth: number): number {
  return 0;
}

async function allTimeListingVoteCount(db: D1Database, uuid: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as c FROM rootmc_listing_votes
       WHERE minecraft_uuid = ?`,
    )
    .bind(normalizeUuid(uuid))
    .first<{ c: number }>();
  return Math.max(0, Math.floor(Number(row?.c) || 0));
}

async function allTimeListingCanonicalSites(
  db: D1Database,
  uuid: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT service FROM rootmc_listing_votes
       WHERE minecraft_uuid = ?
       ORDER BY service ASC`,
    )
    .bind(normalizeUuid(uuid))
    .all<{ service: string }>();
  const raw = (results || []).map((r) => str(r.service)).filter(Boolean);
  return canonicalListingSiteIds(raw);
}

export async function governancePowerForUuid(
  db: D1Database,
  serverId: string,
  uuid: string,
  snapshot?: GovernancePowerSnapshot,
): Promise<GovernancePowerRow | null> {
  const snap = snapshot || (await computeGovernancePowerSnapshot(db, serverId));
  return snap.rows.find((r) => normalizeUuid(r.minecraft_uuid) === normalizeUuid(uuid)) || null;
}

export async function computeGovernancePowerSnapshot(
  db: D1Database,
  serverId: string,
): Promise<GovernancePowerSnapshot> {
  const { results: links } = await db
    .prepare(
      `SELECT m.minecraft_uuid, m.minecraft_username, d.discord_user_id
       FROM rootstat_minecraft_links m
       INNER JOIN discord_account_links d ON d.account_id = m.account_id
       WHERE d.discord_user_id IS NOT NULL AND TRIM(d.discord_user_id) != ''`,
    )
    .all<{ minecraft_uuid: string; minecraft_username: string | null; discord_user_id: string }>();

  const rows: GovernancePowerRow[] = [];
  for (const link of links || []) {
    const uuid = normalizeUuid(link.minecraft_uuid);
    if (!uuid) continue;

    const playtime = await playtimeStatsForPlayer(db, serverId, uuid);
    const playtimeSeconds = Math.max(0, Math.floor(Number(playtime?.total_playtime_seconds) || 0));
    if (playtimeSeconds < MIN_PLAYTIME_SECONDS) continue;

    const totalVotes = await allTimeListingVoteCount(db, uuid);
    const sites = await allTimeListingCanonicalSites(db, uuid);
    const votePoints = votePointsFromTotalVotes(totalVotes);
    const raw = playtimeSeconds * votePoints;

    rows.push({
      minecraft_uuid: uuid,
      minecraft_username: str(link.minecraft_username) || str(playtime?.minecraft_username) || null,
      discord_user_id: str(link.discord_user_id) || null,
      playtime_seconds: playtimeSeconds,
      net_worth: 0,
      stake: 0,
      total_votes: totalVotes,
      vote_points: votePoints,
      site_multiplier: votePoints,
      raw_weight: Math.round(raw * 100) / 100,
      share_percent: 0,
      sites_voted: sites,
    });
  }

  const totalRaw = rows.reduce((s, r) => s + r.raw_weight, 0);
  for (const row of rows) {
    row.share_percent =
      totalRaw > 0 ? Math.round((row.raw_weight / totalRaw) * 10000) / 100 : 0;
  }

  rows.sort((a, b) => b.share_percent - a.share_percent || b.raw_weight - a.raw_weight);
  return { eligible_count: rows.length, total_raw: totalRaw, rows };
}

export function formatGovernancePowerLine(row: GovernancePowerRow): string {
  const sites =
    row.sites_voted.length > 0
      ? row.sites_voted.slice(0, 4).join(", ") + (row.sites_voted.length > 4 ? "…" : "")
      : "none (run /vote on listing sites)";
  return [
    `Playtime ${formatHours(row.playtime_seconds)} · vote points ${row.vote_points} (${row.total_votes} listing votes)`,
    `Listing sites (all-time): ${sites}`,
  ].join("\n");
}

export function formatHours(seconds: number): string {
  const h = Math.floor(Math.max(0, seconds) / 3600);
  const m = Math.floor((Math.max(0, seconds) % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function isGovernanceEligible(row: GovernancePowerRow | null): boolean {
  return row != null && row.share_percent > 0;
}

/** @deprecated Renamed — use canonicalListingSiteId from rootmc-listing-sites. */
export function siteBonusForService(service: string): number {
  return canonicalListingSiteId(service) ? 1 : 0;
}

/** @deprecated Vote points use total vote count, not distinct sites. */
export function computeSiteMultiplier(services: string[]): number {
  return votePointsFromTotalVotes(services.length);
}

export { VOTE_POINT_BASELINE, LISTING_SITE_MAX_POINTS };
