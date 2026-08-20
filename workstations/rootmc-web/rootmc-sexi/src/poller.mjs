import {
  loadEnv,
  botToken,
  sexiBotAppId,
  DISCORD_API,
  watchChannels,
} from "./config.mjs";
import {
  extractQuestion,
  looksLikeSexiTrigger,
  recommend,
  isHushCommand,
  isWakeCommand,
} from "./recommend.mjs";
import {
  buildPlayerContext,
  rememberPlayerLine,
  memoryContext,
} from "./playerContext.mjs";
import {
  pickInstantOpen,
  pickHold,
  holdBeatDelays,
} from "./instantLines.mjs";
import { brainQueueDepth, beginAsk, endAsk } from "./cursorBrain.mjs";
import {
  loadSeen,
  saveSeen,
  loadWatermark,
  saveWatermark,
  markShutdown,
  isHushed,
  setHushed,
  lastReplyFor,
  setLastReply,
  nearDuplicate,
  storePaths,
} from "./store.mjs";

const env = await loadEnv();
const token = botToken(env);
const botAppId = sexiBotAppId(env);
if (token.length < 40) {
  console.error("SEXI_DISCORD_BOT_TOKEN missing — poller idle");
  process.exit(1);
}
if (!botAppId) {
  console.error("SEXI_DISCORD_APPLICATION_ID missing — poller idle");
  process.exit(1);
}

const headers = {
  Authorization: `Bot ${token}`,
  "User-Agent": "RootMC-Ava/0.4",
  "Content-Type": "application/json",
};

const seen = loadSeen();
const watch = watchChannels(env);
const ANNOUNCE_CHANNEL =
  process.env.AVA_ANNOUNCE_CHANNEL ||
  env.AVA_ANNOUNCE_CHANNEL ||
  "1516108586307158088";

/** Hot poll while recently pinged; slow poll on break. */
const HOT_POLL_MS = Number(process.env.SEXI_POLL_MS || process.env.AVA_HOT_POLL_MS || 4_000);
const BREAK_POLL_MS = Number(process.env.AVA_BREAK_POLL_MS || 60_000);
/** Quiet this long → announce break + slow down. */
const BREAK_AFTER_MS = Number(process.env.AVA_BREAK_AFTER_MS || 10 * 60_000);
const FETCH_LIMIT = Number(process.env.SEXI_FETCH_LIMIT || 40);
const busyChannels = new Set();
let live = false; // false until boot handshake finishes
let tickRunning = false;
let onBreak = false;
let lastActivityAt = Date.now();
let pollTimer = null;

function discordStamp(ms = Date.now()) {
  const unix = Math.floor(ms / 1000);
  return `<t:${unix}:F> · <t:${unix}:R>`;
}

function touchActivity(reason = "") {
  lastActivityAt = Date.now();
  if (onBreak) {
    onBreak = false;
    console.log(`Ava leave break${reason ? ` (${reason})` : ""} → hot poll ${HOT_POLL_MS}ms`);
  }
}

function currentPollMs() {
  if (onBreak || isHushed()) return BREAK_POLL_MS;
  if (Date.now() - lastActivityAt >= BREAK_AFTER_MS) return BREAK_POLL_MS;
  return HOT_POLL_MS;
}

async function maybeEnterBreak() {
  if (!live || onBreak || isHushed()) return;
  if (Date.now() - lastActivityAt < BREAK_AFTER_MS) return;
  onBreak = true;
  const quietMin = Math.round(BREAK_AFTER_MS / 60_000);
  const line = [
    `taking a break — quiet for ~${quietMin}m.`,
    `stamp: ${discordStamp()}`,
    `slow checks every ${Math.round(BREAK_POLL_MS / 1000)}s. ping me and I'll hop back.`,
  ].join("\n");
  try {
    await reply(ANNOUNCE_CHANNEL, line);
  } catch (err) {
    console.warn("break announce failed:", err.message);
  }
  console.log(`Ava on break → poll ${BREAK_POLL_MS}ms`);
}

/**
 * Instant canned open + timed transfer beats while Root Server digs.
 * Beats cancel when the real answer lands.
 */
function startHoldTransfers(channelId, refId, queueDepth) {
  const state = { done: false, timers: [] };
  const delays = holdBeatDelays(queueDepth);

  // Queued deep: fire beat-2 anticipator almost immediately after open
  if (queueDepth >= 2) {
    state.timers.push(
      setTimeout(() => {
        if (state.done) return;
        reply(channelId, pickHold(2), refId).catch(() => {});
      }, 1_200),
    );
  }

  state.timers.push(
    setTimeout(() => {
      if (state.done) return;
      reply(channelId, pickHold(2), refId).catch(() => {});
    }, delays.beat2),
  );

  state.timers.push(
    setTimeout(() => {
      if (state.done) return;
      reply(channelId, pickHold(3), refId).catch(() => {});
    }, delays.beat3),
  );

  return {
    stop() {
      state.done = true;
      for (const t of state.timers) clearTimeout(t);
    },
  };
}

async function fetchJson(path, init = {}) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function channelTargets() {
  const out = new Set(watch);
  if (watch.includes("1526664180491358419")) {
    try {
      const active = await fetchJson(`/guilds/1516108585740800042/threads/active`);
      for (const t of active?.threads || []) {
        if (t.parent_id === "1526664180491358419") out.add(t.id);
      }
    } catch (err) {
      console.warn("active threads:", err.message);
    }
  }
  return [...out];
}

async function reply(channelId, content, refId) {
  return fetchJson(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: String(content).slice(0, 2000),
      message_reference: refId ? { message_id: refId } : undefined,
      allowed_mentions: { parse: [] },
    }),
  });
}

function warmMemory(channelId, messages) {
  for (const m of [...(messages || [])].reverse()) {
    if (!m?.author || m.author.bot) continue;
    if (m.author.id === botAppId) continue;
    if (!m.content?.trim()) continue;
    rememberPlayerLine(channelId, m.author.id, m.author.username, m.content);
  }
}

function markSeen(id) {
  if (!id) return;
  seen.add(id);
  if (seen.size > 8000) {
    const drop = [...seen].slice(0, 2000);
    for (const x of drop) seen.delete(x);
  }
}

function snowflakeTime(id) {
  try {
    return Number((BigInt(id) >> 22n) + 1420070400000n);
  } catch {
    return 0;
  }
}

async function bootHandshake() {
  storePaths(); // ensure uploads/plans/data exist
  const wm = loadWatermark();
  const channels = await channelTargets();
  const bullets = [];
  const latestMap = {};

  for (const channelId of channels) {
    let messages;
    try {
      messages = await fetchJson(`/channels/${channelId}/messages?limit=${FETCH_LIMIT}`);
    } catch {
      continue;
    }
    if (!Array.isArray(messages) || !messages.length) continue;
    latestMap[channelId] = messages[0].id;
    const floorId = wm.channels?.[channelId];
    const floorTs = wm.shutdownAt || 0;

    for (const m of messages) {
      markSeen(m.id);
      if (m.author?.bot) continue;
      const ts = snowflakeTime(m.id);
      const isNew =
        floorId ? BigInt(m.id) > BigInt(floorId) : floorTs ? ts > floorTs : false;
      if (!isNew) continue;
      const text = String(m.content || "").trim();
      if (!text) continue;
      const hit =
        looksLikeSexiTrigger(m, botAppId) ||
        /\b(ava|sexi)\b/i.test(text);
      if (hit) {
        bullets.push(`• **${m.author.username}**: ${text.slice(0, 160)}`);
      }
    }
    warmMemory(channelId, messages);
  }

  saveSeen(seen);
  saveWatermark({ channels: latestMap, shutdownAt: Date.now() });

  const summary =
    bullets.length > 0
      ? [
          "**While I was out — quick catch-up:**",
          ...bullets.slice(0, 12),
          bullets.length > 12 ? `_…+${bullets.length - 12} more_` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "**While I was out:** nothing directed at me worth replaying. All good.";

  const apology = [
    "Sorry I was asleep — that dump above is the sync, not me spam-replying old pings.",
    "I'm **Ava Ivy**, back and active. Lead-dev brain + gamer-girl mouth.",
    "Ping me with @Sexi / Ava — I'll go *mmm give me a sec* while I dig, then answer once.",
  ].join("\n");

  try {
    await reply(ANNOUNCE_CHANNEL, summary);
    await reply(ANNOUNCE_CHANNEL, apology);
  } catch (err) {
    console.warn("boot announce failed:", err.message);
  }

  live = true;
  touchActivity("boot");
  console.log("Ava boot handshake done — live (hot until quiet)");
}

function isReplyToAva(msg, messages) {
  const refId = msg?.message_reference?.message_id;
  if (!refId) return false;
  const ref = (messages || []).find((m) => m.id === refId);
  return Boolean(ref && String(ref.author?.id) === String(botAppId));
}

async function handleTrigger(channelId, msg, messages) {
  if (busyChannels.has(channelId)) return;
  busyChannels.add(channelId);
  const holds = { stop() {} };
  try {
    const wasBreak = onBreak;
    touchActivity("ping");

    // Instant canned line — before any pack/context/LLM work
    const depthAtAck = brainQueueDepth();
    const openLine = pickInstantOpen({
      fromBreak: wasBreak,
      queueDepth: depthAtAck,
    });
    const ackP = reply(channelId, openLine, msg.id).catch((err) => {
      console.warn("ack failed:", err.message);
    });
    beginAsk();

    const question =
      extractQuestion(msg.content) || "you pinged me — what's up?";
    const liveCtx = buildPlayerContext({
      trigger: msg,
      messages,
      sexiBotId: botAppId,
    });
    const mem = memoryContext(channelId, msg.author.id);
    const context = [mem, liveCtx].filter(Boolean).join("\n\n").slice(0, 5500);

    Object.assign(holds, startHoldTransfers(channelId, msg.id, depthAtAck));

    console.log(
      `ava trigger in ${channelId} from ${msg.author?.username} (queue=${depthAtAck})`,
    );
    let answer;
    try {
      answer = await recommend({ question, context, env });
    } finally {
      endAsk();
    }
    holds.stop();
    await ackP;
    touchActivity("answered");

    if (nearDuplicate(answer, lastReplyFor(channelId))) {
      console.log("skip near-duplicate answer");
      return;
    }
    await reply(channelId, answer, msg.id);
    setLastReply(channelId, answer);
    rememberPlayerLine(channelId, botAppId, "Ava", answer);
  } finally {
    holds.stop();
    busyChannels.delete(channelId);
    saveSeen(seen);
  }
}

async function tick() {
  if (!live || tickRunning) return;
  tickRunning = true;
  try {
    await maybeEnterBreak();

    const channels = await channelTargets();
    const latestMap = {};

    for (const channelId of channels) {
      let messages;
      try {
        messages = await fetchJson(`/channels/${channelId}/messages?limit=${FETCH_LIMIT}`);
      } catch {
        continue;
      }
      if (Array.isArray(messages) && messages[0]?.id) {
        latestMap[channelId] = messages[0].id;
      }

      warmMemory(channelId, messages);

      // Process oldest-first among new triggers so order feels natural
      const batch = [...(messages || [])].reverse();
      for (const msg of batch) {
        if (!msg?.id || seen.has(msg.id)) continue;
        markSeen(msg.id);
        if (msg.author?.bot) continue;
        if (msg.author?.id === botAppId) continue;

        if (isHushCommand(msg.content)) {
          setHushed(true, "user hush");
          touchActivity("hush");
          onBreak = true; // hush = intentional quiet; keep slow poll
          try {
            await reply(
              channelId,
              `Got it — going quiet. ${discordStamp()}\nPing me when you want me back.`,
              msg.id,
            );
          } catch {
            /* ignore */
          }
          continue;
        }
        if (isWakeCommand(msg.content)) {
          setHushed(false, "user wake");
          const wasBreak = onBreak;
          touchActivity("wake");
          try {
            await reply(
              channelId,
              wasBreak
                ? `I'm up — ${discordStamp()}\nGive me a sec when you ask something — I think first.`
                : "I'm up. Give me a sec when you ask something — I think first.",
              msg.id,
            );
          } catch {
            /* ignore */
          }
          continue;
        }

        if (isHushed()) continue;
        if (!looksLikeSexiTrigger(msg, botAppId) && !isReplyToAva(msg, messages)) continue;

        await handleTrigger(channelId, msg, messages);
      }
    }

    if (Object.keys(latestMap).length) {
      const wm = loadWatermark();
      saveWatermark({ ...wm, channels: { ...(wm.channels || {}), ...latestMap } });
    }
  } finally {
    tickRunning = false;
  }
}

function scheduleNextTick() {
  if (pollTimer) clearTimeout(pollTimer);
  const ms = currentPollMs();
  pollTimer = setTimeout(() => {
    tick()
      .catch((err) => console.warn("tick:", err.message))
      .finally(() => scheduleNextTick());
  }, ms);
}

function shutdown() {
  console.log("Ava shutting down — watermark");
  if (pollTimer) clearTimeout(pollTimer);
  markShutdown(loadWatermark().channels || {});
  saveSeen(seen);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  `Ava Ivy poller as app ${botAppId}, watching ${watch.length} channel(s)`,
);
console.log(
  `poll: hot ${HOT_POLL_MS}ms · break ${BREAK_POLL_MS}ms after ${Math.round(BREAK_AFTER_MS / 60_000)}m quiet`,
);
console.log(`handoff data: ${storePaths().dir}`);

await bootHandshake();
scheduleNextTick();
