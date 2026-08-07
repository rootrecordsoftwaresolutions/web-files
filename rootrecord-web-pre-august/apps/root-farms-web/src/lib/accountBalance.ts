import { fetchEarnSummary } from "./api";

/** Same ledger as account hub / Discord / all Root Record apps (`rr_earn_balance`). */
export const ACCOUNT_ROOT_UNITS_EVENT = "rr:account-root-units";

const STORAGE_KEY = "rr.account_root_units";
const CACHE_VER_KEY = "rr.account_root_units_schema";
/** Bump when cache format / balance semantics change (v2 = ledger-only, never lifetime farms). */
const CACHE_SCHEMA = 2;
const BALANCE_MIGRATION_KEY = "rr.account_balance_ledger_v2";

type BalancePayload = { balance: number; at: number };

/** One-time: drop pre-v2 cache that could show lifetime farms total as spendable balance. */
export function ensureAccountBalanceCacheMigrated(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(BALANCE_MIGRATION_KEY) === "1") return;
    clearAccountBalanceCache();
    localStorage.setItem(BALANCE_MIGRATION_KEY, "1");
  } catch {
    /* */
  }
}

export function clearAccountBalanceCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CACHE_VER_KEY);
  } catch {
    /* */
  }
}

export function publishAccountBalance(balance: number): void {
  const n = Math.max(0, Math.floor(balance));
  if (typeof window === "undefined") return;
  try {
    const payload: BalancePayload = { balance: n, at: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(CACHE_VER_KEY, String(CACHE_SCHEMA));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new CustomEvent(ACCOUNT_ROOT_UNITS_EVENT, { detail: { balance: n } }));
}

export function readCachedAccountBalance(): number | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem(CACHE_VER_KEY) !== String(CACHE_SCHEMA)) return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BalancePayload;
    if (typeof parsed?.balance !== "number") return null;
    return Math.max(0, Math.floor(parsed.balance));
  } catch {
    return null;
  }
}

/** Spendable Root Units from D1 (`rr_earn_balance`) — same field as rootrecord.info/account. */
export async function fetchAccountRootUnits(): Promise<number | null> {
  const summary = await fetchEarnSummary();
  if (!summary) return null;
  publishAccountBalance(summary.ledger_balance);
  return summary.ledger_balance;
}

export function subscribeAccountBalance(onBalance: (balance: number) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ balance?: number }>).detail;
    if (detail?.balance != null) onBalance(Math.max(0, Math.floor(detail.balance)));
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    if (localStorage.getItem(CACHE_VER_KEY) !== String(CACHE_SCHEMA)) return;
    try {
      const parsed = JSON.parse(e.newValue) as BalancePayload;
      if (typeof parsed?.balance === "number") onBalance(Math.max(0, Math.floor(parsed.balance)));
    } catch {
      /* ignore */
    }
  };

  window.addEventListener(ACCOUNT_ROOT_UNITS_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ACCOUNT_ROOT_UNITS_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
