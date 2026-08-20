/**
 * Global thank-you for RootMC Stripe income: memberships + Vote Shards.
 * Discord (#general, #updates, #admins) + in-game broadcast via chat bridge.
 * App / web accounts without Minecraft still get celebrated — that money funds the server.
 */
export type SupportAnnounceKind =
  | "sub_first"
  | "sub_renew"
  | "lifetime"
  | "one_month"
  | "vote_shards";

/** @deprecated use SupportAnnounceKind */
export type ProSupportAnnounceKind = Exclude<SupportAnnounceKind, "vote_shards">;

export type SupportAnnounceIdentity = {
  discordUserId?: string | null;
  discordUsername?: string | null;
  minecraftUsername?: string | null;
};

export type SupportAnnounceDetails = {
  usd?: number | null;
  shards?: number | null;
};

export type SupportAnnounceEnv = {
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_UPDATES_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ADMINS_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ECONOMY_ANNOUNCE_CHANNEL_ID?: string;
  DISCORD_ROOTMC_INGAME_CHAT_CHANNEL_ID?: string;
};

/** @deprecated use SupportAnnounceEnv */
export type ProSupportAnnounceEnv = SupportAnnounceEnv;

const GENERAL_FALLBACK = "1516108586307158088";
const UPDATES_FALLBACK = "1520665313631408251";
const ADMINS_FALLBACK = "1516121832493678612";
const ECONOMY_FALLBACK = "1516804780884889621";
const INGAME_CHAT_FALLBACK = "1516706598519832677";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function usdSuffix(usd?: number | null): string {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return "";
  return ` ($${n.toFixed(2)})`;
}

function shardsLabel(shards?: number | null): string {
  const n = Math.max(0, Math.round(Number(shards) || 0));
  if (!n) return "Vote Shards";
  return `${n.toLocaleString("en-US")} Vote Shards`;
}

/** Discord mention when linked; otherwise IGN / Discord name / “A supporter”. */
export function proSupportMention(opts: SupportAnnounceIdentity): string {
  const did = str(opts.discordUserId);
  if (did) return `<@${did}>`;
  const ign = str(opts.minecraftUsername);
  if (ign) return `**${ign}**`;
  const dname = str(opts.discordUsername);
  if (dname) return `**${dname}**`;
  return "A supporter";
}

/** Plain name for Minecraft chat (never a Discord mention). */
export function supportPlainName(opts: SupportAnnounceIdentity): string {
  const ign = str(opts.minecraftUsername);
  if (ign) return ign;
  const dname = str(opts.discordUsername);
  if (dname) return dname;
  return "A supporter";
}

function isAppOnly(opts: SupportAnnounceIdentity): boolean {
  return !str(opts.minecraftUsername);
}

export function formatProSupportMessage(
  kind: SupportAnnounceKind,
  mentionOrName: string,
  details?: SupportAnnounceDetails,
  appOnly = false,
): string {
  const who = mentionOrName.trim() || "A supporter";
  const money = usdSuffix(details?.usd);
  const app = appOnly ? " on the app" : "";
  switch (kind) {
    case "vote_shards":
      return `${who} just bought **${shardsLabel(details?.shards)}**${money}${app}! That income keeps RootMC online. Thank you!`;
    case "sub_renew":
      return `${who} renewed Monthly Pro${money}${app}! Recurring support keeps the server running. Thank you!`;
    case "sub_first":
      return `${who} subscribed to Monthly Pro${money}${app}! Membership income keeps RootMC online. Thank you!`;
    case "lifetime":
      return `${who} purchased Lifetime Pro${money}${app}! Huge support — that income keeps RootMC online. Thank you!`;
    case "one_month":
      return `${who} bought 1-Month Pro${money}${app}! Thank you for funding the server!`;
    default:
      return `${who} supported RootMC${money}${app}! Thank you for funding the server!`;
  }
}

export function formatInGameSupportMessage(
  kind: SupportAnnounceKind,
  plainName: string,
  details?: SupportAnnounceDetails,
  appOnly = false,
): string {
  const who = plainName.trim() || "A supporter";
  const money = usdSuffix(details?.usd);
  const app = appOnly ? " on the app" : "";
  switch (kind) {
    case "vote_shards":
      return `${who} bought ${shardsLabel(details?.shards)}${money}${app}! Thank you for funding RootMC!`;
    case "sub_renew":
      return `${who} renewed Monthly Pro${money}${app}! Thank you for funding the server!`;
    case "sub_first":
      return `${who} subscribed to Monthly Pro${money}${app}! Thank you for funding the server!`;
    case "lifetime":
      return `${who} purchased Lifetime Pro${money}${app}! Thank you for funding RootMC!`;
    case "one_month":
      return `${who} bought 1-Month Pro${money}${app}! Thank you for funding the server!`;
    default:
      return `${who} supported RootMC${money}${app}! Thank you for funding the server!`;
  }
}

async function postChannel(token: string, channelId: string, content: string): Promise<void> {
  const res = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "RootMC/stripe-income-announce",
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("rootmc_support_discord_post_failed", channelId, res.status, body.slice(0, 200));
  }
}

async function broadcastInGame(
  env: SupportAnnounceEnv,
  token: string,
  kind: SupportAnnounceKind,
  identity: SupportAnnounceIdentity,
  details?: SupportAnnounceDetails,
): Promise<void> {
  const channelId = str(env.DISCORD_ROOTMC_INGAME_CHAT_CHANNEL_ID) || INGAME_CHAT_FALLBACK;
  if (!channelId) return;
  const appOnly = isAppOnly(identity);
  const description = formatInGameSupportMessage(kind, supportPlainName(identity), details, appOnly);
  const authorName = `[DISCORD] ${supportPlainName(identity)}`;
  // Root-Discord inbound: footer rootmc-bridge:{senderTag}:chat → Bukkit.broadcastMessage
  const res = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "RootMC/stripe-income-ingame",
    },
    body: JSON.stringify({
      embeds: [
        {
          author: { name: authorName },
          description,
          footer: { text: "rootmc-bridge:Discord:chat" },
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("rootmc_support_ingame_post_failed", res.status, body.slice(0, 200));
  }
}

/**
 * Global income celebration: Discord public + ops + in-game broadcast.
 * Never throws. Works with Discord-only / app-only accounts (no Minecraft).
 */
export async function announceSupportPurchase(
  env: SupportAnnounceEnv,
  kind: SupportAnnounceKind,
  identity: SupportAnnounceIdentity,
  details?: SupportAnnounceDetails,
): Promise<void> {
  try {
    const token = str(env.DISCORD_ROOTMC_BOT_TOKEN);
    if (!token) {
      console.warn("rootmc_support_announce_skip", "missing bot token");
      return;
    }
    const appOnly = isAppOnly(identity);
    const content = formatProSupportMessage(kind, proSupportMention(identity), details, appOnly);
    const channels = [
      str(env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID) || GENERAL_FALLBACK,
      str(env.DISCORD_ROOTMC_UPDATES_CHANNEL_ID) || UPDATES_FALLBACK,
      str(env.DISCORD_ROOTMC_ADMINS_CHANNEL_ID) || ADMINS_FALLBACK,
      str(env.DISCORD_ROOTMC_ECONOMY_ANNOUNCE_CHANNEL_ID) || ECONOMY_FALLBACK,
    ];
    await Promise.all([
      ...channels.map((id) => postChannel(token, id, content)),
      broadcastInGame(env, token, kind, identity, details),
    ]);
  } catch (e) {
    console.warn("rootmc_support_announce_error", e instanceof Error ? e.message : String(e));
  }
}

/** Post the same thank-you to general + admins. Never throws. */
export async function announceProSupport(
  env: ProSupportAnnounceEnv,
  kind: ProSupportAnnounceKind,
  opts: SupportAnnounceIdentity,
): Promise<void> {
  await announceSupportPurchase(env, kind, opts);
}
