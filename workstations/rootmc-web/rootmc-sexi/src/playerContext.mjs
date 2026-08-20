/**
 * Build Discord conversation context so Sexi remembers the player's recent lines.
 * Discord message arrays are newest-first.
 */

const PLAYER_LINES = Number(process.env.SEXI_PLAYER_CONTEXT || 12);
const THREAD_LINES = Number(process.env.SEXI_THREAD_CONTEXT || 10);
const SEXI_LINES = Number(process.env.SEXI_OWN_CONTEXT || 6);

function line(m) {
  const name = m.author?.username || m.author?.global_name || "unknown";
  const text = String(m.content || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return `${name}: ${text}`;
}

/**
 * @param {object} opts
 * @param {object} opts.trigger - triggering message
 * @param {object[]} opts.messages - channel messages newest-first
 * @param {string} opts.sexiBotId
 */
export function buildPlayerContext({ trigger, messages, sexiBotId }) {
  const list = Array.isArray(messages) ? messages : [];
  const playerId = trigger?.author?.id;
  const parts = [];

  // Reply-to target if present
  const refId = trigger?.message_reference?.message_id;
  if (refId) {
    const ref = list.find((m) => m.id === refId);
    if (ref) {
      const l = line(ref);
      if (l) parts.push(`(replying to) ${l}`);
    }
  }

  // This player's recent messages (including trigger), chronological
  const fromPlayer = list
    .filter((m) => m.author?.id === playerId && m.content)
    .slice(0, PLAYER_LINES)
    .reverse()
    .map(line)
    .filter(Boolean);

  if (fromPlayer.length) {
    parts.push("Recent messages from this player (oldest → newest):");
    parts.push(...fromPlayer);
  }

  // Sexi's own recent replies in-channel (so she doesn't contradict herself)
  const fromSexi = list
    .filter((m) => m.author?.id === sexiBotId && m.content)
    .slice(0, SEXI_LINES)
    .reverse()
    .map(line)
    .filter(Boolean);
  if (fromSexi.length) {
    parts.push("Your recent replies here:");
    parts.push(...fromSexi);
  }

  // Short mixed thread window around the chat
  const thread = list
    .filter((m) => m.id !== trigger?.id && m.content)
    .slice(0, THREAD_LINES)
    .reverse()
    .map(line)
    .filter(Boolean);
  if (thread.length) {
    parts.push("Recent thread (others included):");
    parts.push(...thread);
  }

  return parts.join("\n").slice(0, 6000);
}

/** In-memory rolling history per channel+player (survives between polls). */
const memory = new Map();
const MEMORY_MAX = 20;

export function rememberPlayerLine(channelId, playerId, username, content) {
  if (!channelId || !playerId || !content) return;
  const key = `${channelId}:${playerId}`;
  const arr = memory.get(key) || [];
  arr.push({ username, content: String(content).slice(0, 500), at: Date.now() });
  while (arr.length > MEMORY_MAX) arr.shift();
  memory.set(key, arr);
}

export function memoryContext(channelId, playerId) {
  const key = `${channelId}:${playerId}`;
  const arr = memory.get(key);
  if (!arr?.length) return "";
  return (
    "Earlier in this channel from this player (memory):\n" +
    arr.map((r) => `${r.username}: ${r.content}`).join("\n")
  );
}
