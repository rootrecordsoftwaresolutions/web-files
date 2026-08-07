import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import NetworkPill from "../ui/NetworkPill";
import { useWallet } from "../../contexts/WalletContext";
import { fetchRecentSignatures } from "../../lib/solana";
import { shortAddr, timeAgo } from "../../lib/format";
import { CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";

export default function History() {
  const { pubkey, connection, network } = useWallet();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetchRecentSignatures(connection, pubkey, 20);
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setErr(e?.message || "Failed to fetch activity.");
    } finally { setLoading(false); }
  }, [pubkey, connection]);

  useEffect(() => { load(); }, [load]);

  const explorerUrl = (sig) => {
    const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
    return `https://explorer.solana.com/tx/${sig}${cluster}`;
  };

  return (
    <div className="page-shell" data-testid="history-screen">
      <PageHeader
        title="Activity"
        subtitle={`Last ${items.length || 20} signatures`}
        right={
          <>
            <NetworkPill network={network} />
            <button
              className="p-2 rounded-lg hover:bg-white/5 text-ink-secondary"
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              data-testid="history-refresh-btn"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </>
        }
      />
      <div className="px-4 pt-4 space-y-2" data-testid="history-list">
        {err && (
          <div className="card p-3 text-sm text-rose border border-rose/30 bg-rose/5" data-testid="history-error">{err}</div>
        )}
        {!err && items.length === 0 && !loading && (
          <div className="card p-6 text-center" data-testid="history-empty">
            <div className="font-heading text-base text-ink-primary font-semibold">No activity yet</div>
            <div className="text-sm text-ink-secondary mt-1">Transactions involving this address will show up here.</div>
          </div>
        )}
        {items.map((it) => {
          const ok = !it.err;
          return (
            <a
              key={it.signature}
              href={explorerUrl(it.signature)}
              target="_blank"
              rel="noreferrer"
              className="card p-3 flex items-center gap-3 hover:border-white/10 transition-colors"
              data-testid={`history-item-${it.signature}`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  ok ? "bg-phos/15 text-phos border border-phos/30" : "bg-rose/15 text-rose border border-rose/30"
                }`}
              >
                {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="mono text-sm text-ink-primary truncate">{shortAddr(it.signature, 8, 8)}</div>
                <div className="text-[11px] text-ink-tertiary">
                  slot {it.slot} · {timeAgo(it.blockTime)} · {ok ? "confirmed" : "failed"}
                </div>
              </div>
              <ExternalLink size={16} className="text-ink-tertiary" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
