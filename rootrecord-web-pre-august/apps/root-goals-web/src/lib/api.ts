import { Capacitor } from "@capacitor/core";
import { getGuestId } from "./guest";

const GOALS_API_CUSTOM = "https://api-goals.rootrecord.info/api";
const GOALS_API_WORKERS = "https://rootrecord-api-goals.rootrecord.workers.dev/api";

export const RR_APP_ID =
  (import.meta.env.VITE_RR_APP_ID as string | undefined)?.trim() ||
  (Capacitor.isNativePlatform?.() ? "rootrecord_goals_android" : "rootrecord_goals_web");

function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
}

function normalizeApiBase(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  if (!base.endsWith("/api")) base = `${base}/api`;
  return base;
}

function useSameOriginGoalsApi(): boolean {
  if (isNativeAndroid() || typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "goals.rootrecord.info" || host.endsWith(".rootrecord-goals-web.pages.dev");
}

function apiBaseCandidates(): string[] {
  const env = (import.meta.env.VITE_GOALS_API_BASE as string | undefined)?.trim();
  const list: string[] = [];
  if (env) list.push(normalizeApiBase(env));
  if (useSameOriginGoalsApi() && typeof window !== "undefined") {
    list.push(normalizeApiBase(`${window.location.origin}/api`));
  }
  list.push(GOALS_API_CUSTOM, GOALS_API_WORKERS);
  return Array.from(new Set(list));
}

function apiOrigin(): string {
  return apiBaseCandidates()[0]!.replace(/\/api\/?$/, "") || GOALS_API_CUSTOM.replace(/\/api\/?$/, "");
}

function authHeaders(hasJsonBody: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "X-Guest-Id": getGuestId(),
    "X-RR-App-Id": RR_APP_ID,
  };
  if (hasJsonBody) h["Content-Type"] = "application/json";
  const token = localStorage.getItem("rg_token");
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function formatFetchError(e: unknown): Error {
  if (e instanceof TypeError && /fetch/i.test(e.message)) {
    if (isNativeAndroid()) {
      return new Error("Could not reach the server. Check your connection and try again.");
    }
    return new Error(
      "Could not reach the server. Try reloading, or if you use Brave, lower Shields for this site.",
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const hasJsonBody =
    init.body != null &&
    init.body !== "" &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams);
  const headers = {
    ...authHeaders(hasJsonBody),
    ...(init.headers as Record<string, string> | undefined),
  };
  const bases = apiBaseCandidates();
  let lastError: unknown = null;
  let lastResponse: Response | null = null;
  for (let i = 0; i < bases.length; i++) {
    const url = `${bases[i]!.replace(/\/$/, "")}${p}`;
    const isLast = i === bases.length - 1;
    try {
      const res = await fetch(url, {
        ...init,
        headers,
        credentials: isNativeAndroid() ? "omit" : "same-origin",
      });
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
  throw formatFetchError(lastError);
}

export function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem("rg_token"));
}

export function logoutLocal(): void {
  localStorage.removeItem("rg_token");
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  logoutLocal();
}

export async function loadDraft(): Promise<Record<string, unknown> | null> {
  const res = await apiFetch("/onboarding/draft");
  const data = await parseJson(res);
  if (!res.ok) return null;
  return (data.draft as Record<string, unknown>) || null;
}

export async function saveDraft(draft: Record<string, unknown>): Promise<void> {
  const res = await apiFetch("/onboarding/draft", { method: "PUT", body: JSON.stringify({ draft }) });
  if (!res.ok) throw new Error(String((await parseJson(res)).detail || res.statusText));
}

export async function login(email: string, password: string): Promise<void> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_id: getGuestId(), app_id: RR_APP_ID }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "Login failed"));
  const token = String(data.token || data.access_token || "");
  if (token) localStorage.setItem("rg_token", token);
}

export async function signup(email: string, password: string): Promise<void> {
  const res = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, device_id: getGuestId(), app_id: RR_APP_ID }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "Signup failed"));
  const token = String(data.token || data.access_token || "");
  if (token) localStorage.setItem("rg_token", token);
}

export async function finalizeOnboarding(draft: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await apiFetch("/onboarding/finalize", {
    method: "POST",
    body: JSON.stringify({ draft }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "Could not create goal"));
  return data;
}

export async function listCategories(): Promise<Array<{ id: string; name: string }>> {
  const res = await apiFetch("/categories");
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "Categories failed"));
  return (data.categories as Array<{ id: string; name: string }>) || [];
}

export async function createCategory(name: string): Promise<{ id: string; name: string }> {
  const res = await apiFetch("/categories", { method: "POST", body: JSON.stringify({ name }) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "Could not add category"));
  return (data.category as { id: string; name: string }) || { id: "", name };
}

export async function listGoals(): Promise<{ goals: Array<Record<string, unknown>>; limits: Record<string, unknown> }> {
  const res = await apiFetch("/goals");
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "Goals failed"));
  return { goals: (data.goals as Array<Record<string, unknown>>) || [], limits: (data.limits as Record<string, unknown>) || {} };
}

export async function getGoal(id: string): Promise<Record<string, unknown>> {
  const res = await apiFetch(`/goals/${id}`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "Goal not found"));
  return data;
}

export async function patchGoal(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await apiFetch(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "Update failed"));
  return data;
}

export async function refreshGoalAi(id: string): Promise<Record<string, unknown>> {
  const res = await apiFetch(`/goals/${id}/ai-refresh`, { method: "POST" });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.detail || "AI refresh failed"));
  return data;
}

export async function deleteAction(goalId: string, actionId: string): Promise<void> {
  const res = await apiFetch(`/goals/${goalId}/actions/${actionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(String((await parseJson(res)).detail || "Delete failed"));
}

export async function deleteSuggestion(goalId: string, suggestionId: string): Promise<void> {
  const res = await apiFetch(`/goals/${goalId}/suggestions/${suggestionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(String((await parseJson(res)).detail || "Delete failed"));
}

export async function addAchievement(goalId: string, title: string): Promise<void> {
  const res = await apiFetch(`/goals/${goalId}/achievements`, { method: "POST", body: JSON.stringify({ title }) });
  if (!res.ok) throw new Error(String((await parseJson(res)).detail || "Failed"));
}

export async function patchAchievement(goalId: string, achievementId: string, body: Record<string, unknown>): Promise<void> {
  const res = await apiFetch(`/goals/${goalId}/achievements/${achievementId}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String((await parseJson(res)).detail || "Failed"));
}

export async function addEntry(goalId: string, kind: string, body: string, amountCents?: number | null): Promise<void> {
  const res = await apiFetch(`/goals/${goalId}/entries`, {
    method: "POST",
    body: JSON.stringify({ kind, body, amount_cents: amountCents ?? null }),
  });
  if (!res.ok) throw new Error(String((await parseJson(res)).detail || "Failed"));
}

export async function fetchPublicGoals(address: string, slug?: string): Promise<Record<string, unknown>> {
  const path = slug
    ? `/public/${encodeURIComponent(address)}/goals/${encodeURIComponent(slug)}`
    : `/public/${encodeURIComponent(address)}/goals`;
  const url = isNativeAndroid() ? `${GOALS_API_CUSTOM.replace(/\/api\/?$/, "")}${path}` : `${apiOrigin()}${path}`;
  try {
    const res = await fetch(url);
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (e) {
    throw formatFetchError(e);
  }
}

export function estimateCompletionDate(minDays: number | null, maxDays: number | null): string | null {
  if (minDays == null && maxDays == null) return null;
  const lo = Math.max(0, minDays ?? 0);
  const hi = Math.max(lo, maxDays ?? lo);
  const mid = Math.round((lo + hi) / 2);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + mid);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
