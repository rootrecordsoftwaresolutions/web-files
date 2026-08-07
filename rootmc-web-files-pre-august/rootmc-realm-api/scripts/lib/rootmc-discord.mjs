/**
 * RootMC Discord bot helpers for local ops scripts.
 * Token: DISCORD_ROOTMC_BOT_TOKEN in RootMC Workspace\.env (via loadRootMcEnv).
 */
import { loadRootMcEnv, rootMcBotToken } from "./rootmc-env.mjs";

export const DISCORD_API = "https://discord.com/api/v10";

/** RootMC guild (play.rootmc.net Discord). */
export const ROOTMC_GUILD_ID = "1516108585740800042";

/** Common channel IDs — use names with resolveRootMcChannel(). */
export const ROOTMC_CHANNELS = {
  updates: "1520665313631408251",
  general: "1516108586307158088",
  admins: "1516121832493678612",
  rules: "1516392367869919243",
  economy: "1516804780884889621",
  dailyReport: "1516395175780286615",
  ingameChat: "1516706598519832677",
  ingameFeedback: "1516828735536365669",
  feedback: "1516391754625187921",
  townInfo: "1516282373426249878",
  nationInfo: "1516283667364974602",
  operationsForum: "1516143406315737169",
  constitution: "1522406019152478210",
  governance: "1522406451413385317",
  voting: "1522413185364398090",
  proposals: "1522417281928396891",
};

const CHANNEL_ALIASES = {
  "#updates": "updates",
  updates: "updates",
  "#general": "general",
  "general-chat": "general",
  general: "general",
  admins: "admins",
  rules: "rules",
  constitution: "constitution",
  governance: "governance",
  voting: "voting",
  proposals: "proposals",
  economy: "economy",
  "#economy-guide": "economy",
  "daily-report": "dailyReport",
  dailyReport: "dailyReport",
};

export function resolveRootMcChannel(nameOrId) {
  const raw = String(nameOrId || "updates").trim();
  if (/^\d{10,}$/.test(raw)) return raw;
  const key = CHANNEL_ALIASES[raw] || CHANNEL_ALIASES[raw.toLowerCase()] || raw;
  const id = ROOTMC_CHANNELS[key];
  if (!id) throw new Error(`Unknown channel "${raw}". Use a numeric id or: ${Object.keys(ROOTMC_CHANNELS).join(", ")}`);
  return id;
}

export function discordMessageUrl(channelId, messageId, guildId = ROOTMC_GUILD_ID) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId || ""}`;
}

export function splitDiscordContent(text, maxLen = 2000) {
  const body = String(text || "");
  if (body.length <= maxLen) return [body];
  const chunks = [];
  let rest = body;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n", maxLen);
    if (cut < Math.floor(maxLen * 0.35)) cut = maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export async function postDiscordMessage({
  channelId,
  content,
  token,
  userAgent = "RootMC/discord-post",
}) {
  const bot = String(token || rootMcBotToken(loadRootMcEnv())).replace(/^bot\s+/i, "").trim();
  if (bot.length < 40) throw new Error("DISCORD_ROOTMC_BOT_TOKEN missing in RootMC Workspace\\.env");
  const cid = resolveRootMcChannel(channelId);
  const res = await fetch(`${DISCORD_API}/channels/${cid}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${bot}`,
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({ content: String(content).slice(0, 2000) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Discord ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

export async function postDiscordMessageChunks({
  channelId,
  content,
  token,
  userAgent = "RootMC/discord-post",
}) {
  const chunks = splitDiscordContent(content);
  const posted = [];
  for (const chunk of chunks) {
    posted.push(await postDiscordMessage({ channelId, content: chunk, token, userAgent }));
  }
  return posted;
}
