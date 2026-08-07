import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1516108585740800042";

function firstEnv(env, keys) {
  for (const k of keys) {
    const v = env[k] ?? process.env[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/** Find RootMC\.env on any drive — prefer EXE/kit drive, then common layouts. */
function discoverEnvCandidates() {
  const out = [];
  const push = (p) => {
    if (p && !out.includes(p)) out.push(p);
  };

  push(process.env.ROOTMC_ENV_FILE);
  if (process.env.ROOTMC_ROOT) {
    push(path.join(process.env.ROOTMC_ROOT, ".env"));
    push(path.join(process.env.ROOTMC_ROOT, "..", ".credentials", ".env"));
  }

  // Packed EXE lives under .../Ava Laptop/AvaIvy/ — walk up for RootMC/.env
  let cur = path.resolve(__dirname, "..");
  for (let i = 0; i < 8; i++) {
    push(path.join(cur, ".env"));
    push(path.join(cur, ".credentials", ".env"));
    const parent = path.dirname(cur);
    if (!parent || parent === cur) break;
    cur = parent;
  }

  const rels = [
    [".1 Work Stations", "RootMC", ".env"],
    [".1 Work Stations", ".credentials", ".env"],
    ["RootMC", ".env"],
  ];
  const letters = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  // Prefer drive of this process / exe resources
  const homeDrive = (process.execPath || process.cwd() || "C:\\").slice(0, 1).toUpperCase();
  const ordered = [homeDrive, ...letters.filter((L) => L !== homeDrive)];
  for (const L of ordered) {
    const root = `${L}:\\`;
    try {
      if (!fs.existsSync(root)) continue;
    } catch {
      continue;
    }
    for (const parts of rels) {
      push(path.join(root, ...parts));
    }
  }

  push(path.resolve(__dirname, "../../../.env"));
  push(path.resolve(__dirname, "../../../../.env"));
  push(path.resolve(__dirname, "../../../.credentials/.env"));
  return out.filter(Boolean);
}

export async function loadDesktopEnv() {
  const candidates = discoverEnvCandidates();
  let fileEnv = {};
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      fileEnv = { ...fileEnv, ...parseEnvFile(p) };
    }
  }
  const discordToken = firstEnv(fileEnv, [
    "AVA_DISCORD_BOT_TOKEN",
    "DISCORD_AVA_BOT_TOKEN",
    "DISCORD_ROOTMC_BOT_TOKEN",
  ]).replace(/^Bot\s+/i, "");
  const slackToken = firstEnv(fileEnv, ["AVA_SLACK_BOT_TOKEN"]).replace(
    /^Bearer\s+/i,
    "",
  );
  const telegramToken = firstEnv(fileEnv, ["AVA_TELEGRAM_BOT_TOKEN"]);
  const operatorChatId = firstEnv(fileEnv, ["AVA_TELEGRAM_OPERATOR_IDS"])
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0] || "6644482344";
  return {
    discordToken,
    slackToken,
    telegramToken,
    operatorChatId,
    rewriteUrl: firstEnv(fileEnv, ["AVA_REWRITE_URL"]) || "http://127.0.0.1:8787/api/rewrite",
  };
}

/** Named destinations for manual Post-as-Ava (Discord / Slack / Telegram). */
export const AVA_POST_PRESETS = [
  { key: "general", surface: "discord", id: "1516108586307158088", label: "Discord #general" },
  { key: "admins", surface: "discord", id: "1516121832493678612", label: "Discord #admins" },
  { key: "updates", surface: "discord", id: "1520665313631408251", label: "Discord #updates" },
  { key: "development", surface: "discord", id: "1532929974154166522", label: "Discord #development" },
  { key: "governance", surface: "discord", id: "1522406451413385317", label: "Discord #governance" },
  { key: "voting", surface: "discord", id: "1522413185364398090", label: "Discord #voting" },
  { key: "constitution", surface: "discord", id: "1522406019152478210", label: "Discord #constitution" },
  { key: "proposals", surface: "discord", id: "1526664180491358419", label: "Discord #proposals" },
  { key: "memes", surface: "discord", id: "1516389376198840421", label: "Discord #memes-and-media" },
  { key: "ava-media", surface: "discord", id: "1533268458668687392", label: "Discord Ava media vault" },
  { key: "facts", surface: "discord", id: "1531432703675596942", label: "Discord #random-facts" },
  { key: "solar", surface: "discord", id: "1533915343766949949", label: "Discord #solar-server" },
  { key: "ingame", surface: "discord", id: "1516706598519832677", label: "Discord in-game chat" },
  { key: "daily", surface: "discord", id: "1516395175780286615", label: "Discord #daily" },
  { key: "economy", surface: "discord", id: "1516804780884889621", label: "Discord #economy" },
  { key: "slack-dev", surface: "slack", id: "C0BMCPMDDQR", label: "Slack #development-feed" },
  { key: "slack-plans", surface: "slack", id: "C0BM4P3GVDX", label: "Slack #new-plugin-development-plans" },
  { key: "alex", surface: "telegram", id: "6644482344", label: "Telegram DM Alex (@WildEcho94)" },
];

export function listPostPresets() {
  return { ok: true, presets: AVA_POST_PRESETS };
}

export async function listDiscordTextChannels(env) {
  if (!env.discordToken) return { ok: false, detail: "missing_discord_token", channels: [] };
  const res = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/channels`, {
    headers: { Authorization: `Bot ${env.discordToken}` },
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, detail: data?.message || res.status, channels: [] };
  const channels = (Array.isArray(data) ? data : [])
    .filter((c) => c.type === 0)
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, channels };
}

export async function fetchDiscordHistory(env, channelId, limit = 42) {
  if (!env.discordToken || !channelId) {
    return { ok: false, messages: [], detail: "missing_token_or_channel" };
  }
  const res = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages?limit=${Math.min(100, limit)}`,
    { headers: { Authorization: `Bot ${env.discordToken}` } },
  );
  const data = await res.json();
  if (!res.ok) return { ok: false, messages: [], detail: data?.message || res.status };
  const messages = (Array.isArray(data) ? data : [])
    .reverse()
    .slice(-limit)
    .map((m) => ({
      who: m.author?.username || m.author?.id || "?",
      text: m.content || "",
      id: m.id,
    }));
  return { ok: true, messages };
}

export async function sendDiscordMessage(env, channelId, content, refId = null) {
  if (!env.discordToken) throw new Error("missing_discord_token");
  const body = { content: String(content).slice(0, 1900) };
  if (refId) {
    body.message_reference = { message_id: String(refId) };
  }
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.discordToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `discord_${res.status}`);
  return data;
}

export async function sendSlackMessage(env, channelId, content, threadTs = null) {
  if (!env.slackToken) throw new Error("missing_slack_token");
  const payload = {
    channel: String(channelId),
    text: String(content).slice(0, 3900),
  };
  if (threadTs) payload.thread_ts = String(threadTs);
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.slackToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "slack_send_failed");
  return data;
}

export async function fetchTelegramHistory(env, chatId, limit = 42) {
  // Telegram Bot API has no full history; keep a local ring buffer file.
  const bufPath = path.resolve(__dirname, "../data/telegram-context.json");
  try {
    if (!fs.existsSync(bufPath)) return { ok: true, messages: [] };
    const raw = JSON.parse(fs.readFileSync(bufPath, "utf8"));
    const list = Array.isArray(raw[String(chatId)]) ? raw[String(chatId)] : [];
    return {
      ok: true,
      messages: list.slice(-limit).map((m) => ({
        who: m.who || "?",
        text: m.text || "",
        id: m.id || null,
      })),
    };
  } catch {
    return { ok: true, messages: [] };
  }
}

function pushTelegramContext(chatId, who, text, id = null) {
  const bufPath = path.resolve(__dirname, "../data/telegram-context.json");
  fs.mkdirSync(path.dirname(bufPath), { recursive: true });
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(bufPath, "utf8"));
  } catch {
    raw = {};
  }
  const key = String(chatId);
  const list = Array.isArray(raw[key]) ? raw[key] : [];
  list.push({ who, text, at: Date.now(), id: id ? String(id) : null });
  raw[key] = list.slice(-80);
  fs.writeFileSync(bufPath, JSON.stringify(raw, null, 2), "utf8");
}

export async function sendTelegramMessage(env, chatId, content, replyToMessageId = null) {
  if (!env.telegramToken) throw new Error("missing_telegram_token");
  const payload = {
    chat_id: chatId,
    text: String(content).slice(0, 4000),
    disable_web_page_preview: true,
  };
  if (replyToMessageId) {
    payload.reply_to_message_id = Number(replyToMessageId) || replyToMessageId;
  }
  const res = await fetch(
    `https://api.telegram.org/bot${env.telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "telegram_send_failed");
  pushTelegramContext(chatId, "Ava", content, data.result?.message_id || null);
  return data.result;
}

/**
 * Post as Ava on any surface.
 * @param {{ surface: string, channelId: string, text: string, refId?: string, rewrite?: boolean }} opts
 */
export async function postAsAva(env, opts = {}) {
  const surface = String(opts.surface || "").toLowerCase();
  const channelId = String(opts.channelId || "").trim();
  const refId = opts.refId ? String(opts.refId).trim() : "";
  let text = String(opts.text || "").trim();
  if (!surface || !channelId || !text) {
    throw new Error("surface, channelId, and text are required");
  }

  let via = "direct";
  if (opts.rewrite) {
    let context = [];
    try {
      if (surface === "discord") {
        const hist = await fetchDiscordHistory(env, channelId, 20);
        context = hist.messages || [];
      } else if (surface === "telegram") {
        const hist = await fetchTelegramHistory(env, channelId, 20);
        context = hist.messages || [];
      }
    } catch {
      context = [];
    }
    const rewritten = await rewriteDraft(env, { text, surface, context });
    text = rewritten.text || text;
    via = rewritten.via || "rewrite";
  }

  let sent;
  if (surface === "discord") {
    sent = await sendDiscordMessage(env, channelId, text, refId || null);
  } else if (surface === "slack") {
    sent = await sendSlackMessage(env, channelId, text, refId || null);
  } else if (surface === "telegram") {
    sent = await sendTelegramMessage(
      env,
      channelId || env.operatorChatId,
      text,
      refId || null,
    );
  } else {
    throw new Error(`unknown_surface_${surface}`);
  }

  return {
    ok: true,
    surface,
    channelId,
    text,
    via,
    id: sent?.id || sent?.ts || sent?.message_id || null,
    sent,
  };
}

export async function rewriteDraft(env, { text, surface, context }) {
  const draft = String(text || "");
  const lightCleanup = () =>
    draft
      .replace(/\b\$\s*(\d+)/g, "$1 Gold")
      .replace(/\bdollars?\b/gi, "Gold")
      .trim() || draft;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 9000);
    let res;
    try {
      res = await fetch(env.rewriteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          text: draft,
          surface,
          context,
          authorId: "desktop",
          authorName: "desktop",
          timeoutMs: 8000,
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => null);
    if (data?.text) {
      return {
        ok: true,
        text: data.text,
        via: data.via || "ava-rewrite",
        detail: data.detail || null,
      };
    }
  } catch (err) {
    /* fall through — still never leave the UI hanging */
    if (err?.name === "AbortError") {
      return { ok: true, text: lightCleanup(), via: "timeout-fallback" };
    }
  }
  // Offline fallback: light cleanup still counts as rewrite pass
  return { ok: true, text: lightCleanup(), via: "offline-fallback" };
}
