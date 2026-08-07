import { json } from "./cors";
import { discordBotFetch } from "./discord-rootmc-api";
import { record, str } from "./realm-lib";
import type { RootStatEnv } from "./rootstat-minecraft";
import { validateServerAuth } from "./rootstat-minecraft";

type ReportEnv = RootStatEnv & {
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_INGAME_FEEDBACK_CHANNEL_ID?: string;
};

function feedbackChannelId(env: ReportEnv): string {
  return String(env.DISCORD_ROOTMC_INGAME_FEEDBACK_CHANNEL_ID || "").trim();
}

function botToken(env: ReportEnv): string {
  return String(env.DISCORD_ROOTMC_BOT_TOKEN || "").replace(/^bot\s+/i, "").trim();
}

function stripMcColors(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, "").replace(/&[0-9a-fk-or]/gi, "").trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 3)) + "...";
}

/**
 * POST /api/rootmc/command-test-report — per-command onboarding test notes → Discord.
 */
export async function handleRootMcCommandTestReport(
  request: Request,
  env: ReportEnv,
  subpath: string,
  method: string,
): Promise<Response | null> {
  if (!subpath.startsWith("/rootmc/command-test-report")) return null;

  if (method !== "POST" || subpath !== "/rootmc/command-test-report") {
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
  const testKey = stripMcColors(str(body.test_key));
  const command = stripMcColors(str(body.command));
  const note = stripMcColors(str(body.note));
  const completed = Number(body.completed) || 0;
  const total = Number(body.total) || 0;

  if (!uuid || !username || !testKey) {
    return json({ detail: "uuid, username, and test_key are required." }, 400);
  }

  const token = botToken(env);
  const channelId = feedbackChannelId(env);
  if (!token || !channelId) {
    return json({ detail: "Command test reports are not configured on the API." }, 503);
  }

  let desc =
    `**Player:** ${username}\n` +
    `**UUID:** \`${uuid}\`\n` +
    `**Progress:** ${completed}/${total}\n` +
    `**Command key:** \`${testKey}\`\n` +
    `**Catalog:** ${command || testKey}`;
  if (world) desc += `\n**World:** ${world}`;
  if (note) desc += `\n\n**Note:**\n${truncate(note, 2800)}`;

  const embed = {
    title: "Command test report",
    description: truncate(desc, 4000),
    color: 0x5865f2,
    timestamp: new Date().toISOString(),
  };

  const res = await discordBotFetch(token, `/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("command_test_report_discord_failed", res.status, text.slice(0, 400));
    return json({ detail: "Could not deliver report. Try again later." }, 502);
  }

  return json({ ok: true, channel_id: channelId }, 200);
}
