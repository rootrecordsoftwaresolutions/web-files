import { json } from "./cors";
import { discordBotFetch } from "./discord-rootmc-api";
import { record, str } from "./realm-lib";
import type { RootStatEnv } from "./rootstat-minecraft";
import { validateServerAuth } from "./rootstat-minecraft";

type QuestionnaireEnv = RootStatEnv & {
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_INGAME_FEEDBACK_CHANNEL_ID?: string;
};

type AnswerRow = { id?: string; question?: string; answer?: string };

function feedbackChannelId(env: QuestionnaireEnv): string {
  return String(env.DISCORD_ROOTMC_INGAME_FEEDBACK_CHANNEL_ID || "").trim();
}

function botToken(env: QuestionnaireEnv): string {
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
 * POST /api/rootmc/ingame-questionnaire — server-authenticated one-time survey → Discord.
 * Body: { uuid, username, world?, answers: [{ id, question, answer }] }
 */
export async function handleRootMcIngameQuestionnaire(
  request: Request,
  env: QuestionnaireEnv,
  subpath: string,
  method: string,
): Promise<Response | null> {
  if (!subpath.startsWith("/rootmc/ingame-questionnaire")) return null;

  if (method !== "POST" || subpath !== "/rootmc/ingame-questionnaire") {
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
  const world = stripMcColors(str(body.world));
  const answersRaw = body.answers;

  if (!uuid || !username) {
    return json({ detail: "uuid and username are required." }, 400);
  }
  if (!Array.isArray(answersRaw) || answersRaw.length === 0) {
    return json({ detail: "answers array is required." }, 400);
  }

  const token = botToken(env);
  const channelId = feedbackChannelId(env);
  if (!token || !channelId) {
    return json({ detail: "In-game questionnaire is not configured on the API." }, 503);
  }

  const fields = answersRaw.slice(0, 25).map((row, index) => {
    const answer = record(row as Record<string, unknown>);
    const question = truncate(safeText(stripMcColors(str(answer.question || answer.id || `Q${index + 1}`))), 256);
    const value = truncate(safeText(stripMcColors(str(answer.answer))), 1024);
    return { name: question, value: value || "(empty)", inline: false };
  });

  const embed = {
    title: "Player questionnaire",
    description: truncate(
      `**Player:** ${username}\n` +
        `**UUID:** \`${uuid}\`\n` +
        `**Server ID:** \`${server.serverId}\`` +
        (world ? `\n**World:** ${world}` : ""),
      2000,
    ),
    color: 0x5865f2,
    fields,
    timestamp: new Date().toISOString(),
  };

  const res = await discordBotFetch(token, `/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("ingame_questionnaire_discord_post_failed", res.status, text.slice(0, 400));
    return json({ detail: "Could not deliver questionnaire. Try again later." }, 502);
  }

  return json({ ok: true, channel_id: channelId }, 200);
}
