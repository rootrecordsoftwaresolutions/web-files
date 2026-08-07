import { getApiOrigin, getStoredToken } from "./api";
import { ensureGuestId } from "../guest";

export const FARMS_APP_ID = "root_farms";

const ACCOUNT_API_FALLBACK = "https://rootrecord-api-account.rootrecord.workers.dev";

function sessionNotifyOrigin(): string {
  if (typeof window !== "undefined") {
    const h = window.location.hostname.toLowerCase();
    if (h === "rootrecord.info" || h.endsWith(".rootrecord.info")) {
      return window.location.origin.replace(/\/+$/, "");
    }
  }
  const env = (import.meta.env.VITE_ROOTRECORD_API_ORIGIN as string | undefined)?.trim();
  if (env) return env.replace(/\/+$/, "").replace(/\/api$/i, "");
  const fromApi = getApiOrigin();
  return fromApi || ACCOUNT_API_FALLBACK;
}

/** Once per tab session — Discord app-session webhook on account Worker. */
export function notifyFarmsSessionStart(betaTester: boolean): void {
  const apiOrigin = sessionNotifyOrigin();
  const appId = FARMS_APP_ID;
  try {
    if (typeof sessionStorage !== "undefined") {
      const key = `rr.app_session_notify.${appId}.${betaTester ? "beta" : "acct"}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    }
  } catch {
    /* ignore */
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const guestId = ensureGuestId();
  if (guestId) headers["X-Guest-Id"] = guestId;
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  void fetch(`${apiOrigin}/api/app-session/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      app_id: appId,
      mode: betaTester ? "beta_tester" : "signed_in",
    }),
    credentials: "include",
  }).catch(() => {
    /* play must not depend on Discord */
  });
}
