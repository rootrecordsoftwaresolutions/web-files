/**
 * Smoke-test Gen 2 API after deploy.
 * Usage: node scripts/test-g2-api.mjs [--api https://api2.rootmc.net]
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiBase = (process.argv.find((a) => a.startsWith("--api=")) || "--api=https://api2.rootmc.net")
  .split("=")[1]
  .replace(/\/$/, "");

const cloudPath = resolve(__dirname, "../../../gen2-27/plugins/RootMC/cloud.yml");
const cloud = readFileSync(cloudPath, "utf8");
const serverId = cloud.match(/server-id:\s*"?([^"\n#]+)"?/)?.[1]?.trim();
const serverSecret = cloud.match(/server-secret:\s*"?([^"\n#]+)"?/)?.[1]?.trim();

if (!serverId || !serverSecret) {
  console.error("Missing server-id/server-secret in", cloudPath);
  console.error("Run: powershell -File deploy.ps1 from Web Files/rootmc-api-g2");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-RootStat-Server-Id": serverId,
  "X-RootStat-Server-Secret": serverSecret,
};

async function req(method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const health = await fetch(`${apiBase}/api/v2/health`).then((r) => r.json());
console.log("health", health);

const hb = await req("POST", "/api/v2/realm/heartbeat");
console.log("heartbeat", hb.status, hb.json);

const snap = await req("POST", "/api/v2/realm/snapshot/economy?force=1", {
  updated_at_ms: Date.now(),
  online_count: 0,
  treasury_g: 1000,
  balances: [["00000000-0000-0000-0000-000000000001", 42.5, "TestPlayer"]],
});
console.log("economy", snap.status, snap.json);

const status = await req("GET", "/api/v2/realm/status");
console.log("status", status.status, status.json);

if (hb.status >= 400 || snap.status >= 400) {
  process.exit(1);
}
console.log("G2 API smoke test OK");
