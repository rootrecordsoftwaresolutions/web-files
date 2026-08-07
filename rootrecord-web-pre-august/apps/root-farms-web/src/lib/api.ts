/**
 * Root Farms → `rootrecord-api-account` (auth + earn summary).
 */
import { clearEntitlement, setEntitlementFromAuthPayload } from "./entitlement";
import { ensureGuestId } from "../guest";

const STORAGE = {
  token: "rrfarms.token",
  email: "rrfarms.email",
  accountVerified: "rrfarms.accountVerified",
} as const;

/** Farms + earn + auth for this app live on the account shard (not legacy `api.rootrecord.info` / primary). */
const ACCOUNT_API = "https://rootrecord-api-account.rootrecord.workers.dev";
const FETCH_TIMEOUT_MS = 25_000;

type CapacitorWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

function isNativePlatform(): boolean {
  try {
    return typeof window !== "undefined" && Boolean((window as CapacitorWindow).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function normalizeOrigin(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  if (base.toLowerCase().endsWith("/api")) base = base.slice(0, -4).replace(/\/+$/, "");
  return base;
}

export function getApiOrigin(): string {
  const env = (import.meta.env.VITE_ROOTRECORD_API_ORIGIN as string | undefined)?.trim();
  if (env) return normalizeOrigin(env);
  return ACCOUNT_API;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
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

export function getStoredAccountVerified(): boolean {
  try {
    return localStorage.getItem(STORAGE.accountVerified) === "1";
  } catch {
    return false;
  }
}

export function isAuthed(): boolean {
  return Boolean(getStoredToken());
}

export function setSession(token: string, email: string): void {
  try {
    localStorage.setItem(STORAGE.token, token);
    localStorage.setItem(STORAGE.email, email);
  } catch {
    /* */
  }
}

function setAccountVerifiedFromPayload(data: Record<string, unknown>): void {
  try {
    localStorage.setItem(STORAGE.accountVerified, data.account_verified ? "1" : "0");
  } catch {
    /* */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE.token);
    localStorage.removeItem(STORAGE.email);
    localStorage.removeItem(STORAGE.accountVerified);
  } catch {
    /* */
  }
  clearEntitlement();
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Guest-Id", ensureGuestId());
  const t = getStoredToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const url = `${getApiOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
  const credentials = isNativePlatform() ? ("omit" as RequestCredentials) : "include";
  return fetchWithTimeout(url, { ...init, headers, credentials });
}

export async function apiFetchNoBearer(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Guest-Id", ensureGuestId());
  const url = `${getApiOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
  const credentials = isNativePlatform() ? ("omit" as RequestCredentials) : "include";
  return fetchWithTimeout(url, { ...init, headers, credentials });
}

async function applyAuthMeResponse(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  const data = (await res.json()) as Record<string, unknown>;
  const tok = String(data.access_token || data.token || "").trim();
  const email = String(data.email || "").trim();
  if (!tok || !email) return false;
  setSession(tok, email);
  setAccountVerifiedFromPayload(data);
  setEntitlementFromAuthPayload(data);
  return true;
}

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

async function authPost(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  let res: Response;
  try {
    res = await apiFetchNoBearer(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Could not reach the server.";
    return { ok: false, detail };
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* */
  }
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : text.slice(0, 200) || res.statusText;
    return { ok: false, detail };
  }
  const tok = String(data.access_token || data.token || "").trim();
  const emailOut = String(data.email || (typeof body.email === "string" ? body.email : "")).trim();
  if (!tok || !emailOut) return { ok: false, detail: "Invalid response from server." };
  setSession(tok, emailOut);
  setAccountVerifiedFromPayload(data);
  setEntitlementFromAuthPayload(data);
  try {
    await applyAuthMeResponse(await apiFetch("/api/auth/me", { method: "POST" }));
  } catch {
    /* Login/signup response is still enough to start the session. */
  }
  return { ok: true };
}

export async function loginRequest(email: string, password: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  return authPost("/api/auth/login", {
    email: email.trim(),
    password,
    device_id: ensureGuestId(),
  });
}

export async function signupRequest(
  email: string,
  password: string,
  name?: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const body: Record<string, unknown> = {
    email: email.trim(),
    password,
    device_id: ensureGuestId(),
  };
  const trimmedName = name?.trim();
  if (trimmedName) body.name = trimmedName;
  return authPost("/api/auth/signup", body);
}

export async function requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  let res: Response;
  try {
    res = await apiFetchNoBearer("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach the server." };
  }
  if (res.ok) return { ok: true };
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* */
  }
  return { ok: false, detail: String(data.detail || text || res.statusText) };
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  let res: Response;
  try {
    res = await apiFetchNoBearer("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        code: code.trim(),
        new_password: newPassword,
        device_id: ensureGuestId(),
      }),
    });
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach the server." };
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* */
  }
  if (!res.ok) return { ok: false, detail: String(data.detail || text || res.statusText) };
  const tok = String(data.access_token || data.token || "").trim();
  const emailOut = String(data.email || email).trim();
  if (tok && emailOut) {
    setSession(tok, emailOut);
    setAccountVerifiedFromPayload({ ...data, account_verified: true });
    setEntitlementFromAuthPayload(data);
  }
  return { ok: true };
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  } catch {
    /* */
  }
  clearSession();
}

export type EarnSummary = {
  /** Spendable balance in D1 (`rr_earn_balance`) — not `balance_display` / custodial totals. */
  ledger_balance: number;
  root_units: number;
  daily_remaining?: number;
  daily_cap?: number;
};

/** Parse headline Root Units from `/earn/summary` (Discord `/bal` total — not `custodial_pending_units`). */
export function parseLedgerBalanceFromSummary(data: Record<string, unknown>): number {
  const keys = ["ledger_balance", "root_units_balance", "balance", "total_rewards_units", "root_units"] as const;
  for (const key of keys) {
    const n = Number(data[key]);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

export async function fetchEarnSummary(opts?: { skipCustodialRefresh?: boolean }): Promise<EarnSummary | null> {
  const q = new URLSearchParams({ app_id: "root_farms" });
  if (opts?.skipCustodialRefresh !== false) {
    q.set("custodial_refresh", "0");
  }
  const res = await apiFetch(`/api/earn/summary?${q}`, { method: "GET", cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const ledger_balance = parseLedgerBalanceFromSummary(data);
  return {
    ledger_balance,
    root_units: ledger_balance,
    daily_remaining: data.daily_remaining != null ? Math.floor(Number(data.daily_remaining)) : undefined,
    daily_cap: data.daily_cap != null ? Math.floor(Number(data.daily_cap)) : undefined,
  };
}
