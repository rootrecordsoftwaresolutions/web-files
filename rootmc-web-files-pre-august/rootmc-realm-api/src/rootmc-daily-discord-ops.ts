/**
 * Pull substantive Discord messages for daily AI summaries — #general + operations forum.
 */

import { discordBotFetch } from "./discord-rootmc-api";
import { isExiledDiscordUser } from "./rootmc-exiled-discord";

export type DiscordOperationalHighlight = {
  channel: string;
  kind: "message" | "forum_post";
  author: string;
  content: string;
  thread_title?: string;
};

type OpsEnv = {
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_OPERATIONS_FORUM_CHANNEL_ID?: string;
  DISCORD_ROOTMC_APPEALS_FORUM_CHANNEL_ID?: string;
};

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function snowflakeFromMs(ms: number): string {
  return String((BigInt(Math.floor(ms)) - 1420070400000n) << 22n);
}

function snowflakeToMs(id: string): number {
  try {
    return Number((BigInt(id) >> 22n) + 1420070400000n);
  } catch {
    return 0;
  }
}

function cleanContent(raw: string): string {
  return raw
    .replace(/<@!?\d+>/g, "@user")
    .replace(/<#\d+>/g, "#channel")
    .replace(/<a?:\w+:\d+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulContent(content: string): boolean {
  const text = cleanContent(content);
  if (text.length < 24) return false;
  if (/^(gm+|gn+|lol+|ok+|yes+|no+|thanks?|ty|np)\.?$/i.test(text)) return false;
  return true;
}

type DiscordMessageRow = {
  id?: string;
  timestamp?: string;
  content?: string;
  author?: { id?: string; username?: string; bot?: boolean };
};

async function fetchTextChannelHighlights(
  token: string,
  channelId: string,
  channelLabel: string,
  startMs: number,
  endMs: number,
  maxItems: number,
): Promise<DiscordOperationalHighlight[]> {
  const after = snowflakeFromMs(startMs);
  let before: string | undefined;
  const out: DiscordOperationalHighlight[] = [];

  for (let page = 0; page < 5 && out.length < maxItems; page++) {
    const params = new URLSearchParams({ limit: "100", after });
    if (before) params.set("before", before);
    const res = await discordBotFetch(
      token,
      `/channels/${encodeURIComponent(channelId)}/messages?${params}`,
    );
    if (!res.ok) break;
    const msgs = (await res.json()) as DiscordMessageRow[];
    if (!msgs.length) break;

    for (const msg of msgs) {
      const ts = Date.parse(msg.timestamp || "");
      if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;
      if (msg.author?.bot) continue;
      if (isExiledDiscordUser(msg.author?.id)) continue;
      const content = cleanContent(str(msg.content));
      if (!isUsefulContent(content)) continue;
      out.push({
        channel: channelLabel,
        kind: "message",
        author: str(msg.author?.username) || "member",
        content: content.slice(0, 500),
      });
      if (out.length >= maxItems) break;
    }

    if (msgs.length < 100) break;
    before = msgs[msgs.length - 1]?.id;
    if (!before) break;
  }

  return out;
}

async function listForumThreadsInWindow(
  token: string,
  forumId: string,
  startMs: number,
  endMs: number,
): Promise<Array<{ id: string; name: string }>> {
  const threads: Array<{ id: string; name: string }> = [];
  const paths = [
    `/channels/${encodeURIComponent(forumId)}/threads/active`,
    `/channels/${encodeURIComponent(forumId)}/threads/archived/public?limit=50`,
  ];

  for (const path of paths) {
    const res = await discordBotFetch(token, path);
    if (!res.ok) continue;
    const data = (await res.json()) as { threads?: Array<{ id?: string; name?: string }> };
    for (const row of data.threads || []) {
      const id = str(row.id);
      if (!id) continue;
      const createdMs = snowflakeToMs(id);
      if (createdMs < startMs || createdMs > endMs) continue;
      threads.push({ id, name: str(row.name) || "forum post" });
    }
  }

  return threads;
}

async function fetchForumPostBody(
  token: string,
  threadId: string,
): Promise<{ author: string; content: string } | null> {
  const res = await discordBotFetch(
    token,
    `/channels/${encodeURIComponent(threadId)}/messages?limit=5`,
  );
  if (!res.ok) return null;
  const msgs = (await res.json()) as DiscordMessageRow[];
  const starter = msgs[msgs.length - 1] || msgs[0];
  if (!starter || starter.author?.bot) return null;
  if (isExiledDiscordUser(starter.author?.id)) return null;
  const content = cleanContent(str(starter.content));
  if (!isUsefulContent(content)) return null;
  return {
    author: str(starter.author?.username) || "member",
    content: content.slice(0, 700),
  };
}

async function fetchForumHighlights(
  token: string,
  forumId: string,
  channelLabel: string,
  startMs: number,
  endMs: number,
  maxItems: number,
): Promise<DiscordOperationalHighlight[]> {
  const threads = await listForumThreadsInWindow(token, forumId, startMs, endMs);
  const out: DiscordOperationalHighlight[] = [];

  for (const thread of threads.slice(0, maxItems * 2)) {
    const body = await fetchForumPostBody(token, thread.id);
    if (!body) continue;
    out.push({
      channel: channelLabel,
      kind: "forum_post",
      author: body.author,
      content: body.content,
      thread_title: thread.name.slice(0, 120),
    });
    if (out.length >= maxItems) break;
  }

  return out;
}

export function resolveOperationsForumChannelId(env: OpsEnv): string {
  return (
    str(env.DISCORD_ROOTMC_OPERATIONS_FORUM_CHANNEL_ID) ||
    str(env.DISCORD_ROOTMC_APPEALS_FORUM_CHANNEL_ID)
  );
}

/** Staff/ops highlights from #general and the operations forum for the HST day. */
export async function gatherDiscordOperationalHighlights(
  env: OpsEnv,
  startMs: number,
  endMs: number,
): Promise<DiscordOperationalHighlight[]> {
  const token = str(env.DISCORD_ROOTMC_BOT_TOKEN);
  const generalId = str(env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID);
  const forumId = resolveOperationsForumChannelId(env);
  if (!token) return [];

  const [general, forum] = await Promise.all([
    generalId
      ? fetchTextChannelHighlights(token, generalId, "general", startMs, endMs, 12)
      : Promise.resolve([]),
    forumId
      ? fetchForumHighlights(token, forumId, "operations-forum", startMs, endMs, 8)
      : Promise.resolve([]),
  ]);

  const merged = [...forum, ...general];
  merged.sort((a, b) => {
    const score = (h: DiscordOperationalHighlight) =>
      (h.kind === "forum_post" ? 2 : 1) + Math.min(h.content.length / 200, 3);
    return score(b) - score(a);
  });

  return merged.slice(0, 16);
}
