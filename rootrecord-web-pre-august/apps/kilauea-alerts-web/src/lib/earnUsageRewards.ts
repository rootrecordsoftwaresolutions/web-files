/**
 * Periodic Root Units accrual while signed in (`POST /api/earn/heartbeat`) + daily check-in.
 * Server enforces caps; Token Manager should not call this hook.
 */
const HEARTBEAT_MS = 25_000;

type EarnApi = {
  post: (path: string, body: Record<string, unknown>) => Promise<{ data?: { ok?: boolean } }>;
};

type EarnUsageOpts = {
  appId: string;
  getToken: () => string;
  getPage?: () => string;
  enabled?: boolean;
};

function checkinStorageKey(appId: string) {
  return `rr.earn.checkin.${String(appId || "").trim()}`;
}

function todayUtcYmd() {
  return new Date().toISOString().slice(0, 10);
}

function defaultPagePath() {
  if (typeof window === "undefined") return "/";
  return window.location?.pathname || "/";
}

export function startEarnUsageRewards(api: EarnApi, opts: EarnUsageOpts) {
  const appId = String(opts?.appId || "").trim();
  const getToken = opts?.getToken;
  const getPage = opts?.getPage || defaultPagePath;
  if (!appId || opts?.enabled === false) return () => {};

  let stopped = false;
  let timer = null;

  const runCheckin = async () => {
    if (stopped || !getToken?.()) return;
    try {
      const key = checkinStorageKey(appId);
      const ymd = todayUtcYmd();
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key) === ymd) return;
      const { data } = await api.post("/earn/checkin", { app_id: appId });
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
      await api.post("/earn/heartbeat", { app_id: appId, page: getPage() });
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
