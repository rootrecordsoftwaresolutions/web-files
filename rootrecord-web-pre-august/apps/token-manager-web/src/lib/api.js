import axios from "axios";

function normalizeBase(raw) {
  let b = String(raw ?? "").trim().replace(/\/+$/, "");
  if (!b) return "";
  if (b.toLowerCase().endsWith("/api")) b = b.slice(0, -4).replace(/\/+$/, "");
  return b;
}

const BACKEND = normalizeBase(process.env.REACT_APP_BACKEND_URL);
const API_BASE = `${BACKEND}/api`;

export const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

export function isBackendConfigured() {
  return Boolean(BACKEND);
}

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (typeof d === "string" && d) return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" · ");
  if (err?.code === "ECONNABORTED") return "Request timed out. Check your connection.";
  return err?.message || "Something went wrong.";
}

export function connectWallet(pubkey, deviceId) {
  return api.post("/wallets/connect", { pubkey, device_id: deviceId });
}

export function getPreferences(pubkey) {
  return api.get(`/wallets/${pubkey}/preferences`);
}

export function patchPreferences(pubkey, body) {
  return api.patch(`/wallets/${pubkey}/preferences`, body);
}

export function listContacts(pubkey) {
  return api.get(`/wallets/${pubkey}/contacts`);
}

export function createContact(pubkey, body) {
  return api.post(`/wallets/${pubkey}/contacts`, body);
}

export function deleteContact(pubkey, id) {
  return api.delete(`/wallets/${pubkey}/contacts/${id}`);
}

export function getSolPrice(vs = "usd") {
  return api.get("/price/sol", { params: { vs } });
}

export function getNetworkEndpoints() {
  return api.get("/network/endpoints");
}

export function backendHealth() {
  return api.get("/health");
}
