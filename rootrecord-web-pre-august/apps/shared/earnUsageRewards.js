/**
 * Periodic Root Units accrual while signed in (`POST /api/earn/heartbeat`) + daily check-in.
 * Server enforces caps; Token Manager should not call this hook.
 */

const HEARTBEAT_MS = 25_000;

function checkinStorageKey(appId) {
  return `rr.earn.checkin.${String(appId || "").trim()}`;
}

function todayUtcYmd() {
  return new Date().toISOString().slice(0, 10);
}

function defaultPagePath() {
  if (typeof window === "undefined") return "/";
  return window.location?.pathname || "/";
}

/**
 * @param {import('axios').AxiosInstance} api - product shard client (`/api` base)
 * @param {{ appId: string, getToken: () => string, getPage?: () => string, enabled?: boolean }} opts
 * @returns {() => void} stop
 */
export function startEarnUsageRewards(api, opts) {
  const appId = String(opts?.appId || "").trim();
  const getToken = opts?.getToken;
  const getPage = opts?.getPage || defaultPagePath;
  if (!appId || opts?.enabled === false) return () => {};

  let stopped = false;
  let timer = null;

  const postJson = async (path, body) => {
    if (typeof api.post === "function") {
      return api.post(path, body);
    }
    if (typeof api === "function") {
      const res = await api(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res?.ok) throw new Error("earn request failed");
      return { data: await res.json() };
    }
    throw new Error("earn client not configured");
  };

  const runCheckin = async () => {
    if (stopped || !getToken?.()) return;
    try {
      const key = checkinStorageKey(appId);
      const ymd = todayUtcYmd();
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key) === ymd) return;
      const { data } = await postJson("/earn/checkin", { app_id: appId });
      if (data?.ok && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(key, ymd);
      }
    } catch {
      /* offline / guest */
    }
  };

  const runHeartbeat = async () => {
    if (stopped || !getToken?.()) return;
    try {
      await postJson("/earn/heartbeat", { app_id: appId, page: getPage() });
    } catch {
      /* offline */
    }
  };

  void runCheckin();
  void runHeartbeat();
  timer = setInterval(() => {
    void runHeartbeat();
  }, HEARTBEAT_MS);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
