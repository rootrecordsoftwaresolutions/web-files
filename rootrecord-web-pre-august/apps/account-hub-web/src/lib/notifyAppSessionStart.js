/**

 * Best-effort POST /api/app-session/start (once per browser tab session per app/mode).

 */

const ACCOUNT_API_FALLBACK = "https://rootrecord-api-account.rootrecord.workers.dev";



export function resolveAccountNotifyOrigin(preferred) {

  const fallback = String(preferred || ACCOUNT_API_FALLBACK)

    .trim()

    .replace(/\/+$/, "");

  if (typeof window !== "undefined") {

    try {

      const h = window.location.hostname.toLowerCase();

      if (h === "rootrecord.info" || h.endsWith(".rootrecord.info")) {

        return window.location.origin.replace(/\/+$/, "");

      }

    } catch {

      /* ignore */

    }

  }

  return fallback;

}



export async function notifyAppSessionStart(opts) {

  const apiOrigin = resolveAccountNotifyOrigin(opts?.apiOrigin);

  const appId = String(opts?.appId || "").trim();

  if (!apiOrigin || !appId) return;



  const betaTester = Boolean(opts.betaTester);

  try {

    if (typeof sessionStorage !== "undefined") {

      const key = `rr.app_session_notify.${appId}.${betaTester ? "beta" : "acct"}`;

      if (sessionStorage.getItem(key)) return;

      sessionStorage.setItem(key, "1");

    }

  } catch {

    /* ignore */

  }



  const headers = { "Content-Type": "application/json" };

  const guestId = String(opts.guestId || "").trim();

  if (guestId) headers["X-Guest-Id"] = guestId;

  const token = opts.getAuthToken?.();

  if (token) headers.Authorization = `Bearer ${token}`;



  try {

    await fetch(`${apiOrigin}/api/app-session/start`, {

      method: "POST",

      headers,

      body: JSON.stringify({

        app_id: appId,

        mode: betaTester ? "beta_tester" : "signed_in",

      }),

      credentials: opts.includeCredentials ? "include" : "omit",

    });

  } catch {

    /* ignore */

  }

}

