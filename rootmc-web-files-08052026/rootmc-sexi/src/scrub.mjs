import { NEVER_MENTION } from "./config.mjs";

export function stripForbiddenMentions(text) {
  let out = String(text || "");
  for (const id of NEVER_MENTION) {
    out = out.replace(new RegExp(`<@!?${id}>`, "g"), "that player");
  }
  return out;
}

/** Strip common secret / path leaks before Discord. */
export function scrubPublicReply(text) {
  let out = stripForbiddenMentions(text);
  out = out.replace(/```[\s\S]*?```/g, (block) => {
    if (/password|token|secret|api[_-]?key|\.env/i.test(block)) {
      return "_[code omitted]_";
    }
    return block;
  });
  out = out.replace(/D:\\\.1 Work Stations\\RootMC[^\s`]*/gi, "`(workspace)`");
  out = out.replace(/\/(?:Users|home)\/[^\s`]+/gi, "`(path)`");
  out = out.replace(
    /\b(?:CURSOR_API_KEY|DISCORD_(?:ROOTMC_)?BOT_TOKEN|GROK_[A-Z0-9_]+|JWT_[A-Z0-9_]+|XAI_API_KEY)\b\s*[:=]\s*\S+/gi,
    "[redacted]",
  );
  out = out.replace(/\bsk-[a-zA-Z0-9_-]{20,}\b/g, "[redacted]");
  out = out.replace(/\bcursor_[a-zA-Z0-9_-]{20,}\b/g, "[redacted]");
  out = out.replace(/\bcrsr_[a-zA-Z0-9_-]{20,}\b/g, "[redacted]");
  // Never leak other AI / vendor names into Discord
  out = out.replace(
    /\b(grok|xai|chatgpt|chat\s*gpt|claude|openai|gemini|copilot|cursor\s*sdk|cursor)\b/gi,
    "Root Server",
  );
  return out.trim().slice(0, 1900);
}
