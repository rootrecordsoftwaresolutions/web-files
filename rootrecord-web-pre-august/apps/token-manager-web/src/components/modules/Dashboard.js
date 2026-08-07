import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, Eye, Coins, Image as ImageIcon, ChevronRight,
} from "lucide-react";
import { useWallet } from "../../contexts/WalletContext";
import PageHeader from "../ui/PageHeader";
import NetworkPill from "../ui/NetworkPill";
import AddressCopy from "../ui/AddressCopy";
import { fetchSolBalance, fetchTokenAccounts } from "../../lib/solana";
import { getSolPrice } from "../../lib/api";
import { formatSol, formatTokenAmount, formatUsd, lamportsToSol } from "../../lib/format";
import { useToast } from "../ui/Toast";

export default function Dashboard() {
  const nav = useNavigate();
  const toast = useToast();
  const { pubkey, mode, network, connection } = useWallet();
  const [solLamports, setSolLamports] = useState(0);
  const [tokens, setTokens] = useState([]);
  const [priceUsd, setPriceUsd] = useState(null);
  const [change24h, setChange24h] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("tokens"); // 'tokens' | 'nfts'

  const load = useCallback(async () => {
    if (!pubkey) return;
    setLoading(true);
    try {
      const [lamports, ta, priceResp] = await Promise.allSettled([
        fetchSolBalance(connection, pubkey),
        fetchTokenAccounts(connection, pubkey),
        getSolPrice("usd"),
      ]);
      if (lamports.status === "fulfilled") setSolLamports(lamports.value);
      if (ta.status === "fulfilled") setTokens(ta.value || []);
      if (priceResp.status === "fulfilled") {
        setPriceUsd(priceResp.value?.data?.price ?? null);
        setChange24h(priceResp.value?.data?.change_24h_pct ?? null);
      }
    } catch (e) {
      toast.error("Failed to refresh wallet data.");
    } finally {
      setLoading(false);
    }
  }, [pubkey, connection, toast]);

  useEffect(() => { load(); }, [load]);

  const solUi = lamportsToSol(solLamports);
  const solUsd = priceUsd != null ? solUi * priceUsd : null;
  const { nfts, fungibles } = useMemo(() => {
    const n = tokens.filter((t) => t.isNft);
    const f = tokens.filter((t) => !t.isNft && t.uiAmount > 0);
    return { nfts: n, fungibles: f };
  }, [tokens]);

  return (
    <div className="page-shell" data-testid="dashboard-screen">
      <PageHeader
        title="RootRecord"
        subtitle="Token Manager"
        right={
          <>
            <NetworkPill network={network} />
            <button
              className="p-2 rounded-lg hover:bg-white/5 text-ink-secondary"
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              data-testid="refresh-btn"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </>
        }
      />

      <div className="px-4 pt-4">
        <div className="card p-5 relative overflow-hidden" data-testid="balance-card">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-phos/10 blur-3xl" />
          <div className="absolute -left-10 -bottom-14 w-48 h-48 rounded-full bg-magenta/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="label mb-0">Total balance</span>
              {mode === "watch" && (
                <span className="chip" data-testid="watch-badge">
                  <Eye size={12} /> WATCHING
                </span>
              )}
            </div>
            <div className="mt-2 font-heading text-[38px] leading-none font-bold tracking-tight"
                 data-testid="sol-balance-value">
              <span className="mono text-ink-primary">{formatSol(solLamports, 4)}</span>
              <span className="text-ink-secondary text-2xl ml-2">SOL</span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm">
              {solUsd != null ? (
                <span className="text-ink-secondary mono" data-testid="sol-balance-usd">
                  ≈ {formatUsd(solUsd)}
                </span>
              ) : (
                <span className="text-ink-tertiary text-xs">USD price unavailable</span>
              )}
              {change24h != null && (
                <span
                  className={`mono text-xs px-2 py-0.5 rounded-full border ${
                    change24h >= 0
                      ? "text-phos border-phos/30 bg-phos/5"
                      : "text-rose border-rose/30 bg-rose/5"
                  }`}
                  data-testid="sol-price-change"
                >
                  {change24h >= 0 ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}% 24h
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <AddressCopy address={pubkey} testid="dashboard-address" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                className="btn btn-primary"
                onClick={() => nav("/send")}
                data-testid="dashboard-send-btn"
              >
                <ArrowUpRight size={16} />
                Send
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => nav("/receive")}
                data-testid="dashboard-receive-btn"
              >
                <ArrowDownLeft size={16} />
                Receive
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="inline-flex bg-bg-elevated/60 border border-white/5 rounded-xl p-1">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold mono tracking-widest uppercase transition-colors ${
              tab === "tokens" ? "bg-bg-raised text-ink-primary" : "text-ink-tertiary"
            }`}
            onClick={() => setTab("tokens")}
            data-testid="tab-tokens"
          >
            <Coins size={14} className="inline mr-1.5 -mt-0.5" /> Tokens
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold mono tracking-widest uppercase transition-colors ${
              tab === "nfts" ? "bg-bg-raised text-ink-primary" : "text-ink-tertiary"
            }`}
            onClick={() => setTab("nfts")}
            data-testid="tab-nfts"
          >
            <ImageIcon size={14} className="inline mr-1.5 -mt-0.5" /> NFTs
          </button>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-2" data-testid="assets-list">
        {tab === "tokens" ? (
          fungibles.length === 0 && solLamports === 0 && !loading ? (
            <EmptyState
              title="No assets on this network"
              body="Try switching to Devnet in Settings, or fund this address."
            />
          ) : (
            fungibles.map((t) => (
              <div key={t.accountPubkey} className="card p-3 flex items-center gap-3" data-testid={`token-row-${t.mint}`}>
                <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-white/10 flex items-center justify-center mono text-ink-secondary text-[10px]">
                  SPL
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mono text-xs text-ink-secondary truncate">{t.mint}</div>
                  <div className="text-[11px] text-ink-tertiary">
                    decimals {t.decimals} · {t.programId.slice(0, 4)}…
                  </div>
                </div>
                <div className="mono text-ink-primary font-semibold">
                  {formatTokenAmount(t.uiAmount)}
                </div>
                <ChevronRight size={16} className="text-ink-tertiary" />
              </div>
            ))
          )
        ) : (
          nfts.length === 0 ? (
            <EmptyState
              title="No NFTs here"
              body="NFTs in this wallet will appear as a grid once minted / received."
            />
          ) : (
            <div className="grid grid-cols-3 gap-2" data-testid="nfts-grid">
              {nfts.map((n) => (
                <div
                  key={n.accountPubkey}
                  className="aspect-square rounded-xl border border-white/10 bg-bg-elevated flex items-center justify-center mono text-[10px] text-ink-tertiary p-2 text-center"
                  data-testid={`nft-tile-${n.mint}`}
                  title={n.mint}
                >
                  {n.mint.slice(0, 4)}…{n.mint.slice(-4)}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="card p-6 text-center" data-testid="empty-state">
      <div className="font-heading text-base text-ink-primary font-semibold">{title}</div>
      <div className="text-sm text-ink-secondary mt-1">{body}</div>
    </div>
  );
}
