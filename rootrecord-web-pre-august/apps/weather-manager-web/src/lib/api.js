import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { attachAxiosNetworkResilience } from './httpResilience';
import { safeLocalStorage } from './storage';

// Per-product API shard `rootrecord-api-weather` (Web/cloudflare/rootrecord-api-weather).
// Native Android (Capacitor) → custom domain (no cookie concerns).
// Web → same custom domain so SSO cookies under `.rootrecord.info` work; falls back to workers.dev if Custom Domain isn't attached yet.
// Override either via REACT_APP_BACKEND_URL.
const PRIMARY_BACKEND = 'https://api-weather.rootrecord.info';
const SHARD_WEB_BACKEND = 'https://api-weather.rootrecord.info';

function isNativeAndroid() {
  try {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.();
  } catch {
    return false;
  }
}

function webBackendForProductPages() {
  return SHARD_WEB_BACKEND;
}

function defaultBackend() {
  return isNativeAndroid() ? PRIMARY_BACKEND : webBackendForProductPages();
}

function normalizeBackendBase(raw) {
  let base = String(raw ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!base) return '';
  // Avoid https://host/api + /locations → …/api/api/locations (404 / “Network Error”)
  if (base.toLowerCase().endsWith('/api')) {
    base = base.slice(0, -4).replace(/\/+$/, '');
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
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
    if (h === '10.0.2.2') return true;
    return false;
  } catch {
    return false;
  }
}

const fromEnv = normalizeBackendBase(process.env.REACT_APP_BACKEND_URL);
const useProdFallback =
  process.env.NODE_ENV === 'production' && fromEnv && isLocalDevBackend(fromEnv);
const BACKEND = useProdFallback
  ? isNativeAndroid()
    ? PRIMARY_BACKEND
    : SHARD_WEB_BACKEND
  : fromEnv || defaultBackend();
const API = `${BACKEND}/api`;

/** Ecosystem id used by per-app server endpoints (version policy, developer messages, push). */
export const RR_APP_ID = String(process.env.REACT_APP_RR_APP_ID || 'rootrecord_weather_manager_android');

export function isBackendConfigured() {
  return Boolean(BACKEND);
}

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d !== undefined && d !== null && d !== '') {
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(' · ');
    return String(d);
  }
  const code = err?.code;
  if (code === 'ECONNABORTED') {
    return 'Request timed out. Check your connection and try again.';
  }
  const msg = String(err?.message || '');
  if (code === 'ERR_NETWORK' || msg.toLowerCase().includes('network error')) {
    try {
      const host = new URL(API).host;
      return `Could not reach ${host}. Check Wi‑Fi or cellular data, or try again after disabling VPN. If this persists, reinstall from a build that uses the production API.`;
    } catch {
      return 'Could not reach the server. Check your internet connection and try again.';
    }
  }
  return msg || 'Something went wrong.';
}

const STORAGE_KEYS = {
  token: 'rrwm.token',
  email: 'rrwm.email',
  guest: 'rrwm.guestId',
  pro: 'rrwm.pro',
  life: 'rrwm.life_member',
  proCheckedAt: 'rrwm.pro_checked_at',
  units: 'rrwm.units',
  activeLocId: 'rrwm.activeLocationId',
  locationsCache: 'rrwm.locationsCache.v1',
};

const ACCESS_EVENT = 'rrwm.access.changed';

function storedTruthy(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function accessFromPayload(data) {
  const access = data?.access && typeof data.access === 'object' ? data.access : {};
  const raw = data?.raw && typeof data.raw === 'object' ? data.raw : {};
  const rawAccess = raw?.access && typeof raw.access === 'object' ? raw.access : {};
  const tier = String(data?.tier || data?.plan || access?.tier || access?.plan || raw?.tier || raw?.plan || rawAccess?.tier || '').trim().toLowerCase();
  const subscriptionStatus = String(data?.subscription_status || data?.subscriptionStatus || raw?.subscription_status || '').trim().toLowerCase();
  const life =
    storedTruthy(data?.life_member) ||
    storedTruthy(data?.lifeMember) ||
    storedTruthy(data?.lifetime_member) ||
    storedTruthy(data?.lifetimeMember) ||
    storedTruthy(data?.lifetime) ||
    storedTruthy(access?.life_member) ||
    storedTruthy(access?.lifeMember) ||
    storedTruthy(raw?.life_member) ||
    storedTruthy(raw?.lifeMember) ||
    storedTruthy(rawAccess?.life_member) ||
    storedTruthy(rawAccess?.lifeMember) ||
    tier === 'life' ||
    tier === 'lifetime';
  const pro =
    life ||
    storedTruthy(data?.pro_unlocked) ||
    storedTruthy(data?.proUnlocked) ||
    storedTruthy(data?.pro) ||
    storedTruthy(access?.pro_unlocked) ||
    storedTruthy(access?.proUnlocked) ||
    storedTruthy(raw?.pro_unlocked) ||
    storedTruthy(raw?.proUnlocked) ||
    storedTruthy(rawAccess?.pro_unlocked) ||
    storedTruthy(rawAccess?.proUnlocked) ||
    tier === 'pro' ||
    tier === 'premium' ||
    tier === 'paid' ||
    subscriptionStatus === 'active' ||
    subscriptionStatus === 'trialing';
  return { pro, life };
}

/** Capacitor Android: re-read Pro/Lifetime from localStorage and show or hide the native banner. */
function notifyNativeAdsSync() {
  try {
    if (typeof window !== 'undefined' && window.RootRecordAds?.sync) {
      window.RootRecordAds.sync();
    }
  } catch {
    /* ignore */
  }
}

function ensureGuestId() {
  let g = safeLocalStorage.getItem(STORAGE_KEYS.guest);
  if (!g) {
    g = 'g_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    safeLocalStorage.setItem(STORAGE_KEYS.guest, g);
  }
  return g;
}

function authHeaders() {
  const token = safeLocalStorage.getItem(STORAGE_KEYS.token);
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

const client = axios.create({ baseURL: API, timeout: 30000 });
attachAxiosNetworkResilience(client, { maxRetries: 3 });
// Do not assign `cfg.headers = { ...spread }` — axios 1.x uses AxiosHeaders; spreading drops adapter state.
client.interceptors.request.use((cfg) => {
  const auth = authHeaders();
  if (auth.Authorization) cfg.headers.Authorization = auth.Authorization;
  if (!isNativeAndroid()) cfg.withCredentials = true;
  return cfg;
});

// Auto-clear stale local session when the server rejects our Bearer. The Worker returns
// this exact detail string ONLY from resolveUserId() when a Bearer was present but failed
// to validate (signature mismatch, missing/revoked license_sessions row). Sign-in failures
// return different detail strings ("Incorrect email or password."), so login isn't disrupted.
// Without this, a single bad token in localStorage 401s every authed request forever and
// the user has to manually sign out + back in to recover.
client.interceptors.response.use(
  (r) => r,
  (e) => {
    if (
      e?.response?.status === 401 &&
      e?.response?.data?.detail === 'Invalid or expired session.'
    ) {
      try { session.clearSession(); } catch { /* ignore */ }
    }
    return Promise.reject(e);
  }
);

/**
 * SQLite / JSON sometimes yields numeric lat/lon as strings. Coerce so UI `.toFixed` never throws
 * (uncaught render errors → blank WebView).
 */
export function normalizeLocationRow(row) {
  if (!row || typeof row !== 'object') return null;
  const id = row.id != null ? String(row.id) : '';
  const name = String(row.name ?? '').trim();
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { ...row, id, name, latitude: lat, longitude: lon };
}

export function getCachedLocations() {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEYS.locationsCache);
    const data = JSON.parse(raw || '[]');
    if (!Array.isArray(data)) return [];
    return data.map(normalizeLocationRow).filter(Boolean);
  } catch {
    return [];
  }
}

function setCachedLocations(rows) {
  try {
    const safe = (Array.isArray(rows) ? rows : []).map(normalizeLocationRow).filter(Boolean);
    safeLocalStorage.setItem(STORAGE_KEYS.locationsCache, JSON.stringify(safe));
  } catch {
    /* quota / private mode */
  }
}

export const session = {
  getToken: () => safeLocalStorage.getItem(STORAGE_KEYS.token),
  getEmail: () => safeLocalStorage.getItem(STORAGE_KEYS.email) || '',
  isAuthed: () => Boolean(safeLocalStorage.getItem(STORAGE_KEYS.token)),
  isGuest: () => !safeLocalStorage.getItem(STORAGE_KEYS.token),
  isPro: () => storedTruthy(safeLocalStorage.getItem(STORAGE_KEYS.pro)),
  isLifeMember: () => storedTruthy(safeLocalStorage.getItem(STORAGE_KEYS.life)),
  getProCheckedAtMs: () => {
    const raw = safeLocalStorage.getItem(STORAGE_KEYS.proCheckedAt);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  },
  setSession: (token, email, pro, lifeMember) => {
    const nextLife = storedTruthy(lifeMember);
    const nextPro = nextLife || storedTruthy(pro);
    safeLocalStorage.setItem(STORAGE_KEYS.token, token || '');
    safeLocalStorage.setItem(STORAGE_KEYS.email, email || '');
    safeLocalStorage.setItem(STORAGE_KEYS.pro, nextPro ? '1' : '0');
    safeLocalStorage.setItem(STORAGE_KEYS.life, nextLife ? '1' : '0');
    // If this user isn't lifetime, treat sign-in as a tier check.
    if (!nextLife) safeLocalStorage.setItem(STORAGE_KEYS.proCheckedAt, String(Date.now()));
    try { window.dispatchEvent(new Event(ACCESS_EVENT)); } catch { /* ignore */ }
    notifyNativeAdsSync();
  },
  setAccess: (pro, lifeMember) => {
    const nextLife = storedTruthy(lifeMember);
    const nextPro = nextLife || storedTruthy(pro);
    safeLocalStorage.setItem(STORAGE_KEYS.pro, nextPro ? '1' : '0');
    safeLocalStorage.setItem(STORAGE_KEYS.life, nextLife ? '1' : '0');
    if (!nextLife) safeLocalStorage.setItem(STORAGE_KEYS.proCheckedAt, String(Date.now()));
    try { window.dispatchEvent(new Event(ACCESS_EVENT)); } catch { /* ignore */ }
    notifyNativeAdsSync();
  },
  clearSession: () => {
    safeLocalStorage.removeItem(STORAGE_KEYS.token);
    safeLocalStorage.removeItem(STORAGE_KEYS.email);
    safeLocalStorage.removeItem(STORAGE_KEYS.pro);
    safeLocalStorage.removeItem(STORAGE_KEYS.life);
    safeLocalStorage.removeItem(STORAGE_KEYS.proCheckedAt);
    try { window.dispatchEvent(new Event(ACCESS_EVENT)); } catch { /* ignore */ }
    notifyNativeAdsSync();
  },
  guestId: ensureGuestId,
  STORAGE_KEYS,
  ACCESS_EVENT,
};

/** Server min supported semver + Play Store link (sign-in screen). */
export function getMobileVersionPolicy() {
  return client.get('/mobile/version-policy', { params: { app_id: RR_APP_ID } });
}

/** Recent developer notes (Settings). */
export function listDeveloperMessages() {
  return client.get('/mobile/developer-messages', { params: { app_id: RR_APP_ID } });
}

/** After signing in on another `*.rootrecord.info` app, `/auth/me` + HttpOnly cookie can hydrate this origin's localStorage. */
export async function tryHydrateSessionFromCookie() {
  if (isNativeAndroid()) return false;
  if (session.isAuthed()) return true;
  try {
    const { data } = await client.post('/auth/me');
    const tok = data.access_token || data.token;
    if (!tok || !data.email) return false;
    const access = accessFromPayload(data);
    session.setSession(tok, data.email, access.pro, access.life);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  health: () => client.get('/health'),
  // auth — device_id matches desktop licenseService (Worker forwards to POST /v1/auth/*).
  login: (email, password) =>
    client.post('/auth/login', { email, password, device_id: session.guestId() }),
  signup: (email, password) =>
    client.post('/auth/signup', { email, password, device_id: session.guestId() }),
  me: () => client.post('/auth/me'),
  // prefs
  getPrefs: () => client.get('/me/prefs'),
  setPrefs: (body) => client.post('/me/prefs', body),
  // locations
  listLocations: async () => {
    const res = await client.get('/locations');
    const raw = Array.isArray(res?.data) ? res.data : [];
    const rows = raw.map(normalizeLocationRow).filter(Boolean);
    setCachedLocations(rows);
    return { ...res, data: rows };
  },
  createLocation: async (loc) => {
    const res = await client.post('/locations', loc);
    const normalized = res?.data ? normalizeLocationRow(res.data) : null;
    if (normalized) {
      const next = [...getCachedLocations().filter((r) => r?.id !== normalized.id), normalized];
      setCachedLocations(next);
    }
    return normalized ? { ...res, data: normalized } : res;
  },
  updateLocation: (id, patch) => client.patch(`/locations/${id}`, patch),
  deleteLocation: async (id) => {
    const res = await client.delete(`/locations/${id}`);
    setCachedLocations(getCachedLocations().filter((r) => r?.id !== id));
    return res;
  },
  /** Latest device GPS for this account (app open); not a named saved location. */
  reportDeviceLocation: (body) => client.post('/me/device-location', body),
  registerPushToken: (body) => client.post('/me/push-token', body),
  // weather
  current: (lat, lon) => client.get('/weather/current', { params: { lat, lon } }),
  forecast: (lat, lon) => client.get('/weather/forecast', { params: { lat, lon } }),
  alerts: (lat, lon) => client.get('/weather/alerts', { params: { lat, lon } }),
  airQuality: (lat, lon) => client.get('/weather/air-quality', { params: { lat, lon } }),
  canada: (lat, lon) => client.get('/canada/alerts', { params: { lat, lon } }),
  dashboard: (lat, lon, opts = {}) =>
    client.get('/dashboard', {
      params: {
        lat,
        lon,
        ...(opts.locationId ? { location_id: opts.locationId } : {}),
        ...(opts.forceRefresh ? { refresh: true } : {}),
      },
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    }),
  getLocationAi: (locationId) =>
    client.get('/weather/location-ai', { params: { location_id: locationId } }),
  refreshLocationAi: (locationId) =>
    client.post('/weather/location-ai', { location_id: locationId }),
  // hazards
  earthquakes: (lat, lon, opts = {}) =>
    client.get('/usgs/earthquakes', {
      params: { lat, lon, period: opts.period || 'day', min_magnitude: opts.min ?? 2.5, radius_miles: opts.radius ?? 2000 },
    }),
  tsunamis: () => client.get('/usgs/tsunamis'),
  cyclones: () => client.get('/eonet/cyclones'),
  wildfires: () => client.get('/eonet/wildfires'),
  /** In-app feedback → primary Worker → Discord (Bearer required). */
  sendFeedback: (body) => client.post('/feedback', body),
};

export default client;
