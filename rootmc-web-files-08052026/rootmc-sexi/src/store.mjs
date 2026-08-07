import fs from "node:fs";
import path from "node:path";
import { AVA_HANDOFF } from "./config.mjs";

function dataDir() {
  const root = AVA_HANDOFF || path.resolve("D:\\.1 Work Stations\\RootMC\\Server Handoffs\\Ava Ivy");
  const dir = path.join(root, "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(root, "uploads"), { recursive: true });
  fs.mkdirSync(path.join(root, "plans"), { recursive: true });
  return dir;
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

export function storePaths() {
  const dir = dataDir();
  return {
    dir,
    seen: path.join(dir, "seen.json"),
    watermark: path.join(dir, "watermark.json"),
    hush: path.join(dir, "hush.json"),
    lastReply: path.join(dir, "last-reply.json"),
  };
}

export function loadSeen() {
  const raw = readJson(storePaths().seen, { ids: [] });
  return new Set(Array.isArray(raw.ids) ? raw.ids : []);
}

export function saveSeen(seen) {
  const ids = [...seen];
  if (ids.length > 8000) ids.splice(0, ids.length - 6000);
  writeJson(storePaths().seen, { ids, updatedAt: Date.now() });
}

export function loadWatermark() {
  return readJson(storePaths().watermark, { channels: {}, shutdownAt: 0 });
}

export function saveWatermark(wm) {
  writeJson(storePaths().watermark, { ...wm, updatedAt: Date.now() });
}

export function markShutdown(channelLatestMap) {
  const wm = loadWatermark();
  wm.shutdownAt = Date.now();
  wm.channels = { ...(wm.channels || {}), ...channelLatestMap };
  saveWatermark(wm);
}

export function isHushed() {
  const h = readJson(storePaths().hush, { muted: false });
  return Boolean(h.muted);
}

export function setHushed(muted, reason = "") {
  writeJson(storePaths().hush, { muted: Boolean(muted), reason, at: Date.now() });
}

export function lastReplyFor(channelId) {
  const all = readJson(storePaths().lastReply, {});
  return all[channelId] || "";
}

export function setLastReply(channelId, text) {
  const all = readJson(storePaths().lastReply, {});
  all[channelId] = String(text || "").slice(0, 500);
  writeJson(storePaths().lastReply, all);
}

export function nearDuplicate(a, b) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280);
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.includes(y.slice(0, 80)) || y.includes(x.slice(0, 80));
}
