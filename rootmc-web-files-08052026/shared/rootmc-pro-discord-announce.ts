/**
 * Public Discord thank-you posts for RootMC Pro Stripe checkouts.
 */
export type ProSupportAnnounceKind = "sub_first" | "sub_renew" | "lifetime" | "one_month";

export type ProSupportAnnounceEnv = {
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ADMINS_CHANNEL_ID?: string;
};

const GENERAL_FALLBACK = "1516108586307158088";
const ADMINS_FALLBACK = "1516121832493678612";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function formatProSupportMessage(
  kind: ProSupportAnnounceKind,
  mentionOrName: string,
): string {
  const who = mentionOrName.trim() || "Someone";
  switch (kind) {
    case "sub_renew":
      return `${who} renewed their subscription! Thank you for supporting RootMC!`;
    case "sub_first":
      return `${who} subscribed for the first time! Thank you for supporting RootMC!`;
    case "lifetime":
      return `${who} purchased a lifetime membership! Thank you for supporting RootMC!`;
    case "one_month":
      return `${who} purchased a single One Month Pro Membership item! Thank you for supporting RootMC!`;
    default:
      return `${who} supported RootMC! Thank you!`;
  }
}

export function proSupportMention(opts: {
  discordUserId?: string | null;
  minecraftUsername?: string | null;
}): string {
  const did = str(opts.discordUserId);
  if (did) return `<@${did}>`;
  const ign = str(opts.minecraftUsername);
  if (ign) return `**${ign}**`;
  return "Someone";
}

async function postChannel(token: string, channelId: string, content: string): Promise<void> {
  const res = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "RootMC/stripe-pro-announce",
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("rootmc_pro_support_discord_post_failed", channelId, res.status, body.slice(0, 200));
  }
}

/** Post the same thank-you to general + admins. Never throws. */
export async function announceProSupport(
  env: ProSupportAnnounceEnv,
  kind: ProSupportAnnounceKind,
  opts: { discordUserId?: string | null; minecraftUsername?: string | null },
): Promise<void> {
  try {
    const token = str(env.DISCORD_ROOTMC_BOT_TOKEN);
    if (!token) {
      console.warn("rootmc_pro_support_discord_skip", "missing bot token");
      return;
    }
    const content = formatProSupportMessage(kind, proSupportMention(opts));
    const channels = [
      str(env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID) || GENERAL_FALLBACK,
      str(env.DISCORD_ROOTMC_ADMINS_CHANNEL_ID) || ADMINS_FALLBACK,
    ];
    await Promise.all(channels.map((id) => postChannel(token, id, content)));
  } catch (e) {
    console.warn("rootmc_pro_support_discord_error", e instanceof Error ? e.message : String(e));
  }
}
