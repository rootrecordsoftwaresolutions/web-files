import { apiFetch } from "./api";

export type RootsMintStatus = {
  ok: true;
  roots_mint: string;
  internal_balance_atomic: number;
  custodial_roots_atomic: number;
  custodial_wallet: string;
  custodial_sol_lamports: number;
  minimum_sol_lamports: number;
  can_mint: boolean;
  rpc_refreshed?: boolean;
};

const ROOTS_MINT_ADDRESS = "8hwxLN1Q4Yr8xFErErULCqNvcF1cMwGjpRXPz6DAH7gM";
const MINIMUM_SOL_LAMPORTS = 10_000_000;

export type RootsMintResult =
  | {
      ok: true;
      request_id: string;
      amount_atomic: number;
      destination_owner: string;
      custodial_fee_payer: string;
      tx_signature: string;
      explorer: string;
      new_balance: number;
    }
  | {
      ok: false;
      detail: string;
      request_id?: string;
      pending?: boolean;
      tx_signature?: string;
      explorer?: string;
      new_balance?: number;
    };

export type RootsSolSwapQuote =
  | {
      ok: true;
      input_lamports: number;
      out_roots_atomic: number;
      out_roots_raw: string;
      price_impact_pct: string;
      slippage_bps: number;
      route_plan_count: number;
      custodial_wallet?: string;
      sol_usd_price?: number;
      rate_label?: string;
    }
  | { ok: false; detail: string };

export type RootsSolSwapResult =
  | {
      ok: true;
      swap_id: string;
      tx_signature: string;
      explorer: string;
      input_lamports: number;
      quoted_roots_atomic: number;
      internal_credit_status: "credited" | "pending";
      execution_mode?: string;
    }
  | { ok: false; detail: string; swap_id?: string; tx_signature?: string };

function detailFromData(data: Record<string, unknown>, fallback: string): string {
  return typeof data.detail === "string" && data.detail.trim() ? data.detail : fallback;
}

async function fetchRootsMintStatusFallback(): Promise<RootsMintStatus | { ok: false; detail: string }> {
  try {
    const walletRes = await apiFetch("/api/v1/me/custodial-sol-wallet", { method: "POST" });
    const walletData = (await walletRes.json().catch(() => ({}))) as Record<string, unknown>;
    const wallet = String(walletData.public_key || "");
    if (!walletRes.ok || !wallet) {
      return { ok: false, detail: detailFromData(walletData, "Could not load your custodial wallet.") };
    }

    const summaryRes = await apiFetch("/api/earn/summary?app_id=root_farms&custodial_refresh=0", { method: "GET" });
    const summary = (await summaryRes.json().catch(() => ({}))) as Record<string, unknown>;
    const internalBalance = Math.max(
      0,
      Math.floor(Number(summary.ledger_balance ?? summary.root_units_balance ?? summary.balance ?? 0) || 0),
    );

    return {
      ok: true,
      roots_mint: ROOTS_MINT_ADDRESS,
      internal_balance_atomic: internalBalance,
      custodial_roots_atomic: 0,
      custodial_wallet: wallet,
      custodial_sol_lamports: 0,
      minimum_sol_lamports: MINIMUM_SOL_LAMPORTS,
      can_mint: false,
      rpc_refreshed: false,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach the Minting Machine." };
  }
}

export async function fetchRootsMintStatus(): Promise<RootsMintStatus | { ok: false; detail: string }> {
  try {
    const res = await apiFetch("/api/v1/me/roots/mint-balance", { method: "GET", headers: { Accept: "application/json" } });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok !== true) return { ok: false, detail: detailFromData(data, "Could not load Minting Machine status.") };
    return {
      ok: true,
      roots_mint: String(data.roots_mint || ""),
      internal_balance_atomic: Math.max(0, Math.floor(Number(data.internal_balance_atomic) || 0)),
      custodial_roots_atomic: Math.max(0, Math.floor(Number(data.custodial_roots_atomic) || 0)),
      custodial_wallet: String(data.custodial_wallet || ""),
      custodial_sol_lamports: Math.max(0, Math.floor(Number(data.custodial_sol_lamports) || 0)),
      minimum_sol_lamports: Math.max(0, Math.floor(Number(data.minimum_sol_lamports) || 0)),
      can_mint: data.can_mint === true,
      rpc_refreshed: data.rpc_refreshed === true,
    };
  } catch (e) {
    return fetchRootsMintStatusFallback();
  }
}

export async function mintFullRootsBalance(destinationPubkey?: string): Promise<RootsMintResult> {
  try {
    const res = await apiFetch("/api/v1/me/roots/mint-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ destination_pubkey: destinationPubkey?.trim() || null }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok !== true) {
      return {
        ok: false,
        detail: detailFromData(data, `Mint request failed (${res.status}).`),
        request_id: typeof data.request_id === "string" ? data.request_id : undefined,
        pending: data.pending === true,
        tx_signature: typeof data.tx_signature === "string" ? data.tx_signature : undefined,
        explorer: typeof data.explorer === "string" ? data.explorer : undefined,
        new_balance: data.new_balance != null ? Math.max(0, Math.floor(Number(data.new_balance) || 0)) : undefined,
      };
    }
    return {
      ok: true,
      request_id: String(data.request_id || ""),
      amount_atomic: Math.max(0, Math.floor(Number(data.amount_atomic) || 0)),
      destination_owner: String(data.destination_owner || ""),
      custodial_fee_payer: String(data.custodial_fee_payer || ""),
      tx_signature: String(data.tx_signature || ""),
      explorer: String(data.explorer || ""),
      new_balance: Math.max(0, Math.floor(Number(data.new_balance) || 0)),
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach the Minting Machine." };
  }
}

export async function quoteSolToRoots(amountSol: number, slippageBps = 100): Promise<RootsSolSwapQuote> {
  try {
    const res = await apiFetch("/api/v1/me/roots/swap-sol-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ amount_sol: amountSol, slippage_bps: slippageBps }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok !== true) return { ok: false, detail: detailFromData(data, `Quote failed (${res.status}).`) };
    return {
      ok: true,
      input_lamports: Math.max(0, Math.floor(Number(data.input_lamports) || 0)),
      out_roots_atomic: Math.max(0, Math.floor(Number(data.out_roots_atomic) || 0)),
      out_roots_raw: String(data.out_roots_raw || "0"),
      price_impact_pct: String(data.price_impact_pct ?? "0"),
      slippage_bps: Math.max(0, Math.floor(Number(data.slippage_bps) || slippageBps)),
      route_plan_count: Math.max(0, Math.floor(Number(data.route_plan_count) || 0)),
      custodial_wallet: typeof data.custodial_wallet === "string" ? data.custodial_wallet : undefined,
      sol_usd_price: data.sol_usd_price != null ? Math.max(0, Number(data.sol_usd_price) || 0) : undefined,
      rate_label: typeof data.rate_label === "string" ? data.rate_label : undefined,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach swap quote service." };
  }
}

export async function swapSolToRoots(amountSol: number, slippageBps = 100): Promise<RootsSolSwapResult> {
  try {
    const res = await apiFetch("/api/v1/me/roots/swap-sol", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ amount_sol: amountSol, slippage_bps: slippageBps }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok !== true) {
      return {
        ok: false,
        detail: detailFromData(data, `Swap failed (${res.status}).`),
        swap_id: typeof data.swap_id === "string" ? data.swap_id : undefined,
        tx_signature: typeof data.tx_signature === "string" ? data.tx_signature : undefined,
      };
    }
    return {
      ok: true,
      swap_id: String(data.swap_id || ""),
      tx_signature: String(data.tx_signature || ""),
      explorer: String(data.explorer || ""),
      input_lamports: Math.max(0, Math.floor(Number(data.input_lamports) || 0)),
      quoted_roots_atomic: Math.max(0, Math.floor(Number(data.quoted_roots_atomic) || 0)),
      internal_credit_status: data.internal_credit_status === "credited" ? "credited" : "pending",
      execution_mode: typeof data.execution_mode === "string" ? data.execution_mode : undefined,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach swap service." };
  }
}
