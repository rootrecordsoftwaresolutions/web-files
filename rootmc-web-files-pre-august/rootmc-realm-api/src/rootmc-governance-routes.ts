/**
 * HTTP routes — governance voting power for linked players.
 */

import type { D1Database } from "@cloudflare/workers-types";

import { json } from "./cors";
import { resolveLinkedPlayerByDiscord } from "./discord-rootmc-economy";
import { resolveServerId } from "./rootmc-daily-report";
import {
  computeGovernancePowerSnapshot,
  formatGovernancePowerLine,
  governancePowerForUuid,
  isGovernanceEligible,
} from "./rootmc-governance-voting";
import { syncCouncilVotersRoleForDiscordUser } from "./rootmc-governance-council";

export type GovernanceRoutesEnv = {
  DB: D1Database;
  DISCORD_ROOTMC_VOTING_CHANNEL_ID?: string;
  DISCORD_ROOTMC_GUILD_ID?: string;
  SITE_URL?: string;
} & Parameters<typeof syncCouncilVotersRoleForDiscordUser>[0];

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export async function handleGovernanceRoutes(
  request: Request,
  env: GovernanceRoutesEnv,
  sub: string,
  method: string,
): Promise<Response | null> {
  if (method !== "GET") return null;

  const votingChannelId = str(env.DISCORD_ROOTMC_VOTING_CHANNEL_ID);
  const votingChannelUrl = votingChannelId
    ? `https://discord.com/channels/${str(env.DISCORD_ROOTMC_GUILD_ID) || "1516108585740800042"}/${votingChannelId}`
    : "https://rootmc.net/wiki/constitution/#governance-voting";

  if (sub === "governance/voting-power") {
    const url = new URL(request.url);
    const uuid = str(url.searchParams.get("uuid"));
    const discordUserId = str(url.searchParams.get("discord_user_id"));
    const serverId = await resolveServerId(env.DB);

    let targetUuid = uuid;
    if (!targetUuid && discordUserId) {
      const linked = await resolveLinkedPlayerByDiscord(env.DB, discordUserId);
      targetUuid = str(linked?.minecraftUuid);
    }
    if (!targetUuid) {
      return json({ ok: false, eligible: false, detail: "not_linked" }, 404);
    }

    const power = await governancePowerForUuid(env.DB, serverId, targetUuid);
    const eligible = isGovernanceEligible(power);
    return json({
      ok: true,
      eligible,
      minecraft_uuid: targetUuid,
      share_percent: power?.share_percent ?? 0,
      playtime_seconds: power?.playtime_seconds ?? 0,
      net_worth: power?.net_worth ?? 0,
      site_multiplier: power?.site_multiplier ?? 1,
      total_votes: power?.total_votes ?? 0,
      vote_points: power?.vote_points ?? 1,
      sites_voted: power?.sites_voted ?? [],
      voting_channel_id: votingChannelId || null,
      voting_channel_url: votingChannelUrl,
      constitution_url: "https://rootmc.net/wiki/constitution/#governance-voting",
      summary: power ? formatGovernancePowerLine(power) : null,
    });
  }

  if (sub === "governance/leaderboard") {
    const serverId = await resolveServerId(env.DB);
    const snap = await computeGovernancePowerSnapshot(env.DB, serverId);
    return json({
      ok: true,
      eligible_count: snap.eligible_count,
      leaders: snap.rows.slice(0, 25).map((r) => ({
        minecraft_username: r.minecraft_username,
        share_percent: r.share_percent,
        playtime_seconds: r.playtime_seconds,
        vote_points: r.vote_points,
        total_votes: r.total_votes,
        site_multiplier: r.site_multiplier,
      })),
    });
  }

  return null;
}

export async function handleGovernanceDiscordVote(
  env: GovernanceRoutesEnv,
  discordUserId: string,
): Promise<string> {
  const linked = await resolveLinkedPlayerByDiscord(env.DB, discordUserId);
  if (!linked?.minecraftUuid) {
    return "Link Minecraft at **https://rootmc.net/verify** before checking governance voting power.";
  }

  const serverId = await resolveServerId(env.DB);
  const power = await governancePowerForUuid(env.DB, serverId, linked.minecraftUuid);
  const votingChannelId = str(env.DISCORD_ROOTMC_VOTING_CHANNEL_ID);
  const channelNote = votingChannelId ? `<#${votingChannelId}>` : "**#voting**";

  await syncCouncilVotersRoleForDiscordUser(env, discordUserId);

  if (!isGovernanceEligible(power)) {
    return [
      `**Governance voting power** — not eligible yet`,
      "",
      "Requires a **linked** account and **≥1 hour** playtime on RootMC.",
      "",
      `Listing sites (Gold + vote points): run \`/vote\` in-game or see https://rootmc.net/wiki/economy/#votes`,
      `Constitution: https://rootmc.net/wiki/constitution/#governance-voting`,
    ].join("\n");
  }

  return [
    `**Governance voting power** — ${str(linked.minecraftUsername) || "linked player"}`,
    "",
    formatGovernancePowerLine(power!),
    "",
    `Official polls: ${channelNote} · also at https://rootmc.net/council/`,
    "Vote on bot polls or the site (For / Against / Abstain) — weighted by your %.",
    "Accept terms: https://rootmc.net/terms/ · Policy: https://rootmc.net/wiki/constitution/#governance-voting",
  ].join("\n");
}
