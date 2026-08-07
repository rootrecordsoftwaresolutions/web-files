import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";

import { json } from "./cors";
import {
  addGuildMemberRole,
  ensureGuildMember,
  findGuildRoleIdByName,
  patchGuildMemberNickname,
  sendChannelMessage,
} from "./discord-rootmc-api";
import {
  consumeLinkCode,
  loadLinkCode,
  upsertGlobalMinecraftLink,
  validateLinkCodeRow,
} from "./rootmc-minecraft-link";
import {
  queueDiscordLinkBonus,
  resolveDiscordEconomyServerId,
} from "./discord-rootmc-economy";
import { provisionMinecraftPlayerAccount } from "./rootmc-provision-account";
import { syncCouncilVotersRoleForDiscordUser } from "./rootmc-governance-council";
import type { AuthEnv } from "./primary-auth";
import { mintAuthToken } from "./primary-auth";
import { buildSessionCookieHeader, ssoCookieDomainForApiHost } from "./web-sso";

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const OAUTH_SCOPES = ["identify", "guilds.join"];
const SIGNIN_STATE_PREFIX = "signin:";

const DEFAULT_OAUTH_REDIRECT_URI = "https://api.rootmc.net/v1/discord/rootmc/callback";

export interface RootMcDiscordLinkEnv extends AuthEnv {
  DB: D1Database;
  SITE_URL?: string;
  DISCORD_ROOTMC_OAUTH_REDIRECT_URI?: string;
  DISCORD_ROOTMC_CLIENT_ID?: string;
  DISCORD_ROOTMC_CLIENT_SECRET?: string;
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_GUILD_ID?: string;
  DISCORD_ROOTMC_LINKED_ROLE_ID?: string;
  DISCORD_ROOTMC_MINECRAFT_SYNC_ROLE_ID?: string;
  DISCORD_ROOTMC_COUNCIL_VOTERS_ROLE_ID?: string;
  DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ADMINS_CHANNEL_ID?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function randState(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function cleanBotToken(env: RootMcDiscordLinkEnv): string {
  return String(env.DISCORD_ROOTMC_BOT_TOKEN || "").replace(/^bot\s+/i, "").trim();
}

function verifyReturnUrl(site: string, query?: string): string {
  const root = String(site || "https://rootmc.net").trim().replace(/\/+$/, "");
  const base = `${root}/verify`;
  return query ? `${base}?${query}` : base;
}

function sanitizeReturnPath(raw: string): string {
  let p = str(raw) || "/governance/";
  if (!p.startsWith("/")) p = "/governance/";
  if (p.includes("://")) return "/governance/";
  try {
    const u = new URL(p, "https://rootmc.net");
    const path = u.pathname + u.search;
    const allowed = ["/governance", "/verify", "/terms"];
    if (!allowed.some((a) => path === a || path.startsWith(`${a}/`) || path.startsWith(`${a}?`))) {
      return "/governance/";
    }
    return path;
  } catch {
    return "/governance/";
  }
}

function siteReturnUrl(site: string, returnPath: string, query?: string): string {
  const root = String(site || "https://rootmc.net").trim().replace(/\/+$/, "");
  const path = sanitizeReturnPath(returnPath);
  const base = `${root}${path}`;
  if (!query) return base;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}${query}`;
}

function sessionRedirect(request: Request, targetUrl: string, token: string | null): Response {
  const headers = new Headers({ Location: targetUrl });
  if (token) {
    const dom = ssoCookieDomainForApiHost(new URL(request.url).hostname);
    if (dom) headers.set("Set-Cookie", buildSessionCookieHeader(token, dom));
  }
  return new Response(null, { status: 302, headers });
}

async function mintSessionRedirect(
  request: Request,
  env: RootMcDiscordLinkEnv,
  site: string,
  returnPath: string,
  email: string,
  accountId: string,
  query?: string,
): Promise<Response> {
  const token = await mintAuthToken(env, email, accountId);
  const base = siteReturnUrl(site, returnPath, query);
  const target = token ? `${base}#token=${encodeURIComponent(token)}` : base;
  return sessionRedirect(request, target, token);
}

function oauthCallbackUrl(env: RootMcDiscordLinkEnv): string {
  const explicit = str(env.DISCORD_ROOTMC_OAUTH_REDIRECT_URI);
  if (explicit) return explicit;
  return DEFAULT_OAUTH_REDIRECT_URI;
}

async function discordFormPost(url: string, body: URLSearchParams): Promise<{
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body: j };
}

async function discordGetMe(accessToken: string): Promise<Record<string, unknown> | null> {
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return null;
  return j;
}

async function saveDiscordLink(
  db: D1Database,
  acct: { id: string; email: string },
  discord: {
    discord_user_id: string;
    discord_username: string | null;
    discord_global_name: string | null;
    discord_email: string | null;
  },
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO discord_account_links (
         account_id, email, discord_user_id, discord_username, discord_global_name, discord_email, linked_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         email = excluded.email,
         discord_user_id = excluded.discord_user_id,
         discord_username = excluded.discord_username,
         discord_global_name = excluded.discord_global_name,
         discord_email = excluded.discord_email,
         updated_at = excluded.updated_at`,
    )
    .bind(
      acct.id,
      acct.email.trim().toLowerCase(),
      discord.discord_user_id,
      discord.discord_username,
      discord.discord_global_name,
      discord.discord_email,
      now,
      now,
    )
    .run();
}

export async function applyRootMcLinkedDiscordMember(
  env: RootMcDiscordLinkEnv,
  discordUserId: string,
  minecraftUsername: string,
  userOAuthAccessToken?: string,
): Promise<{ joined: boolean; nick: boolean; role: boolean; syncRole: boolean }> {
  const bot = cleanBotToken(env);
  const guildId = str(env.DISCORD_ROOTMC_GUILD_ID);
  const roleId =
    str(env.DISCORD_ROOTMC_LINKED_ROLE_ID) ||
    (bot && guildId ? await findGuildRoleIdByName(bot, guildId, "RootMC Verified") : "") ||
    (bot && guildId ? await findGuildRoleIdByName(bot, guildId, "RootMC") : "") ||
    "";
  const syncRoleId =
    str(env.DISCORD_ROOTMC_MINECRAFT_SYNC_ROLE_ID) ||
    (bot && guildId ? await findGuildRoleIdByName(bot, guildId, "Minecraft Sync") : "") ||
    "";
  const userId = str(discordUserId);
  if (!bot || !guildId || !userId) {
    return { joined: false, nick: false, role: false, syncRole: false };
  }

  let joined = true;
  if (userOAuthAccessToken) {
    joined = await ensureGuildMember(bot, guildId, userId, userOAuthAccessToken);
  }

  const nick = await patchGuildMemberNickname(bot, guildId, userId, minecraftUsername);
  const role = roleId ? await addGuildMemberRole(bot, guildId, userId, roleId) : false;
  const syncRole = syncRoleId ? await addGuildMemberRole(bot, guildId, userId, syncRoleId) : false;
  return { joined, nick, role, syncRole };
}

export async function notifyRootMcDiscordLinkSuccess(
  env: RootMcDiscordLinkEnv,
  discordUserId: string,
  minecraftUsername: string,
): Promise<void> {
  const token = cleanBotToken(env);
  const userId = str(discordUserId);
  if (!token || !userId) return;

  const generalId = str(env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID);
  const adminsId = str(env.DISCORD_ROOTMC_ADMINS_CHANNEL_ID);
  const player = str(minecraftUsername) || "their player";
  const mention = `<@${userId}>`;
  const content = `${mention} completed Minecraft verify — linked **${player}**.`;

  const channelIds = [generalId, adminsId].filter((id, index, all) => id && all.indexOf(id) === index);
  if (channelIds.length === 0) return;

  const results = await Promise.allSettled(
    channelIds.map((channelId) =>
      sendChannelMessage(token, channelId, {
        content,
        mentionUserIds: [userId],
      }),
    ),
  );
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("rootmc_discord_link_notify_failed", r.reason);
    }
  }
}

async function insertOAuthState(
  env: RootMcDiscordLinkEnv,
  linkCode: string,
): Promise<{ expiresAt: string; authorize_url: string } | Response> {
  const clientId = str(env.DISCORD_ROOTMC_CLIENT_ID);
  if (!clientId) {
    return json({ detail: "Discord linking is not configured on the server." }, 503);
  }

  const codeVerifier = createCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const state = randState();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + OAUTH_STATE_TTL_MS).toISOString();

  await env.DB.prepare(
    "INSERT INTO rootmc_discord_oauth_states (state, link_code, created_at, expires_at, code_verifier) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(state, linkCode, createdAt, expiresAt, codeVerifier)
    .run();

  const redirectUri = oauthCallbackUrl(env);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    state,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    expiresAt,
    authorize_url: `https://discord.com/api/oauth2/authorize?${params.toString()}`,
  };
}

export async function startRootMcDiscordSignIn(
  env: RootMcDiscordLinkEnv,
  returnTo: string,
): Promise<Response> {
  const returnPath = sanitizeReturnPath(returnTo);
  const statePayload = await insertOAuthState(env, `${SIGNIN_STATE_PREFIX}${returnPath}`);
  if (statePayload instanceof Response) return statePayload;
  return json({
    authorize_url: statePayload.authorize_url,
    expires_at: statePayload.expiresAt,
    return_to: returnPath,
  });
}

export async function startRootMcDiscordLink(
  request: Request,
  env: RootMcDiscordLinkEnv,
  linkCode: string,
): Promise<Response> {
  const code = linkCode.toUpperCase();
  if (!code || code.length !== 6) {
    return json({ detail: "Valid 6-character link code required." }, 400);
  }

  const row = validateLinkCodeRow(await loadLinkCode(env.DB, code));
  if (row instanceof Response) return row;

  const statePayload = await insertOAuthState(env, code);
  if (statePayload instanceof Response) return statePayload;

  return json({
    authorize_url: statePayload.authorize_url,
    expires_at: statePayload.expiresAt,
    minecraft_username: row.minecraft_username,
  });
}

export async function handleRootMcDiscordOAuthCallback(
  request: Request,
  env: RootMcDiscordLinkEnv,
  ctx?: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const oauthCode = str(url.searchParams.get("code"));
  const state = str(url.searchParams.get("state"));
  const err = str(url.searchParams.get("error"));
  const site = str(env.SITE_URL) || "https://rootmc.net";

  if (err) return Response.redirect(verifyReturnUrl(site, "discord=error"), 302);
  if (!oauthCode || !state) return Response.redirect(verifyReturnUrl(site, "discord=error"), 302);

  const stateRow = await env.DB.prepare(
    "SELECT link_code, expires_at, code_verifier FROM rootmc_discord_oauth_states WHERE state = ? LIMIT 1",
  )
    .bind(state)
    .first<{ link_code: string; expires_at: string; code_verifier?: string }>();

  await env.DB.prepare("DELETE FROM rootmc_discord_oauth_states WHERE state = ?").bind(state).run();

  if (!stateRow?.link_code) {
    return Response.redirect(verifyReturnUrl(site, "discord=expired"), 302);
  }
  const expMs = Date.parse(stateRow.expires_at || "");
  if (!Number.isFinite(expMs) || expMs < Date.now()) {
    return Response.redirect(verifyReturnUrl(site, "discord=expired"), 302);
  }

  const clientId = str(env.DISCORD_ROOTMC_CLIENT_ID);
  if (!clientId) {
    return Response.redirect(verifyReturnUrl(site, "discord=error"), 302);
  }

  const redirectUri = oauthCallbackUrl(env);
  const codeVerifier = str(stateRow.code_verifier);
  const tokenBody = new URLSearchParams();
  tokenBody.set("client_id", clientId);
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("code", oauthCode);
  tokenBody.set("redirect_uri", redirectUri);
  if (codeVerifier) {
    tokenBody.set("code_verifier", codeVerifier);
  } else {
    const clientSecret = str(env.DISCORD_ROOTMC_CLIENT_SECRET);
    if (!clientSecret) {
      return Response.redirect(verifyReturnUrl(site, "discord=error"), 302);
    }
    tokenBody.set("client_secret", clientSecret);
  }

  const tok = await discordFormPost("https://discord.com/api/oauth2/token", tokenBody);
  const accessToken = typeof tok.body?.access_token === "string" ? tok.body.access_token : "";
  if (!tok.ok || !accessToken) {
    const errCode = str(tok.body?.error) || "token_exchange_failed";
    console.error("rootmc_discord_token_exchange_failed", tok.status, errCode, str(tok.body?.error_description).slice(0, 180));
    return Response.redirect(verifyReturnUrl(site, `discord=${encodeURIComponent(errCode)}`), 302);
  }

  const me = await discordGetMe(accessToken);
  const discordUserId = typeof me?.id === "string" ? me.id : "";
  const discordUsername = typeof me?.username === "string" ? me.username : null;
  const discordGlobalName = typeof me?.global_name === "string" ? me.global_name : null;
  const discordEmail = typeof me?.email === "string" ? me.email : null;
  if (!discordUserId) return Response.redirect(verifyReturnUrl(site, "discord=error"), 302);

  const linkCodeRaw = str(stateRow.link_code);
  const isSignIn = linkCodeRaw.startsWith(SIGNIN_STATE_PREFIX);
  const signInReturn = isSignIn
    ? sanitizeReturnPath(linkCodeRaw.slice(SIGNIN_STATE_PREFIX.length))
    : "/governance/";

  if (isSignIn) {
    const linked = await env.DB.prepare(
      `SELECT d.account_id, d.email, l.minecraft_uuid, l.minecraft_username
       FROM discord_account_links d
       LEFT JOIN rootstat_minecraft_links l ON l.account_id = d.account_id
       WHERE d.discord_user_id = ? LIMIT 1`,
    )
      .bind(discordUserId)
      .first<{
        account_id: string;
        email: string;
        minecraft_uuid: string | null;
        minecraft_username: string | null;
      }>();

    if (!linked?.account_id || !str(linked.minecraft_uuid)) {
      return sessionRedirect(
        request,
        siteReturnUrl(site, signInReturn, "discord=not_linked"),
        null,
      );
    }

    const councilJob = syncCouncilVotersRoleForDiscordUser(env, discordUserId).catch((e) =>
      console.error("rootmc_council_role_sync_failed", e),
    );
    if (ctx?.waitUntil) ctx.waitUntil(councilJob);
    else await councilJob;

    return mintSessionRedirect(
      request,
      env,
      site,
      signInReturn,
      linked.email,
      linked.account_id,
      "discord=signed_in",
    );
  }

  const linkCode = linkCodeRaw.toUpperCase();
  const linkRow = validateLinkCodeRow(await loadLinkCode(env.DB, linkCode));
  if (linkRow instanceof Response) {
    return Response.redirect(verifyReturnUrl(site, "discord=code_invalid"), 302);
  }

  const existingDiscord = await env.DB.prepare(
    "SELECT account_id FROM discord_account_links WHERE discord_user_id = ? LIMIT 1",
  )
    .bind(discordUserId)
    .first<{ account_id: string }>();

  const provisioned = await provisionMinecraftPlayerAccount(
    env.DB,
    linkRow.minecraft_uuid,
    linkRow.minecraft_username,
  );

  if (existingDiscord && existingDiscord.account_id !== provisioned.accountId) {
    return Response.redirect(verifyReturnUrl(site, "discord=already_linked"), 302);
  }

  await upsertGlobalMinecraftLink(
    env.DB,
    linkRow.minecraft_uuid,
    linkRow.minecraft_username,
    provisioned.accountId,
    provisioned.email,
  );
  await consumeLinkCode(env.DB, linkCode, provisioned.accountId);

  await saveDiscordLink(env.DB, { id: provisioned.accountId, email: provisioned.email }, {
    discord_user_id: discordUserId,
    discord_username: discordUsername,
    discord_global_name: discordGlobalName,
    discord_email: discordEmail,
  });

  await applyRootMcLinkedDiscordMember(env, discordUserId, linkRow.minecraft_username, accessToken);

  const councilJob = syncCouncilVotersRoleForDiscordUser(env, discordUserId).catch((e) =>
    console.error("rootmc_council_role_sync_failed", e),
  );
  if (ctx?.waitUntil) {
    ctx.waitUntil(councilJob);
  } else {
    await councilJob;
  }

  const linkBonus = await queueDiscordLinkBonus(
    env.DB,
    await resolveDiscordEconomyServerId(env.DB),
    linkRow.minecraft_uuid,
    linkRow.minecraft_username,
    discordUserId,
  );
  if (linkBonus.queued) {
    console.info("rootmc_discord_link_bonus_queued", linkRow.minecraft_username, linkBonus.transferId);
  }

  const notifyJob = notifyRootMcDiscordLinkSuccess(
    env,
    discordUserId,
    linkRow.minecraft_username,
  ).catch((e) => console.error("rootmc_discord_link_notify_failed", e));
  if (ctx?.waitUntil) {
    ctx.waitUntil(notifyJob);
  } else {
    await notifyJob;
  }

  const q = new URLSearchParams({
    discord: "linked",
    player: linkRow.minecraft_username,
  });
  return mintSessionRedirect(
    request,
    env,
    site,
    "/verify/",
    provisioned.email,
    provisioned.accountId,
    q.toString(),
  );
}

export async function handleRootMcDiscordLinkRoutes(
  request: Request,
  env: RootMcDiscordLinkEnv,
  subpath: string,
  method: string,
): Promise<Response | null> {
  if (!subpath.startsWith("/realm/minecraft")) return null;
  const rest = subpath.slice("/realm/minecraft".length) || "/";

  if (method === "POST" && rest === "/link/discord/start") {
    let body: { code?: string } = {};
    try {
      body = JSON.parse(await request.text()) as { code?: string };
    } catch {
      return json({ detail: "Invalid JSON body." }, 400);
    }
    return startRootMcDiscordLink(request, env, str(body.code));
  }

  return null;
}
