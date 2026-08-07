import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRu } from "../game/format";
import {
  economyEntryLabel,
  fetchEconomyDaily,
  fetchEconomyLeaderboard,
  type EconomyDaily,
  type EconomyLeaderboard,
} from "../lib/economyApi";
import { EconomyCirculationChart } from "./EconomyCirculationChart";

const REFRESH_MS = 30_000;
type EconomySortKey = "balance" | "name" | "farmLevel";

export function RootEconomyScreen({ variant = "web" }: { variant?: "web" | "mobile" }) {
  const [board, setBoard] = useState<EconomyLeaderboard | null>(null);
  const [daily, setDaily] = useState<EconomyDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<EconomySortKey>("balance");

  const load = useCallback(async () => {
    const [boardData, dailyData] = await Promise.all([fetchEconomyLeaderboard(), fetchEconomyDaily(30)]);
    if (!boardData) {
      setError("Could not load Root Economy — try again shortly.");
      setLoading(false);
      return;
    }
    setBoard(boardData);
    setDaily(dailyData);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const updatedLabel =
    board?.updated_at &&
    (() => {
      try {
        return new Date(board.updated_at).toLocaleTimeString(undefined, { timeStyle: "short" });
      } catch {
        return null;
      }
    })();

  const sortedEntries = useMemo(() => {
    const entries = [...(board?.entries ?? [])];
    if (sortKey === "name") {
      entries.sort((a, b) => {
        const byName = economyEntryLabel(a).localeCompare(economyEntryLabel(b), undefined, { sensitivity: "base" });
        return byName || b.balance - a.balance;
      });
    } else if (sortKey === "farmLevel") {
      entries.sort((a, b) => {
        const level = (b.farms_plots_unlocked ?? 0) - (a.farms_plots_unlocked ?? 0);
        return level || b.balance - a.balance || economyEntryLabel(a).localeCompare(economyEntryLabel(b));
      });
    } else {
      entries.sort((a, b) => b.balance - a.balance || economyEntryLabel(a).localeCompare(economyEntryLabel(b)));
    }
    return entries;
  }, [board?.entries, sortKey]);

  return (
    <div className={`screen economy-screen economy-screen--${variant}`}>
      <header className="economy-head">
        <h1>Root Economy</h1>
        <p className="economy-lead">Live Root Units balances for the top 100 accounts on Root Record.</p>
        {board ? (
          <p className="economy-circulation" aria-label="Total Root Units in internal circulation">
            <span className="economy-circulation-label">Internal circulation</span>
            <span className="economy-circulation-value">{formatRu(board.total_circulation ?? 0)}</span>
            <span className="economy-circulation-raw">{(board.total_circulation ?? 0).toLocaleString()} atomic units</span>
          </p>
        ) : null}
        {updatedLabel ? <p className="economy-updated">Updated {updatedLabel}</p> : null}
      </header>

      {daily?.series?.length ? (
        <EconomyCirculationChart series={daily.series} />
      ) : loading ? null : (
        <p className="economy-chart-empty">Circulation chart unavailable right now.</p>
      )}

      {loading && !board ? <p className="economy-status">Loading leaderboard…</p> : null}
      {error ? <p className="economy-status economy-status--err">{error}</p> : null}

      {board && board.entries.length > 0 ? (
        <>
        <div className="economy-sort" aria-label="Sort Root Economy leaderboard">
          <span>Sort by</span>
          <button type="button" className={sortKey === "balance" ? "is-active" : ""} onClick={() => setSortKey("balance")}>
            Balance
          </button>
          <button type="button" className={sortKey === "farmLevel" ? "is-active" : ""} onClick={() => setSortKey("farmLevel")}>
            Farm level
          </button>
          <button type="button" className={sortKey === "name" ? "is-active" : ""} onClick={() => setSortKey("name")}>
            Name
          </button>
        </div>
        <ol className="economy-list" aria-label="Top accounts by Root Units balance">
          {sortedEntries.map((e, index) => {
            const label = economyEntryLabel(e);
            const showWallet = label !== e.wallet_short;
            return (
              <li key={`${e.rank}-${e.wallet_short}`} className="economy-row">
                <span className="economy-rank">{sortKey === "balance" ? e.rank : index + 1}</span>
                <span className="economy-holder">
                  <span className="economy-name">{label}</span>
                  {showWallet ? <span className="economy-wallet">{e.wallet_short}</span> : null}
                  {e.public_display_name && e.discord_username ? (
                    <span className="economy-discord">@{e.discord_username.replace(/^@/, "")}</span>
                  ) : null}
                  {(e.farms_plots_unlocked ?? 0) > 0 || (e.farms_rows_accumulated ?? 0) > 0 ? (
                    <span className="economy-farms">
                      {(e.farms_plots_unlocked ?? 0).toLocaleString()} total plot
                      {(e.farms_plots_unlocked ?? 0) === 1 ? "" : "s"} ·{" "}
                      {(e.farms_rows_accumulated ?? 0).toLocaleString()} total rows
                    </span>
                  ) : null}
                </span>
                <span className="economy-balance">{formatRu(e.balance)}</span>
              </li>
            );
          })}
        </ol>
        </>
      ) : null}

      {board && board.entries.length === 0 && !loading ? (
        <p className="economy-status">No balances yet.</p>
      ) : null}

      <p className="economy-foot">
        Set a public display name on{" "}
        <a href="https://rootrecord.info/account.html" target="_blank" rel="noopener noreferrer">
          rootrecord.info/account
        </a>
        . Discord username appears when your account is linked.
      </p>
    </div>
  );
}
