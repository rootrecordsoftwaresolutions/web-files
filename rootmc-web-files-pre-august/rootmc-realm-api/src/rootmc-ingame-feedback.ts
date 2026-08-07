import { json } from "./cors";
import { discordBotFetch } from "./discord-rootmc-api";
import { record, str } from "./realm-lib";
import type { RootStatEnv } from "./rootstat-minecraft";
import { validateServerAuth } from "./rootstat-minecraft";

type FeedbackEnv = RootStatEnv & {
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_INGAME_FEEDBACK_CHANNEL_ID?: string;
};

function feedbackChannelId(env: FeedbackEnv): string {
  return String(env.DISCORD_ROOTMC_INGAME_FEEDBACK_CHANNEL_ID || "").trim();
}

function botToken(env: FeedbackEnv): string {
  return String(env.DISCORD_ROOTMC_BOT_TOKEN || "").replace(/^bot\s+/i, "").trim();
}

function stripMcColors(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, "").replace(/&[0-9a-fk-or]/gi, "").trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 3)) + "...";
}

function safeText(s: string): string {
  return s.replace(/```/g, "'''").replace(/\r\n/g, "\n").trim();
}

/**
 * POST /api/rootmc/ingame-feedback — server-authenticated in-game player feedback → Discord.
 * Body: { uuid, username, message, world? }
 */
export async function handleRootMcIngameFeedback(
  request: Request,
  env: FeedbackEnv,
  subpath: string,
  method: string,
): Promise<Response | null> {
  if (!subpath.startsWith("/rootmc/ingame-feedback")) return null;

  if (method !== "POST" || subpath !== "/rootmc/ingame-feedback") {
    return json({ detail: "Not Found" }, 404);
  }

  const server = await validateServerAuth(env, request);
  if (server instanceof Response) return server;

  let body: Record<string, unknown>;
  try {
    body = record(JSON.parse(await request.text()));
  } catch {
    return json({ detail: "Invalid JSON body." }, 400);
  }

  const uuid = stripMcColors(str(body.uuid));
  const username = stripMcColors(str(body.username));
  const message = safeText(stripMcColors(str(body.message)));
  const world = stripMcColors(str(body.world));

  if (!uuid || !username) {
    return json({ detail: "uuid and username are required." }, 400);
  }
  if (!message) {
    return json({ detail: "message is required." }, 400);
  }

  const token = botToken(env);
  const channelId = feedbackChannelId(env);
  if (!token || !channelId) {
    return json({ detail: "In-game feedback is not configured on the API." }, 503);
  }

  let desc =
    `**Player:** ${username}\n` +
    `**UUID:** \`${uuid}\`\n` +
    `**Server ID:** \`${server.serverId}\``;
  if (world) desc += `\n**World:** ${world}`;
  desc += `\n\n**Message:**\n${truncate(message, 3200)}`;

  const embed = {
    title: "In-game feedback",
    description: truncate(desc, 4000),
    color: 0x57f287,
    timestamp: new Date().toISOString(),
  };

  const res = await discordBotFetch(token, `/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("ingame_feedback_discord_post_failed", res.status, text.slice(0, 400));
    return json({ detail: "Could not deliver feedback. Try again later." }, 502);
  }

  return json({ ok: true, channel_id: channelId }, 200);
}
