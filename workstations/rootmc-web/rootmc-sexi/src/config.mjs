import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Reuse RootMC realm-api env loader without publishing a package. */
export async function loadEnv() {
  const loaderPath = path.resolve(
    __dirname,
    "../../rootmc-realm-api/scripts/lib/rootmc-env.mjs",
  );
  if (!fs.existsSync(loaderPath)) {
    throw new Error(`Missing env loader at ${loaderPath}`);
  }
  const m = await import(pathToFileURL(loaderPath).href);
  return m.loadRootMcEnv();
}

export function botToken(env) {
  // Prefer dedicated Sexi bot; fall back to RootMC bot only if unset.
  return String(
    env.SEXI_DISCORD_BOT_TOKEN ||
      process.env.SEXI_DISCORD_BOT_TOKEN ||
      env.DISCORD_ROOTMC_BOT_TOKEN ||
      env.DISCORD_BOT_TOKEN ||
      "",
  )
    .replace(/^bot\s+/i, "")
    .trim();
}

/** Discord application / bot user id for the Sexi bot (mentions + self-skip). */
export function sexiBotAppId(env = {}) {
  return String(
    process.env.SEXI_DISCORD_APPLICATION_ID ||
      env.SEXI_DISCORD_APPLICATION_ID ||
      process.env.SEXI_DISCORD_CLIENT_ID ||
      env.SEXI_DISCORD_CLIENT_ID ||
      SEXI_BOT_APP_ID ||
      "",
  ).trim();
}

export function grokToken(env) {
  return String(
    process.env.SEXI_XAI_API_KEY ||
      env.SEXI_XAI_API_KEY ||
      process.env.XAI_API_KEY ||
      env.XAI_API_KEY ||
      env.GROK_API_BEARER_TOKEN ||
      env.GROK_ROOT_ASK_BEARER_TOKEN ||
      "",
  ).trim();
}

/** Cursor user / service-account API key (Dashboard → Integrations). */
export function cursorApiKey(env) {
  return String(
    process.env.CURSOR_API_KEY ||
      env.CURSOR_API_KEY ||
      env.CURSOR_SDK_API_KEY ||
      "",
  ).trim();
}

export const SEXI_MODEL = String(process.env.SEXI_MODEL || "composer-2.5").trim();
export const SEXI_GROK_MODEL = String(process.env.SEXI_GROK_MODEL || "grok-3-mini").trim();
/** Default brain is Cursor — Grok unplugged. */
export const SEXI_BRAIN_DEFAULT = "cursor";

/** Override workspace cwd for the local Cursor agent (defaults to RootMC root). */
export const SEXI_WORKSPACE = String(process.env.SEXI_WORKSPACE || "").trim();

/** Ava Ivy handoff folder — lead-dev notes + future agent assets. */
export const AVA_HANDOFF = String(
  process.env.AVA_HANDOFF ||
    process.env.SEXI_HANDOFF ||
    "D:\\.1 Work Stations\\RootMC\\Server Handoffs\\Ava Ivy",
).trim();

/** Discord user IDs Sexi must never @mention. */
export const NEVER_MENTION = new Set([
  "788153722198294618", // asked not to be tagged
]);

export const DISCORD_API = "https://discord.com/api/v10";
export const ROOTMC_GUILD_ID = "1516108585740800042";
/** Legacy RootMC bot — not used for Sexi replies when SEXI_DISCORD_* is set. */
export const ROOTMC_BOT_APP_ID = "1511794429986345020";
/** Dedicated Sexi Discord application / bot user id. */
export const SEXI_BOT_APP_ID = "1532751879875072070";

/** Default watch list — proposals, admins, general. */
export const DEFAULT_WATCH_CHANNELS = [
  "1526664180491358419", // proposals
  "1516121832493678612", // admins
  "1516108586307158088", // #general
];

/** Resolve watch channels from env + defaults. */
export function watchChannels(env = {}) {
  const fromEnv = String(
    process.env.SEXI_WATCH_CHANNELS ||
      env.SEXI_WATCH_CHANNELS ||
      "",
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const extras = [
    env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID,
    process.env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_WATCH_CHANNELS, ...fromEnv, ...extras])];
}

export const SEXI_PORT = Number(process.env.SEXI_PORT || 8787);
