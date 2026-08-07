/**
 * Canonical paths for RootMC Workspace (post-MonoRepo move).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libDir = path.dirname(fileURLToPath(import.meta.url));

export const PROJECTS_ROOT = "C:\\Users\\store\\Desktop\\Projects";
export const WORKSPACE_ROOT = path.join(PROJECTS_ROOT, "RootMC Workspace");
export const WORKSPACE_ENV = path.join(WORKSPACE_ROOT, ".env");
export const CLOUDFLARE_ROOT = path.join(PROJECTS_ROOT, "cloudflare");
export const MONO_REPO_ROOT = PROJECTS_ROOT;
export const MONO_REPO_CREDENTIALS = path.join(PROJECTS_ROOT, "credentials.env");
export const D1_MIGRATIONS_DIR =
  process.env.ROOTMC_D1_MIGRATIONS_DIR ||
  path.join(CLOUDFLARE_ROOT, "rootrecord-api-account", "migrations");
export const HANDOFF_ROOT = path.join(WORKSPACE_ROOT, "Server Files (Handoff Off)");
export const HANDOFF_PLUGINS_DIR = path.join(HANDOFF_ROOT, "plugins");
export const HANDOFF_CLOUD_YML = path.join(HANDOFF_PLUGINS_DIR, "RootRecord", "cloud.yml");
export const REALM_API_ROOT = path.resolve(libDir, "..", "..");
export const REFERENCE_DIR = path.join(REALM_API_ROOT, "reference");

/** rootmc-realm-api package root (run scripts from here). */
export function realmApiRoot() {
  return REALM_API_ROOT;
}

export function credentialsCandidates() {
  return [
    process.env.CREDENTIALS_ENV,
    WORKSPACE_ENV,
    path.join(WORKSPACE_ROOT, "_local", ".env"),
    MONO_REPO_CREDENTIALS,
    path.join(process.cwd(), "credentials.env"),
    path.join(PROJECTS_ROOT, "credentials.env"),
    path.join(process.cwd(), "../../../../credentials.env"),
  ].filter(Boolean);
}

export function findCredentialsPath() {
  for (const p of credentialsCandidates()) {
    if (fs.existsSync(p)) return p;
  }
  return WORKSPACE_ENV;
}

export function envFileCandidates() {
  return [
    process.env.ROOTMC_ENV_FILE,
    WORKSPACE_ENV,
    path.join(WORKSPACE_ROOT, "_local", ".env"),
    MONO_REPO_CREDENTIALS,
  ].filter(Boolean);
}

export function cloudYmlCandidates() {
  return [
    process.env.ROOTMC_CLOUD_YML,
    HANDOFF_CLOUD_YML,
    path.join(WORKSPACE_ROOT, "Plugin Building", "Minecraft", "server", "plugins", "RootRecord", "cloud.yml"),
    path.join(process.cwd(), "../../Plugin Building/Minecraft/server/plugins/RootRecord/cloud.yml"),
  ].filter(Boolean);
}

export function wranglerTomlPath() {
  for (const p of [
    path.join(process.cwd(), "wrangler.toml"),
    path.join(process.cwd(), "../rootmc-api/wrangler.toml"),
    path.join(WORKSPACE_ROOT, "Web Files", "rootmc-api", "wrangler.toml"),
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(WORKSPACE_ROOT, "Web Files", "rootmc-api", "wrangler.toml");
}

export function readCloudYml() {
  for (const p of cloudYmlCandidates()) {
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const serverId = text.match(/server-id:\s*([0-9a-f-]{36})/i)?.[1] || "";
    const serverSecret = text.match(/server-secret:\s*([0-9a-f]{64})/i)?.[1] || "";
    if (serverId && serverSecret) return { serverId, serverSecret, path: p };
  }
  return null;
}
