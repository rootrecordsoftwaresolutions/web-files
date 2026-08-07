import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ROOT_CLUSTER_COUNT, rootClusterName, rootClusterRange } from "../game/catalog";
import { formatRu } from "../game/format";
import type { FarmsStoreData } from "../game/storeCatalog";
import type { MembershipBonus, MembershipBonusTree, OrchardAppBonus } from "../lib/farmsApi";
import { fetchRootsMintStatus, quoteSolToRoots, swapSolToRoots, type RootsMintStatus, type RootsSolSwapQuote } from "../lib/rootsMintApi";
import { AccountBalanceHud } from "./AccountBalanceHud";

type Props = {
  orchardAppBonus: OrchardAppBonus | null;
  membershipBonus: MembershipBonus | null;
  store: FarmsStoreData;
  rootLevel: number;
};

const ROOTS_MINT_ADDRESS = "8hwxLN1Q4Yr8xFErErULCqNvcF1cMwGjpRXPz6DAH7gM";
const BILLING_URL = "https://rootrecord.info/billing.html";

const APP_TREE_DETAILS: Record<string, { source: string; inactive: string }> = {
  volcano: {
    source: "Kilauea Alerts session",
    inactive: "Open Kilauea Alerts to activate this 24h bonus.",
  },
  business: {
    source: "Business Manager session",
    inactive: "Open Business Manager to activate this 24h bonus.",
  },
  weather: {
    source: "Weather Manager session",
    inactive: "Open Weather Manager to activate this 24h bonus.",
  },
};

function formatExpires(lastOpenAt: string | null): string | null {
  if (!lastOpenAt) return null;
  const lastOpenMs = Date.parse(lastOpenAt);
  if (!Number.isFinite(lastOpenMs) || lastOpenMs <= 0) return null;
  return new Date(lastOpenMs + 24 * 60 * 60 * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TreeSprite({ active }: { active: boolean }) {
  return (
    <span className={`plot-tree${active ? " plot-tree--active" : ""}`} aria-hidden>
      <span className="plot-tree-canopy plot-tree-canopy--a" />
      <span className="plot-tree-canopy plot-tree-canopy--b" />
      <span className="plot-tree-canopy plot-tree-canopy--c" />
      <span className="plot-tree-trunk" />
      <span className="plot-tree-soil" />
    </span>
  );
}

function defaultMemberTrees(): MembershipBonusTree[] {
  return [
    {
      key: "monthly_member",
      name: "Monthly Member Tree",
      active: false,
      bonus_pct: 10,
      blurb: "Active monthly members grow a +10% income tree.",
    },
    {
      key: "lifetime_member",
      name: "Lifetime Tree",
      active: false,
      bonus_pct: 25,
      blurb: "Lifetime members grow a permanent +25% income tree.",
    },
  ];
}

export function OrchardsScreen({ orchardAppBonus, membershipBonus, store, rootLevel }: Props) {
  const appTrees = orchardAppBonus?.trees ?? [];
  const memberTrees = membershipBonus?.trees?.length ? membershipBonus.trees : defaultMemberTrees();
  const clusterIds = Array.from({ length: ROOT_CLUSTER_COUNT }, (_, i) => i + 1).filter(
    (clusterId) => store.root_clusters?.[clusterId - 1] === true,
  );
  const activeAppCount = orchardAppBonus?.active_count ?? 0;
  const memberBonusPct = membershipBonus?.bonus_pct ?? 0;
  const clusterBonusPct = clusterIds.length * 5;
  const appBonusPct = activeAppCount * 10;
  const totalBonusPct = appBonusPct + clusterBonusPct + memberBonusPct;
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [treasuryStatus, setTreasuryStatus] = useState<RootsMintStatus | null>(null);
  const [treasuryNote, setTreasuryNote] = useState("");
  const [treasuryBusy, setTreasuryBusy] = useState(false);
  const [treasuryQr, setTreasuryQr] = useState("");
  const [treasuryCopyNote, setTreasuryCopyNote] = useState("");
  const [swapSolAmount, setSwapSolAmount] = useState("0.01");
  const [swapQuote, setSwapQuote] = useState<RootsSolSwapQuote | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapNote, setSwapNote] = useState("");

  const treasuryWallet = treasuryStatus?.custodial_wallet || "";

  useEffect(() => {
    let cancelled = false;
    setTreasuryQr("");
    if (!treasuryWallet) return;
    QRCode.toDataURL(treasuryWallet, {
      margin: 1,
      width: 196,
      color: {
        dark: "#06130d",
        light: "#f2fff4",
      },
    })
      .then((url) => {
        if (!cancelled) setTreasuryQr(url);
      })
      .catch(() => {
        if (!cancelled) setTreasuryQr("");
      });
    return () => {
      cancelled = true;
    };
  }, [treasuryWallet]);

  const openTreasuryTree = async () => {
    setTreasuryOpen((open) => !open);
    if (treasuryStatus || treasuryBusy) return;
    setTreasuryBusy(true);
    setTreasuryNote("");
    try {
      const status = await fetchRootsMintStatus();
      if (status.ok) {
        setTreasuryStatus(status);
      } else {
        setTreasuryNote(status.detail);
      }
    } finally {
      setTreasuryBusy(false);
    }
  };

  const copyTreasuryWallet = async () => {
    if (!treasuryWallet) return;
    try {
      await navigator.clipboard.writeText(treasuryWallet);
      setTreasuryCopyNote("Copied wallet address.");
    } catch {
      setTreasuryCopyNote("Copy failed. Long-press the address to copy it.");
    }
  };

  const quoteSwap = async () => {
    const amount = Number(swapSolAmount);
    setSwapBusy(true);
    setSwapNote("");
    try {
      const quote = await quoteSolToRoots(amount);
      setSwapQuote(quote);
      if (!quote.ok) setSwapNote(quote.detail);
    } finally {
      setSwapBusy(false);
    }
  };

  const buyInternalRoots = async () => {
    const amount = Number(swapSolAmount);
    setSwapBusy(true);
    setSwapNote("");
    try {
      const result = await swapSolToRoots(amount);
      if (!result.ok) {
        setSwapNote(result.detail);
        return;
      }
      const status = await fetchRootsMintStatus();
      if (status.ok) setTreasuryStatus(status);
      setSwapQuote(null);
      setSwapNote(
        result.internal_credit_status === "credited"
          ? "Purchase complete. SOL moved to treasury and ROOTS were credited internally."
          : "Swap confirmed. Internal credit is pending and the deposit processor will retry automatically.",
      );
    } finally {
      setSwapBusy(false);
    }
  };

  return (
    <div className="screen">
      <AccountBalanceHud />
      <header className="screen-header">
        <h1>Orchards</h1>
        <p className="screen-lead">
          App trees activate automatically for 24 hours after one signed-in session in the matching app.
          Purchased Root Cluster Trees move here, and member-only trees add monthly or lifetime income perks.
        </p>
      </header>

      <div className="tier-stat-strip" aria-label="Orchard totals">
        <div className="tier-stat-pill">
          <span className="tier-stat-k">Active app</span>
          <span className="tier-stat-v">
            {activeAppCount}<small>/{appTrees.length || 3}</small>
          </span>
        </div>
        <div className="tier-stat-pill">
          <span className="tier-stat-k">Cluster trees</span>
          <span className="tier-stat-v">{clusterIds.length}</span>
        </div>
        <div className="tier-stat-pill">
          <span className="tier-stat-k">Member tree</span>
          <span className="tier-stat-v">+{memberBonusPct}%</span>
        </div>
        <div className="tier-stat-pill tier-stat-pill--accent">
          <span className="tier-stat-k">Total bonus</span>
          <span className="tier-stat-v">+{totalBonusPct}%</span>
        </div>
      </div>

      <div className="section-head tier-section-head">
        <span>Treasury Tree</span>
        <span>No income perk · cannot be damaged</span>
      </div>
      <article className="plot-card plot-card--grid accent-green orchard-tree-card orchard-tree-card--treasury">
        <button type="button" className="treasury-tree-button" onClick={() => void openTreasuryTree()} aria-expanded={treasuryOpen}>
          <TreeSprite active />
          <div className="plot-card-top">
            <div className="plot-card-main">
              <span className="plot-name">
                Treasury Tree
                <span className="plot-dot" aria-label="available" />
              </span>
              <span className="plot-sub plot-sub--sci">Custodial wallet gateway</span>
              <span className="plot-sub">Stores and views your internal ROOTS, on-chain ROOTS, and SOL deposit wallet.</span>
            </div>
            <span className="plot-yield">
              0%
              <small>perk</small>
            </span>
          </div>
        </button>
        {treasuryOpen ? (
          <div className="treasury-tree-detail">
            {treasuryWallet ? (
              <div className="treasury-deposit-card">
                <div className="treasury-qr-card">
                  {treasuryQr ? (
                    <img src={treasuryQr} alt="Custodial wallet QR code" />
                  ) : (
                    <span className="treasury-qr-placeholder">QR loading</span>
                  )}
                </div>
                <div className="treasury-deposit-copy">
                  <span className="treasury-label">Public deposit address</span>
                  <strong className="treasury-public-address">{treasuryWallet}</strong>
                  <p>Send SOL for actions or ROOTS deposits to this custodial wallet.</p>
                  <div className="treasury-address-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => void copyTreasuryWallet()}>
                      Copy address
                    </button>
                    <a className="btn btn-ghost" href={`https://solscan.io/account/${treasuryWallet}`} target="_blank" rel="noreferrer">
                      Open Solscan
                    </a>
                  </div>
                  {treasuryCopyNote ? <small>{treasuryCopyNote}</small> : null}
                </div>
              </div>
            ) : null}
            <div className="treasury-wallet-grid">
              <div>
                <span className="treasury-label">Custodial wallet</span>
                <strong className="treasury-address">{treasuryWallet || (treasuryBusy ? "Loading..." : "Unavailable")}</strong>
                <small>Deposit SOL here to perform future on-chain actions.</small>
              </div>
              <div>
                <span className="treasury-label">Internal ROOTS</span>
                <strong>{treasuryStatus ? formatRu(treasuryStatus.internal_balance_atomic) : "..."}</strong>
              </div>
              <div>
                <span className="treasury-label">On-chain ROOTS</span>
                <strong>{treasuryStatus ? formatRu(treasuryStatus.custodial_roots_atomic) : "..."}</strong>
                <small>Mint: {ROOTS_MINT_ADDRESS}</small>
              </div>
              <div>
                <span className="treasury-label">SOL for actions</span>
                <strong>
                  {treasuryStatus
                    ? `${(treasuryStatus.custodial_sol_lamports / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL`
                    : "..."}
                </strong>
              </div>
            </div>
            <div className={`treasury-mint-card${rootLevel >= 30 ? "" : " treasury-mint-card--locked"}`}>
              <div>
                <h2>Mint card</h2>
                <p>
                  Minting unlocks at farm level 30 and will require a mint license held in this custodial wallet once the
                  Solana license flow is plugged in.
                </p>
              </div>
              <span className="market-lock-badge">{rootLevel >= 30 ? "License required" : `Level ${rootLevel}/30`}</span>
            </div>
            <div className="treasury-swap-card">
              <div>
                <h2>Buy internal ROOTS with SOL</h2>
                <p>
                  Uses the internal rate: 100 ROOTS = $5. SOL moves to treasury and ROOTS are credited internally.
                </p>
              </div>
              <label className="treasury-swap-input">
                <span>SOL amount</span>
                <input
                  type="number"
                  min="0.00001"
                  step="0.001"
                  value={swapSolAmount}
                  onChange={(e) => {
                    setSwapSolAmount(e.target.value);
                    setSwapQuote(null);
                    setSwapNote("");
                  }}
                />
              </label>
              {swapQuote?.ok ? (
                <p className="market-note">
                  Quote: about {formatRu(swapQuote.out_roots_atomic)} internal ROOTS at {swapQuote.rate_label || "100 ROOTS per $5"}.
                </p>
              ) : null}
              <div className="treasury-address-actions">
                <button type="button" className="btn btn-ghost" disabled={swapBusy || !treasuryWallet} onClick={() => void quoteSwap()}>
                  {swapBusy ? "Checking..." : "Get quote"}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={swapBusy || !treasuryWallet || !swapQuote?.ok}
                  onClick={() => void buyInternalRoots()}
                >
                  Buy ROOTS
                </button>
              </div>
              {swapNote ? <p className="market-note market-note--warn">{swapNote}</p> : null}
            </div>
            {treasuryNote ? <p className="market-note market-note--warn">{treasuryNote}</p> : null}
          </div>
        ) : null}
      </article>

      <div className="section-head tier-section-head">
        <span>Member-only Trees</span>
        <span>Monthly +10% · Lifetime +25%</span>
      </div>
      <div className="plots-grid orchard-tree-grid">
        {memberTrees.map((tree) => (
          <article
            key={tree.key}
            className={`plot-card plot-card--grid accent-green orchard-tree-card orchard-tree-card--member${tree.active ? "" : " orchard-tree-card--inactive"}`}
          >
            <TreeSprite active={tree.active} />
            <div className="plot-card-top">
              <div className="plot-card-main">
                <span className="plot-name">
                  {tree.name}
                  {tree.active ? <span className="plot-dot" aria-label="active" /> : null}
                </span>
                <span className="plot-sub plot-sub--sci">Member-only orchard perk</span>
                <span className="plot-sub">
                  {tree.active ? "Active membership tree bonus is growing now." : tree.blurb}
                </span>
              </div>
              <span className="plot-yield">
                +{tree.bonus_pct}%
                <small>income</small>
              </span>
            </div>
            {tree.active ? (
              <p className="plot-bonus">Member-only income boost active</p>
            ) : (
              <p className="plot-bonus is-muted">
                Member perk locked. <a href={BILLING_URL}>Become a member</a> to grow this tree.
              </p>
            )}
          </article>
        ))}
      </div>

      <div className="section-head tier-section-head">
        <span>App bonus trees ({appTrees.length})</span>
        <span>{activeAppCount} active</span>
      </div>
      <div className="plots-grid orchard-tree-grid">
        {appTrees.map((tree) => {
          const details = APP_TREE_DETAILS[tree.key] ?? {
            source: "App session",
            inactive: "Open the matching app to activate this 24h bonus.",
          };
          const expires = formatExpires(tree.last_open_at);
          return (
            <article
              key={tree.key || tree.id}
              className={`plot-card plot-card--grid accent-green orchard-tree-card${tree.active ? "" : " orchard-tree-card--inactive"}`}
            >
              <TreeSprite active={tree.active} />
              <div className="plot-card-top">
                <div className="plot-card-main">
                  <span className="plot-name">
                    {tree.name}
                    {tree.active ? <span className="plot-dot" aria-label="active" /> : null}
                  </span>
                  <span className="plot-sub plot-sub--sci">{details.source}</span>
                  <span className="plot-sub">
                    {tree.active
                      ? `Active now${expires ? ` · expires ${expires}` : ""}`
                      : details.inactive}
                  </span>
                </div>
                <span className="plot-yield">
                  +10%
                  <small>income</small>
                </span>
              </div>
              <p className={`plot-bonus${tree.active ? "" : " is-muted"}`}>
                {tree.active ? "24h bonus income rate active" : "No purchase needed"}
              </p>
            </article>
          );
        })}
      </div>

      <div className="section-head tier-section-head">
        <span>Root Cluster Trees ({clusterIds.length})</span>
        <span>+{clusterBonusPct}% income</span>
      </div>
      {clusterIds.length > 0 ? (
        <div className="plots-grid orchard-tree-grid">
          {clusterIds.map((clusterId) => {
            const range = rootClusterRange(clusterId);
            return (
              <article key={clusterId} className="plot-card plot-card--grid plot-card--cluster accent-green orchard-tree-card">
                <TreeSprite active />
                <div className="plot-card-top">
                  <div className="plot-card-main">
                    <span className="plot-name">
                      {rootClusterName(clusterId)}
                      <span className="plot-dot" aria-label="clustered" />
                    </span>
                    <span className="plot-sub plot-sub--sci">
                      Root plots {range.start}-{range.end}
                    </span>
                    <span className="plot-sub">Purchased cluster tree</span>
                  </div>
                  <span className="plot-yield">
                    +5%
                    <small>income</small>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <article className="plot-card orchard-empty-card">
          <span className="orchard-empty-emoji" aria-hidden>🌳</span>
          <div>
            <p className="orchard-empty-title">Plant your first orchard</p>
            <p className="plot-sub">
              Complete a 10-plot root section from the Roots tab, then cluster it to move that Root Cluster Tree here.
            </p>
          </div>
        </article>
      )}
    </div>
  );
}
