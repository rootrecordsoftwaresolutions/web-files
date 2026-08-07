import axios from "axios";
import { Capacitor } from "@capacitor/core";

// Native Android (Capacitor): shared primary. Product web (Pages): token API shard.
const PRIMARY_BACKEND = "https://api.rootrecord.info";
const SHARD_WEB_BACKEND = "https://rootrecord-api-token.rootrecord.workers.dev";

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

const fromEnv = normalizeBackendBase(process.env.REACT_APP_RR_BACKEND_URL);
const useProdFallback =
  process.env.NODE_ENV === "production" && fromEnv && isLocalDevBackend(fromEnv);
const BACKEND = useProdFallback ? PRIMARY_BACKEND : fromEnv || defaultBackend();
const API_BASE = `${BACKEND}/api`;

export const rrApi = axios.create({ baseURL: API_BASE, timeout: 25000 });

const TOKEN_KEY = "rrtm_rr_token";
const DEVICE_ID_KEY = "rrtm_rr_device_id";

/** Ecosystem id used by per-app server endpoints (version policy, developer messages, feedback). */
export const RR_APP_ID = String(process.env.REACT_APP_RR_APP_ID || "rootrecord_token_manager_android");

export function getRrToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setRrToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Stable per-install id sent as `device_id` on login/signup (RootRecord Worker requires it). */
export function getRrDeviceId() {
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

rrApi.interceptors.request.use((cfg) => {
  const t = getRrToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export function formatRrApiError(err) {
  const d = err?.response?.data?.detail;
  if (d !== undefined && d !== null && d !== "") {
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" · ");
    return String(d);
  }
  const code = err?.code;
  if (code === "ECONNABORTED") return "Request timed out. Check your connection and try again.";
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

export function listDeveloperMessages() {
  return rrApi.get("/mobile/developer-messages", { params: { app_id: RR_APP_ID } });
}

export function getMobileVersionPolicy() {
  return rrApi.get("/mobile/version-policy", { params: { app_id: RR_APP_ID } });
}

export function sendFeedback(body) {
  return rrApi.post("/feedback", body);
}

/** Re-sync plan after Play purchase / Stripe (same as Account Hub + Business Manager). */
export function refreshEntitlement() {
  return rrApi.post("/auth/entitlement", { device_id: getRrDeviceId() });
}

export function getMyInternalWallet() {
  return rrApi.get("/solana/my-wallet");
}

export function createMyInternalWallet() {
  return rrApi.post("/solana/my-wallet", {});
}

/**
 * Report a Solana tool action to RootRecord (Discord). Requires RR login (Bearer).
 * Fire-and-forget; never throws to callers.
 */
export function reportSolanaToolActivity(payload) {
  const t = getRrToken();
  if (!t) return Promise.resolve();
  const body = {
    action: String(payload?.action || "").slice(0, 96),
    wallet: payload?.wallet != null ? String(payload.wallet).trim().slice(0, 44) : undefined,
    signature: payload?.signature != null ? String(payload.signature).trim().slice(0, 128) : undefined,
    summary: payload?.summary != null ? String(payload.summary).trim().slice(0, 500) : undefined,
    cluster: payload?.cluster != null ? String(payload.cluster).trim().slice(0, 32) : undefined,
    metadata:
      payload?.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
        ? payload.metadata
        : undefined,
  };
  if (!body.action) return Promise.resolve();
  return rrApi.post("/solana/activity", body).catch(() => {});
}

