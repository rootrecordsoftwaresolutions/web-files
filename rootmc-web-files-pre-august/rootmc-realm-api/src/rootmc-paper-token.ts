import type { D1Database } from "@cloudflare/workers-types";

import { json } from "./cors";
import { resolveServerId } from "./rootmc-daily-report";

export type PaperTokenEnv = {
  DB: D1Database;
  ROOTMC_PAPER_TOKEN_MINT?: string;
  ROOTMC_PAPER_REFERENCE_PRICE_USD?: string;
  ROOTMC_PAPER_REFERENCE_G_PER_UNIT?: string;
  ROOTMC_PAPER_TRADE_FEE_PERCENT?: string;
  HELIUS_API_KEY?: string;
};

const DEFAULT_MINT = "Evy78vHFifT3tdR2vCMUeMLMyFS9ex8wHHi8uKYApump";

function nowIso(): string {
  return new Date().toISOString();
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function paperTokenMint(env: PaperTokenEnv): string {
  return str(env.ROOTMC_PAPER_TOKEN_MINT) || DEFAULT_MINT;
}

export function paperReferencePriceUsd(env: PaperTokenEnv): number {
  return Math.max(1e-18, num(env.ROOTMC_PAPER_REFERENCE_PRICE_USD, 0.00001));
}

export function paperReferenceGPerUnit(env: PaperTokenEnv): number {
  return Math.max(0.0001, num(env.ROOTMC_PAPER_REFERENCE_G_PER_UNIT, 1));
}

export function paperTradeFeePercent(env: PaperTokenEnv): number {
  return Math.max(0, Math.min(25, num(env.ROOTMC_PAPER_TRADE_FEE_PERCENT, 0.5)));
}

export function computeGPerUnit(
  priceUsd: number,
  referencePriceUsd: number,
  referenceGPerUnit: number,
): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return referenceGPerUnit;
  if (!Number.isFinite(referencePriceUsd) || referencePriceUsd <= 0) return referenceGPerUnit;
  const g = referenceGPerUnit * (priceUsd / referencePriceUsd);
  return Math.round(g * 1_000_000) / 1_000_000;
}

type PriceFetch = { priceUsd: number; source: string };

async function fetchJupiterPriceUsd(mint: string): Promise<PriceFetch | null> {
  const url = `https://api.jup.ag/price/v2?ids=${encodeURIComponent(mint)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: Record<string, { price?: number }> };
  const row = body.data?.[mint];
  const price = Number(row?.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return { priceUsd: price, source: "jupiter" };
}

async function fetchDexScreenerPriceUsd(mint: string): Promise<PriceFetch | null> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const body = (await res.json()) as { pairs?: Array<{ priceUsd?: string }> };
  const pairs = body.pairs || [];
  for (const pair of pairs) {
    const price = Number(pair.priceUsd);
    if (Number.isFinite(price) && price > 0) {
      return { priceUsd: price, source: "dexscreener" };
    }
  }
  return null;
}

/** Optional Helius validation ping — price still from Jupiter/DexScreener. */
async function heliusAvailable(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "rootmc-paper", method: "getHealth" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLivePaperTokenPrice(env: PaperTokenEnv): Promise<PriceFetch | null> {
  const mint = paperTokenMint(env);
  const jup = await fetchJupiterPriceUsd(mint);
  if (jup) {
    const helius = str(env.HELIUS_API_KEY);
    if (helius && (await heliusAvailable(helius))) {
      return { priceUsd: jup.priceUsd, source: "jupiter+helius" };
    }
    return jup;
  }
  return fetchDexScreenerPriceUsd(mint);
}

export async function refreshPaperTokenPrice(env: PaperTokenEnv, serverId?: string): Promise<boolean> {
  const sid = serverId || (await resolveServerId(env.DB));
  const mint = paperTokenMint(env);
  const live = await fetchLivePaperTokenPrice(env);
  if (!live) {
    console.warn("rootmc_paper_token_price_fetch_failed", mint);
    return false;
  }

  const refUsd = paperReferencePriceUsd(env);
  const refG = paperReferenceGPerUnit(env);
  const gPerUnit = computeGPerUnit(live.priceUsd, refUsd, refG);
  const ts = nowIso();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO rootmc_paper_token_price
         (server_id, mint, price_usd, g_per_unit, source, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(server_id, mint) DO UPDATE SET
         price_usd = excluded.price_usd,
         g_per_unit = excluded.g_per_unit,
         source = excluded.source,
         fetched_at = excluded.fetched_at`,
    ).bind(sid, mint, live.priceUsd, gPerUnit, live.source, ts),
    env.DB.prepare(
      `INSERT INTO rootmc_paper_token_price_history
         (server_id, mint, price_usd, g_per_unit, source, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(sid, mint, live.priceUsd, gPerUnit, live.source, ts),
  ]);

  return true;
}

export async function loadPaperTokenQuote(env: PaperTokenEnv, serverId?: string) {
  const sid = serverId || (await resolveServerId(env.DB));
  const mint = paperTokenMint(env);
  const row = await env.DB.prepare(
    `SELECT price_usd, g_per_unit, source, fetched_at
     FROM rootmc_paper_token_price
     WHERE server_id = ? AND mint = ?
     LIMIT 1`,
  )
    .bind(sid, mint)
    .first<{
      price_usd: number;
      g_per_unit: number;
      source: string;
      fetched_at: string;
    }>();

  const refUsd = paperReferencePriceUsd(env);
  const refG = paperReferenceGPerUnit(env);
  const fee = paperTradeFeePercent(env);

  if (!row) {
    return {
      ok: false as const,
      mint,
      detail: "Price not cached yet. Wait for the next market sync.",
    };
  }

  return {
    ok: true as const,
    mint,
    display_name: "Paper ROOTMC",
    disclaimer: "Simulated units — not on-chain $ROOTMC. G is debited/credited; no wallet required.",
    price_usd: row.price_usd,
    g_per_unit: row.g_per_unit,
    reference_price_usd: refUsd,
    reference_g_per_unit: refG,
    trade_fee_percent: fee,
    source: row.source,
    fetched_at: row.fetched_at,
  };
}

export async function handlePaperTokenRoutes(
  request: Request,
  env: PaperTokenEnv,
  subpath: string,
  method: string,
): Promise<Response | null> {
  if (!subpath.startsWith("/rootmc/paper-token")) return null;

  if (method === "GET" && subpath === "/rootmc/paper-token/quote") {
    const quote = await loadPaperTokenQuote(env);
    if (!quote.ok) {
      await refreshPaperTokenPrice(env).catch(() => {});
      const retry = await loadPaperTokenQuote(env);
      if (!retry.ok) return json(retry, 503);
      return json(retry);
    }
    return json(quote);
  }

  if (method === "GET" && subpath === "/rootmc/paper-token/history") {
    const url = new URL(request.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 96));
    const sid = await resolveServerId(env.DB);
    const mint = paperTokenMint(env);
    const { results } = await env.DB.prepare(
      `SELECT price_usd, g_per_unit, source, recorded_at
       FROM rootmc_paper_token_price_history
       WHERE server_id = ? AND mint = ?
       ORDER BY recorded_at DESC
       LIMIT ?`,
    )
      .bind(sid, mint, limit)
      .all<Record<string, unknown>>();
    return json({ ok: true, mint, points: (results || []).reverse() });
  }

  return null;
}

export async function runPaperTokenPriceCron(env: PaperTokenEnv): Promise<void> {
  const ok = await refreshPaperTokenPrice(env);
  if (!ok) {
    console.warn("rootmc_paper_token_cron_no_price");
  }
}
