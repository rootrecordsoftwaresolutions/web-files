import { useEffect, useMemo, useState } from "react";
import { formatRu } from "../game/format";
import { fetchRootsTransactions, type RootsTransactionsResponse, type RootsTransaction } from "../lib/transactionsApi";
import { AccountBalanceHud } from "./AccountBalanceHud";

function formatSol(lamports: number): string {
  return `${(Math.max(0, Math.floor(lamports)) / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Unknown time";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function sourceLabel(tx: RootsTransaction): string {
  if (tx.source === "swap") return "Swap";
  if (tx.source === "deposit") return "Deposit";
  if (tx.source === "market") return "Market";
  if (tx.source === "onchain") return "On-chain";
  return "Ledger";
}

export function TransactionsScreen() {
  const [data, setData] = useState<RootsTransactionsResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      setData(await fetchRootsTransactions(100));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const maxDayRoots = useMemo(() => {
    if (!data?.ok) return 0;
    return Math.max(1, ...data.by_day.map((d) => d.roots_in_atomic + d.roots_out_atomic));
  }, [data]);

  if (data && !data.ok) {
    return (
      <div className="screen transactions-screen">
        <AccountBalanceHud />
        <header className="screen-header">
          <h1>Chart / Transactions</h1>
          <p className="screen-lead">Could not load transactions: {data.detail}</p>
        </header>
        <button type="button" className="btn btn-primary" onClick={() => void load()} disabled={busy}>
          Retry
        </button>
      </div>
    );
  }

  const txs = data?.ok ? data.transactions : [];
  const totals = data?.ok ? data.totals : null;

  return (
    <div className="screen transactions-screen">
      <AccountBalanceHud />
      <header className="screen-header transactions-header">
        <div>
          <h1>Chart / Transactions</h1>
          <p className="screen-lead">
            Swaps, ROOTS deposits, market results, and custodial on-chain activity tied to your account.
            {data?.ok && data.visible_after_label ? ` Showing records from ${data.visible_after_label} forward.` : ""}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={busy}>
          {busy ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="transaction-stat-grid">
        <div>
          <span>ROOTS in</span>
          <strong>{formatRu(totals?.roots_in_atomic ?? 0)}</strong>
        </div>
        <div>
          <span>ROOTS out</span>
          <strong>{formatRu(totals?.roots_out_atomic ?? 0)}</strong>
        </div>
        <div>
          <span>SOL to treasury</span>
          <strong>{formatSol(totals?.sol_in_lamports ?? 0)}</strong>
        </div>
        <div>
          <span>Swaps / deposits</span>
          <strong>{(totals?.swap_count ?? 0).toLocaleString()} / {(totals?.deposit_count ?? 0).toLocaleString()}</strong>
        </div>
        <div>
          <span>Market / on-chain</span>
          <strong>{(totals?.market_count ?? 0).toLocaleString()} / {(totals?.onchain_count ?? 0).toLocaleString()}</strong>
        </div>
      </div>

      <section className="transaction-chart-card">
        <div className="section-head tier-section-head">
          <span>Recent Activity Chart</span>
          <span>By day</span>
        </div>
        {data?.ok && data.by_day.length ? (
          <div className="transaction-chart" aria-label="Daily transaction chart">
            {data.by_day.slice(-14).map((day) => {
              const rootsTotal = day.roots_in_atomic + day.roots_out_atomic;
              const pct = Math.max(4, Math.round((rootsTotal / maxDayRoots) * 100));
              return (
                <div key={day.day} className="transaction-chart-row">
                  <span>{day.day.slice(5)}</span>
                  <div className="transaction-chart-track">
                    <div className="transaction-chart-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <strong>{formatRu(rootsTotal)}</strong>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="market-note">No transaction chart data yet.</p>
        )}
      </section>

      <section className="transaction-list-card">
        <div className="section-head tier-section-head">
          <span>Transactions</span>
          <span>{txs.length.toLocaleString()} shown</span>
        </div>
        {txs.length ? (
          <div className="transaction-list">
            {txs.map((tx) => (
              <article key={`${tx.source}:${tx.id}`} className={`transaction-row transaction-row--${tx.source}`}>
                <div>
                  <div className="transaction-row-title">
                    <strong>{tx.title}</strong>
                    <span>{sourceLabel(tx)}</span>
                  </div>
                  <p>{tx.detail || tx.kind}</p>
                  <small>{formatWhen(tx.created_at)} · {tx.status}</small>
                </div>
                <div className="transaction-row-values">
                  <strong className={tx.direction === "out" ? "is-out" : ""}>
                    {tx.direction === "out" ? "-" : "+"}
                    {formatRu(tx.roots_atomic)}
                  </strong>
                  {tx.sol_lamports > 0 ? <span>{formatSol(tx.sol_lamports)}</span> : null}
                  {tx.tx_signature ? (
                    <a href={`${data?.ok ? data.explorer_tx_base : "https://solscan.io/tx/"}${tx.tx_signature}`} target="_blank" rel="noreferrer">
                      Solscan
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="market-note">No swaps or transactions recorded yet.</p>
        )}
      </section>
    </div>
  );
}
