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
  push(process.env.AVA_ENV_FILE);
  // Ubuntu Desktop / OptiPlex SSD home
  push("/home/ava-core/ava/.env");
  push(path.join(process.env.HOME || "", "ava", ".env"));
  if (process.env.ROOTMC_ROOT) {
    push(path.join(process.env.ROOTMC_ROOT, ".env"));
    push(path.join(process.env.ROOTMC_ROOT, "..", ".credentials", ".env"));
  }
  if (process.env.AVA_HANDOFF) {
    push(path.join(process.env.AVA_HANDOFF, ".env"));
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
  { key: "daily", surface: "discord", id: "1539779979280257054", label: "Discord Ava home" },
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
    .map((c) => ({
      id: c.id,
      name: c.name,
      kind: "guild",
      nsfw: Boolean(c.nsfw),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, channels };
}

/** Discord DM + group DM channels Ava shares. */
export async function listDiscordPrivateChannels(env) {
  if (!env.discordToken) return { ok: false, detail: "missing_discord_token", channels: [] };
  const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
    headers: { Authorization: `Bot ${env.discordToken}` },
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, detail: data?.message || res.status, channels: [] };
  const channels = (Array.isArray(data) ? data : [])
    .map((c) => {
      const recipients = Array.isArray(c.recipients) ? c.recipients : [];
      const names = recipients
        .map((u) => u.global_name || u.username || u.id)
        .filter(Boolean);
      const label =
        c.type === 3
          ? `group · ${names.slice(0, 3).join(", ") || c.id}`
          : `dm · ${names[0] || c.id}`;
      return {
        id: c.id,
        name: label,
        kind: c.type === 3 ? "group_dm" : "dm",
        recipients: names,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, channels };
}

export async function listSlackChannels(env) {
  if (!env.slackToken) return { ok: false, detail: "missing_slack_token", channels: [] };
  const channels = [];
  let cursor = "";
  do {
    const qs = new URLSearchParams({
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
    });
    if (cursor) qs.set("cursor", cursor);
    const res = await fetch(`https://slack.com/api/conversations.list?${qs}`, {
      headers: { Authorization: `Bearer ${env.slackToken}` },
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, detail: data.error || "slack_list_failed", channels };
    for (const c of data.channels || []) {
      if (!c.is_member) continue;
      channels.push({
        id: c.id,
        name: c.name || c.id,
        kind: c.is_private ? "private" : "public",
        private: Boolean(c.is_private),
      });
    }
    cursor = data.response_metadata?.next_cursor || "";
  } while (cursor);
  channels.sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, channels };
}

export async function fetchSlackHistory(env, channelId, limit = 42) {
  if (!env.slackToken || !channelId) {
    return { ok: false, messages: [], detail: "missing_token_or_channel" };
  }
  const qs = new URLSearchParams({
    channel: String(channelId),
    limit: String(Math.min(100, limit)),
  });
  const res = await fetch(`https://slack.com/api/conversations.history?${qs}`, {
    headers: { Authorization: `Bearer ${env.slackToken}` },
  });
  const data = await res.json();
  if (!data.ok) return { ok: false, messages: [], detail: data.error || "slack_history_failed" };
  const messages = (Array.isArray(data.messages) ? data.messages : [])
    .reverse()
    .slice(-limit)
    .map((m) => ({
      who: m.username || m.user || (m.bot_id ? "bot" : "?"),
      text: m.text || "",
      id: m.ts,
    }));
  return { ok: true, messages };
}

/** Telegram operator + known private/group chats from local buffers + logs. */
export async function listTelegramChats(env) {
  const chats = [];
  const seen = new Set();
  const add = (id, name, kind) => {
    const cid = normalizeTgChatId(id);
    if (!cid || cid === "undefined" || cid === "null" || seen.has(cid)) return;
    seen.add(cid);
    chats.push({ id: cid, name: name || `chat · ${cid}`, kind: kind || "known" });
  };

  const op = String(env.operatorChatId || "").trim();
  if (op) add(op, `dm · operator (${op})`, "private");

  const bufPath = path.resolve(__dirname, "../data/telegram-context.json");
  try {
    if (fs.existsSync(bufPath)) {
      const raw = JSON.parse(fs.readFileSync(bufPath, "utf8"));
      for (const id of Object.keys(raw || {})) add(id, `chat · ${id}`, "known");
    }
  } catch {
    /* ignore */
  }

  const groupsDir = path.join(handoffRoot(), "data", "telegram", "groups");
  try {
    if (fs.existsSync(groupsDir)) {
      for (const name of fs.readdirSync(groupsDir)) add(name, `group · ${name}`, "group");
    }
  } catch {
    /* ignore */
  }

  // Discover more chats from recent logs
  const logDir = path.join(handoffRoot(), "data", "logs");
  for (const file of ["inbound.jsonl", "outbound.jsonl"]) {
    for (const line of readJsonlTail(path.join(logDir, file), 2500)) {
      try {
        const j = JSON.parse(line);
        if (String(j.surface || "").toLowerCase() !== "telegram") continue;
        const cid = normalizeTgChatId(j.channelId);
        if (!cid) continue;
        const label =
          j.isDm || String(j.channelId || "").includes(cid)
            ? `dm · ${j.authorName || cid}`
            : `chat · ${cid}`;
        add(cid, label, j.isDm ? "private" : "known");
      } catch {
        /* ignore */
      }
    }
  }

  return { ok: true, channels: chats };
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

function handoffRoot() {
  return process.env.AVA_HANDOFF || "/home/ava-core/ava";
}

function normalizeTgChatId(chatId) {
  const raw = String(chatId || "").trim();
  if (!raw) return "";
  return raw.startsWith("tg:") ? raw.slice(3) : raw;
}

function tgChannelMatches(channelId, chatId) {
  const want = normalizeTgChatId(chatId);
  const got = String(channelId || "").trim();
  if (!want || !got) return false;
  return got === want || got === `tg:${want}` || got.endsWith(`:${want}`);
}

function readJsonlTail(filePath, maxLines = 4000) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

/** Merge Ava flight-recorder logs + local desktop buffer for Telegram history. */
export async function fetchTelegramHistory(env, chatId, limit = 42) {
  const id = normalizeTgChatId(chatId || env.operatorChatId);
  if (!id) return { ok: true, messages: [], detail: "missing_chat_id" };

  const byKey = new Map();
  const pushMsg = (m) => {
    const text = String(m.text || "").trim();
    if (!text) return;
    const mid = m.id != null ? String(m.id) : "";
    const key = mid || `${m.at || 0}:${m.who}:${text.slice(0, 48)}`;
    const prev = byKey.get(key);
    if (!prev || Number(m.at || 0) >= Number(prev.at || 0)) {
      byKey.set(key, {
        who: m.who || "?",
        text,
        id: mid || null,
        at: Number(m.at || 0) || 0,
      });
    }
  };

  // 1) Desktop ring buffer
  const bufPath = path.resolve(__dirname, "../data/telegram-context.json");
  try {
    if (fs.existsSync(bufPath)) {
      const raw = JSON.parse(fs.readFileSync(bufPath, "utf8"));
      for (const m of Array.isArray(raw[id]) ? raw[id] : []) {
        pushMsg({
          who: m.who || "?",
          text: m.text || "",
          id: m.id || null,
          at: m.at || 0,
        });
      }
    }
  } catch {
    /* ignore */
  }

  // 2) Inbound / outbound action logs
  const logDir = path.join(handoffRoot(), "data", "logs");
  for (const line of readJsonlTail(path.join(logDir, "inbound.jsonl"))) {
    try {
      const j = JSON.parse(line);
      if (String(j.surface || "").toLowerCase() !== "telegram") continue;
      if (!tgChannelMatches(j.channelId, id)) continue;
      pushMsg({
        who: j.authorName || j.authorId || "user",
        text: j.content || "",
        id: j.messageId || null,
        at: j.at || 0,
      });
    } catch {
      /* ignore */
    }
  }
  for (const line of readJsonlTail(path.join(logDir, "outbound.jsonl"))) {
    try {
      const j = JSON.parse(line);
      if (String(j.surface || "").toLowerCase() !== "telegram") continue;
      if (!tgChannelMatches(j.channelId, id)) continue;
      if (j.ok === false) continue;
      pushMsg({
        who: "Ava",
        text: j.content || "",
        id: j.messageId || null,
        at: j.at || 0,
      });
    } catch {
      /* ignore */
    }
  }

  // 3) Conversation turns (Q/A pairs)
  const turnsPath = path.join(handoffRoot(), "data", "conversations", "turns.jsonl");
  for (const line of readJsonlTail(turnsPath, 6000)) {
    try {
      const j = JSON.parse(line);
      if (!tgChannelMatches(j.channelId, id)) continue;
      if (j.question) {
        pushMsg({
          who: j.authorName || j.authorId || "user",
          text: j.question,
          id: j.messageId || null,
          at: j.at || 0,
        });
      }
      if (j.answer) {
        pushMsg({
          who: "Ava",
          text: j.answer,
          id: j.messageId ? `a:${j.messageId}` : null,
          at: (j.at || 0) + 1,
        });
      }
    } catch {
      /* ignore */
    }
  }

  const messages = [...byKey.values()]
    .sort((a, b) => (a.at || 0) - (b.at || 0))
    .slice(-Math.min(100, Math.max(1, limit)))
    .map(({ who, text, id: mid }) => ({ who, text, id: mid }));

  return {
    ok: true,
    messages,
    detail: messages.length ? `merged_${messages.length}` : "no_local_history",
  };
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
 * @param {{ surface: string, channelId: string, text: string, refId?: string, rewrite?: boolean, provider?: string }} opts
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
  let provider = opts.provider || "exact";
  if (opts.rewrite) {
    let context = [];
    try {
      if (surface === "discord") {
        const hist = await fetchDiscordHistory(env, channelId, 20);
        context = hist.messages || [];
      } else if (surface === "telegram") {
        const hist = await fetchTelegramHistory(env, channelId, 20);
        context = hist.messages || [];
      } else if (surface === "slack") {
        const hist = await fetchSlackHistory(env, channelId, 20);
        context = hist.messages || [];
      }
    } catch {
      context = [];
    }
    const rewritten = await rewriteDraft(env, {
      text,
      surface,
      context,
      provider: opts.provider || "dream",
    });
    text = rewritten.text || text;
    via = rewritten.via || "rewrite";
    provider = rewritten.provider || provider;
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
    provider,
    id: sent?.id || sent?.ts || sent?.message_id || null,
    sent,
  };
}

export async function rewriteDraft(
  env,
  { text, surface, context, provider = "dream", compare = false },
) {
  const draft = String(text || "");
  const lightCleanup = () =>
    draft
      .replace(/\b\$\s*(\d+)/g, "$1 Gold")
      .replace(/\bdollars?\b/gi, "Gold")
      .trim() || draft;

  if (String(provider).toLowerCase() === "exact" && !compare) {
    return { ok: true, text: lightCleanup(), via: "exact", provider: "exact" };
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), compare ? 120000 : 20000);
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
          provider,
          compare: Boolean(compare),
          authorId: "desktop",
          authorName: "desktop",
          timeoutMs: compare ? 12000 : 10000,
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => null);
    if (compare && data?.results) {
      return {
        ok: true,
        compare: true,
        results: data.results,
        via: "compare",
        provider: "all",
      };
    }
    if (data?.text) {
      return {
        ok: true,
        text: data.text,
        via: data.via || "ava-rewrite",
        provider: data.provider || provider,
        detail: data.detail || null,
      };
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      return {
        ok: true,
        text: lightCleanup(),
        via: "timeout-fallback",
        provider,
      };
    }
  }
  return { ok: true, text: lightCleanup(), via: "offline-fallback", provider };
}

export async function summarizeChannel(
  env,
  { surface, channelId, provider = "dream", limit = 80 },
) {
  let hist = { messages: [] };
  if (surface === "discord") hist = await fetchDiscordHistory(env, channelId, limit);
  else if (surface === "slack") hist = await fetchSlackHistory(env, channelId, limit);
  else if (surface === "telegram") {
    hist = await fetchTelegramHistory(env, channelId, limit);
  } else return { ok: false, detail: "unknown_surface" };

  const messages = hist.messages || [];
  if (!messages.length) return { ok: false, detail: "no_messages", messages: [] };

  const summarizeUrl = String(env.rewriteUrl || "").replace(
    /\/api\/rewrite\/?$/,
    "/api/summarize",
  );
  try {
    const res = await fetch(summarizeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        surface,
        provider,
        limit,
        authorId: "desktop",
        authorName: "desktop",
      }),
    });
    const data = await res.json().catch(() => null);
    return {
      ok: Boolean(data?.ok ?? data?.text),
      text: data?.text || "",
      provider: data?.provider || provider,
      via: data?.via || null,
      messageCount: messages.length,
      detail: data?.detail || null,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err?.message || String(err),
      messageCount: messages.length,
    };
  }
}

export async function fetchRewriteProviders(env) {
  const url = String(env.rewriteUrl || "").replace(
    /\/api\/rewrite\/?$/,
    "/api/rewrite-providers",
  );
  try {
    const res = await fetch(url);
    const data = await res.json();
    return { ok: true, providers: data.providers || [] };
  } catch (err) {
    return {
      ok: false,
      detail: err?.message || String(err),
      providers: [
        { id: "exact", label: "Exactly the same" },
        { id: "dream", label: "Dream / Grok" },
        { id: "cursor", label: "Cursor" },
        { id: "ollama", label: "Ollama" },
        { id: "google", label: "Google / Gemini" },
      ],
    };
  }
}

function apiBase(env) {
  return String(env.rewriteUrl || "http://127.0.0.1:8787/api/rewrite").replace(
    /\/api\/rewrite\/?$/,
    "",
  );
}

async function localJson(url, { method = "GET", body } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        detail: data?.detail || `http_${res.status}`,
        status: res.status,
        ...(data && typeof data === "object" ? data : {}),
      };
    }
    return data && typeof data === "object" ? data : { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      detail: err?.name === "AbortError" ? "timeout" : err?.message || String(err),
    };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchCronStatus(env) {
  return localJson(`${apiBase(env)}/api/cron`);
}

export async function runCronJob(env, id) {
  return localJson(`${apiBase(env)}/api/cron/run`, {
    method: "POST",
    body: { id, reason: "desktop" },
  });
}

export async function configureCron(env, body) {
  return localJson(`${apiBase(env)}/api/cron/config`, {
    method: "POST",
    body: body || {},
  });
}

async function localJsonLong(url, { method = "GET", body, timeoutMs = 130000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), Math.max(8000, Number(timeoutMs) || 130000));
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        detail: data?.detail || `http_${res.status}`,
        status: res.status,
        ...(data && typeof data === "object" ? data : {}),
      };
    }
    return data && typeof data === "object" ? data : { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      detail: err?.name === "AbortError" ? "timeout" : err?.message || String(err),
    };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchCoreChatStatus(env) {
  return localJson(`${apiBase(env)}/api/core-chat/status`);
}

export async function coreChat(env, opts = {}) {
  return localJsonLong(`${apiBase(env)}/api/core-chat`, {
    method: "POST",
    body: {
      text: opts.text || "",
      messages: opts.messages || [],
      sessionId: opts.sessionId || null,
      save: opts.save !== false,
      timeoutMs: opts.timeoutMs || 180000,
    },
    timeoutMs: 200000,
  });
}

export async function coreChatEnhance(env, opts = {}) {
  return localJsonLong(`${apiBase(env)}/api/core-chat/enhance`, {
    method: "POST",
    body: {
      draft: opts.draft || "",
      context: opts.context || [],
      provider: opts.provider || "dream",
      sessionId: opts.sessionId || null,
      save: opts.save !== false,
      timeoutMs: opts.timeoutMs || 45000,
    },
    timeoutMs: 60000,
  });
}

export async function coreChatGold(env, opts = {}) {
  return localJson(`${apiBase(env)}/api/core-chat/gold`, {
    method: "POST",
    body: {
      question: opts.question || "",
      answer: opts.answer || "",
      sessionId: opts.sessionId || null,
      provider: opts.provider || "ollama",
      source: opts.source || "core-desktop",
    },
  });
}
