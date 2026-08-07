/**
 * RootMC community governance — linked-player proposals and voting on Discord.
 */

import type { D1Database } from "@cloudflare/workers-types";

import {
  createForumPostThread,
  discordBotFetch,
  sendChannelMessage,
  type DiscordEmbed,
} from "./discord-rootmc-api";
import { resolveOperationsForumChannelId } from "./rootmc-daily-discord-ops";
import { resolveLinkedPlayerByDiscord } from "./discord-rootmc-economy";
import { isSystemReportUser } from "./rootmc-system-report";
import { activateSeasonFromProposal, defaultSeasonLines } from "./rootmc-season-arcs";
import { governancePowerForUuid } from "./rootmc-governance-voting";
import { resolveServerId } from "./rootmc-daily-report";
import { syncCouncilVotersRoleForDiscordUser } from "./rootmc-governance-council";
import { GOVERNANCE_TERMS_VERSION, termsAcceptedForDiscord } from "./rootmc-governance-terms";
import {
  compileWeeklyBill,
  legislationStatusText,
  listLegislationSummary,
  retractLegislationItem,
  submitBillAmendment,
  submitLegislationItem,
} from "./rootmc-legislature";
import {
  grantProposalEmbedNote,
  GRANT_MAJORITY_HOLD_MS,
  isGrantProposal,
  queueGrantTreasuryPayout,
  syncGrantMajorityState,
  type GrantMajorityDirection,
} from "./rootmc-grant-proposals";

export type ProposalEnv = {
  DB: D1Database;
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_GUILD_ID?: string;
  DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_GOVERNANCE_CHANNEL_ID?: string;
  DISCORD_ROOTMC_VOTING_CHANNEL_ID?: string;
  DISCORD_ROOTMC_PROPOSALS_CHANNEL_ID?: string;
  DISCORD_ROOTMC_OPERATIONS_FORUM_CHANNEL_ID?: string;
  DISCORD_ROOTMC_APPEALS_FORUM_CHANNEL_ID?: string;
};

export type VoteChoice = "for" | "against" | "abstain";

const VOTE_PREFIX = "rootmc_prop:vote:";
const EMBED_BLUE = 0x2d6a4f;
const EMBED_GOLD = 0xc9a227;
const EMBED_RED = 0x8b2635;
/** Minimum linked voters required for a passing result. */
const QUORUM = 5;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function proposalId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function parseVoteCustomId(customId: string): { proposalId: string; choice: VoteChoice } | null {
  if (!customId.startsWith(VOTE_PREFIX)) return null;
  const rest = customId.slice(VOTE_PREFIX.length);
  const i = rest.lastIndexOf(":");
  if (i <= 0) return null;
  const id = rest.slice(0, i);
  const choice = rest.slice(i + 1) as VoteChoice;
  if (!id || !["for", "against", "abstain"].includes(choice)) return null;
  return { proposalId: id, choice };
}

function voteButtons(proposalId: string, disabled = false) {
  const style = disabled ? 2 : 1;
  return [
    {
      type: 1,
      components: [
        { type: 2, style, label: "For", custom_id: `${VOTE_PREFIX}${proposalId}:for`, disabled },
        { type: 2, style: disabled ? 2 : 4, label: "Against", custom_id: `${VOTE_PREFIX}${proposalId}:against`, disabled },
        { type: 2, style: disabled ? 2 : 2, label: "Abstain", custom_id: `${VOTE_PREFIX}${proposalId}:abstain`, disabled },
      ],
    },
  ];
}

async function tallyVotes(db: D1Database, proposalId: string) {
  const { results } = await db
    .prepare(
      `SELECT vote,
              COUNT(*) AS c,
              COALESCE(SUM(vote_weight), 0) AS weighted
       FROM rootmc_community_proposal_votes
       WHERE proposal_id = ? GROUP BY vote`,
    )
    .bind(proposalId)
    .all<{ vote: string; c: number; weighted: number }>();
  let votesFor = 0;
  let votesAgainst = 0;
  let votesAbstain = 0;
  let weightedFor = 0;
  let weightedAgainst = 0;
  let weightedAbstain = 0;
  for (const row of results || []) {
    const c = Number(row.c) || 0;
    const w = Number(row.weighted) || 0;
    if (row.vote === "for") {
      votesFor = c;
      weightedFor = w;
    } else if (row.vote === "against") {
      votesAgainst = c;
      weightedAgainst = w;
    } else if (row.vote === "abstain") {
      votesAbstain = c;
      weightedAbstain = w;
    }
  }
  const totalWeight = weightedFor + weightedAgainst + weightedAbstain;
  const pct = (part: number) =>
    totalWeight > 0 ? Math.round((part / totalWeight) * 1000) / 10 : 0;
  return {
    votesFor,
    votesAgainst,
    votesAbstain,
    total: votesFor + votesAgainst + votesAbstain,
    weightedFor,
    weightedAgainst,
    weightedAbstain,
    totalWeight,
    weightedForPct: pct(weightedFor),
    weightedAgainstPct: pct(weightedAgainst),
    weightedAbstainPct: pct(weightedAbstain),
  };
}

function formatWeight(n: number): string {
  return `${Math.round(Math.max(0, n) * 100) / 100}%`;
}

function buildProposalEmbed(
  row: {
    id: string;
    title: string;
    description: string;
    status: string;
    closes_at: string;
    result_summary?: string | null;
    kind?: string | null;
    season_theme?: string | null;
    bill_summary?: string | null;
    bill_url?: string | null;
    grant_amount?: number | null;
    grant_recipient_username?: string | null;
    majority_direction?: string | null;
    majority_since?: string | null;
  },
  tallies: Awaited<ReturnType<typeof tallyVotes>>,
): DiscordEmbed {
  const open = row.status === "open";
  const isSeason = str(row.kind) === "season_arc";
  const isGrant = str(row.kind) === "grant";
  const billSummary = str(row.bill_summary);
  const billUrl = str(row.bill_url);
  const grantAmount = Number(row.grant_amount) || 0;
  const grantRecipient = str(row.grant_recipient_username);
  const majorityDir = str(row.majority_direction);
  const majoritySince = str(row.majority_since);
  const lines = [
    isSeason ? `_Season arc vote · theme: **${str(row.season_theme) || row.title}**_` : "",
    isGrant
      ? `_Treasury grant · **${grantAmount} G** → **${grantRecipient || "?"}** · ${grantProposalEmbedNote()}_`
      : "",
    billSummary ? `_Bill summary:_ ${billSummary}` : "",
    billUrl ? `_Full bill:_ ${billUrl}` : "",
    row.description.slice(0, 1600),
    "",
    `**Weighted For:** ${formatWeight(tallies.weightedForPct)} · **Against:** ${formatWeight(tallies.weightedAgainstPct)} · **Abstain:** ${formatWeight(tallies.weightedAbstainPct)}`,
    `**Head count:** ${tallies.votesFor} for · ${tallies.votesAgainst} against · ${tallies.votesAbstain} abstain`,
    isGrant
      ? majorityDir && majoritySince
        ? `_Current majority: **${majorityDir}** since ${majoritySince.replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}_`
        : `_No sustained majority yet — need 24h weighted majority to pass or veto_`
      : `**Linked voters:** ${tallies.total} (quorum for pass: ${QUORUM})`,
    open
      ? isGrant
        ? `_Open up to ${row.closes_at.replace("T", " ").replace(/\.\d{3}Z$/, " UTC")} if no majority resolves_`
        : `_Closes ${row.closes_at.replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}_`
      : `_Status: **${row.status}**_`,
  ].filter(Boolean);
  if (row.result_summary) lines.push("", row.result_summary);
  return {
    title: open ? `Official poll — ${row.title}` : `Closed — ${row.title}`,
    description: lines.join("\n").slice(0, 4096),
    color: open ? EMBED_BLUE : row.status === "passed" ? EMBED_GOLD : EMBED_RED,
    footer: {
      text: `Proposal ${row.id}${isSeason ? " · season arc" : ""} · Council of Voters · weighted shares`,
    },
  };
}

async function getProposal(db: D1Database, id: string) {
  return db
    .prepare(`SELECT * FROM rootmc_community_proposals WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<Record<string, unknown>>();
}

async function patchProposalMessage(
  token: string,
  channelId: string,
  messageId: string,
  embed: DiscordEmbed,
  proposalId: string,
  disabled: boolean,
): Promise<void> {
  await discordBotFetch(token, `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      embeds: [embed],
      components: voteButtons(proposalId, disabled),
    }),
  });
}

async function requireLinkedVoter(db: D1Database, discordUserId: string) {
  const linked = await resolveLinkedPlayerByDiscord(db, discordUserId);
  if (!linked?.minecraftUuid) {
    return { ok: false as const, message: "Link Minecraft at https://rootmc.net/verify before voting." };
  }
  return {
    ok: true as const,
    uuid: linked.minecraftUuid,
    username: str(linked.minecraftUsername) || "player",
  };
}

export async function createCommunityProposal(
  env: ProposalEnv,
  params: {
    title: string;
    description: string;
    days: number;
    createdByDiscordId: string;
    kind?: "general" | "season_arc" | "official" | "grant" | "legislation";
    seasonTheme?: string;
    seasonLines?: string[];
    pollChannel?: "forum" | "voting";
    billSummary?: string;
    billUrl?: string;
    grantAmount?: number;
    grantRecipientUuid?: string;
    grantRecipientUsername?: string;
  },
): Promise<{ ok: boolean; detail: string; proposalId?: string }> {
  const token = str(env.DISCORD_ROOTMC_BOT_TOKEN);
  const votingChannelId = str(env.DISCORD_ROOTMC_VOTING_CHANNEL_ID);
  const kind =
    params.kind === "season_arc"
      ? "season_arc"
      : params.kind === "official"
        ? "official"
        : params.kind === "grant"
          ? "grant"
          : params.kind === "legislation"
            ? "legislation"
            : "general";
  const useVotingChannel =
    (params.pollChannel === "voting" || kind === "grant" || kind === "legislation") && votingChannelId;
  const forumId = useVotingChannel ? "" : resolveOperationsForumChannelId(env);
  if (!token || (!useVotingChannel && !forumId)) {
    return { ok: false, detail: "Bot token or poll channel not configured." };
  }
  const seasonTheme = kind === "season_arc" ? str(params.seasonTheme || params.title) : "";
  const seasonLines =
    kind === "season_arc"
      ? (params.seasonLines?.length ? params.seasonLines : defaultSeasonLines(params.title, seasonTheme))
      : [];
  const seasonLinesJson = seasonLines.length ? JSON.stringify(seasonLines) : null;

  const id = proposalId();
  const createdAt = nowIso();
  const closesAt = new Date(Date.now() + Math.max(1, Math.min(30, params.days)) * 24 * 60 * 60 * 1000).toISOString();
  const tallies = {
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    total: 0,
    weightedFor: 0,
    weightedAgainst: 0,
    weightedAbstain: 0,
    totalWeight: 0,
    weightedForPct: 0,
    weightedAgainstPct: 0,
    weightedAbstainPct: 0,
  };
  const billSummary = str(params.billSummary).slice(0, 500) || null;
  const billUrl = str(params.billUrl).slice(0, 500) || null;
  const grantAmount = kind === "grant" ? Number(params.grantAmount) || 0 : null;
  const grantRecipientUuid =
    kind === "grant" ? str(params.grantRecipientUuid).toLowerCase() || null : null;
  const grantRecipientUsername = kind === "grant" ? str(params.grantRecipientUsername) || null : null;
  const embed = buildProposalEmbed(
    {
      id,
      title: params.title,
      description: params.description,
      status: "open",
      closes_at: closesAt,
      kind,
      season_theme: seasonTheme || null,
      bill_summary: billSummary,
      bill_url: billUrl,
      grant_amount: grantAmount,
      grant_recipient_username: grantRecipientUsername,
    },
    tallies,
  );

  let channelId = "";
  let messageId = "";

  if (useVotingChannel) {
    channelId = votingChannelId;
    const webVoteUrl = `https://rootmc.net/governance/vote/?id=${id}`;
    const intro =
      kind === "grant"
        ? `_Treasury grant vote — weighted Council vote. Site: ${webVoteUrl} · **24h sustained majority** passes or vetoes · proposer cannot vote · https://rootmc.net/terms/_`
        : kind === "legislation"
          ? `_Citizen proposal — weighted Council signal. Vote on the site: ${webVoteUrl} or with buttons below · linked accounts + terms · https://rootmc.net/terms/_`
          : `_Official poll — **Council of Voters** (linked accounts). Vote with buttons below or on the site: ${webVoteUrl} · weighted by governance % · accept terms at https://rootmc.net/terms/_`;
    const postRes = await discordBotFetch(token, `/channels/${encodeURIComponent(channelId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: intro, embeds: [embed], components: voteButtons(id, false) }),
    });
    if (!postRes.ok) {
      return { ok: false, detail: "Could not post poll to voting channel." };
    }
    const posted = (await postRes.json()) as { id?: string };
    messageId = str(posted.id);
  } else {
    const thread = await createForumPostThread(token, forumId, params.title.slice(0, 100), {
      content:
        "_Vote with the buttons below. **Linked Minecraft accounts only** — link at https://rootmc.net/verify · power: `/vote` · https://rootmc.net/wiki/constitution/#governance-voting_",
      embeds: [embed],
    });
    if (!thread?.id) {
      return { ok: false, detail: "Could not create forum post." };
    }
    channelId = thread.id;
    const msgRes = await discordBotFetch(token, `/channels/${encodeURIComponent(thread.id)}/messages?limit=1`);
    if (msgRes.ok) {
      const msgs = (await msgRes.json()) as Array<{ id?: string }>;
      messageId = str(msgs[0]?.id);
    }
    if (messageId) {
      await patchProposalMessage(token, channelId, messageId, embed, id, false);
    }
  }

  await env.DB.prepare(
    `INSERT INTO rootmc_community_proposals
       (id, title, description, status, created_by_discord_id, created_at, closes_at, channel_id, message_id,
        kind, season_theme, season_lines_json, bill_summary, bill_url, poll_channel,
        grant_amount, grant_recipient_uuid, grant_recipient_username)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      params.title.slice(0, 200),
      params.description.slice(0, 4000),
      params.createdByDiscordId,
      createdAt,
      closesAt,
      channelId,
      messageId || null,
      kind,
      seasonTheme || null,
      seasonLinesJson,
      billSummary,
      billUrl,
      useVotingChannel ? "voting" : "forum",
      grantAmount,
      grantRecipientUuid,
      grantRecipientUsername,
    )
    .run();

  const governanceId = str(env.DISCORD_ROOTMC_GOVERNANCE_CHANNEL_ID);
  const announceChannel = governanceId || str(env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID);
  if (token && announceChannel && !useVotingChannel) {
    const kindNote =
      kind === "season_arc"
        ? " _(season arc — announcer lines activate if passed)_"
        : kind === "grant"
          ? " _(treasury grant — 24h sustained majority)_"
          : "";
    const channelNote = governanceId ? "Discuss in this channel · vote in the thread" : "Discuss and vote in the thread";
    await sendChannelMessage(token, announceChannel, {
      content: `**New community vote:** ${params.title}${kindNote}\n${channelNote} · <#${channelId}> · \`/proposal status id:${id}\`\n_Linked accounts only — https://rootmc.net/verify_`,
    });
  }

  const dest = useVotingChannel ? `<#${channelId}>` : `<#${channelId}>`;
  return { ok: true, detail: `Proposal **${id}** opened in ${dest}.`, proposalId: id };
}

export async function castProposalVote(
  env: ProposalEnv,
  proposalId: string,
  choice: VoteChoice,
  discordUserId: string,
): Promise<{ ok: boolean; detail: string; embed?: DiscordEmbed; channelId?: string; messageId?: string; disabled?: boolean }> {
  const row = await getProposal(env.DB, proposalId);
  if (!row) return { ok: false, detail: "Unknown proposal id." };
  if (str(row.status) !== "open") return { ok: false, detail: "This vote is closed." };
  if (Date.parse(str(row.closes_at)) < Date.now()) {
    return { ok: false, detail: "Voting period ended." };
  }

  const voter = await requireLinkedVoter(env.DB, discordUserId);
  if (!voter.ok) return { ok: false, detail: voter.message };

  if (isGrantProposal(row) && str(row.created_by_discord_id) === discordUserId) {
    return { ok: false, detail: "Grant proposers cannot vote on their own request." };
  }

  const serverId = await resolveServerId(env.DB);
  const power = await governancePowerForUuid(env.DB, serverId, voter.uuid);
  const voteWeight = power?.share_percent ?? 0;
  if (voteWeight <= 0) {
    return {
      ok: false,
      detail: "Not eligible — need ≥1h playtime and a linked account. Check `/vote` for your governance %.",
    };
  }

  const termsOk = await termsAcceptedForDiscord(env.DB, discordUserId);
  if (!termsOk) {
    return {
      ok: false,
      detail: `Accept the Terms of Service at https://rootmc.net/terms/ before voting (version ${GOVERNANCE_TERMS_VERSION}).`,
    };
  }

  await syncCouncilVotersRoleForDiscordUser(env, discordUserId);

  await env.DB.prepare(
    `INSERT INTO rootmc_community_proposal_votes
       (proposal_id, discord_user_id, vote, minecraft_uuid, minecraft_username, voted_at, vote_weight)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(proposal_id, discord_user_id) DO UPDATE SET
       vote = excluded.vote,
       minecraft_uuid = excluded.minecraft_uuid,
       minecraft_username = excluded.minecraft_username,
       voted_at = excluded.voted_at,
       vote_weight = excluded.vote_weight`,
  )
    .bind(proposalId, discordUserId, choice, voter.uuid, voter.username, nowIso(), voteWeight)
    .run();

  const tallies = await tallyVotes(env.DB, proposalId);
  if (isGrantProposal(row)) {
    await syncGrantMajorityState(env.DB, proposalId, tallies);
  }
  const refreshed = isGrantProposal(row) ? await getProposal(env.DB, proposalId) : row;
  const embed = buildProposalEmbed(
    {
      id: proposalId,
      title: str(refreshed.title),
      description: str(refreshed.description),
      status: "open",
      closes_at: str(refreshed.closes_at),
      kind: str(refreshed.kind) || null,
      bill_summary: str(refreshed.bill_summary) || null,
      bill_url: str(refreshed.bill_url) || null,
      grant_amount: Number(refreshed.grant_amount) || null,
      grant_recipient_username: str(refreshed.grant_recipient_username) || null,
      majority_direction: str(refreshed.majority_direction) || null,
      majority_since: str(refreshed.majority_since) || null,
    },
    tallies,
  );

  return {
    ok: true,
    detail: `Recorded **${choice}** as ${voter.username} (**${voteWeight.toFixed(2)}%** weight).`,
    embed,
    channelId: str(row.channel_id) || undefined,
    messageId: str(row.message_id) || undefined,
    disabled: false,
  };
}

export async function closeCommunityProposal(
  env: ProposalEnv,
  proposalId: string,
  forceStatus?: "passed" | "failed" | "cancelled",
): Promise<{ ok: boolean; detail: string }> {
  const token = str(env.DISCORD_ROOTMC_BOT_TOKEN);
  const row = await getProposal(env.DB, proposalId);
  if (!row) return { ok: false, detail: "Unknown proposal id." };
  if (str(row.status) !== "open") return { ok: false, detail: "Already closed." };

  const tallies = await tallyVotes(env.DB, proposalId);
  const grant = isGrantProposal(row);
  let status = forceStatus;
  if (!status) {
    if (grant) {
      if (tallies.weightedFor > tallies.weightedAgainst) status = "passed";
      else status = "failed";
    } else if (tallies.total < QUORUM) status = "failed";
    else if (tallies.weightedFor > tallies.weightedAgainst) status = "passed";
    else status = "failed";
  }

  const summary =
    status === "passed"
      ? grant
        ? `**Result: PASSED** — treasury grant approved (weighted ${formatWeight(tallies.weightedForPct)} for · ${formatWeight(tallies.weightedAgainstPct)} against · ${tallies.total} voters)`
        : `**Result: PASSED** (weighted ${formatWeight(tallies.weightedForPct)} for · ${formatWeight(tallies.weightedAgainstPct)} against · ${tallies.total} voters)`
      : status === "cancelled"
        ? "**Result: CANCELLED** by staff."
        : grant
          ? `**Result: VETOED** (weighted ${formatWeight(tallies.weightedForPct)} for · ${formatWeight(tallies.weightedAgainstPct)} against)`
          : `**Result: FAILED** (weighted ${formatWeight(tallies.weightedForPct)} for · ${formatWeight(tallies.weightedAgainstPct)} against — need ${QUORUM}+ voters & weighted majority)`;

  await env.DB.prepare(
    `UPDATE rootmc_community_proposals
     SET status = ?, closed_at = ?, result_summary = ?
     WHERE id = ?`,
  )
    .bind(status, nowIso(), summary, proposalId)
    .run();

  const embed = buildProposalEmbed(
    {
      id: proposalId,
      title: str(row.title),
      description: str(row.description),
      status,
      closes_at: str(row.closes_at),
      result_summary: summary,
      kind: str(row.kind) || null,
      bill_summary: str(row.bill_summary) || null,
      bill_url: str(row.bill_url) || null,
      grant_amount: Number(row.grant_amount) || null,
      grant_recipient_username: str(row.grant_recipient_username) || null,
      majority_direction: str(row.majority_direction) || null,
      majority_since: str(row.majority_since) || null,
    },
    tallies,
  );

  const channelId = str(row.channel_id);
  const messageId = str(row.message_id);
  if (token && channelId && messageId) {
    await patchProposalMessage(token, channelId, messageId, embed, proposalId, true);
  }

  const generalId = str(env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID);
  const governanceId = str(env.DISCORD_ROOTMC_GOVERNANCE_CHANNEL_ID);
  const announceChannel = governanceId || generalId;
  if (token && announceChannel) {
    await sendChannelMessage(token, announceChannel, {
      content: `**Community vote closed — ${str(row.title)}**\n${summary}\n_Proposal \`${proposalId}\`_`,
    });
  }

  if (status === "passed" && str(row.kind) === "season_arc") {
    await activateSeasonFromProposal(env, proposalId);
  }

  if (status === "passed" && grant) {
    const payout = await queueGrantTreasuryPayout(env, proposalId, row);
    if (payout.transferId) {
      await env.DB.prepare(
        `UPDATE rootmc_community_proposals SET result_summary = ? WHERE id = ?`,
      )
        .bind(`${summary}\n${payout.detail}`, proposalId)
        .run();
    }
  }

  return { ok: true, detail: summary };
}

export async function listOpenProposals(db: D1Database): Promise<string> {
  const { results } = await db
    .prepare(
      `SELECT id, title, closes_at FROM rootmc_community_proposals
       WHERE status = 'open' ORDER BY closes_at ASC LIMIT 10`,
    )
    .all<{ id: string; title: string; closes_at: string }>();
  if (!results?.length) return "No open community votes.";
  return results
    .map((r) => `• **${r.title}** — \`id:${r.id}\` · closes ${r.closes_at.replace("T", " ").slice(0, 16)} UTC`)
    .join("\n");
}

export async function proposalStatusText(db: D1Database, id: string): Promise<string> {
  const row = await getProposal(db, id);
  if (!row) return "Unknown proposal id.";
  const tallies = await tallyVotes(db, id);
  const embedLines = buildProposalEmbed(
    {
      id: str(row.id),
      title: str(row.title),
      description: str(row.description),
      status: str(row.status),
      closes_at: str(row.closes_at),
      result_summary: str(row.result_summary) || null,
      kind: str(row.kind) || "general",
      season_theme: str(row.season_theme) || null,
      bill_summary: str(row.bill_summary) || null,
      bill_url: str(row.bill_url) || null,
    },
    tallies,
  );
  return `${embedLines.title}\n${embedLines.description}`;
}

export async function expireDueProposals(env: ProposalEnv): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM rootmc_community_proposals WHERE status = 'open' AND closes_at <= ?`,
  )
    .bind(nowIso())
    .all<{ id: string }>();
  let closed = 0;
  for (const row of results || []) {
    const res = await closeCommunityProposal(env, row.id);
    if (res.ok) closed++;
  }
  return closed;
}

export async function processGrantProposalMajorityHold(env: ProposalEnv): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM rootmc_community_proposals WHERE status = 'open' AND kind = 'grant'`,
  ).all<{ id: string }>();

  let closed = 0;
  for (const row of results || []) {
    const proposal = await env.DB.prepare(
      `SELECT id, majority_direction, majority_since FROM rootmc_community_proposals WHERE id = ? LIMIT 1`,
    )
      .bind(row.id)
      .first<{ id: string; majority_direction: string | null; majority_since: string | null }>();
    if (!proposal) continue;

    const direction = str(proposal.majority_direction) as GrantMajorityDirection;
    const since = str(proposal.majority_since);
    if (!direction || !since) continue;
    if (Date.now() - Date.parse(since) < GRANT_MAJORITY_HOLD_MS) continue;

    const status = direction === "for" ? "passed" : "failed";
    const res = await closeCommunityProposal(env, row.id, status);
    if (res.ok) closed++;
  }
  return closed;
}

export function isProposalVoteCustomId(customId: string): boolean {
  return customId.startsWith(VOTE_PREFIX);
}

export async function handleProposalVoteButton(
  env: ProposalEnv,
  customId: string,
  discordUserId: string,
): Promise<Response> {
  const parsed = parseVoteCustomId(customId);
  if (!parsed) {
    return proposalInteraction(4, { content: "Invalid vote button.", flags: 64 });
  }
  const result = await castProposalVote(env, parsed.proposalId, parsed.choice, discordUserId);
  if (!result.ok) {
    return proposalInteraction(4, { content: result.detail, flags: 64 });
  }
  if (result.embed) {
    return proposalInteraction(6, {
      embeds: [result.embed],
      components: voteButtons(parsed.proposalId, false),
    });
  }
  return proposalInteraction(4, { content: result.detail, flags: 64 });
}

function proposalInteraction(
  type: number,
  data: { content?: string; flags?: number; embeds?: unknown[]; components?: unknown[] },
): Response {
  const payload = Object.keys(data).length ? { type, data } : { type };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function handleProposalSlashCommand(
  interaction: Record<string, unknown>,
  env: ProposalEnv,
): Promise<Response> {
  const data = (interaction.data as Record<string, unknown> | undefined) || {};
  const sub = interactionSubcommandName(data);
  const discordUserId = str((interaction.member as Record<string, unknown> | undefined)?.user
    ? ((interaction.member as Record<string, unknown>).user as Record<string, unknown>)?.id
    : (interaction.user as Record<string, unknown> | undefined)?.id);

  if (sub === "create" || sub === "close" || sub === "compile") {
    if (!isSystemReportUser(discordUserId)) {
      return proposalInteraction(4, { content: "Staff only.", flags: 64 });
    }
  }

  if (sub === "discuss") {
    const id = interactionSubOptionString(data, "id").replace(/^id:/i, "");
    if (!id) return proposalInteraction(4, { content: "Provide **id**.", flags: 64 });
    const item = await env.DB.prepare(
      `SELECT discord_thread_id, title FROM rootmc_legislation_items WHERE id = ? LIMIT 1`,
    )
      .bind(id)
      .first<{ discord_thread_id: string | null; title: string }>();
    const bill = !item
      ? await env.DB.prepare(
          `SELECT discord_thread_id, title FROM rootmc_weekly_bills WHERE id = ? LIMIT 1`,
        )
          .bind(id)
          .first<{ discord_thread_id: string | null; title: string }>()
      : null;
    const row = item || bill;
    if (!row) return proposalInteraction(4, { content: "Unknown id.", flags: 64 });
    const tid = str(row.discord_thread_id);
    const web =
      item
        ? `https://rootmc.net/governance/proposal/?id=${encodeURIComponent(id)}`
        : `https://rootmc.net/governance/bill/?id=${encodeURIComponent(id)}`;
    return proposalInteraction(4, {
      content: tid
        ? `**${str(row.title)}**\nDiscuss in <#${tid}>\n${web}\n_Thread discussion feeds Grok synthesis before Council vote._`
        : `**${str(row.title)}**\n${web}\n_No Discord thread yet — discuss on the site._`,
      flags: 64,
    });
  }

  if (sub === "submit") {
    const title = interactionSubOptionString(data, "title");
    const description = interactionSubOptionString(data, "description");
    const category = interactionSubOptionString(data, "category") || "governance";
    if (!title || !description) {
      return proposalInteraction(4, { content: "Provide **title** and **description**.", flags: 64 });
    }
    const result = await submitLegislationItem(env, {
      discordUserId,
      title,
      description,
      category,
    });
    return proposalInteraction(4, { content: result.detail, flags: 64 });
  }

  if (sub === "retract") {
    const id = interactionSubOptionString(data, "id").replace(/^id:/i, "");
    if (!id) return proposalInteraction(4, { content: "Provide **id**.", flags: 64 });
    const result = await retractLegislationItem(env, id, discordUserId);
    return proposalInteraction(4, { content: result.detail, flags: 64 });
  }

  if (sub === "amend") {
    const bill = interactionSubOptionString(data, "bill").replace(/^bill:/i, "");
    const text = interactionSubOptionString(data, "text");
    const itemId = interactionSubOptionString(data, "item").replace(/^id:/i, "") || undefined;
    if (!bill || !text) {
      return proposalInteraction(4, { content: "Provide **bill** id and amendment **text**.", flags: 64 });
    }
    const result = await submitBillAmendment(env, {
      billId: bill,
      discordUserId,
      text,
      itemId,
    });
    return proposalInteraction(4, { content: result.detail, flags: 64 });
  }

  if (sub === "compile") {
    const weekRaw = interactionSubOptionString(data, "week");
    const { previousCompletedHstWeekKey } = await import("./rootmc-hst-week");
    const weekKey = weekRaw || previousCompletedHstWeekKey();
    const result = await compileWeeklyBill(env, weekKey, true);
    return proposalInteraction(4, { content: result.detail, flags: 64 });
  }

  if (sub === "create") {
    const title = interactionSubOptionString(data, "title");
    const description = interactionSubOptionString(data, "description");
    const days = interactionSubOptionInt(data, "days") || 7;
    const kindRaw = interactionSubOptionString(data, "kind").toLowerCase();
    const kind = kindRaw === "season_arc" ? "season_arc" : "general";
    const seasonTheme = interactionSubOptionString(data, "theme");
    const seasonLinesRaw = interactionSubOptionString(data, "lines");
    const seasonLines = seasonLinesRaw
      ? seasonLinesRaw.split("|").map((s) => s.trim()).filter(Boolean)
      : undefined;
    if (!title || !description) {
      return proposalInteraction(4, { content: "Provide **title** and **description**.", flags: 64 });
    }
    const result = await createCommunityProposal(env, {
      title,
      description,
      days,
      createdByDiscordId: discordUserId,
      kind,
      seasonTheme: kind === "season_arc" ? seasonTheme || title : undefined,
      seasonLines,
    });
    return proposalInteraction(4, { content: result.detail, flags: 64 });
  }

  if (sub === "list") {
    const leg = await listLegislationSummary(env.DB);
    const votes = await listOpenProposals(env.DB);
    const text = `${leg}\n\n---\n\n${votes}`.slice(0, 2000);
    return proposalInteraction(4, { content: text, flags: 64 });
  }

  if (sub === "status") {
    const id = interactionSubOptionString(data, "id").replace(/^id:/i, "");
    if (!id) return proposalInteraction(4, { content: "Provide **id**.", flags: 64 });
    const legText = await legislationStatusText(env.DB, id);
    if (!legText.startsWith("No legislation")) {
      return proposalInteraction(4, { content: legText.slice(0, 2000), flags: 64 });
    }
    const text = await proposalStatusText(env.DB, id);
    return proposalInteraction(4, { content: text.slice(0, 2000), flags: 64 });
  }

  if (sub === "close") {
    const id = interactionSubOptionString(data, "id");
    if (!id) return proposalInteraction(4, { content: "Provide **id**.", flags: 64 });
    const result = await closeCommunityProposal(env, id.replace(/^id:/i, ""));
    return proposalInteraction(4, { content: result.detail, flags: 64 });
  }

  return proposalInteraction(4, {
    content:
      "Use **`/proposal submit`**, **`retract`**, **`amend`**, **`list`**, **`status`** · staff: **`create`**, **`compile`**, **`close`**.",
    flags: 64,
  });
}

function interactionSubcommandName(data: Record<string, unknown>): string {
  const opts = (data.options as Array<Record<string, unknown>> | undefined) || [];
  const sub = opts.find((o) => Number(o.type) === 1);
  return String(sub?.name ?? "").trim().toLowerCase();
}

function interactionSubOptionString(data: Record<string, unknown>, name: string): string {
  const opts = (data.options as Array<Record<string, unknown>> | undefined) || [];
  const sub = opts.find((o) => Number(o.type) === 1);
  const subOpts = (sub?.options as Array<Record<string, unknown>> | undefined) || [];
  const hit = subOpts.find((o) => String(o.name) === name);
  return String(hit?.value ?? "").trim();
}

function interactionSubOptionInt(data: Record<string, unknown>, name: string): number {
  const raw = interactionSubOptionString(data, name);
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}
