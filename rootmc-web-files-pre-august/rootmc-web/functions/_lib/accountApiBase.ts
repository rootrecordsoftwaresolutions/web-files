/** Default account API (auth, billing). */
export const DEFAULT_ROOTRECORD_API_ACCOUNT_BASE = "https://rootrecord-api-account.rootrecord.workers.dev";

/** RootMC realm API — production on RootMC Cloudflare account. */
export const DEFAULT_ROOTMC_API_BASE = "https://api.rootmc.net";

export function isAccountShardApiTail(tail: string): boolean {
  const t = tail.replace(/^\/+/, "");
  if (t === "auth" || t.startsWith("auth/")) return true;
  if (t === "earn" || t.startsWith("earn/")) return true;
  if (t === "app-session" || t.startsWith("app-session/")) return true;
  return false;
}

export function isRootMcShardApiTail(tail: string): boolean {
  const t = tail.replace(/^\/+/, "");
  if (t === "blocknotes" || t.startsWith("blocknotes/")) return true;
  if (t === "realm/minecraft" || t.startsWith("realm/minecraft/")) return true;
  if (t.startsWith("rootmc/")) return true;
  if (t === "sync" || t.startsWith("sync/")) return true;
  if (t === "governance" || t.startsWith("governance/")) return true;
  if (t === "public/player" || t.startsWith("public/player/")) return true;
  return false;
}

export function rewriteLegacyBlocknotesApiTail(tail: string): string {
  const t = tail.replace(/^\/+/, "");
  if (t === "blocknotes") return "rootmc";
  if (t.startsWith("blocknotes/")) return `rootmc/${t.slice("blocknotes/".length)}`;
  return tail;
}

export function rootmcApiBaseFromEnv(env: {
  ROOTMC_API_BASE?: string;
  /** @deprecated use ROOTMC_API_BASE */
  ROOTRECORD_API_BLOCKNOTES_BASE?: string;
}): string {
  let b = String(env.ROOTMC_API_BASE || env.ROOTRECORD_API_BLOCKNOTES_BASE || "")
    .trim()
    .replace(/\/+$/, "");
  if (!b) return DEFAULT_ROOTMC_API_BASE;
  if (!/^https?:\/\//i.test(b)) b = `https://${b}`;
  try {
    const u = new URL(b);
    if (u.protocol !== "http:" && u.protocol !== "https:") return DEFAULT_ROOTMC_API_BASE;
    return u.origin;
  } catch {
    return DEFAULT_ROOTMC_API_BASE;
  }
}

export function accountApiBaseFromEnv(env: { ROOTRECORD_API_ACCOUNT_BASE?: string }): string {
  let a = String(env.ROOTRECORD_API_ACCOUNT_BASE || "")
    .trim()
    .replace(/\/+$/, "");
  if (!a) return DEFAULT_ROOTRECORD_API_ACCOUNT_BASE;
  if (!/^https?:\/\//i.test(a)) a = `https://${a}`;
  try {
    const u = new URL(a);
    if (u.protocol !== "http:" && u.protocol !== "https:") return DEFAULT_ROOTRECORD_API_ACCOUNT_BASE;
    return u.origin;
  } catch {
    return DEFAULT_ROOTRECORD_API_ACCOUNT_BASE;
  }
}
