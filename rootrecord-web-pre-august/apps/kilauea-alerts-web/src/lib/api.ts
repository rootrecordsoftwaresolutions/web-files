/**
 * Kīlauea web → `rootrecord-api-kilauea` only. Same session model as Weather/Business web:
 * HttpOnly `rr_web_session` on `.rootrecord.info` + Bearer in localStorage for API calls.
 */
import { ensureGuestId } from "../guest";

const STORAGE = {
  token: "rrkil.token",
  email: "rrkil.email",
  pro: "rrkil.pro",
  life: "rrkil.life",
} as const;

const WORKERS_DEV = "https://rootrecord-api-kilauea.rootrecord.workers.dev";
const ROOTRECORD_INFO_API = "https://api-kilauea.rootrecord.info";

export const RR_APP_ID = "rootrecord_kilauea_alerts_android";

function normalizeOrigin(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  if (base.toLowerCase().endsWith("/api")) base = base.slice(0, -4).replace(/\/+$/, "");
  return base;
}

/** API origin without `/api` suffix. */
export function getApiOrigin(): string {
  const env = (import.meta.env.VITE_ROOTRECORD_API_ORIGIN as string | undefined)?.trim();
  if (env) return normalizeOrigin(env);
  return ROOTRECORD_INFO_API;
}

function apiOrigins(): string[] {
  const primary = getApiOrigin();
  return Array.from(new Set([primary, ROOTRECORD_INFO_API, WORKERS_DEV].map(normalizeOrigin)));
}

async function fetchApiPath(path: string, init: RequestInit): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origins = apiOrigins();
  let lastError: unknown = null;
  let lastResponse: Response | null = null;
  for (let i = 0; i < origins.length; i++) {
    const origin = origins[i]!;
    const isLast = i === origins.length - 1;
    try {
      const res = await fetch(`${origin}${p}`, { ...init, credentials: "include" });
      if (res.ok) return res;
      if (!isLast && (res.status === 404 || res.status >= 502)) {
        lastResponse = res;
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("Failed to fetch");
}

export function getStoredToken(): string | null {
  try {
    const t = localStorage.getItem(STORAGE.token);
    return t && t.length > 8 ? t : null;
  } catch {
    return null;
  }
}

export function getStoredEmail(): string {
  try {
    return localStorage.getItem(STORAGE.email) || "";
  } catch {
    return "";
  }
}

export function isAuthed(): boolean {
  return Boolean(getStoredToken());
}

function storedTruthy(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function accessFromPayload(data: Record<string, unknown>): { pro: boolean; life: boolean } {
  const access = data.access && typeof data.access === "object" ? (data.access as Record<string, unknown>) : {};
  const raw = data.raw && typeof data.raw === "object" ? (data.raw as Record<string, unknown>) : {};
  const rawAccess = raw.access && typeof raw.access === "object" ? (raw.access as Record<string, unknown>) : {};
  const tier = String(data.tier || data.plan || access.tier || raw.tier || raw.plan || rawAccess.tier || "").trim().toLowerCase();
  const subscriptionStatus = String(data.subscription_status || data.subscriptionStatus || raw.subscription_status || "").trim().toLowerCase();
  const life =
    storedTruthy(data.life_member) ||
    storedTruthy(data.lifeMember) ||
    storedTruthy(data.lifetime_member) ||
    storedTruthy(data.lifetimeMember) ||
    storedTruthy(data.lifetime) ||
    storedTruthy(access.life_member) ||
    storedTruthy(access.lifeMember) ||
    storedTruthy(raw.life_member) ||
    storedTruthy(raw.lifeMember) ||
    storedTruthy(rawAccess.life_member) ||
    storedTruthy(rawAccess.lifeMember) ||
    tier === "life" ||
    tier === "lifetime";
  const pro =
    life ||
    storedTruthy(data.pro_unlocked) ||
    storedTruthy(data.proUnlocked) ||
    storedTruthy(data.pro) ||
    storedTruthy(access.pro_unlocked) ||
    storedTruthy(access.proUnlocked) ||
    storedTruthy(raw.pro_unlocked) ||
    storedTruthy(raw.proUnlocked) ||
    storedTruthy(rawAccess.pro_unlocked) ||
    storedTruthy(rawAccess.proUnlocked) ||
    tier === "pro" ||
    tier === "premium" ||
    tier === "paid" ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing";
  return { pro, life };
}

export function isPro(): boolean {
  try {
    return storedTruthy(localStorage.getItem(STORAGE.pro));
  } catch {
    return false;
  }
}

export function isLifeMember(): boolean {
  try {
    return storedTruthy(localStorage.getItem(STORAGE.life));
  } catch {
    return false;
  }
}

export function setSession(token: string, email: string, pro?: unknown, lifeMember?: unknown): void {
  const life = storedTruthy(lifeMember);
  const paid = life || storedTruthy(pro);
  try {
    localStorage.setItem(STORAGE.token, token);
    localStorage.setItem(STORAGE.email, email);
    localStorage.setItem(STORAGE.pro, paid ? "1" : "0");
    localStorage.setItem(STORAGE.life, life ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE.token);
    localStorage.removeItem(STORAGE.email);
    localStorage.removeItem(STORAGE.pro);
    localStorage.removeItem(STORAGE.life);
  } catch {
    /* ignore */
  }
}

/** `path` must start with `/api/…`. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const guest = ensureGuestId();
  const headers = new Headers(init.headers);
  headers.set("X-Guest-Id", guest);
  const t = getStoredToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  return fetchApiPath(path, { ...init, headers });
}

async function apiFetchNoBearer(path: string, init: RequestInit = {}): Promise<Response> {
  const guest = ensureGuestId();
  const headers = new Headers(init.headers);
  headers.set("X-Guest-Id", guest);
  return fetchApiPath(path, { ...init, headers });
}

async function applyAuthMeResponse(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  const data = (await res.json()) as Record<string, unknown>;
  const tok = String(data.access_token || data.token || "").trim();
  const email = String(data.email || "").trim();
  if (!tok || !email) return false;
  const access = accessFromPayload(data);
  setSession(tok, email, access.pro, access.life);
  return true;
}

/**
 * Hydrate from Bearer (if any) + HttpOnly cookie. If a stale Bearer fails but a valid SSO cookie exists,
 * clears local token and retries once without Authorization.
 */
export async function tryHydrateSessionFromCookie(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    let res = await apiFetch("/api/auth/me", { method: "POST" });
    if (await applyAuthMeResponse(res)) return true;
    if (res.status === 401 && getStoredToken()) {
      clearSession();
      res = await apiFetchNoBearer("/api/auth/me", { method: "POST" });
      return applyAuthMeResponse(res);
    }
    return false;
  } catch {
    return false;
  }
}

export async function loginRequest(email: string, password: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const res = await apiFetchNoBearer("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      password,
      device_id: ensureGuestId(),
    }),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : text.slice(0, 200) || res.statusText;
    return { ok: false, detail };
  }
  const tok = String(data.access_token || data.token || "").trim();
  const emailOut = String(data.email || email).trim();
  if (!tok || !emailOut) return { ok: false, detail: "Invalid response from server." };
  const access = accessFromPayload(data);
  setSession(tok, emailOut, access.pro, access.life);
  return { ok: true };
}

export async function signupRequest(email: string, password: string, name?: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const res = await apiFetchNoBearer("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      password,
      name: name?.trim() || undefined,
      device_id: ensureGuestId(),
    }),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : text.slice(0, 200) || res.statusText;
    return { ok: false, detail };
  }
  const tok = String(data.access_token || data.token || "").trim();
  const emailOut = String(data.email || email).trim();
  if (!tok || !emailOut) return { ok: false, detail: "Invalid response from server." };
  const access = accessFromPayload(data);
  setSession(tok, emailOut, access.pro, access.life);
  return { ok: true };
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  } catch {
    /* still clear local */
  }
  clearSession();
}
