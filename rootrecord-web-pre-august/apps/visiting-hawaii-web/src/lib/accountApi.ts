/** RootRecord account API (sponsored listings, auth). */
export const ACCOUNT_API_BASE =
  (import.meta.env.VITE_ACCOUNT_API_BASE as string | undefined)?.replace(/\/+$/, "") ||
  "https://rootrecord-api-account.rootrecord.workers.dev";

export function accountApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${ACCOUNT_API_BASE}${p}`;
}

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rootrecord_portal_token");
}

export function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getPortalToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
