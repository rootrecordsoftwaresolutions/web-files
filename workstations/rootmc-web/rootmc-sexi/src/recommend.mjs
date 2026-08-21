import { cursorApiKey } from "./config.mjs";
import { cursorRecommend } from "./cursorBrain.mjs";
import { scrubPublicReply } from "./scrub.mjs";
import { gatherSiteContext } from "./siteContext.mjs";
import { gatherLocalContext } from "./localContext.mjs";

export { scrubPublicReply } from "./scrub.mjs";
export { stripForbiddenMentions } from "./scrub.mjs";

export function wantsRootServer(question) {
  const q = String(question || "").toLowerCase();
  if (String(process.env.SEXI_FORCE_CURSOR || "").trim() === "1") return true;
  return (
    /\broot\s*server\b/.test(q) ||
    /\b(implement|code\s+this|build\s+it|ship\s+it|dig\s+into\s+(the\s+)?(repo|code|source))\b/.test(q) ||
    /\b(check|read|scan|look\s+at|verify|find)\s+(the\s+)?(repo|codebase|source|plugins?|logs?|files?)\b/.test(q) ||
    /\b(why\s+(is|did|does)|stack\s*trace|exception|crash|npe)\b/.test(q)
  );
}

export function isHushCommand(content) {
  const q = String(content || "").toLowerCase();
  return (
    (/\b(stop|hush|quiet|sleep|go\s+offline|shut\s+up)\b/.test(q) &&
      /\b(ava|sexi)\b/.test(q)) ||
    /^(stop|hush|quiet)\s*(ava|sexi)?[!?.]*$/i.test(q.trim())
  );
}

export function isWakeCommand(content) {
  const q = String(content || "").toLowerCase();
  return /\b(wake|come\s+back|you'?re\s+active|unmute)\b/.test(q) && /\b(ava|sexi)\b/.test(q);
}

export function heuristicRecommend(question) {
  const q = String(question || "").toLowerCase();
  if (/frisky|dtf|sexy|smash|date\s+me|hook\s*up|nudes?|onlyfans/i.test(q)) {
    return scrubPublicReply(" off.");
  }
  return scrubPublicReply(
    "I'm a bit offline on the deep-dig side — ask again when the Root Server's up, or leave notes in my handoff folder.",
  );
}

/**
 * Cursor-only brain. Wiki + local packs go into the Cursor prompt.
 * Pack gather is parallel; deep dig only when needed (speed default).
 */
export async function recommend({ question, context = "", env }) {
  const q = String(question || "").trim();
  if (!q) {
    return scrubPublicReply(
      "What's up? Wiki, design, logs, proposals — fire away. Give me a sec when you ping; I think before I talk.",
    );
  }

  if (/frisky|dtf|sexy|smash|date\s+me|hook\s*up|nudes?|onlyfans|(come|get)\s+over\s+here/i.test(q)) {
    return scrubPublicReply(" off.");
  }

  if (!cursorApiKey(env || {})) {
    return heuristicRecommend(q);
  }

  const [site, local] = await Promise.all([
    gatherSiteContext(q, { maxPages: 3, maxChars: 6500 }),
    Promise.resolve(gatherLocalContext(`${q}\n${context}`)),
  ]);

  const packed = [
    context,
    site.brief.slice(0, 5000),
    local.brief.slice(0, 8000),
  ]
    .filter(Boolean)
    .join("\n\n");

  const deep = wantsRootServer(q);
  const cursor = await cursorRecommend({
    question: q,
    context: packed,
    env,
    deep,
  });
  if (cursor.ok && cursor.text) return cursor.text;
  console.warn("Ava cursor:", cursor.reason);
  return heuristicRecommend(q);
}

/** Clear address to Ava — not mid-sentence gossip. */
export function looksLikeSexiTrigger(contentOrMsg, botUserId) {
  if (contentOrMsg && typeof contentOrMsg === "object") {
    const msg = contentOrMsg;
    if (botUserId && Array.isArray(msg.mentions)) {
      if (msg.mentions.some((u) => String(u?.id) === String(botUserId))) return true;
    }
    if (msg.message_reference?.message_id && botUserId) {
      // reply-to handled by poller when ref author is Ava
    }
    return looksLikeSexiTrigger(msg.content || "", botUserId);
  }
  const raw = String(contentOrMsg || "").trim();
  if (!raw) return false;
  if (botUserId && (raw.includes(`<@${botUserId}>`) || raw.includes(`<@!${botUserId}>`))) {
    return true;
  }
  if (/\b@?sexi\b/i.test(raw) || /sexi\s+assistant/i.test(raw)) return true;
  // "Ava" / "Ava Ivy" as address — start of message, or short ping
  if (/^(hey\s+|hi\s+|yo\s+|ok\s+|okay\s+|alright\s+)?ava(\s+ivy)?([,:!?]|\s|$)/i.test(raw)) {
    return true;
  }
  if (/^ava(\s+ivy)?[!?.]*$/i.test(raw)) return true;
  return false;
}

export function extractQuestion(content) {
  return String(content || "")
    .replace(/<@!?\d+>/g, "")
    .replace(/\b@?sexi\b/gi, "")
    .replace(/sexi\s+assistant/gi, "")
    .replace(/^(hey\s+|hi\s+|yo\s+|ok\s+|okay\s+|alright\s+)?ava(\s+ivy)?[,:!]?\s*/i, "")
    .trim();
}
