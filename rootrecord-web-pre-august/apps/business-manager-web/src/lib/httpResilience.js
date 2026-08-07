/**
 * Axios resilience: exponential backoff retries for flaky mobile networks and Cloudflare edge.
 * Retries only safe/idempotent methods (GET/HEAD/DELETE/PATCH) on transient failures.
 */

function isTransientError(err) {
  const c = err?.code;
  if (c === "ERR_NETWORK" || c === "ECONNABORTED" || c === "ETIMEDOUT") return true;
  const st = err?.response?.status;
  if (st === 502 || st === 503 || st === 504) return true;
  if (st === 429) return true;
  return false;
}

function methodAllowsAutoRetry(cfg) {
  const m = String(cfg.method || "get").toLowerCase();
  return m === "get" || m === "head" || m === "delete" || m === "patch";
}

function setNoCacheHeader(cfg) {
  const h = cfg.headers;
  // Never replace with `{ Cache-Control }` only — axios defaults (Accept, serializers) live on AxiosHeaders.
  if (!h) return;
  if (typeof h.set === "function") {
    if (!h.get("Cache-Control")) h.set("Cache-Control", "no-cache");
  } else if (typeof h === "object" && !Object.prototype.hasOwnProperty.call(h, "Cache-Control")) {
    h["Cache-Control"] = "no-cache";
  }
}

/**
 * @param {import('axios').AxiosInstance} axiosInstance
 * @param {{ maxRetries?: number }} [opts]
 */
export function attachAxiosNetworkResilience(axiosInstance, opts = {}) {
  const maxRetries = Math.min(6, Math.max(1, Number(opts.maxRetries) || 3));

  axiosInstance.interceptors.request.use((cfg) => {
    setNoCacheHeader(cfg);
    return cfg;
  });

  axiosInstance.interceptors.response.use(
    (r) => r,
    async (err) => {
      const cfg = err.config;
      if (!cfg || !methodAllowsAutoRetry(cfg)) return Promise.reject(err);
      if (!isTransientError(err)) return Promise.reject(err);

      const prev = Number(cfg.__rrNetRetry) || 0;
      if (prev >= maxRetries) return Promise.reject(err);
      cfg.__rrNetRetry = prev + 1;

      const base = 450 * 2 ** (cfg.__rrNetRetry - 1);
      const delay = Math.min(10_000, base) + Math.floor(Math.random() * 280);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return axiosInstance.request(cfg);
    },
  );
}
