import axios from "axios";
import { Capacitor } from "@capacitor/core";

/**
 * Account Hub — same `/api/*` routes as other RootRecord apps. Native Android uses the
 * shared primary hostname; product web (Pages) uses the account API shard.
 */
const PRIMARY_BACKEND = "https://api.rootrecord.info";
const SHARD_WEB_BACKEND = "https://rootrecord-api-account.rootrecord.workers.dev";

function defaultBackend() {
  try {
    if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform?.()) return PRIMARY_BACKEND;
  } catch {
    /* no-op */
  }
  return SHARD_WEB_BACKEND;
}

function normalizeBackendBase(raw) {
  let base = String(raw ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (!base) return "";
  if (base.toLowerCase().endsWith("/api")) {
    base = base.slice(0, -4).replace(/\/+$/, "");
  }
  return base;
}

/** Hosts that only work with a dev machine / emulator — never use in a production bundle. */
function isLocalDevBackend(base) {
  if (!base) return false;
  try {
    const withProto = /^https?:\/\//i.test(base) ? base : `http://${base}`;
    const { hostname } = new URL(withProto);
    const h = hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
    if (h === "10.0.2.2") return true; // Android emulator → host loopback
    return false;
  } catch {
    return false;
  }
}

const fromEnv = normalizeBackendBase(process.env.REACT_APP_BACKEND_URL);
const useProdFallback =
  process.env.NODE_ENV === "production" && fromEnv && isLocalDevBackend(fromEnv);
const BACKEND = useProdFallback ? PRIMARY_BACKEND : fromEnv || defaultBackend();
const API_BASE = `${BACKEND}/api`;

/** Ecosystem id used by per-app server endpoints (version policy, developer messages). */
export const RR_APP_ID = String(
  process.env.REACT_APP_RR_APP_ID || "rootrecord_account_hub_android"
);

export function isBackendConfigured() {
  return Boolean(BACKEND);
}

export const api = axios.create({ baseURL: API_BASE, timeout: 25000 });

const TOKEN_KEY = "rrah_token";
const DEVICE_ID_KEY = "rrah_device_id";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Stable per-install id sent as `device_id` on login/signup (Worker requires it). */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (id && id.length >= 8) return id;
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    id = crypto.randomUUID();
  } else {
    id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Auto-clear stale local session when the server rejects our Bearer. The Worker returns
// this exact detail string ONLY when a Bearer was present but failed to validate
// (signature mismatch, missing/revoked license_sessions row). Sign-in failures use a
// different detail, so login isn't disrupted. AuthContext listens for the dispatched
// event and drops `user`, so the AuthScreen re-renders instead of looping on 401s.
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (
      e?.response?.status === 401 &&
      e?.response?.data?.detail === "Invalid or expired session."
    ) {
      try {
        setToken("");
        window.dispatchEvent(new Event("rrah.session.invalidated"));
      } catch {
        /* ignore */
      }
    }
    return Promise.reject(e);
  }
);

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d !== undefined && d !== null && d !== "") {
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" · ");
    return String(d);
  }
  const code = err?.code;
  if (code === "ECONNABORTED") {
    return "Request timed out. Check your connection and try again.";
  }
  const msg = String(err?.message || "");
  if (code === "ERR_NETWORK" || msg.toLowerCase().includes("network error")) {
    try {
      const host = new URL(API_BASE).host;
      return `Could not reach ${host}. Check Wi‑Fi or cellular data, or try again after disabling VPN.`;
    } catch {
      return "Could not reach the server. Check your internet connection and try again.";
    }
  }
  return msg || "Something went wrong.";
}

export function getMobileVersionPolicy() {
  return api.get("/mobile/version-policy", { params: { app_id: RR_APP_ID } });
}

export function listDeveloperMessages() {
  return api.get("/mobile/developer-messages", { params: { app_id: RR_APP_ID } });
}

/** Notification / program preferences. Weather Manager already calls these. */
export function getPrefs() {
  return api.get("/me/prefs");
}
export function setPrefs(body) {
  return api.post("/me/prefs", body);
}

/** Entitlement re-check (also used by Business Manager to refresh plan after purchase). */
export function refreshEntitlement() {
  return api.post("/auth/entitlement", { device_id: getDeviceId() });
}
