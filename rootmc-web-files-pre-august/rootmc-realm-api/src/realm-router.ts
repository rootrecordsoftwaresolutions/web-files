import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";

import { handleAppSessionStartRoute } from "../../rootrecord-api-account/src/app-session-notify";
import { scheduleAuthLoginDiscordSessionNotify } from "../../shared/discord-app-session-notify";
import { bindCorsRequest, cors, json } from "./cors";
import { lifeMemberFromLicenseData, readUserAccountAccessFlags, upsertUserAccountFromLicense } from "./accounts";
import {
  authLogin,
  authMe,
  authSignup,
  extractAuthToken,
  type AuthEnv,
} from "./primary-auth";
import { buildSessionCookieHeader, ssoCookieDomainForApiHost } from "./web-sso";
import { buildSessionInsertMeta, handleAuthLogout, handleAuthLogoutAll } from "./me-account-routes";
import { handleRootMcFeedbackRoute } from "./feedback-route-rootmc";
import { handleRootMcWorldAi } from "./rootmc-world-ai";
import { handleRootMcRealm } from "./rootmc-realm";
import { handleRootMcSync } from "./rootmc-sync";
import { handleRootMcServer, featuredServerForMobileConfig } from "./rootmc-server";
import { handleRootStatMinecraft } from "./rootstat-minecraft";
import { handleRootMcServerAi } from "./rootmc-server-ai";
import { handleRootMcEconomyServer, handleEconomySync, handlePhysicalGoldSync, handleShopListingSync } from "./rootmc-economy";
import {
  completeTreasuryDividends,
  handleTreasuryPublicRoutes,
  listPendingTreasuryDividends,
} from "./rootmc-treasury";
import { runRootMcMonthlyDividendDiscordReport } from "./rootmc-monthly-dividend-report";
import { handleRootMcIngame } from "./rootmc-ingame";
import { handleRootMcIngameChat } from "./rootmc-ingame-chat";
import { handleRootMcIngameAsk } from "./rootmc-ingame-ask";
import { handleRootMcIngameFeedback } from "./rootmc-ingame-feedback";
import { handleRootMcCommandTestReport } from "./rootmc-command-test-report";
import { handleRootMcAdminProbeFlag } from "./rootmc-admin-probe-flag";
import { handleRootMcIngameQuestionnaire } from "./rootmc-ingame-questionnaire";
import { handleRootMcIngameReport } from "./rootmc-ingame-report";
import { handleRootMcVaultMarket } from "./rootmc-vault-market";
import { handleItemValueRoute } from "./rootmc-item-value";
import {
  handleRootMcDiscordLinkRoutes,
  handleRootMcDiscordOAuthCallback,
} from "./discord-rootmc-player-link";
import { handleTownySync, reconcileRootMcTownyDiscord } from "./discord-rootmc-towny";
import { runRootMcCombinedDailyPreview } from "./rootmc-daily-preview";
import { previousHstDayKey, resolveServerId, runRootMcDailyReportCron } from "./rootmc-daily-report";
import { runRootMcDailyCategoryReport } from "./rootmc-daily-category-reports";
import { runFullDailyReportSuite } from "./rootmc-daily-report-runner";
import { previousCompletedHstWeekKey } from "./rootmc-hst-week";
import { runFullWeeklyReportSuite, runWeeklyIntelligenceSuite } from "./rootmc-weekly-report-runner";
import { runRootMcWeeklyActivityAwards } from "./rootmc-weekly-activity-awards";
import { ROOTMC_DEDICATED_CHANNEL_CATEGORIES } from "./rootmc-grok-prompts";
import { validateServerAuth } from "./rootstat-minecraft";
import { handleWeeklyActivityHighlights } from "./rootmc-weekly-activity-public";
import { completeGoldTransfers, listPendingGoldTransfers } from "./rootmc-gold-transfers";
import { getReferenceVersion, handleRootMcReference } from "./rootmc-reference";
import { handleRootMcDiscordInteractions } from "./discord-rootmc-bot";
import { handlePushRoutes } from "../../rootrecord-api-account/src/push";
import { handleRootMcShopAlerts } from "./rootmc-shop-alerts";
import { handleRootMcTownyFacing } from "./rootmc-towny-facing";
import { handleRootMcSeason } from "./rootmc-season-arcs";
import { handleRootMcBlueprintRoutes } from "./rootmc-blueprints";
import { handlePaperTokenRoutes } from "./rootmc-paper-token";
import { runMysqlEconomyPullCron, runTownyMysqlEnrichmentNow } from "./rootmc-mysql-economy-pull";
import { handleGovernanceRoutes } from "./rootmc-governance-routes";
import { handleGovernanceWebRoutes } from "./rootmc-governance-web";

export interface Env extends AuthEnv {
  DB: D1Database;
  SITE_URL: string;
  WORKER_SHARD?: string;
  DISCORD_ROOTMC_OAUTH_REDIRECT_URI?: string;
  DISCORD_ROOTMC_PUBLIC_KEY?: string;
  DISCORD_ROOTMC_CLIENT_ID?: string;
  DISCORD_FEEDBACK_CHANNEL_ID?: string;
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_WEBHOOK_URL?: string;
  DISCORD_ROOTMC_AI_ARCHIVE_CHANNEL_ID?: string;
  DISCORD_APP_SESSION_WEBHOOK_URL?: string;
  DISCORD_APP_SESSION_CHANNEL_ID?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_GUILD_ID?: string;
  DISCORD_DEVELOPER_ROLE_ID?: string;
  GROK_API_BEARER_TOKEN?: string;
  GROK_ROOT_ASK_BEARER_TOKEN?: string;
  GROK_X_BEARER_TOKEN?: string;
  GROK_API_URL?: string;
  GROK_MODEL?: string;
  DISCORD_ROOTMC_GUILD_ID?: string;
  DISCORD_ROOTMC_LINKED_ROLE_ID?: string;
  DISCORD_ROOTMC_MINECRAFT_SYNC_ROLE_ID?: string;
  DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ADMINS_CHANNEL_ID?: string;
  DISCORD_ROOTMC_INGAME_CHAT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_INGAME_FEEDBACK_CHANNEL_ID?: string;
  DISCORD_ROOTMC_REPORT_TICKETS_CATEGORY_ID?: string;
  DISCORD_ROOTMC_STAFF_ROLE_ID?: string;
  DISCORD_ROOTMC_TOWN_CATEGORY_ID?: string;
  DISCORD_ROOTMC_NATION_CATEGORY_ID?: string;
  DISCORD_ROOTMC_TOWN_ARCHIVE_CATEGORY_ID?: string;
  DISCORD_ROOTMC_NATION_ARCHIVE_CATEGORY_ID?: string;
  DISCORD_ROOTMC_TOWN_INFO_CHANNEL_ID?: string;
  DISCORD_ROOTMC_NATION_INFO_CHANNEL_ID?: string;
  DISCORD_ROOTMC_DAILY_REPORT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_AI_RAW_ARCHIVE_CHANNEL_ID?: string;
  FCM_SERVICE_ACCOUNT_JSON?: string;
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
  RR_PUSH_ADMIN_SECRET?: string;
  DISCORD_ROOTMC_BOT_SPAM_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ACTIVE_PARTICIPANT_ROLE_ID?: string;
  DISCORD_ROOTMC_TOP_ACTIVE_PLAYER_ROLE_ID?: string;
  ASSETS?: import("@cloudflare/workers-types").R2Bucket;
  ROOTMC_PAPER_TOKEN_MINT?: string;
  ROOTMC_PAPER_REFERENCE_PRICE_USD?: string;
  ROOTMC_PAPER_REFERENCE_G_PER_UNIT?: string;
  ROOTMC_PAPER_TRADE_FEE_PERCENT?: string;
  HELIUS_API_KEY?: string;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+/g, "/").replace(/\/+$/, "") || "/";
}

function apiSubpath(pathname: string): string {
  let p = normalizePathname(pathname);
  if (!p.startsWith("/api")) return p;
  while (p.startsWith("/api/") || p === "/api") {
    if (p === "/api") return "/";
    p = normalizePathname(p.slice(4));
  }
  return p;
}

function licenseDeviceId(creds: { device_id?: string }, request: Request): string | null {
  const fromBody = String(creds.device_id || "").trim();
  if (fromBody) return fromBody.slice(0, 128);
  const guest = (request.headers.get("X-Guest-Id") || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return guest || null;
}

function webSsoSetCookie(request: Request, token: string | undefined | null): string | undefined {
  const t = String(token || "").trim();
  if (!t) return undefined;
  const dom = ssoCookieDomainForApiHost(new URL(request.url).hostname);
  if (!dom) return undefined;
  return buildSessionCookieHeader(t, dom);
}

async function mergedAccessFromAccountMirror(
  env: Env,
  email: string,
  data: Record<string, unknown>,
): Promise<{ pro: boolean; life: boolean }> {
  const flags = await readUserAccountAccessFlags(env.DB, email).catch(() => null);
  const life = lifeMemberFromLicenseData(data) || Boolean(flags?.life_member);
  const pro = life || Boolean(data.proUnlocked || data.pro_unlocked) || Boolean(flags?.pro_unlocked);
  return { pro, life };
}

async function healthJson(env: Env): Promise<Response> {
  let d1Ok = false;
  try {
    const r = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    d1Ok = r?.ok === 1;
  } catch {
    d1Ok = false;
  }
  return json(
    {
      status: d1Ok ? "ok" : "degraded",
      db: d1Ok ? "ok" : "unavailable",
      service: "rootmc-api",
      site_url: env.SITE_URL,
    },
    200,
  );
}

export async function handleRequest(
  request: Request,
  env: Env,
  ctx?: ExecutionContext,
): Promise<Response> {
  bindCorsRequest(request);
  try {
    const url = new URL(request.url);
    const pathname = normalizePathname(url.pathname);
    const method = request.method;

    if (method === "OPTIONS") {
      const h = new Headers();
      for (const [k, v] of Object.entries(cors())) {
        h.set(k, v);
      }
      return new Response(null, { status: 204, headers: h });
    }

    if (!pathname.startsWith("/api")) {
      if (method === "GET" && (pathname === "/" || pathname === "/health")) {
        return healthJson(env);
      }

      if (
        method === "GET"
        && (pathname === "/v1/discord/rootmc/oauth/callback"
          || pathname === "/v1/discord/rootmc/callback")
      ) {
        return handleRootMcDiscordOAuthCallback(request, env, ctx);
      }

      if (method === "GET" && pathname === "/v1/discord/rootmc/interactions") {
        return json(
          {
            ok: true,
            post_only: true,
            hint: "RootMC slash commands POST here. Set Interactions Endpoint URL on the RootMC Discord application.",
          },
          200,
        );
      }

      if (method === "POST" && pathname === "/v1/discord/rootmc/interactions") {
        return handleRootMcDiscordInteractions(request, env, ctx);
      }

      if (method === "POST" && pathname === "/v1/auth/login") {
        let creds: { email?: string; password?: string; device_id?: string };
        try {
          creds = (await request.json()) as typeof creds;
        } catch {
          return json({ detail: "Invalid JSON" }, 400);
        }
        if (!licenseDeviceId(creds, request)) {
          return json({ detail: "device_id is required (or send X-Guest-Id)." }, 400);
        }
        const meta = buildSessionInsertMeta(request, licenseDeviceId(creds, request));
        const res = await authLogin(env, { email: creds.email || "", password: creds.password || "" }, meta);
        if (!res.ok) return res;
        const data = (await res.json()) as Record<string, unknown>;
        const email = String(data.email || creds.email || "").trim();
        const access = await mergedAccessFromAccountMirror(env, email, data);
        data.pro_unlocked = access.pro;
        data.proUnlocked = access.pro;
        data.life_member = access.life;
        data.lifeMember = access.life;
        try {
          await upsertUserAccountFromLicense(env.DB, {
            email,
            account_id: String(data.account_id || ""),
            pro_unlocked: access.pro,
            life_member: access.life,
            extra: { source: "login", path: "/v1/auth/login" },
          });
        } catch {
          /* optional */
        }
        scheduleAuthLoginDiscordSessionNotify(
          ctx,
          env,
          request,
          creds as Record<string, unknown>,
          data,
          licenseDeviceId(creds, request),
        );
        const tok = (data.access_token || data.token) as string | undefined;
        return json(data, 200, undefined, webSsoSetCookie(request, tok));
      }

      if (method === "POST" && pathname === "/v1/auth/signup") {
        let creds: { email?: string; password?: string; device_id?: string };
        try {
          creds = (await request.json()) as typeof creds;
        } catch {
          return json({ detail: "Invalid JSON" }, 400);
        }
        if (!licenseDeviceId(creds, request)) {
          return json({ detail: "device_id is required (or send X-Guest-Id)." }, 400);
        }
        const meta = buildSessionInsertMeta(request, licenseDeviceId(creds, request));
        const res = await authSignup(env, { email: creds.email || "", password: creds.password || "" }, meta);
        if (!res.ok) return res;
        const data = (await res.json()) as Record<string, unknown>;
        const email = String(data.email || creds.email || "").trim();
        const access = await mergedAccessFromAccountMirror(env, email, data);
        data.pro_unlocked = access.pro;
        data.proUnlocked = access.pro;
        data.life_member = access.life;
        data.lifeMember = access.life;
        try {
          await upsertUserAccountFromLicense(env.DB, {
            email,
            account_id: String(data.account_id || ""),
            pro_unlocked: access.pro,
            life_member: access.life,
            extra: { source: "signup", path: "/v1/auth/signup" },
          });
        } catch {
          /* optional */
        }
        scheduleAuthLoginDiscordSessionNotify(
          ctx,
          env,
          request,
          creds as Record<string, unknown>,
          data,
          licenseDeviceId(creds, request),
        );
        const tok = (data.access_token || data.token) as string | undefined;
        return json(data, 200, undefined, webSsoSetCookie(request, tok));
      }

      if (method === "GET" && pathname === "/v1/me") {
        const tok = extractAuthToken(request);
        if (!tok) return json({ detail: "Missing token" }, 401);
        return authMe(env, tok, ctx);
      }

      if (method === "POST" && pathname === "/v1/auth/logout") {
        return handleAuthLogout(request, env);
      }

      if (method === "POST" && pathname === "/v1/auth/logout-all") {
        return handleAuthLogoutAll(request, env);
      }

      return json({ ok: false, error: "not_found" }, 404);
    }

    const sub = apiSubpath(pathname);

    if (method === "GET" && sub === "/health") {
      return healthJson(env);
    }

    const appSessionRes = await handleAppSessionStartRoute(request, env, sub, method);
    if (appSessionRes) return appSessionRes;

    if (method === "GET" && sub === "/v1/me") {
      const tok = extractAuthToken(request);
      if (!tok) return json({ detail: "Missing token" }, 401);
      return authMe(env, tok, ctx);
    }

    if (method === "POST" && sub === "/auth/login") {
      let creds: { email?: string; password?: string; device_id?: string };
      try {
        creds = (await request.json()) as typeof creds;
      } catch {
        return json({ detail: "Invalid JSON" }, 400);
      }
      const deviceId = licenseDeviceId(creds, request);
      if (!deviceId) {
        return json({ detail: "device_id is required (or send X-Guest-Id)." }, 400);
      }
      const meta = buildSessionInsertMeta(request, deviceId);
      const res = await authLogin(env, { email: creds.email || "", password: creds.password || "" }, meta);
      if (!res.ok) return res;
      const data = (await res.json()) as Record<string, unknown>;
      const token = (data.access_token || data.token) as string | undefined;
      const emailOut = String(data.email || creds.email || "").trim();
      const access = await mergedAccessFromAccountMirror(env, emailOut, data);
      try {
        await upsertUserAccountFromLicense(env.DB, {
          email: emailOut,
          account_id: String(data.account_id || ""),
          pro_unlocked: access.pro,
          life_member: access.life,
          extra: { source: "login" },
        });
      } catch {
        /* optional */
      }
      scheduleAuthLoginDiscordSessionNotify(
        ctx,
        env,
        request,
        creds as Record<string, unknown>,
        data,
        deviceId,
      );
      return json(
        {
          ok: true,
          token,
          access_token: token,
          email: emailOut,
          account_id: String(data.account_id || ""),
          pro_unlocked: access.pro,
          life_member: access.life,
        },
        200,
        undefined,
        webSsoSetCookie(request, token),
      );
    }

    if (method === "POST" && (sub === "/auth/signup" || sub === "/auth/register")) {
      let creds: { email?: string; password?: string; device_id?: string };
      try {
        creds = (await request.json()) as typeof creds;
      } catch {
        return json({ detail: "Invalid JSON" }, 400);
      }
      const deviceId = licenseDeviceId(creds, request);
      if (!deviceId) {
        return json({ detail: "device_id is required (or send X-Guest-Id)." }, 400);
      }
      const meta = buildSessionInsertMeta(request, deviceId);
      const res = await authSignup(env, { email: creds.email || "", password: creds.password || "" }, meta);
      if (!res.ok) return res;
      const data = (await res.json()) as Record<string, unknown>;
      const token = (data.access_token || data.token) as string | undefined;
      const emailOut = String(data.email || creds.email || "").trim();
      const access = await mergedAccessFromAccountMirror(env, emailOut, data);
      try {
        await upsertUserAccountFromLicense(env.DB, {
          email: emailOut,
          account_id: String(data.account_id || ""),
          pro_unlocked: access.pro,
          life_member: access.life,
          extra: { source: "signup" },
        });
      } catch {
        /* optional */
      }
      scheduleAuthLoginDiscordSessionNotify(
        ctx,
        env,
        request,
        creds as Record<string, unknown>,
        data,
        deviceId,
      );
      return json(
        {
          ok: true,
          token,
          access_token: token,
          email: emailOut,
          account_id: String(data.account_id || ""),
          pro_unlocked: access.pro,
          life_member: access.life,
        },
        200,
        undefined,
        webSsoSetCookie(request, token),
      );
    }

    if ((method === "GET" || method === "POST") && sub === "/auth/me") {
      const token = extractAuthToken(request);
      if (!token) return json({ detail: "Missing token" }, 401);
      return authMe(env, token, ctx);
    }

    if (method === "POST" && sub === "/auth/logout") {
      return handleAuthLogout(request, env);
    }

    if (method === "POST" && sub === "/auth/logout-all") {
      return handleAuthLogoutAll(request, env);
    }

    const pushRes = await handlePushRoutes(request, env, sub, method);
    if (pushRes) return pushRes;

    const referenceRes = await handleRootMcReference(request, env, sub, method);
    if (referenceRes) return referenceRes;

    if (method === "GET" && sub === "/mobile/config") {
      const featuredServer = await featuredServerForMobileConfig(env.DB);
      const referenceVersion = await getReferenceVersion(env.DB);
      return json(
        {
          app_id: "rootrecord_rootmc_android",
          reference_version: referenceVersion,
          support_discord_guild_id: String(env.DISCORD_ROOTMC_GUILD_ID || "1516108585740800042").trim(),
          support_discord_invite_url: "https://discord.gg/rFFQYrNaqS",
          support_discord_channel_id: String(
            env.DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID || env.DISCORD_FEEDBACK_CHANNEL_ID || "",
          ).trim() || undefined,
          featured_server: featuredServer,
        },
        200,
      );
    }

    const feedbackRes = await handleRootMcFeedbackRoute(request, env, sub, method);
    if (feedbackRes) return feedbackRes;

    const worldAiRes = await handleRootMcWorldAi(request, env, sub, method, ctx);
    if (worldAiRes) return worldAiRes;

    const serverAiRes = await handleRootMcServerAi(request, env, sub, method, ctx);
    if (serverAiRes) return serverAiRes;

    const realmRes = await handleRootMcRealm(request, env, sub, method);
    if (realmRes) return realmRes;

    const syncRes = await handleRootMcSync(request, env, sub, method);
    if (syncRes) return syncRes;

    const ingameChatRes = await handleRootMcIngameChat(request, env, sub, method);
    if (ingameChatRes) return ingameChatRes;

    const ingameAskRes = await handleRootMcIngameAsk(request, env, sub, method);
    if (ingameAskRes) return ingameAskRes;

    const ingameFeedbackRes = await handleRootMcIngameFeedback(request, env, sub, method);
    if (ingameFeedbackRes) return ingameFeedbackRes;

    const commandTestReportRes = await handleRootMcCommandTestReport(request, env, sub, method);
    if (commandTestReportRes) return commandTestReportRes;

    const adminProbeFlagRes = await handleRootMcAdminProbeFlag(request, env, sub, method);
    if (adminProbeFlagRes) return adminProbeFlagRes;

    const ingameQuestionnaireRes = await handleRootMcIngameQuestionnaire(request, env, sub, method);
    if (ingameQuestionnaireRes) return ingameQuestionnaireRes;

    const ingameReportRes = await handleRootMcIngameReport(request, env, sub, method);
    if (ingameReportRes) return ingameReportRes;

    const ingameRes = await handleRootMcIngame(request, env, sub, method);
    if (ingameRes) return ingameRes;

    const vaultMarketRes = await handleRootMcVaultMarket(request, env, sub, method);
    if (vaultMarketRes) return vaultMarketRes;

    const shopAlertsRes = await handleRootMcShopAlerts(request, env, sub, method);
    if (shopAlertsRes) return shopAlertsRes;

    const townyFacingRes = await handleRootMcTownyFacing(request, env, sub, method);
    if (townyFacingRes) return townyFacingRes;

    const seasonRes = await handleRootMcSeason(request, env, sub, method);
    if (seasonRes) return seasonRes;

    const blueprintRes = await handleRootMcBlueprintRoutes(request, env, sub, method);
    if (blueprintRes) return blueprintRes;

    if (method === "POST" && sub === "/rootmc/towny/sync") {
      const res = await handleTownySync(request, env);
      ctx?.waitUntil(reconcileRootMcTownyDiscord(env));
      return res;
    }

    if (method === "POST" && sub === "/rootmc/towny/enrich-from-mysql") {
      const server = await validateServerAuth(env, request);
      if (server instanceof Response) return server;
      const result = await runTownyMysqlEnrichmentNow(env);
      return json(result, result.ok ? 200 : 503);
    }

    if (method === "POST" && sub === "/rootmc/daily-report/preview") {
      const server = await validateServerAuth(env, request);
      if (server instanceof Response) return server;
      const result = await runRootMcCombinedDailyPreview(env, {
        previewLabel: "manual trigger",
        serverId: server.serverId,
      });
      return json(result, result.ok ? 200 : 503);
    }

    if (method === "POST" && sub === "/rootmc/daily-report/reset-all") {
      const server = await validateServerAuth(env, request);
      if (server instanceof Response) return server;
      const featuredId = await resolveServerId(env.DB);
      for (const sid of new Set([server.serverId, featuredId].filter(Boolean))) {
        await env.DB.prepare(`DELETE FROM rootmc_daily_category_reports WHERE server_id = ?`).bind(sid).run();
        await env.DB.prepare(`DELETE FROM rootmc_daily_reports WHERE server_id = ?`).bind(sid).run();
      }
      return json({ ok: true, server_id: server.serverId, detail: "d1_cleared" });
    }

    if (method === "POST" && sub.startsWith("/rootmc/daily-report/internal-category/")) {
      const auth = request.headers.get("Authorization") || "";
      const jwt = String(env.JWT_SECRET || "").trim();
      if (!jwt || auth !== `Bearer ${jwt}`) {
        return json({ ok: false, detail: "forbidden" }, 403);
      }
      const category = sub.slice("/rootmc/daily-report/internal-category/".length).trim();
      if (!(ROOTMC_DEDICATED_CHANNEL_CATEGORIES as readonly string[]).includes(category)) {
        return json({ ok: false, detail: "invalid category" }, 400);
      }
      let body: { serverId?: string } = {};
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, detail: "invalid json" }, 400);
      }
      const serverId = String(body.serverId || (await resolveServerId(env.DB))).trim();
      const result = await runRootMcDailyCategoryReport(
        env,
        category as (typeof ROOTMC_DEDICATED_CHANNEL_CATEGORIES)[number],
        serverId,
      );
      return json({ ok: result.ok, category, detail: result.detail }, result.ok ? 200 : 503);
    }

    if (method === "POST" && sub.startsWith("/rootmc/daily-report/trigger-category/")) {
      const server = await validateServerAuth(env, request);
      if (server instanceof Response) return server;
      const category = sub.slice("/rootmc/daily-report/trigger-category/".length).trim();
      if (!(ROOTMC_DEDICATED_CHANNEL_CATEGORIES as readonly string[]).includes(category)) {
        return json({ ok: false, detail: "invalid category" }, 400);
      }
      const dayKey = previousHstDayKey();
      await env.DB.prepare(
        `DELETE FROM rootmc_daily_category_reports WHERE server_id = ? AND day_key = ? AND category = ?`,
      )
        .bind(server.serverId, dayKey, category)
        .run();
      const result = await runRootMcDailyCategoryReport(
        env,
        category as (typeof ROOTMC_DEDICATED_CHANNEL_CATEGORIES)[number],
        server.serverId,
      );
      return json(
        { ok: result.ok, category, dayKey, server_id: server.serverId, detail: result.detail },
        result.ok ? 200 : 503,
      );
    }

    if (method === "POST" && sub === "/rootmc/daily-report/trigger-all") {
      const server = await validateServerAuth(env, request);
      if (server instanceof Response) return server;
      let body: { dayKey?: string } = {};
      try {
        body = (await request.json()) as typeof body;
      } catch {
        // empty body ok
      }
      const dayKey = String(body.dayKey ?? "").trim() || previousHstDayKey();
      ctx.waitUntil(
        runFullDailyReportSuite(env, {
          serverId: server.serverId,
          previewLabel: "trigger-all",
          clearDayKey: dayKey,
        }).catch((e) =>
          console.error("rootmc_daily_trigger_all_failed", e instanceof Error ? e.message : String(e)),
        ),
      );
      console.log("rootmc_daily_trigger_all_started", server.serverId, dayKey);
      return json({ ok: true, dayKey, server_id: server.serverId, status: "started" });
    }

    if (method === "POST" && sub === "/rootmc/weekly-report/trigger-all") {
      const server = await validateServerAuth(env, request);
      if (server instanceof Response) return server;
      let body: { weekKey?: string; async?: boolean; force?: boolean } = {};
      try {
        body = (await request.json()) as typeof body;
      } catch {
        // empty body ok
      }
      const weekKey = String(body.weekKey ?? "").trim() || previousCompletedHstWeekKey();
      if (body.async === true) {
        ctx.waitUntil(
          runFullWeeklyReportSuite(env, weekKey).catch((e) =>
            console.error("rootmc_weekly_trigger_all_failed", e instanceof Error ? e.message : String(e)),
          ),
        );
        console.log("rootmc_weekly_trigger_all_started", server.serverId, weekKey);
        return json({ ok: true, weekKey, server_id: server.serverId, status: "started" });
      }
      try {
        const active = await runRootMcWeeklyActivityAwards(env, weekKey, { force: body.force === true });
        ctx.waitUntil(
          runWeeklyIntelligenceSuite(env, weekKey).catch((e) =>
            console.error("rootmc_weekly_intelligence_failed", e instanceof Error ? e.message : String(e)),
          ),
        );
        return json({ ok: active.ok, weekKey, server_id: server.serverId, active });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error("rootmc_weekly_trigger_all_failed", detail);
        return json({ ok: false, weekKey, server_id: server.serverId, detail }, 503);
      }
    }

    if (method === "GET" && sub === "/rootmc/weekly-activity/highlights") {
      return handleWeeklyActivityHighlights(env.DB, env);
    }

    if (method === "GET" && sub === "/rootmc/economy/transfers/pending") {
      return listPendingGoldTransfers(request, env);
    }

    if (method === "POST" && sub === "/rootmc/economy/transfers/complete") {
      return completeGoldTransfers(request, env);
    }

    if (method === "GET" && sub === "/rootmc/treasury/dividends/pending") {
      return listPendingTreasuryDividends(request, env);
    }

    if (method === "POST" && sub === "/rootmc/treasury/dividends/complete") {
      return completeTreasuryDividends(request, env);
    }

    if (method === "POST" && sub === "/rootmc/treasury/dividends/preview-report") {
      const server = await validateServerAuth(env, request);
      if (server instanceof Response) return server;
      const result = await runRootMcMonthlyDividendDiscordReport(env, {
        serverId: server.serverId,
        dryRun: true,
      });
      return json(result, result.ok ? 200 : 503);
    }

    if (method === "POST" && sub === "/realm/minecraft/economy/sync") {
      return handleEconomySync(request, env);
    }

    if (method === "POST" && sub === "/realm/minecraft/economy/physical-gold") {
      return handlePhysicalGoldSync(request, env);
    }

    if (method === "POST" && sub === "/realm/minecraft/economy/shop-listing") {
      return handleShopListingSync(request, env);
    }

    const discordLinkRes = await handleRootMcDiscordLinkRoutes(request, env, sub, method);
    if (discordLinkRes) return discordLinkRes;

    const rootStatRes = await handleRootStatMinecraft(request, env, sub, method);
    if (rootStatRes) return rootStatRes;

    const economyServerRes = await handleRootMcEconomyServer(request, env, sub, method);
    if (economyServerRes) return economyServerRes;

    const treasuryPublicRes = await handleTreasuryPublicRoutes(request, env, sub, method);
    if (treasuryPublicRes) return treasuryPublicRes;

    const govSub = sub.replace(/^\//, "");
    const governanceWebRes = await handleGovernanceWebRoutes(request, env, govSub, method);
    if (governanceWebRes) return governanceWebRes;

    const governanceRes = await handleGovernanceRoutes(request, env, govSub, method);
    if (governanceRes) return governanceRes;

    const paperTokenRes = await handlePaperTokenRoutes(request, env, sub, method);
    if (paperTokenRes) return paperTokenRes;

    const valueRes = await handleItemValueRoute(request, env, sub, method);
    if (valueRes) return valueRes;

    const serverRes = await handleRootMcServer(request, env, sub, method);
    if (serverRes) return serverRes;

    return json({ detail: "Not Found" }, 404);
  } finally {
    bindCorsRequest(undefined);
  }
}
