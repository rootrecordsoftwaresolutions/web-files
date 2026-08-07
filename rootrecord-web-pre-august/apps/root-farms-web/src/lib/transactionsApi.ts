import { apiFetch } from "./api";

export type RootsTransaction = {
  id: string;
  source: "swap" | "deposit" | "ledger" | "market" | "onchain";
  kind: string;
  direction: "in" | "out";
  status: string;
  roots_atomic: number;
  sol_lamports: number;
  tx_signature: string | null;
  title: string;
  detail: string;
  created_at: string;
};

export type RootsTransactionsResponse =
  | {
      ok: true;
      transactions: RootsTransaction[];
      totals: {
        roots_in_atomic: number;
        roots_out_atomic: number;
        sol_in_lamports: number;
        swap_count: number;
        deposit_count: number;
        market_count: number;
        onchain_count: number;
      };
      by_day: Array<{
        day: string;
        roots_in_atomic: number;
        roots_out_atomic: number;
        sol_lamports: number;
        count: number;
      }>;
      explorer_tx_base: string;
      visible_after_iso?: string;
      visible_after_label?: string;
    }
  | { ok: false; detail: string };

function detailFromData(data: Record<string, unknown>, fallback: string): string {
  return typeof data.detail === "string" && data.detail.trim() ? data.detail : fallback;
}

function parseTx(raw: Record<string, unknown>): RootsTransaction {
  const source =
    raw.source === "swap" || raw.source === "deposit" || raw.source === "ledger" || raw.source === "market" || raw.source === "onchain"
      ? raw.source
      : "ledger";
  return {
    id: String(raw.id || ""),
    source,
    kind: String(raw.kind || source),
    direction: raw.direction === "out" ? "out" : "in",
    status: String(raw.status || "recorded"),
    roots_atomic: Math.max(0, Math.floor(Number(raw.roots_atomic) || 0)),
    sol_lamports: Math.max(0, Math.floor(Number(raw.sol_lamports) || 0)),
    tx_signature: typeof raw.tx_signature === "string" && raw.tx_signature ? raw.tx_signature : null,
    title: String(raw.title || raw.kind || source),
    detail: String(raw.detail || ""),
    created_at: String(raw.created_at || ""),
  };
}

export async function fetchRootsTransactions(limit = 80): Promise<RootsTransactionsResponse> {
  try {
    const q = new URLSearchParams({ limit: String(Math.max(1, Math.min(200, Math.floor(limit)))) });
    const res = await apiFetch(`/api/v1/me/roots/transactions?${q}`, { method: "GET", headers: { Accept: "application/json" } });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok !== true) return { ok: false, detail: detailFromData(data, `Could not load transactions (${res.status}).`) };
    const totals = (data.totals || {}) as Record<string, unknown>;
    return {
      ok: true,
      transactions: Array.isArray(data.transactions) ? data.transactions.map((r) => parseTx((r || {}) as Record<string, unknown>)) : [],
      totals: {
        roots_in_atomic: Math.max(0, Math.floor(Number(totals.roots_in_atomic) || 0)),
        roots_out_atomic: Math.max(0, Math.floor(Number(totals.roots_out_atomic) || 0)),
        sol_in_lamports: Math.max(0, Math.floor(Number(totals.sol_in_lamports) || 0)),
        swap_count: Math.max(0, Math.floor(Number(totals.swap_count) || 0)),
        deposit_count: Math.max(0, Math.floor(Number(totals.deposit_count) || 0)),
        market_count: Math.max(0, Math.floor(Number(totals.market_count) || 0)),
        onchain_count: Math.max(0, Math.floor(Number(totals.onchain_count) || 0)),
      },
      by_day: Array.isArray(data.by_day)
        ? data.by_day.map((r) => {
            const row = (r || {}) as Record<string, unknown>;
            return {
              day: String(row.day || ""),
              roots_in_atomic: Math.max(0, Math.floor(Number(row.roots_in_atomic) || 0)),
              roots_out_atomic: Math.max(0, Math.floor(Number(row.roots_out_atomic) || 0)),
              sol_lamports: Math.max(0, Math.floor(Number(row.sol_lamports) || 0)),
              count: Math.max(0, Math.floor(Number(row.count) || 0)),
            };
          })
        : [],
      explorer_tx_base: String(data.explorer_tx_base || "https://solscan.io/tx/"),
      visible_after_iso: typeof data.visible_after_iso === "string" ? data.visible_after_iso : undefined,
      visible_after_label: typeof data.visible_after_label === "string" ? data.visible_after_label : undefined,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach transaction service." };
  }
}
