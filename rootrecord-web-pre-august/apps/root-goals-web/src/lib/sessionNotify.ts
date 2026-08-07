import { Capacitor } from "@capacitor/core";

import { RR_APP_ID } from "./api";
import { getGuestId } from "./guest";

/** Account shard — same as Weather/Kīlauea session notify. */
export const ROOTRECORD_ACCOUNT_API_ORIGIN =
  "https://rootrecord-api-account.rootrecord.workers.dev";

const GOALS_API_ORIGIN = "https://api-goals.rootrecord.info";

function sessionNotifyOrigin(): string {
  if (Capacitor.isNativePlatform?.()) {
    return GOALS_API_ORIGIN;
  }
  if (typeof window !== "undefined") {
    const h = window.location.hostname.toLowerCase();
    if (h === "goals.rootrecord.info" || h.endsWith(".rootrecord-goals-web.pages.dev")) {
      return window.location.origin.replace(/\/+$/, "");
    }
    if (h === "rootrecord.info" || h.endsWith(".rootrecord.info")) {
      return window.location.origin.replace(/\/+$/, "");
    }
  }
  return ROOTRECORD_ACCOUNT_API_ORIGIN;
}

/** Once per tab — POST /api/app-session/start (Goals Worker on native + goals subdomain; account elsewhere). */
export function notifyGoalsSessionStart(): void {
  const apiOrigin = sessionNotifyOrigin();
  const appId = RR_APP_ID;
  try {
    if (typeof sessionStorage !== "undefined") {
      const key = `rr.app_session_notify.${appId}.acct`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    }
  } catch {
    /* ignore */
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-RR-App-Id": appId,
  };
  const guestId = getGuestId();
  if (guestId) headers["X-Guest-Id"] = guestId;
  const token = localStorage.getItem("rg_token");
  if (token) headers.Authorization = `Bearer ${token}`;

  void fetch(`${apiOrigin}/api/app-session/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({ app_id: appId, mode: "signed_in" }),
    credentials: Capacitor.isNativePlatform?.() ? "omit" : "include",
  }).catch(() => {
    /* play must not depend on Discord */
  });
}
