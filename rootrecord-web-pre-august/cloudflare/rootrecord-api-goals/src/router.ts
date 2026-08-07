import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";

import { handleAppSessionStartRoute } from "../../rootrecord-api-account/src/app-session-notify";
import { scheduleAuthLoginDiscordSessionNotify } from "../../shared/discord-app-session-notify";
import { bindCorsRequest, cors, json } from "./cors";
import { resolveUserId } from "./auth";
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
import {
  handleAchievementById,
  handleCategories,
  handleCategoryById,
  handleEntryById,
  handleGoalAchievements,
  handleGoalActionById,
  handleGoalActions,
  handleGoalAiRefresh,
  handleGoalById,
  handleGoalEntries,
  handleGoalSuggestionById,
  handleGoalSuggestions,
  handleGoalsList,
  handleOnboardingDraft,
  handleOnboardingFinalize,
} from "./goals";
import { AI_DISCLAIMER } from "./goals-ai";
import { handlePublicGoals } from "./goals-public";
import { FREE_MAX_GOALS, MEMBER_MAX_GOALS } from "./goals-limits";

export interface Env extends AuthEnv {
  DB: D1Database;
  SITE_URL: string;
  WORKER_SHARD?: string;
  GROK_API_BEARER_TOKEN?: string;
  GROK_X_BEARER_TOKEN?: string;
  GROK_API_URL?: string;
  GROK_MODEL?: string;
  DISCORD_APP_SESSION_WEBHOOK_URL?: string;
  DISCORD_APP_SESSION_CHANNEL_ID?: string;
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTGOALS_AI_COPY_CHANNEL_ID?: string;
  DISCORD_ROOTGOALS_AI_RAW_ARCHIVE_CHANNEL_ID?: string;
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

function guestIdFromRequest(request: Request): string {
  return (request.headers.get("X-Guest-Id") || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function licenseDeviceId(creds: { device_id?: string }, request: Request): string | null {
  const fromBody = String(creds.device_id || "").trim();
  if (fromBody) return fromBody.slice(0, 128);
  const guest = guestIdFromRequest(request);
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
      service: "rootrecord-api-goals",
      site_url: env.SITE_URL,
    },
    200,
  );
}

async function resolveGoalsUser(request: Request, env: Env): Promise<string | Response> {
  return resolveUserId(request, env);
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

    const publicMatch = pathname.match(/^\/public\/([^/]+)\/goals(?:\/([^/]+))?$/);
    if (method === "GET" && publicMatch) {
      return handlePublicGoals(env, publicMatch[1], publicMatch[2]);
    }

    if (!pathname.startsWith("/api")) {
      if (method === "GET" && (pathname === "/" || pathname === "/health")) {
        return healthJson(env);
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
        const meta = buildSessionInsertMeta(request, licenseDeviceId(creds, request)!);
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
        const meta = buildSessionInsertMeta(request, licenseDeviceId(creds, request)!);
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
    const guestId = guestIdFromRequest(request);

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

    const publicApiMatch = sub.match(/^\/public\/goals\/([^/]+)(?:\/([^/]+))?$/);
    if (method === "GET" && publicApiMatch) {
      return handlePublicGoals(env, publicApiMatch[1], publicApiMatch[2]);
    }

    if ((method === "GET" || method === "PUT") && sub === "/onboarding/draft") {
      const uid = await resolveGoalsUser(request, env);
      if (uid instanceof Response) return uid;
      return handleOnboardingDraft(request, env, uid, guestId);
    }

    if (method === "POST" && sub === "/onboarding/finalize") {
      const uid = await resolveGoalsUser(request, env);
      if (uid instanceof Response) return uid;
      return handleOnboardingFinalize(request, env, uid, guestId, ctx);
    }

    const uid = await resolveGoalsUser(request, env);
    if (uid instanceof Response) return uid;

    if (sub === "/categories") {
      return handleCategories(request, env, uid);
    }

    const categoryMatch = sub.match(/^\/categories\/([^/]+)$/);
    if (categoryMatch) {
      return handleCategoryById(request, env, uid, categoryMatch[1]);
    }

    if (sub === "/goals") {
      return handleGoalsList(request, env, uid, ctx);
    }

    const goalActionMatch = sub.match(/^\/goals\/([^/]+)\/actions(?:\/([^/]+))?$/);
    if (goalActionMatch) {
      if (goalActionMatch[2]) {
        return handleGoalActionById(request, env, uid, goalActionMatch[1], goalActionMatch[2]);
      }
      return handleGoalActions(request, env, uid, goalActionMatch[1]);
    }

    const goalSuggestionMatch = sub.match(/^\/goals\/([^/]+)\/suggestions(?:\/([^/]+))?$/);
    if (goalSuggestionMatch) {
      if (goalSuggestionMatch[2]) {
        return handleGoalSuggestionById(request, env, uid, goalSuggestionMatch[1], goalSuggestionMatch[2]);
      }
      return handleGoalSuggestions(request, env, uid, goalSuggestionMatch[1]);
    }

    const achievementMatch = sub.match(/^\/goals\/([^/]+)\/achievements\/([^/]+)$/);
    if (achievementMatch) {
      return handleAchievementById(request, env, uid, achievementMatch[1], achievementMatch[2]);
    }

    const entryMatch = sub.match(/^\/goals\/([^/]+)\/entries\/([^/]+)$/);
    if (entryMatch) {
      return handleEntryById(request, env, uid, entryMatch[1], entryMatch[2]);
    }

    const goalMatch = sub.match(/^\/goals\/([^/]+)(?:\/(achievements|entries|ai-refresh))?$/);
    if (goalMatch) {
      const goalId = goalMatch[1];
      const action = goalMatch[2];
      if (action === "ai-refresh") return handleGoalAiRefresh(request, env, uid, goalId, ctx);
      if (action === "achievements") return handleGoalAchievements(request, env, uid, goalId);
      if (action === "entries") return handleGoalEntries(request, env, uid, goalId);
      return handleGoalById(request, env, uid, goalId);
    }

    if (method === "GET" && sub === "/mobile/config") {
      return json(
        {
          app_id: "rootrecord_goals_web",
          product: "root_goals",
          version: "1.0.8",
          release: 8,
          api_base: "https://api-goals.rootrecord.info/api",
          disclaimer: AI_DISCLAIMER,
          tiers: {
            free: { max_goals: FREE_MAX_GOALS, ai_refresh_days: 3 },
            member: { max_goals: MEMBER_MAX_GOALS, ai_refresh_per_goal_per_day: 3, ai_goals_per_day: 10 },
          },
        },
        200,
      );
    }

    return json({ detail: "Not Found" }, 404);
  } finally {
    bindCorsRequest(undefined);
  }
}
